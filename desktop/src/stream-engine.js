'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const MEDIA_EXTENSIONS = new Set([
  '.mp4',
  '.mkv',
  '.avi',
  '.mov',
  '.webm',
  '.m4v',
  '.ts',
  '.wmv',
  '.mpg',
  '.mpeg',
  '.flv',
  '.3gp',
  '.ogv',
  '.mp3',
  '.flac',
  '.aac',
  '.m4a',
  '.opus',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mkv',
  '.avi',
  '.mov',
  '.webm',
  '.m4v',
  '.ts',
  '.wmv',
  '.mpg',
  '.mpeg',
  '.flv',
  '.3gp',
  '.ogv',
]);

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 100 || idx === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

function isMediaFile(fileName) {
  return MEDIA_EXTENSIONS.has(path.extname(fileName || '').toLowerCase());
}

function isVideoFile(fileName) {
  return VIDEO_EXTENSIONS.has(path.extname(fileName || '').toLowerCase());
}

function findVlcExecutable(customPath) {
  const candidates = [];
  if (customPath) candidates.push(customPath);
  if (process.env.VLC_PATH) candidates.push(process.env.VLC_PATH);

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    candidates.push(
      path.join(programFiles, 'VideoLAN', 'VLC', 'vlc.exe'),
      path.join(programFilesX86, 'VideoLAN', 'VLC', 'vlc.exe'),
      path.join(localAppData, 'Programs', 'VideoLAN', 'VLC', 'vlc.exe')
    );
    for (const c of candidates) {
      if (c && fs.existsSync(c)) return c;
    }
    try {
      const out = execFileSync('where', ['vlc'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const first = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
      if (first && fs.existsSync(first)) return first;
    } catch {
      // Not on PATH
    }
    return null;
  }

  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/VLC.app/Contents/MacOS/VLC',
      path.join(os.homedir(), 'Applications', 'VLC.app', 'Contents/MacOS', 'VLC')
    );
  } else {
    candidates.push('/usr/bin/vlc', '/usr/local/bin/vlc', '/snap/bin/vlc');
  }
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  try {
    const out = execFileSync('which', ['vlc'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const first = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (first && fs.existsSync(first)) return first;
  } catch {
    // Not on PATH
  }
  return null;
}

class DesktopStreamManager {
  constructor(onEvent) {
    this.onEvent = typeof onEvent === 'function' ? onEvent : () => {};
    this.session = null;
    this.sessionSeq = 0;
  }

  emit(payload) {
    this.onEvent(payload);
  }

  async stop() {
    const s = this.session;
    this.session = null;
    if (!s) return;

    s.stopped = true;
    if (s.statusTimer) clearInterval(s.statusTimer);
    if (s.pendingFileReject) {
      try {
        s.pendingFileReject(new Error('Stream stopped'));
      } catch {
        // Ignore
      }
    }

    if (s.vlcProc && !s.vlcProc.killed) {
      try {
        s.vlcProc.kill();
      } catch {
        // Ignore if exited
      }
    }

    await new Promise((resolve) => {
      try {
        s.server.destroy(resolve);
      } catch {
        resolve();
      }
    });

    await new Promise((resolve) => {
      try {
        s.client.destroy(resolve);
      } catch {
        resolve();
      }
    });

    if (!s.keepFiles && s.downloadDir) {
      try {
        fs.rmSync(s.downloadDir, { recursive: true, force: true });
      } catch {
        // Ignore transient Windows file lock
      }
    }

    this.emit({ state: 'stopped', sessionId: s.id });
  }

  selectFile(index) {
    const s = this.session;
    if (!s || !s.pendingFileResolve) return false;
    const resolve = s.pendingFileResolve;
    s.pendingFileResolve = null;
    s.pendingFileReject = null;
    resolve(index);
    return true;
  }

  reopenVlc(customPath) {
    const s = this.session;
    if (!s || !s.streamUrl) return { ok: false, error: 'No active stream URL.' };
    const vlcPath = findVlcExecutable(customPath || s.customVlcPath);
    if (!vlcPath) return { ok: false, error: 'VLC executable not found.' };
    this._launchVlc(s, vlcPath);
    return { ok: true, vlcPath };
  }

  _launchVlc(s, vlcPath) {
    if (!vlcPath || !s.streamUrl) return;
    const startedAt = Date.now();
    const child = spawn(vlcPath, [s.streamUrl], { stdio: 'ignore' });
    s.vlcProc = child;

    child.once('error', (err) => {
      if (s.stopped || this.session !== s) return;
      this.emit({
        state: 'streaming',
        sessionId: s.id,
        title: s.title,
        fileName: s.chosenFile?.name,
        fileSize: s.chosenFile?.length || 0,
        streamUrl: s.streamUrl,
        vlcPath,
        warning: `Failed to spawn VLC directly (${err.message}). Open the stream URL manually in VLC.`,
      });
    });

    child.once('close', () => {
      if (s.stopped || this.session !== s) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed > 3000) {
        this.stop();
      } else {
        this.emit({
          state: 'streaming',
          sessionId: s.id,
          title: s.title,
          fileName: s.chosenFile?.name,
          fileSize: s.chosenFile?.length || 0,
          streamUrl: s.streamUrl,
          vlcPath,
          note: 'VLC handed stream to an existing window — keep this stream active while watching.',
        });
      }
    });
  }

  async start({ magnet, title, customVlcPath = null, keepFiles = false }) {
    if (!magnet || !magnet.startsWith('magnet:?')) {
      throw new Error('A valid magnet:? URI is required.');
    }

    await this.stop();

    const sessionId = ++this.sessionSeq;
    const downloadDir = path.join(os.tmpdir(), `m2t-desktop-${Date.now()}`);
    fs.mkdirSync(downloadDir, { recursive: true });

    const { default: WebTorrent } = await import('webtorrent');
    const client = new WebTorrent();
    const server = client.createServer({ hostname: '127.0.0.1', origin: false });
    const vlcPath = findVlcExecutable(customVlcPath);

    const session = {
      id: sessionId,
      title: title || 'Magnet Stream',
      client,
      server,
      downloadDir,
      keepFiles: Boolean(keepFiles),
      customVlcPath,
      vlcPath,
      vlcProc: null,
      chosenFile: null,
      streamUrl: null,
      statusTimer: null,
      pendingFileResolve: null,
      pendingFileReject: null,
      stopped: false,
    };
    this.session = session;

    try {
      this.emit({
        state: 'connecting',
        sessionId,
        title: session.title,
        vlcPath,
        message: 'Connecting to P2P swarm & fetching torrent metadata…',
      });

      const httpServer = server.server;
      await new Promise((resolve, reject) => {
        if (httpServer && typeof httpServer.once === 'function') {
          httpServer.once('error', reject);
        }
        server.listen(0, '127.0.0.1', () => {
          if (httpServer && typeof httpServer.removeListener === 'function') {
            httpServer.removeListener('error', reject);
          }
          resolve();
        });
      });

      if (session.stopped || this.session !== session) return { ok: false, reason: 'stopped' };
      const port = server.address().port;

      const torrent = await new Promise((resolve, reject) => {
        const onClientErr = (err) => reject(err);
        client.once('error', onClientErr);
        const t = client.add(magnet, { path: downloadDir });
        t.on('warning', () => {});
        t.once('error', (err) => {
          client.removeListener('error', onClientErr);
          reject(err);
        });
        t.once('metadata', () => {
          client.removeListener('error', onClientErr);
          resolve(t);
        });
      });

      if (session.stopped || this.session !== session) return { ok: false, reason: 'stopped' };

      const mediaFiles = torrent.files
        .map((file, rawIndex) => ({ file, rawIndex }))
        .filter(({ file }) => isMediaFile(file.name))
        .sort((a, b) => {
          const av = isVideoFile(a.file.name) ? 1 : 0;
          const bv = isVideoFile(b.file.name) ? 1 : 0;
          if (av !== bv) return bv - av;
          return b.file.length - a.file.length;
        });

      if (mediaFiles.length === 0) {
        await this.stop();
        return {
          ok: false,
          reason: 'no_media',
          error: 'No playable video or audio files found inside this torrent.',
        };
      }

      let chosenEntry = mediaFiles[0];
      if (mediaFiles.length > 1) {
        const optionsList = mediaFiles.map((entry, idx) => ({
          index: idx,
          name: entry.file.name,
          path: entry.file.path,
          length: entry.file.length,
          sizeFormatted: formatBytes(entry.file.length),
          isVideo: isVideoFile(entry.file.name),
        }));

        this.emit({
          state: 'selecting',
          sessionId,
          title: torrent.name || session.title,
          files: optionsList,
        });

        const pickedIdx = await new Promise((resolve, reject) => {
          session.pendingFileResolve = resolve;
          session.pendingFileReject = reject;
        });

        if (session.stopped || this.session !== session) return { ok: false, reason: 'stopped' };
        chosenEntry = mediaFiles[pickedIdx] || mediaFiles[0];
      }

      const chosenFile = chosenEntry.file;
      session.chosenFile = chosenFile;

      torrent.files.forEach((f) => f.deselect());
      chosenFile.select();

      const normalizedPath = chosenFile.path.replace(/\\/g, '/');
      const streamUrl = `http://127.0.0.1:${port}/webtorrent/${torrent.infoHash}/${encodeURI(normalizedPath)}`;
      session.streamUrl = streamUrl;

      this.emit({
        state: 'streaming',
        sessionId,
        title: torrent.name || session.title,
        fileName: chosenFile.name,
        fileSize: chosenFile.length,
        fileSizeFormatted: formatBytes(chosenFile.length),
        streamUrl,
        vlcPath,
        downloadSpeed: 0,
        uploadSpeed: 0,
        downloaded: 0,
        progressPct: 0,
        numPeers: torrent.numPeers || 0,
        warning: vlcPath ? undefined : 'VLC executable not detected. Open the local stream URL manually or configure VLC path.',
      });

      if (vlcPath) {
        this._launchVlc(session, vlcPath);
      }

      session.statusTimer = setInterval(() => {
        if (session.stopped || this.session !== session) return;
        const pct = chosenFile.length > 0
          ? Math.min(100, Number(((chosenFile.downloaded / chosenFile.length) * 100).toFixed(1)))
          : 0;
        this.emit({
          state: 'streaming',
          sessionId,
          title: torrent.name || session.title,
          fileName: chosenFile.name,
          fileSize: chosenFile.length,
          fileSizeFormatted: formatBytes(chosenFile.length),
          streamUrl,
          vlcPath,
          downloadSpeed: torrent.downloadSpeed,
          downloadSpeedFormatted: `${formatBytes(torrent.downloadSpeed)}/s`,
          uploadSpeed: torrent.uploadSpeed,
          uploadSpeedFormatted: `${formatBytes(torrent.uploadSpeed)}/s`,
          downloaded: chosenFile.downloaded,
          downloadedFormatted: formatBytes(chosenFile.downloaded),
          progressPct: pct,
          numPeers: torrent.numPeers,
        });
      }, 1000);

      return { ok: true, streamUrl, vlcPath, fileName: chosenFile.name };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Streaming failed';
      await this.stop();
      if (msg === 'Stream stopped') return { ok: false, reason: 'stopped' };
      this.emit({ state: 'error', sessionId, error: msg });
      return { ok: false, reason: 'error', error: msg };
    }
  }
}

module.exports = {
  DesktopStreamManager,
  findVlcExecutable,
  formatBytes,
  isMediaFile,
  isVideoFile,
};
