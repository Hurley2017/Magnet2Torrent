'use strict';

const TERMS_KEY = 'm2t_desktop_terms_v1';

const SLEEK_RING_SVG = `
  <svg aria-hidden="true" viewBox="0 0 32 32" width="16" height="16" fill="none">
    <path d="M7.5 10.5V19a8.5 8.5 0 0 0 17 0v-8.5" stroke="#ef4444" stroke-width="5.5" stroke-linecap="butt" />
    <path d="M4.75 3.5h5.5v5h-5.5zM21.75 3.5h5.5v5h-5.5z" fill="#a1a1aa" />
    <path d="M4.75 8.5h5.5v1.6h-5.5zM21.75 8.5h5.5v1.6h-5.5z" fill="#27272a" />
  </svg>
`;

const state = {
  termsAccepted: false,
  providers: [],
  vlcPath: null,
  loading: false,
  searchData: null,
  results: [],
  currentPage: 1,
  pageSize: 7,
  history: [],
  busyItemId: null,
  copiedItemId: null,
  lastNoMediaItem: null,
  activeStreamUrl: null,
};

const els = {
  vlcStatusBtn: document.getElementById('vlc-status-btn'),
  advisoryConsentRow: document.getElementById('advisory-consent-row'),
  revokeTermsBtn: document.getElementById('revoke-terms-btn'),
  homeLink: document.getElementById('home-link'),
  backBtn: document.getElementById('back-btn'),
  sourcesBadge: document.getElementById('sources-badge'),
  githubLink: document.getElementById('github-link'),
  termsGate: document.getElementById('terms-gate'),
  termsForm: document.getElementById('terms-form'),
  acceptCheckbox: document.getElementById('accept-terms-checkbox'),
  acceptBtn: document.getElementById('accept-terms-btn'),
  workspace: document.getElementById('workspace'),
  searchForm: document.getElementById('search-form'),
  searchInput: document.getElementById('search-input'),
  searchSubmitBtn: document.getElementById('search-submit-btn'),
  alertBox: document.getElementById('alert-box'),
  alertText: document.getElementById('alert-text'),
  alertFallbackBtn: document.getElementById('alert-fallback-client-btn'),
  alertDismissBtn: document.getElementById('alert-dismiss-btn'),
  homeRoster: document.getElementById('home-roster'),
  rosterGrid: document.getElementById('roster-grid'),
  loadingBox: document.getElementById('loading-box'),
  resultsWorkspace: document.getElementById('results-workspace'),
  mediaDossier: document.getElementById('media-dossier'),
  sourceLedger: document.getElementById('source-ledger'),
  resultsEmpty: document.getElementById('results-empty'),
  resultsEmptyTitle: document.getElementById('results-empty-title'),
  groupMatched: document.getElementById('group-matched'),
  matchedHeading: document.getElementById('matched-heading'),
  matchedList: document.getElementById('matched-list'),
  groupOthers: document.getElementById('group-others'),
  othersHeading: document.getElementById('others-heading'),
  othersList: document.getElementById('others-list'),
  paginationBar: document.getElementById('pagination-bar'),
  paginationInfo: document.getElementById('pagination-info'),
  paginationButtons: document.getElementById('pagination-buttons'),
  streamHud: document.getElementById('stream-hud'),
  streamBadge: document.getElementById('stream-badge'),
  streamFileName: document.getElementById('stream-file-name'),
  streamStatsLine: document.getElementById('stream-stats-line'),
  streamCopyUrlBtn: document.getElementById('stream-copy-url-btn'),
  streamReopenVlcBtn: document.getElementById('stream-reopen-vlc-btn'),
  streamStopBtn: document.getElementById('stream-stop-btn'),
  streamProgressFill: document.getElementById('stream-progress-fill'),
  pickerModal: document.getElementById('file-picker-modal'),
  pickerTitle: document.getElementById('picker-title'),
  pickerList: document.getElementById('picker-list'),
  pickerCancelBtn: document.getElementById('picker-cancel-btn'),
};

function computeDynamicPageSize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isSplit = vw >= 920;
  const chromeHeight = isSplit ? 300 : state.searchData?.media ? 450 : 320;
  const rowHeight = vw >= 640 ? 104 : 128;
  const count = Math.floor(Math.max(360, vh - chromeHeight) / rowHeight);
  return Math.max(4, Math.min(count, 15));
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push('ellipsis');
  for (let p = left; p <= right; p += 1) pages.push(p);
  if (right < total - 1) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

function showAlert(message, fallbackItem = null) {
  els.alertText.textContent = message;
  state.lastNoMediaItem = fallbackItem;
  els.alertFallbackBtn.classList.toggle('hidden', !fallbackItem);
  els.alertBox.classList.remove('hidden');
}

function hideAlert() {
  state.lastNoMediaItem = null;
  els.alertBox.classList.add('hidden');
}

function updateVlcPill() {
  if (state.vlcPath) {
    els.vlcStatusBtn.textContent = 'VLC Ready';
    els.vlcStatusBtn.title = `Detected VLC: ${state.vlcPath} (Click to change)`;
    els.vlcStatusBtn.className = 'vlc-pill vlc-ready';
  } else {
    els.vlcStatusBtn.textContent = 'Set VLC Path';
    els.vlcStatusBtn.title = 'VLC not found automatically — click to browse for vlc.exe';
    els.vlcStatusBtn.className = 'vlc-pill vlc-missing';
  }
}

function syncConsentView() {
  els.termsGate.classList.toggle('hidden', state.termsAccepted);
  els.workspace.classList.toggle('hidden', !state.termsAccepted);
  els.advisoryConsentRow.classList.toggle('hidden', !state.termsAccepted);
}

function renderRoster() {
  els.sourcesBadge.textContent = `${state.providers.length} SOURCES INDEXED`;
  els.rosterGrid.innerHTML = '';
  state.providers.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'roster-card';

    const top = document.createElement('div');
    top.className = 'roster-card-top';
    const num = document.createElement('span');
    num.className = 'roster-idx';
    num.textContent = String(idx + 1).padStart(2, '0');
    const ready = document.createElement('span');
    ready.className = 'roster-ready';
    ready.textContent = 'Ready';
    top.append(num, ready);

    const h3 = document.createElement('h3');
    h3.textContent = p.name;
    const desc = document.createElement('p');
    desc.textContent = p.description;

    card.append(top, h3, desc);
    els.rosterGrid.appendChild(card);
  });
}

function renderMediaDossier(media) {
  if (!media) {
    els.mediaDossier.classList.add('hidden');
    els.mediaDossier.innerHTML = '';
    return;
  }

  els.mediaDossier.innerHTML = '';
  els.mediaDossier.classList.remove('hidden');

  const head = document.createElement('div');
  head.className = 'panel-head';
  const label = document.createElement('h2');
  label.className = 'panel-title';
  label.textContent = media.type === 'movie' ? 'Movie Dossier' : 'Series Dossier';
  head.appendChild(label);
  if (media.rating) {
    const rating = document.createElement('span');
    rating.className = 'badge-red';
    rating.textContent = `IMDb ${media.rating}/10`;
    head.appendChild(rating);
  }

  const body = document.createElement('div');
  body.className = 'panel-body';

  const top = document.createElement('div');
  top.className = 'media-top';
  if (media.poster) {
    const img = document.createElement('img');
    img.className = 'media-poster';
    img.src = media.poster;
    img.alt = media.name;
    img.onerror = () => img.remove();
    top.appendChild(img);
  }

  const info = document.createElement('div');
  const nameEl = document.createElement('h3');
  nameEl.className = 'media-name';
  nameEl.textContent = media.name;
  info.appendChild(nameEl);

  const metaParts = [];
  if (media.year) metaParts.push(media.year);
  if (media.runtime) metaParts.push(media.runtime);
  if (media.seasonsCount) metaParts.push(`${media.seasonsCount} Seasons`);
  if (media.episodesCount) metaParts.push(`${media.episodesCount} Eps`);
  if (metaParts.length > 0) {
    const metaLine = document.createElement('div');
    metaLine.className = 'media-meta-line';
    metaLine.textContent = metaParts.join(' · ');
    info.appendChild(metaLine);
  }

  if (Array.isArray(media.genres) && media.genres.length > 0) {
    const genresEl = document.createElement('div');
    genresEl.className = 'media-genres';
    media.genres.slice(0, 4).forEach((g) => {
      const chip = document.createElement('span');
      chip.className = 'genre-chip';
      chip.textContent = g;
      genresEl.appendChild(chip);
    });
    info.appendChild(genresEl);
  }

  top.appendChild(info);
  body.appendChild(top);

  if (media.description) {
    const desc = document.createElement('p');
    desc.className = 'media-desc';
    desc.textContent = media.description;
    body.appendChild(desc);
  }

  const credits = [];
  if (Array.isArray(media.director) && media.director.length > 0) {
    credits.push(`Director: ${media.director.join(', ')}`);
  }
  if (Array.isArray(media.cast) && media.cast.length > 0) {
    credits.push(`Cast: ${media.cast.join(', ')}`);
  }
  if (credits.length > 0) {
    const credEl = document.createElement('div');
    credEl.className = 'media-credits';
    credEl.textContent = credits.join(' · ');
    body.appendChild(credEl);
  }

  els.mediaDossier.append(head, body);
}

function renderSourceLedger(data) {
  els.sourceLedger.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'panel-head';
  const title = document.createElement('h2');
  title.className = 'panel-title';
  title.style.color = '#e4e4e7';
  title.textContent = 'Source Ledger';
  const ms = document.createElement('span');
  ms.className = 'mono-muted';
  ms.style.color = '#f87171';
  ms.textContent = `${data.durationMs}ms`;
  head.append(title, ms);

  const ul = document.createElement('ul');
  ul.className = 'ledger-list';
  data.providerStats.forEach((stat) => {
    const li = document.createElement('li');
    li.className = 'ledger-item';

    const left = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.style.fontWeight = '600';
    nameEl.textContent = stat.name;
    const detailEl = document.createElement('div');
    detailEl.className = 'mono-muted';
    detailEl.textContent =
      stat.status === 'ok'
        ? `${stat.count} hits · ${stat.durationMs}ms`
        : stat.status === 'empty'
          ? `0 hits · ${stat.durationMs}ms`
          : stat.status === 'timeout'
            ? 'Timed out'
            : stat.error || 'Error';
    left.append(nameEl, detailEl);

    const badge = document.createElement('span');
    badge.className = `ledger-badge ${
      stat.status === 'ok'
        ? 'ledger-up'
        : stat.status === 'empty'
          ? 'ledger-zero'
          : 'ledger-down'
    }`;
    badge.textContent = stat.status === 'ok' ? 'UP' : stat.status === 'empty' ? '0' : 'DOWN';

    li.append(left, badge);
    ul.appendChild(li);
  });

  els.sourceLedger.append(head, ul);
}

function createResultRow(item, rank) {
  const row = document.createElement('article');
  row.className = 'result-row';

  const meta = document.createElement('div');
  meta.className = 'result-meta';
  const rankEl = document.createElement('span');
  rankEl.className = 'result-rank';
  rankEl.textContent = String(rank).padStart(2, '0');
  const sep = document.createElement('span');
  sep.textContent = '//';
  const prov = document.createElement('span');
  prov.style.color = '#e4e4e7';
  prov.style.fontWeight = '600';
  prov.textContent = item.provider;
  meta.append(rankEl, sep, prov);
  if (item.time) {
    const dot = document.createElement('span');
    dot.textContent = '·';
    const age = document.createElement('span');
    age.textContent = item.time;
    meta.append(dot, age);
  }

  const h3 = document.createElement('h3');
  h3.className = 'result-title';
  h3.textContent = item.title;

  const bottom = document.createElement('div');
  bottom.className = 'result-bottom';

  const badges = document.createElement('div');
  badges.className = 'badges-row';
  const sizeBadge = document.createElement('span');
  sizeBadge.className = 'badge-size';
  sizeBadge.textContent = item.size;
  const seedBadge = document.createElement('span');
  seedBadge.className = 'badge-seeds';
  seedBadge.textContent = `Seeds: ${item.seeds}`;
  const peerBadge = document.createElement('span');
  peerBadge.className = 'badge-peers';
  peerBadge.textContent = `Peers: ${item.peers}`;
  badges.append(sizeBadge, seedBadge, peerBadge);

  const actions = document.createElement('div');
  actions.className = 'row-actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn-secondary';
  copyBtn.disabled = state.busyItemId === item.id;
  copyBtn.textContent = state.copiedItemId === item.id ? 'Copied' : 'Copy';
  copyBtn.onclick = () => handleCopyMagnet(item);

  const clientBtn = document.createElement('button');
  clientBtn.type = 'button';
  clientBtn.className = 'btn-secondary';
  clientBtn.disabled = state.busyItemId === item.id;
  clientBtn.title = 'Open magnet link in default BitTorrent client';
  clientBtn.textContent = 'Client';
  clientBtn.onclick = () => handleOpenClient(item);

  const vlcBtn = document.createElement('button');
  vlcBtn.type = 'button';
  vlcBtn.className = 'vlc-magnet-btn';
  vlcBtn.disabled = state.busyItemId === item.id;
  vlcBtn.title = 'Stream directly in VLC Media Player';
  vlcBtn.innerHTML =
    state.busyItemId === item.id ? '<span>…</span>' : `${SLEEK_RING_SVG}<span>Play VLC</span>`;
  vlcBtn.onclick = () => handleStreamInVlc(item);

  actions.append(copyBtn, clientBtn, vlcBtn);
  bottom.append(badges, actions);
  row.append(meta, h3, bottom);
  return row;
}

function renderResults() {
  els.backBtn.classList.toggle('hidden', !state.searchData && !state.loading);
  els.homeRoster.classList.toggle('hidden', state.loading || Boolean(state.searchData));
  els.loadingBox.classList.toggle('hidden', !state.loading);

  if (state.loading || !state.searchData) {
    els.resultsWorkspace.classList.add('hidden');
    return;
  }

  els.resultsWorkspace.classList.remove('hidden');
  renderMediaDossier(state.searchData.media);
  renderSourceLedger(state.searchData);

  const total = state.results.length;
  if (total === 0) {
    els.resultsEmpty.classList.remove('hidden');
    els.resultsEmptyTitle.textContent = `No results found for "${state.searchData.query}"`;
    els.groupMatched.classList.add('hidden');
    els.groupOthers.classList.add('hidden');
    els.paginationBar.classList.add('hidden');
    return;
  }

  els.resultsEmpty.classList.add('hidden');
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  state.currentPage = Math.min(state.currentPage, totalPages);
  const startIdx = (state.currentPage - 1) * state.pageSize;
  const endIdx = Math.min(startIdx + state.pageSize, total);

  const paged = state.results.slice(startIdx, endIdx).map((item, idx) => ({
    item,
    rank: startIdx + idx + 1,
  }));

  const matchedTotal = state.searchData.media
    ? state.results.filter((r) => r.isExactMatch).length
    : 0;
  const showSplit = Boolean(state.searchData.media && matchedTotal > 0);

  if (showSplit) {
    const pageMatched = paged.filter((e) => e.item.isExactMatch);
    const pageOthers = paged.filter((e) => !e.item.isExactMatch);

    if (pageMatched.length > 0) {
      els.groupMatched.classList.remove('hidden');
      els.matchedHeading.textContent = `Matched: ${state.searchData.media.name} // ${matchedTotal} Total`;
      els.matchedList.innerHTML = '';
      pageMatched.forEach((e) => els.matchedList.appendChild(createResultRow(e.item, e.rank)));
    } else {
      els.groupMatched.classList.add('hidden');
    }

    if (pageOthers.length > 0) {
      els.groupOthers.classList.remove('hidden');
      els.othersHeading.textContent = `Rest of Search Results // ${total - matchedTotal} Total`;
      els.othersList.innerHTML = '';
      pageOthers.forEach((e) => els.othersList.appendChild(createResultRow(e.item, e.rank)));
    } else {
      els.groupOthers.classList.add('hidden');
    }
  } else {
    els.groupMatched.classList.add('hidden');
    els.groupOthers.classList.remove('hidden');
    els.othersHeading.textContent = `Results // ${total} Shown of ${state.searchData.totalRawHits} Fetched`;
    els.othersList.innerHTML = '';
    paged.forEach((e) => els.othersList.appendChild(createResultRow(e.item, e.rank)));
  }

  els.paginationBar.classList.remove('hidden');
  els.paginationInfo.textContent = `SHOWING ${startIdx + 1}–${endIdx} OF ${total} (${state.pageSize}/SCREEN)`;
  els.paginationButtons.innerHTML = '';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'btn-secondary';
  prevBtn.disabled = state.currentPage <= 1;
  prevBtn.textContent = 'Prev';
  prevBtn.onclick = () => {
    state.currentPage = Math.max(1, state.currentPage - 1);
    renderResults();
  };
  els.paginationButtons.appendChild(prevBtn);

  getPageNumbers(state.currentPage, totalPages).forEach((entry) => {
    if (entry === 'ellipsis') {
      const span = document.createElement('span');
      span.className = 'mono-muted';
      span.style.padding = '8px 4px';
      span.textContent = '…';
      els.paginationButtons.appendChild(span);
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `page-btn ${entry === state.currentPage ? 'active' : ''}`;
    btn.textContent = String(entry);
    btn.onclick = () => {
      state.currentPage = entry;
      renderResults();
    };
    els.paginationButtons.appendChild(btn);
  });

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'btn-secondary';
  nextBtn.disabled = state.currentPage >= totalPages;
  nextBtn.textContent = 'Next';
  nextBtn.onclick = () => {
    state.currentPage = Math.min(totalPages, state.currentPage + 1);
    renderResults();
  };
  els.paginationButtons.appendChild(nextBtn);
}

async function resolveItemMagnet(item) {
  if (item.magnet && item.magnet.startsWith('magnet:?')) return item.magnet;
  state.busyItemId = item.id;
  renderResults();
  try {
    const magnet = await window.magnetDesktop.resolveMagnet(item);
    item.magnet = magnet;
    return magnet;
  } finally {
    state.busyItemId = null;
    renderResults();
  }
}

async function handleStreamInVlc(item) {
  hideAlert();
  state.busyItemId = item.id;
  renderResults();
  try {
    const res = await window.magnetDesktop.startVlcStream({
      magnet: item.magnet,
      desc: item.desc,
      title: item.title,
    });
    if (res?.magnet) item.magnet = res.magnet;
    if (res && !res.ok && res.reason === 'no_media') {
      showAlert(res.error || 'No video/audio file inside this torrent.', item);
    } else if (res && !res.ok && res.reason === 'error') {
      showAlert(res.error || 'Could not start stream.', item);
    }
  } catch (err) {
    showAlert(err?.message || 'Could not start VLC stream.');
  } finally {
    state.busyItemId = null;
    renderResults();
  }
}

async function handleOpenClient(item) {
  hideAlert();
  try {
    const magnet = await resolveItemMagnet(item);
    await window.magnetDesktop.openExternal(magnet);
  } catch (err) {
    showAlert(err?.message || 'Could not launch torrent client.');
  }
}

async function handleCopyMagnet(item) {
  hideAlert();
  try {
    const magnet = await resolveItemMagnet(item);
    await navigator.clipboard.writeText(magnet);
    state.copiedItemId = item.id;
    renderResults();
    setTimeout(() => {
      if (state.copiedItemId === item.id) {
        state.copiedItemId = null;
        renderResults();
      }
    }, 1800);
  } catch (err) {
    showAlert(err?.message || 'Could not copy magnet link.');
  }
}

async function performSearch(rawQuery, pushHistory = true) {
  const q = rawQuery.trim();
  if (!q || !state.termsAccepted) return;

  if (pushHistory) {
    state.history.push({ query: els.searchInput.value, searchData: state.searchData });
  }

  hideAlert();
  state.loading = true;
  state.currentPage = 1;
  renderResults();

  try {
    const data = await window.magnetDesktop.search(q);
    state.searchData = data;
    state.results = data.results || [];
    state.pageSize = computeDynamicPageSize();
    state.currentPage = 1;
  } catch (err) {
    showAlert(err?.message || 'Search failed.');
  } finally {
    state.loading = false;
    renderResults();
  }
}

function goHome() {
  state.searchData = null;
  state.results = [];
  state.loading = false;
  state.currentPage = 1;
  state.history = [];
  els.searchInput.value = '';
  hideAlert();
  renderResults();
}

function goBack() {
  if (state.history.length > 0) {
    const prev = state.history.pop();
    state.searchData = prev.searchData || null;
    state.results = prev.searchData?.results || [];
    state.currentPage = 1;
    els.searchInput.value = prev.query || '';
    hideAlert();
    renderResults();
    return;
  }
  goHome();
}

function handleStreamEvent(ev) {
  if (!ev) return;

  if (ev.state === 'selecting') {
    els.pickerTitle.textContent = ev.title || 'Select media file to stream';
    els.pickerList.innerHTML = '';
    (ev.files || []).forEach((f) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'picker-item';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = f.path || f.name;
      const sizeSpan = document.createElement('span');
      sizeSpan.className = 'badge-size';
      sizeSpan.textContent = f.sizeFormatted;
      btn.append(nameSpan, sizeSpan);
      btn.onclick = () => {
        els.pickerModal.classList.add('hidden');
        window.magnetDesktop.selectStreamFile(f.index);
      };
      els.pickerList.appendChild(btn);
    });
    els.pickerModal.classList.remove('hidden');
    return;
  }

  els.pickerModal.classList.add('hidden');

  if (ev.state === 'stopped') {
    state.activeStreamUrl = null;
    els.streamHud.classList.add('hidden');
    document.body.classList.remove('has-hud');
    return;
  }

  if (ev.state === 'error') {
    state.activeStreamUrl = null;
    els.streamHud.classList.add('hidden');
    document.body.classList.remove('has-hud');
    showAlert(ev.error || 'Stream error occurred.');
    return;
  }

  els.streamHud.classList.remove('hidden');
  document.body.classList.add('has-hud');

  if (ev.state === 'connecting') {
    els.streamBadge.textContent = 'CONNECTING';
    els.streamFileName.textContent = ev.title || 'Magnet Stream';
    els.streamStatsLine.textContent = ev.message || 'Connecting to swarm…';
    els.streamProgressFill.style.width = '0%';
    els.streamCopyUrlBtn.classList.add('hidden');
    els.streamReopenVlcBtn.classList.add('hidden');
    return;
  }

  if (ev.state === 'streaming') {
    state.activeStreamUrl = ev.streamUrl || state.activeStreamUrl;
    els.streamBadge.textContent = 'VLC STREAM';
    els.streamFileName.textContent = `${ev.fileName || ev.title} (${ev.fileSizeFormatted || ''})`;
    const down = ev.downloadSpeedFormatted || '0 B/s';
    const up = ev.uploadSpeedFormatted || '0 B/s';
    const pct = typeof ev.progressPct === 'number' ? ev.progressPct : 0;
    const peers = typeof ev.numPeers === 'number' ? ev.numPeers : 0;
    const extra = ev.warning || ev.note ? ` · ${ev.warning || ev.note}` : '';
    els.streamStatsLine.textContent = `↓ ${down} · ↑ ${up} · ${pct}% · Peers: ${peers}${extra}`;
    els.streamProgressFill.style.width = `${pct}%`;
    els.streamCopyUrlBtn.classList.toggle('hidden', !state.activeStreamUrl);
    els.streamReopenVlcBtn.classList.toggle('hidden', !state.activeStreamUrl);
  }
}

async function init() {
  state.termsAccepted = localStorage.getItem(TERMS_KEY) === 'true';
  syncConsentView();

  const info = await window.magnetDesktop.getInitInfo();
  state.providers = info.providers || [];
  state.vlcPath = info.vlcPath || null;
  updateVlcPill();
  renderRoster();

  window.magnetDesktop.onStreamEvent(handleStreamEvent);

  els.acceptCheckbox.addEventListener('change', () => {
    els.acceptBtn.disabled = !els.acceptCheckbox.checked;
  });

  els.termsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!els.acceptCheckbox.checked) return;
    localStorage.setItem(TERMS_KEY, 'true');
    state.termsAccepted = true;
    syncConsentView();
    els.searchInput.focus();
  });

  els.revokeTermsBtn.addEventListener('click', () => {
    localStorage.removeItem(TERMS_KEY);
    state.termsAccepted = false;
    els.acceptCheckbox.checked = false;
    els.acceptBtn.disabled = true;
    goHome();
    syncConsentView();
  });

  els.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    performSearch(els.searchInput.value, true);
  });

  els.homeLink.addEventListener('click', (e) => {
    e.preventDefault();
    goHome();
  });

  els.backBtn.addEventListener('click', goBack);

  els.githubLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.magnetDesktop.openExternal('https://github.com/Hurley2017/Magnet2Torrent');
  });

  els.vlcStatusBtn.addEventListener('click', async () => {
    const picked = await window.magnetDesktop.pickVlcPath();
    if (picked) {
      state.vlcPath = picked;
      updateVlcPill();
    }
  });

  els.alertDismissBtn.addEventListener('click', hideAlert);
  els.alertFallbackBtn.addEventListener('click', () => {
    if (state.lastNoMediaItem) handleOpenClient(state.lastNoMediaItem);
  });

  els.streamStopBtn.addEventListener('click', () => window.magnetDesktop.stopStream());
  els.streamReopenVlcBtn.addEventListener('click', () => window.magnetDesktop.reopenVlc());
  els.streamCopyUrlBtn.addEventListener('click', async () => {
    if (!state.activeStreamUrl) return;
    await navigator.clipboard.writeText(state.activeStreamUrl);
    els.streamCopyUrlBtn.textContent = 'Copied';
    setTimeout(() => {
      els.streamCopyUrlBtn.textContent = 'Copy URL';
    }, 1500);
  });

  els.pickerCancelBtn.addEventListener('click', () => {
    els.pickerModal.classList.add('hidden');
    window.magnetDesktop.stopStream();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const nextSize = computeDynamicPageSize();
      if (nextSize !== state.pageSize) {
        state.pageSize = nextSize;
        renderResults();
      }
    }, 120);
  });
}

init();
