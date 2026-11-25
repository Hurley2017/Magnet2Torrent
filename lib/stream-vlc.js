'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawn, execFileSync } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');

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
      path.join(os.homedir(), 'Applications', 'VLC.app', 'Contents', 'MacOS', 'VLC')
    );
    for (const c of candidates) {
      if (c && fs.existsSync(c)) return c;
    }
  } else {
    candidates.push('/usr/bin/vlc', '/usr/local/bin/vlc', '/snap/bin/vlc');
    for (const c of candidates) {
      if (c && fs.existsSync(c)) return c;
    }
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

async function pickMediaFile(files) {
  const mediaFiles = files
    .filter((f) => isMediaFile(f.name))
    .sort((a, b) => {
      const aVid = isVideoFile(a.name) ? 1 : 0;
      const bVid = isVideoFile(b.name) ? 1 : 0;
      if (aVid !== bVid) return bVid - aVid;
      return b.length - a.length;
    });

  if (mediaFiles.length === 0) return null;
  if (mediaFiles.length === 1) return mediaFiles[0];

  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: chalk.cyan('Multiple media files found — choose one to stream in VLC:'),
      pageSize: 16,
      choices: mediaFiles.map((file, idx) => ({
        name: `${String(idx + 1).padStart(2)}. ${file.path} (${chalk.cyan(formatBytes(file.length))})`,
        value: file,
        short: file.name,
      })),
    },
  ]);
  return selected;
}

function waitForStreamStop({ torrent, chosenFile, vlcPath, onChildCreated }) {
  return new Promise((resolve) => {
    let settled = false;
    let statusTimer = null;
    let keyCleanup = null;

    const finish = (reason) => {
      if (settled) return;
      settled = true;
      if (statusTimer) clearInterval(statusTimer);
      if (keyCleanup) keyCleanup();
      process.removeListener('SIGINT', onSigint);
      resolve(reason);
    };

    const onSigint = () => finish('sigint');
    process.once('SIGINT', onSigint);

    if (vlcPath) {
      const startedAt = Date.now();
      const child = spawn(vlcPath, [torrent._streamUrl], { stdio: 'ignore' });
      onChildCreated(child);
      console.log(chalk.green(`   Player: ${vlcPath}\n`));

      child.once('error', (err) => {
        console.log(chalk.yellow(`\n⚠  Could not launch VLC directly (${err.message}). Open the URL above in VLC.`));
      });

      child.once('close', (code) => {
        const elapsed = Date.now() - startedAt;
        if (elapsed > 3000) {
          console.log(chalk.gray('\n\nVLC closed — stopping local torrent stream…'));
          finish('vlc_closed');
        } else if (code === 0) {
          console.log(chalk.yellow('\n   VLC handed stream to an existing window — keep this terminal open while watching.'));
        }
      });
    } else {
      console.log(chalk.yellow('   Waiting for manual player connection… Press Q or Ctrl+C to stop.\n'));
    }

    if (process.stdin.isTTY) {
      readline.emitKeypressEvents(process.stdin);
      const wasRaw = Boolean(process.stdin.isRaw);
      if (typeof process.stdin.setRawMode === 'function') {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      const onKeypress = (_str, key) => {
        if (key && ((key.ctrl && key.name === 'c') || key.name === 'q')) {
          finish('keypress');
        }
      };
      process.stdin.on('keypress', onKeypress);
      keyCleanup = () => {
        process.stdin.removeListener('keypress', onKeypress);
        if (typeof process.stdin.setRawMode === 'function') {
          try {
            process.stdin.setRawMode(wasRaw);
          } catch {
            // Ignore
          }
        }
        process.stdin.pause();
      };
    }

    statusTimer = setInterval(() => {
      const pct = chosenFile.length > 0
        ? Math.min(100, (chosenFile.downloaded / chosenFile.length) * 100).toFixed(1)
        : '0.0';
      const line =
        `   ⬇ ${chalk.cyan(formatBytes(torrent.downloadSpeed) + '/s')} | ` +
        `⬆ ${chalk.magenta(formatBytes(torrent.uploadSpeed) + '/s')} | ` +
        `${chalk.green(pct + '%')} (${formatBytes(chosenFile.downloaded)}/${formatBytes(chosenFile.length)}) | ` +
        `Peers: ${chalk.yellow(torrent.numPeers)} | ` +
        chalk.gray(process.stdin.isTTY ? 'Q or Ctrl+C to stop' : 'Ctrl+C to stop');
      process.stdout.write(`\r\x1b[K${line}`);
    }, 1000);
  });
}

/**
 * Downloads torrent pieces sequentially on the user's machine via WebTorrent
 * and exposes an authenticated loopback HTTP range endpoint played by VLC.
 */
async function streamMagnetToVlc(magnet, options = {}) {
  if (!magnet || !magnet.startsWith('magnet:?')) {
    console.log(chalk.red('\n✖  Valid magnet:? link is required for streaming.\n'));
    return { ok: false, reason: 'invalid_magnet' };
  }

  const vlcPath = findVlcExecutable(options.vlcPath);
  if (!vlcPath) {
    console.log(chalk.yellow('\n⚠  VLC Media Player executable was not found automatically.'));
    console.log(chalk.gray('   Streaming will still expose a local URL you can open in any player.'));
    console.log(chalk.gray('   Install VLC cleanly on Windows: ') + chalk.cyan('winget install VideoLAN.VLC\n'));
  }

  const keepFiles = Boolean(options.keep);
  const downloadDir = options.dir
    ? path.resolve(options.dir)
    : path.join(os.tmpdir(), `magnet2torrent-stream-${Date.now()}`);

  fs.mkdirSync(downloadDir, { recursive: true });

  const { default: WebTorrent } = await import('webtorrent');
  const client = new WebTorrent();
  const server = client.createServer({ hostname: '127.0.0.1', origin: false });

  let metaWarnTimer = null;
  let vlcProc = null;
  let cleanedUp = false;

  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;

    if (metaWarnTimer) clearTimeout(metaWarnTimer);

    if (vlcProc && !vlcProc.killed) {
      try {
        vlcProc.kill();
      } catch {
        // Ignore if already exited
      }
    }

    await new Promise((resolve) => {
      try {
        server.destroy(resolve);
      } catch {
        resolve();
      }
    });

    await new Promise((resolve) => {
      try {
        client.destroy(resolve);
      } catch {
        resolve();
      }
    });

    if (!keepFiles && !options.dir) {
      try {
        fs.rmSync(downloadDir, { recursive: true, force: true });
      } catch {
        // Ignore transient Windows file lock on temp cleanup
      }
    }
  };

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const port = server.address().port;

    const spinner = ora(chalk.cyan('Connecting to peers & fetching torrent metadata…')).start();
    metaWarnTimer = setTimeout(() => {
      if (spinner.isSpinning) {
        spinner.text = chalk.yellow('Still searching DHT/trackers for active peers… (Ctrl+C to cancel)');
      }
    }, 15000);

    const torrent = await new Promise((resolve, reject) => {
      const onClientError = (err) => {
        spinner.fail(chalk.red(`Stream client error: ${err.message}`));
        reject(err);
      };
      const onSigint = () => {
        spinner.stop();
        reject(new Error('Cancelled by user'));
      };
      client.once('error', onClientError);
      process.once('SIGINT', onSigint);

      const t = client.add(magnet, { path: downloadDir });
      t.on('warning', () => {});
      t.once('error', (err) => {
        process.removeListener('SIGINT', onSigint);
        client.removeListener('error', onClientError);
        spinner.fail(chalk.red(`Torrent error: ${err.message}`));
        reject(err);
      });
      t.once('metadata', () => {
        process.removeListener('SIGINT', onSigint);
        client.removeListener('error', onClientError);
        resolve(t);
      });
    });

    if (metaWarnTimer) {
      clearTimeout(metaWarnTimer);
      metaWarnTimer = null;
    }
    spinner.succeed(chalk.green(`Metadata loaded: ${torrent.name}`));

    const chosenFile = await pickMediaFile(torrent.files);
    if (!chosenFile) {
      console.log(chalk.yellow('\n⚠  No playable video or audio files found in this torrent.'));
      console.log(chalk.gray('   Files inside torrent:'));
      torrent.files.slice(0, 8).forEach((f) => {
        console.log(chalk.gray(`   - ${f.path} (${formatBytes(f.length)})`));
      });
      console.log('');
      await cleanup();
      return { ok: false, reason: 'no_media' };
    }

    // Prioritize bandwidth strictly on the chosen media file.
    torrent.files.forEach((f) => f.deselect());
    chosenFile.select();

    const normalizedPath = chosenFile.path.replace(/\\/g, '/');
    const streamUrl = `http://127.0.0.1:${port}/webtorrent/${torrent.infoHash}/${encodeURI(normalizedPath)}`;
    torrent._streamUrl = streamUrl;

    console.log(chalk.bold('\n▶  Streaming locally in VLC'));
    console.log(chalk.gray('   File:   ') + chalk.white(chosenFile.name) + chalk.cyan(` (${formatBytes(chosenFile.length)})`));
    console.log(chalk.gray('   URL:    ') + chalk.dim(streamUrl));
    if (keepFiles || options.dir) {
      console.log(chalk.gray('   Saved:  ') + chalk.dim(downloadDir));
    } else {
      console.log(chalk.gray('   Cache:  ') + chalk.dim('Temporary buffer (auto-deleted on stop)'));
    }

    await waitForStreamStop({
      torrent,
      chosenFile,
      vlcPath,
      onChildCreated: (proc) => {
        vlcProc = proc;
      },
    });

    process.stdout.write('\n');
    await cleanup();
    console.log(chalk.green('✔  Stream stopped cleanly.\n'));
    return { ok: true };
  } catch (err) {
    await cleanup();
    if (err.message === 'Cancelled by user') {
      console.log(chalk.yellow('\nStream cancelled.\n'));
      return { ok: false, reason: 'cancelled' };
    }
    throw err;
  }
}

module.exports = {
  findVlcExecutable,
  formatBytes,
  isMediaFile,
  isVideoFile,
  streamMagnetToVlc,
};
