const defaultConfig = {
  tournamentName: 'MLBB Official League',
  roundName: 'Grand Final',
  hostName: 'Lala',
  casterName: 'Adit',
  blueTeam: { name: 'Blue Phoenix', logo: '/assets/teams/blue-phoenix.svg' },
  redTeam: { name: 'Red Viper', logo: '/assets/teams/red-viper.svg' },
  headerImage: '',
  headerWidth: 1280,
  customItems: [
    { id: 'customText1', type: 'text', name: 'Teks custom 1', text: 'Teks Custom', size: 24, color: '#ffffff' },
    { id: 'customImage1', type: 'image', name: 'Gambar custom 1', src: '', width: 160, height: 90 },
  ],
  match: {
    timer: 1325,
    blueKills: 9,
    redKills: 7,
    blueGold: 18840,
    redGold: 17520,
    turtleBlue: 1,
    turtleRed: 0,
    lordBlue: 1,
    lordRed: 0,
    towerBlue: 3,
    towerRed: 2,
    bo2: { enabled: false, bestOf: 2, games: [{ winner: null }, { winner: null }] },
  },
  style: {
    fontFamily: 'Segoe UI, Tahoma, sans-serif',
    baseSize: 16,
    titleSize: 26,
    teamSize: 26,
    timerSize: 52,
    textColor: '#eef5ff',
    mutedColor: '#9cb3cf',
    goldColor: '#ffd76a',
    blueAccent: '#4aa9ff',
    redAccent: '#ff5b5b',
    items: {
      tournamentName: { size: 12, color: '#a5b6ca' },
      roundName: { size: 12, color: '#a5b6ca' },
      blueName: { size: 18, color: '#5aa9ff' },
      blueKills: { size: 28, color: '#ffd76a' },
      matchTimer: { size: 30, color: '#edf4ff' },
      redName: { size: 18, color: '#ff6666' },
      redKills: { size: 28, color: '#ffd76a' },
      blueGold: { size: 16, color: '#ffd76a' },
      redGold: { size: 16, color: '#ffd76a' },
      goldDiff: { size: 18, color: '#a5b6ca' },
      turtleBlue: { size: 12, color: '#a5b6ca' },
      turtleRed: { size: 12, color: '#a5b6ca' },
      lordBlue: { size: 12, color: '#a5b6ca' },
      lordRed: { size: 12, color: '#a5b6ca' },
      towerBlue: { size: 12, color: '#a5b6ca' },
      towerRed: { size: 12, color: '#a5b6ca' },
      casterName: { size: 12, color: '#ffd76a' },
      hostName: { size: 12, color: '#ffd76a' },
    },
  },
  layout: {
    tournamentName: { x: 320, y: 28 },
    roundName: { x: 320, y: 54 },
    headerImage: { x: 0, y: 0 },
    customText1: { x: 40, y: 600 },
    customImage1: { x: 40, y: 480 },
    blueLogo: { x: 120, y: 120 },
    blueName: { x: 190, y: 136 },
    blueKills: { x: 420, y: 130 },
    matchTimer: { x: 520, y: 118 },
    redLogo: { x: 1040, y: 120 },
    redName: { x: 930, y: 136 },
    redKills: { x: 860, y: 130 },
    blueGold: { x: 210, y: 220 },
    redGold: { x: 950, y: 220 },
    goldDiff: { x: 560, y: 220 },
    bo2Blue: { x: 240, y: 262 },
    bo2Red: { x: 960, y: 262 },
    rosterBlue: { x: 16, y: 300 },
    rosterRed: { x: 876, y: 300 },
    turtleBlue: { x: 500, y: 220 },
    turtleRed: { x: 550, y: 220 },
    lordBlue: { x: 500, y: 248 },
    lordRed: { x: 550, y: 248 },
    towerBlue: { x: 500, y: 276 },
    towerRed: { x: 550, y: 276 },
    casterName: { x: 240, y: 500 },
    hostName: { x: 480, y: 500 },
  },
  ocr: {
    enabled: ['timer', 'blueKills', 'redKills', 'blueGold', 'redGold', 'turtleBlue', 'turtleRed', 'lordBlue', 'lordRed'],
    modes: { turtle: 'auto', lord: 'auto', tower: 'manual' },
  },
};

const textStyleItems = [
  'tournamentName', 'roundName', 'blueName', 'blueKills', 'matchTimer', 'redName', 'redKills',
  'blueGold', 'redGold', 'goldDiff', 'turtleBlue', 'turtleRed', 'lordBlue', 'lordRed', 'towerBlue', 'towerRed', 'casterName', 'hostName',
];

const status = document.getElementById('status');
const form = document.getElementById('control-form');
const saveButton = document.getElementById('save-button');
const applyButton = document.getElementById('apply-button');
const resetButton = document.getElementById('reset-button');
const previewStage = document.getElementById('preview-stage');
const headerImageInput = document.getElementById('header-image-file');
const headerWidthSlider = document.getElementById('header-width-slider');
const customItemsList = document.getElementById('custom-items-list');
const bo2Editor = document.getElementById('bo2-editor');
const bo2Enabled = document.getElementById('bo2-enabled');
const bo2Reset = document.getElementById('bo2-reset');
const ocrEditor = document.getElementById('ocr-editor');
const ocrFieldRows = document.getElementById('ocr-field-rows');
const ocrEnabled = document.getElementById('ocr-enabled');
const resultEditor = document.getElementById('result-editor');

const RESULT_FIELDS = [
  ['result-visible', 'visible', 'bool'],
  ['result-headline-input', 'headline', 'text'],
  ['result-subline-input', 'subline', 'text'],
  ['result-game-input', 'gameNumber', 'int'],
  ['result-bestof-input', 'bestOf', 'int'],
  ['result-duration-input', 'durationSec', 'int'],
  ['result-dealt-input', 'damageDealt', 'int'],
  ['result-taken-input', 'damageTaken', 'int'],
  ['result-mvp-input', 'mvp', 'text'],
];

const defaultResultConfig = {
  visible: false,
  seriesScore: { blue: 0, red: 0 },
  gameNumber: 1,
  bestOf: 5,
  durationSec: 0,
  damageDealt: 0,
  damageTaken: 0,
  mvp: '',
  headline: 'VICTORY',
  subline: '',
};

const defaultPlayer = () => ({
  name: '', hero: '', heroImage: '', level: 1, kills: 0, deaths: 0, assists: 0, items: [],
});

function readResultConfig() {
  const config = getConfig();
  const result = { ...defaultResultConfig, ...(config.result || {}) };
  for (const [id, key, type] of RESULT_FIELDS) {
    const input = document.getElementById(id);
    if (!input) continue;
    if (type === 'bool') result[key] = input.checked;
    else if (type === 'int') result[key] = Number(input.value) || 0;
    else result[key] = input.value;
  }
  return result;
}

function writeResultConfig(result) {
  const value = { ...defaultResultConfig, ...(result || {}) };
  for (const [id, key, type] of RESULT_FIELDS) {
    const input = document.getElementById(id);
    if (!input) continue;
    if (type === 'bool') input.checked = value[key] === true;
    else input.value = String(value[key] ?? '');
  }
  updateResultSeriesNote();
  const link = document.getElementById('result-obs-link');
  if (link) link.href = Kit.pageUrl(slug, 'overlay/result');
}

function updateResultSeriesNote() {
  const note = document.getElementById('result-series-note');
  if (!note) return;
  const bo2 = document.getElementById('bo2-enabled')?.checked === true;
  note.textContent = bo2
    ? 'Skor seri memakai Seri BO2 di atas selama indikatornya aktif.'
    : 'Skor seri memakai angka manual di bawah karena indikator BO2 dimatikan.';
}

async function saveResultConfig() {
  if (!slug || !ownerKey) return;
  const result = readResultConfig();
  const config = getConfig();
  config.result = result;
  setConfig(config);
  const response = await Kit.pushAux(slug, 'result', result, ownerKey);
  if (!response.ok) {
    status.textContent = `Layar hasil gagal disimpan: ${response.error || response.status}`;
    return;
  }
  status.textContent = 'Layar hasil tersimpan di server profil.';
}

function readPlayersConfig() {
  const config = getConfig();
  const players = config.players || {};
  const normalizeSide = (side) => [0, 1, 2, 3, 4].map((index) => ({
    ...defaultPlayer(),
    ...(Array.isArray(side) ? side[index] || {} : {}),
  }));
  return { blue: normalizeSide(players.blue), red: normalizeSide(players.red) };
}

function writePlayersConfig(players) {
  const config = getConfig();
  config.players = players;
  setConfig(config);
}

async function savePlayersConfig() {
  if (!slug || !ownerKey) return;
  const players = readPlayersConfig();
  writePlayersConfig(players);
  const response = await Kit.pushAux(slug, 'players', players, ownerKey);
  const note = document.getElementById('players-note');
  if (!response.ok) {
    if (note) note.textContent = `Gagal menyimpan ke server: ${response.error || response.status}`;
    return;
  }
  if (note) note.textContent = 'Player cards tersimpan di server profil ini.';
  status.textContent = 'Player cards tersimpan.';
}

let registryCache = null;

async function loadRegistry() {
  if (registryCache) return registryCache;
  const result = await Kit.fetchRegistry();
  registryCache = result.ok ? result.registry : null;
  const note = document.getElementById('players-note');
  if (!registryCache && note) note.textContent = 'Registry aset belum termuat. Jalankan npm run build:cloudflare.';
  return registryCache;
}

function openAssetPicker(category, onPick) {
  const registry = registryCache;
  const group = registry?.categories?.[category];
  const dialog = document.createElement('div');
  dialog.className = 'asset-picker';

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = `Cari ${group?.label || category}...`;
  const grid = document.createElement('div');
  grid.className = 'asset-picker-grid';

  const close = () => dialog.remove();
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  const paint = (filter = '') => {
    grid.replaceChildren();
    const keyword = filter.trim().toLowerCase();
    for (const asset of group?.items || []) {
      if (keyword && !asset.name.toLowerCase().includes(keyword)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.title = asset.name;
      const image = document.createElement('img');
      image.src = asset.path;
      image.alt = asset.name;
      image.loading = 'lazy';
      button.append(image);
      button.addEventListener('click', () => {
        onPick(asset);
        close();
      });
      grid.append(button);
    }
  };

  search.addEventListener('input', () => paint(search.value));
  dialog.append(search, grid);
  document.body.append(dialog);
  paint();
  search.focus();
}

function renderPlayersEditor() {
  const players = readPlayersConfig();
  [['blue', 'players-blue'], ['red', 'players-red']].forEach(([side, containerId]) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.replaceChildren();
    players[side].forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'player-row';
      row.dataset.side = side;
      row.dataset.slot = String(index);

      const hero = document.createElement('img');
      hero.src = player.heroImage || '/assets/heroes/aamon.png';
      hero.alt = player.hero || 'Pilih hero';
      hero.title = 'Klik untuk ganti hero';
      hero.addEventListener('click', () => openAssetPicker('heroes', (asset) => {
        player.hero = asset.name;
        player.heroImage = asset.path;
        renderPlayersEditor();
        savePlayersConfig();
      }));

      const name = document.createElement('input');
      name.type = 'text';
      name.value = player.name;
      name.placeholder = 'Nama';
      name.maxLength = 48;
      name.addEventListener('change', () => {
        player.name = name.value;
        savePlayersConfig();
      });

      const level = document.createElement('input');
      level.type = 'number';
      level.min = '1';
      level.max = '99';
      level.value = String(player.level || 1);
      level.title = 'Level';
      level.addEventListener('change', () => {
        player.level = Number(level.value) || 1;
        savePlayersConfig();
      });

      const stat = (key, title) => {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '99';
        input.value = String(player[key] || 0);
        input.title = title;
        input.addEventListener('change', () => {
          player[key] = Number(input.value) || 0;
          savePlayersConfig();
        });
        return input;
      };

      const items = document.createElement('div');
      items.className = 'player-items';
      for (let slot = 0; slot < 6; slot += 1) {
        const path = player.items[slot];
        const cell = document.createElement('img');
        cell.src = path || '';
        cell.alt = path ? `Item ${slot + 1}` : `Slot item ${slot + 1} kosong`;
        cell.title = 'Klik untuk pilih item';
        if (!path) cell.style.opacity = '0.35';
        cell.addEventListener('click', () => openAssetPicker('items', (asset) => {
          player.items[slot] = asset.path;
          renderPlayersEditor();
          savePlayersConfig();
        }));
        items.append(cell);
      }

      row.append(hero, name, level, stat('kills', 'Kill'), stat('deaths', 'Mati'), stat('assists', 'Assist'), items);
      container.append(row);
    });
  });
}

async function initAuxEditors() {
  await loadRegistry();
  const config = getConfig();
  writeResultConfig(config.result);
  renderPlayersEditor();
  if (!slug) {
    const note = document.getElementById('players-note');
    if (note) note.textContent = 'Mode lokal: data tetap di browser dan dikirim lewat live socket.';
    return;
  }
  const [result, players] = await Promise.all([Kit.fetchAux(slug, 'result'), Kit.fetchAux(slug, 'players')]);
  const next = getConfig();
  if (result.ok) next.result = result.value;
  if (players.ok) next.players = players.value;
  setConfig(next);
  writeResultConfig(next.result);
  renderPlayersEditor();
}

// Field Lock berlaku per field, bukan per objective. Satu daftar ini dipakai untuk tabel
// mode OCR di control, untuk menandai input manual, dan untuk validate bacaan di server.
const ocrFieldLabels = {
  timer: 'Timer',
  blueKills: 'Kill Blue',
  redKills: 'Kill Red',
  blueGold: 'Gold Blue',
  redGold: 'Gold Red',
  turtleBlue: 'Turtle Blue',
  turtleRed: 'Turtle Red',
  lordBlue: 'Lord Blue',
  lordRed: 'Lord Red',
  towerBlue: 'Tower Blue',
  towerRed: 'Tower Red',
};

function ocrFieldModes() {
  const saved = getConfig().ocr || {};
  const modes = { ...(saved.modes || {}) };
  if (saved.modes?.turtle) {
    modes.turtleBlue = modes.turtleRed = saved.modes.turtle === 'auto' ? 'auto' : 'lock';
  }
  if (saved.modes?.lord) {
    modes.lordBlue = modes.lordRed = saved.modes.lord === 'auto' ? 'auto' : 'lock';
  }
  if (saved.modes?.tower) {
    modes.towerBlue = modes.towerRed = saved.modes.tower === 'auto' ? 'auto' : 'lock';
  }
  return modes;
}

function isOcrLocked(field) {
  const mode = ocrFieldModes()[field];
  return mode === 'lock' || mode === 'manual';
}

function renderOcrFieldRows() {
  if (!ocrFieldRows) return;
  const saved = getConfig().ocr || {};
  const modes = ocrFieldModes();
  const thresholds = saved.thresholds || {};
  ocrFieldRows.replaceChildren();
  Object.entries(ocrFieldLabels).forEach(([field, label]) => {
    const row = document.createElement('tr');
    row.dataset.field = field;
    row.dataset.locked = String(isOcrLocked(field));

    const nameCell = document.createElement('td');
    nameCell.textContent = label;

    const modeCell = document.createElement('td');
    const select = document.createElement('select');
    select.dataset.ocrMode = field;
    [['auto', 'auto (OCR boleh)'], ['lock', 'kunci (manual)']].forEach(([value, text]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      if ((modes[field] || 'auto') === value) option.selected = true;
      select.append(option);
    });
    modeCell.append(select);

    const thresholdCell = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.step = '5';
    input.dataset.ocrThreshold = field;
    input.value = String(thresholds[field] ?? 70);
    thresholdCell.append(input);

    row.append(nameCell, modeCell, thresholdCell);
    ocrFieldRows.append(row);
  });
  if (ocrEnabled) ocrEnabled.checked = saved.ocrEnabled !== false;
}

async function saveOcrConfig() {
  if (!ocrEditor || !slug || !ownerKey) return;
  const modes = {};
  const thresholds = {};
  ocrFieldRows.querySelectorAll('[data-ocr-mode]').forEach((select) => {
    modes[select.dataset.ocrMode] = select.value;
  });
  ocrFieldRows.querySelectorAll('[data-ocr-threshold]').forEach((input) => {
    thresholds[input.dataset.ocrThreshold] = Number(input.value);
  });
  const saved = getConfig().ocr || {};
  const result = await Kit.pushAux(slug, 'ocr', {
    enabled: ocrEnabled?.checked !== false,
    regions: saved.regions || {},
    modes,
    thresholds,
    anchor: saved.anchor || {},
  }, ownerKey);
  const note = document.getElementById('ocr-sync-note');
  if (!result.ok) {
    if (note) note.textContent = `Gagal menyimpan ke server: ${result.error || result.status}`;
    return;
  }
  const config = getConfig();
  config.ocr = { ...(config.ocr || {}), modes, thresholds, regions: saved.regions || {}, anchor: saved.anchor || {}, ocrEnabled: ocrEnabled?.checked !== false };
  setConfig(config);
  if (note) note.textContent = `Tersimpan di server profil. ${Object.values(modes).filter((mode) => mode !== 'auto').length} field terkunci.`;
  status.textContent = 'Mode OCR dan Field Lock tersimpan di server profil.';
  applyLockedFieldState(config);
}

// Field terkunci tetap boleh disunting operator dari panel ini; yang dicegah adalah OCR.
// Yang dilakukan di sini adalah menandai input supaya operator tahu angka itu milik manual.
function applyLockedFieldState(config) {
  Object.keys(ocrFieldLabels).forEach((field) => {
    const input = form.elements[field];
    if (!input) return;
    const locked = isOcrLocked(field);
    input.dataset.locked = String(locked);
    input.title = locked ? 'Field dikunci: OCR tidak boleh menimpa angka ini.' : '';
  });
}
let customIdSequence = Date.now();

const MAX_ASSETS_BYTES = 700000;
const connectionBadge = document.getElementById('connection-badge');
const connectionDetail = document.getElementById('connection-detail');
const profileBanner = document.getElementById('profile-banner');
const profileBannerText = document.getElementById('profile-banner-text');
const claimButton = document.getElementById('claim-button');
const debugLink = document.getElementById('debug-link');

// A browser can manage several profiles, so every local key is namespaced by slug.
// Without this, editing profile A would silently rewrite profile B's config.
const Kit = window.ProfileKit;
const slug = Kit.slugFromPath();
const isLocalBackend = !slug;
const configKey = slug ? `mlbb_overlay_config_${slug}` : 'mlbb_overlay_config';
const assetsSignatureKey = slug ? `mlbb_overlay_assets_signature_${slug}` : 'mlbb_overlay_assets_signature';
let ownerKey = slug ? Kit.ownerKeyFor(slug) : '';
let profileMeta = null;
let sentAssetsSignature = localStorage.getItem(assetsSignatureKey) || '';
let connectedClients = null;
let assetsSyncedForConnection = false;

// Tautan antar halaman harus mengikuti profil yang sedang dibuka, kalau tidak operator
// akan mendiagnosa ROI profil yang salah atau memasang URL OBS yang salah.
if (debugLink) debugLink.href = Kit.pageUrl(slug, 'debug');
Kit.renderNav(document.getElementById('profile-nav'), { active: 'control' });

function showProfileBanner(message, action) {
  if (!profileBanner) return;
  if (!message) {
    profileBanner.hidden = true;
    return;
  }
  profileBanner.hidden = false;
  profileBannerText.textContent = message;
  claimButton.hidden = !action;
  claimButton.textContent = action || '';
}

async function claimCurrentProfile() {
  const result = await Kit.claim(slug);
  if (!result.ok) {
    status.textContent = result.error;
    return;
  }
  ownerKey = result.ownerKey;
  showProfileBanner('');
  liveSocket.reconnectNow('profil diklaim');
  status.textContent = 'Profil diklaim. Simpan ownerKey ini di tempat aman: server hanya menyimpan hash-nya.';
}

function updateConnectionBadge(state, info = {}) {
  const labels = {
    online: 'Live tersambung',
    connecting: 'Menyambung ke live server...',
    offline: 'Live terputus - mencoba lagi',
    idle: 'Menunggu koneksi',
  };
  if (!connectionBadge) return;
  connectionBadge.dataset.state = state;
  connectionBadge.textContent = labels[state] || state;
  const detail = info.detail || '';
  const peers = connectedClients === null ? '' : ` ${connectedClients} klien overlay terhubung.`;

  if (info.authState === 'viewer') {
    connectionDetail.textContent = 'Socket tersambung sebagai PENONTON. ownerKey tidak cocok atau belum diklaim, jadi perubahan tidak akan terkirim ke server.';
    return;
  }

  connectionDetail.textContent = state === 'online'
    ? `Endpoint ${detail || 'ws'} siap.${peers} Klik badge untuk menyambung ulang bila perlu.`
    : `${detail || 'Belum tersambung.'} Perubahan tetap tersimpan dan dikirim ulang otomatis.`;
}

const liveSocket = window.LiveSocket.create({
  role: 'control',
  slug,
  ownerKey,
  onStatus: (state, info) => {
    if (state === 'online') assetsSyncedForConnection = false;
    updateConnectionBadge(state, info);
  },
  onMessage: (message) => {
    if (message?.type === 'snapshot') {
      connectedClients = message.clients ?? connectedClients;
      if (!assetsSyncedForConnection) {
        assetsSyncedForConnection = true;
        pushLiveAssets(getConfig(), true);
      }
      return;
    }
    if (message?.type === 'assets_changed') {
      connectedClients = message.clients ?? connectedClients;
      return;
    }
    if (message?.type === 'heartbeat' || message?.type === 'peers') {
      connectedClients = message.clients ?? connectedClients;
    }
  },
});

function getConfig() {
  const saved = JSON.parse(localStorage.getItem(configKey) || 'null');
  const config = {
    ...defaultConfig,
    ...saved,
    blueTeam: { ...defaultConfig.blueTeam, ...(saved?.blueTeam || {}) },
    redTeam: { ...defaultConfig.redTeam, ...(saved?.redTeam || {}) },
    match: { ...defaultConfig.match, ...(saved?.match || {}) },
    style: {
      ...defaultConfig.style,
      ...(saved?.style || {}),
      items: { ...defaultConfig.style.items, ...(saved?.style?.items || {}) },
    },
    layout: { ...defaultConfig.layout, ...(saved?.layout || {}) },
    ocr: {
      ...defaultConfig.ocr,
      ...(saved?.ocr || {}),
      modes: { ...defaultConfig.ocr.modes, ...(saved?.ocr?.modes || {}) },
    },
  };
  config.headerImage = saved?.headerImage || saved?.referenceImage || '';
  config.customItems = saved?.customItems || defaultConfig.customItems.map((item) => ({ ...item }));
  delete config.referenceImage;
  return config;
}

function setConfig(config) {
  localStorage.setItem(configKey, JSON.stringify(config));
}

function collectLiveAssets(config) {
  const images = {};
  (config.customItems || []).forEach((item) => {
    if (item.type === 'image' && item.src) images[item.id] = item.src;
  });
  return { headerImage: config.headerImage || '', images };
}

function buildLivePayload(config) {
  const customItems = (config.customItems || []).map((item) => (
    item.type === 'image' ? { ...item, src: '' } : { ...item }
  ));
  return {
    match: config.match,
    teams: { blue: config.blueTeam, red: config.redTeam },
    presentation: {
      tournamentName: config.tournamentName,
      roundName: config.roundName,
      hostName: config.hostName,
      casterName: config.casterName,
      headerImage: '',
      headerWidth: config.headerWidth,
      layout: config.layout,
      style: config.style,
      customItems,
    },
  };
}

function assetsSignature(config) {
  return JSON.stringify(collectLiveAssets(config));
}

function describeLiveResult(result, sentText, queuedText) {
  return result === 'sent' ? sentText : queuedText;
}

function pushLiveAssets(config, force = false) {
  const signature = assetsSignature(config);
  if (!force && signature === sentAssetsSignature) return 'unchanged';

  const assets = collectLiveAssets(config);
  const encoded = JSON.stringify(assets);
  if (encoded.length > MAX_ASSETS_BYTES) {
    status.textContent = `Gambar terlalu besar untuk dikirim live (${Math.round(encoded.length / 1024)} KB). Perkecil PNG lalu coba lagi; data tetap tersimpan di browser.`;
    return 'unchanged';
  }

  sentAssetsSignature = signature;
  localStorage.setItem(assetsSignatureKey, sentAssetsSignature);
  const result = liveSocket.send({ type: 'assets', payload: assets });
  if (force && result === 'sent') {
    status.textContent = 'PNG header dan gambar custom disinkronkan ulang ke overlay.';
  }
  return result;
}

function pushLiveConfig(config) {
  const payload = buildLivePayload(config);
  let result = liveSocket.send({ type: 'update', payload });
  const assetResult = pushLiveAssets(config);
  if (result === 'sent' && assetResult === 'queued') result = 'queued';

  if (result === 'rejected') {
    status.textContent = 'Perubahan ditolak: ownerKey tidak cocok atau profil belum diklaim. Buka beranda untuk mengklaim profil ini.';
    return result;
  }

  if (result === 'queued') {
    pushLiveStateOverHttp(payload).then((saved) => {
      if (!saved && status.textContent.includes('antre')) {
        status.textContent = 'WebSocket belum tersambung dan HTTP fallback gagal. Perubahan tetap tersimpan di browser dan dikirim ulang otomatis.';
      }
    });
  }
  return result;
}

async function pushLiveStateOverHttp(payload) {
  if (!slug) {
    try {
      const response = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  const result = await Kit.pushState(slug, payload, ownerKey);
  return result.ok;
}

function createCustomField(labelText, fieldName, value, type = 'text', attributes = {}) {
  const label = document.createElement('label');
  const caption = document.createElement('span');
  const input = document.createElement('input');
  caption.textContent = labelText;
  input.type = type;
  input.dataset.field = fieldName;
  if (type !== 'file') input.value = value ?? '';
  Object.entries(attributes).forEach(([key, attributeValue]) => input.setAttribute(key, attributeValue));
  label.append(caption, input);
  return label;
}

function renderCustomItemEditors(items = getConfig().customItems) {
  customItemsList.replaceChildren();
  items.forEach((item) => {
    const editor = document.createElement('section');
    editor.className = 'custom-item-editor';
    editor.dataset.customId = item.id;

    const heading = document.createElement('div');
    heading.className = 'custom-item-heading';
    const title = document.createElement('strong');
    title.textContent = item.type === 'text' ? 'Teks custom' : 'Gambar custom';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary';
    remove.dataset.action = 'remove-custom';
    remove.textContent = 'Hapus';
    heading.append(title, remove);

    const fields = document.createElement('div');
    fields.className = 'custom-item-fields';
    fields.append(createCustomField('Nama item', 'name', item.name));
    if (item.type === 'text') {
      fields.append(
        createCustomField('Teks', 'text', item.text),
        createCustomField('Ukuran font (px)', 'size', item.size, 'number', { min: '6', max: '200' }),
        createCustomField('Warna font', 'color', item.color, 'color'),
      );
    } else {
      fields.append(
        createCustomField('URL / sumber gambar', 'src', item.src),
        createCustomField('Unggah gambar', 'file', '', 'file', { accept: 'image/*' }),
        createCustomField('Lebar (px)', 'width', item.width, 'number', { min: '1', max: '1280' }),
        createCustomField('Tinggi (px)', 'height', item.height, 'number', { min: '1', max: '720' }),
      );
    }
    // Posisi X/Y tidak lagi jadi input: posisi hanya hidup di preview lewat drag-and-drop.
    editor.append(heading, fields);
    customItemsList.append(editor);
  });
}

function readCustomItems(config) {
  config.customItems = [...customItemsList.querySelectorAll('.custom-item-editor')].map((editor) => {
    const item = config.customItems.find((savedItem) => savedItem.id === editor.dataset.customId);
    if (!item) return null;
    const read = (field) => editor.querySelector(`[data-field="${field}"]`)?.value;
    const nextItem = { ...item, name: read('name') || item.name };
    // config.layout TIDAK disentuh di sini: posisi hanya diubah oleh drag-and-drop di
    // preview. Sebelumnya nilai X/Y dibaca dari input, dan begitu input-nya dihapus
    // `Number(undefined || 0)` akan mereset semua posisi item custom ke 0,0.
    if (item.type === 'text') {
      nextItem.text = read('text') || '';
      nextItem.size = Math.min(200, Math.max(6, Number(read('size') || item.size || 24)));
      nextItem.color = read('color') || item.color || '#ffffff';
    } else {
      nextItem.src = read('src') || '';
      nextItem.width = Math.min(1280, Math.max(1, Number(read('width') || item.width || 160)));
      nextItem.height = Math.min(720, Math.max(1, Number(read('height') || item.height || 90)));
    }
    return nextItem;
  }).filter(Boolean);
  return config;
}

// Selisih gold diturunkan, bukan disimpan. Menyimpan kedua angka berarti operator bisa
// mengetik angka yang tidak sama dengan selisihnya, lalu overlay menampilkan dua
// kebenaran sekaligus.
function goldDiffOf(match) {
  return (Number(match?.blueGold) || 0) - (Number(match?.redGold) || 0);
}

function formatGoldDiff(value) {
  const diff = Number(value) || 0;
  if (diff === 0) return '0';
  const thousands = diff / 1000;
  // Di bawah 1000, tampilkan angka penuh supaya selisih kecil tidak jadi "0.0K".
  if (Math.abs(diff) < 1000) return `${diff > 0 ? '+' : '-'}${Math.abs(diff)}`;
  return `${diff > 0 ? '+' : '-'}${Math.abs(thousands).toFixed(1)}K`;
}

// Warna mengikuti tim yang sedang unggul supaya operator bisa melihat leader
// tanpa membaca angkanya dulu.
function goldDiffColor(match, style) {
  const diff = goldDiffOf(match);
  if (diff > 0) return style.blueAccent;
  if (diff < 0) return style.redAccent;
  return style.mutedColor;
}

// BO2 hanya menyimpan `games[i].winner`. Status tombol di DOM dan bentuk titik di
// overlay sama-sama diturunkan dari sana, jadi tidak mungkin ada dua sumber yang
// berbeda pendapat tentang game mana yang sudah dimainan.
function normalizeBo2(value) {
  const games = Array.isArray(value?.games) ? value.games : [];
  return {
    enabled: value?.enabled === true,
    bestOf: 2,
    games: [0, 1].map((index) => {
      const winner = games[index]?.winner;
      return { winner: winner === 'blue' || winner === 'red' ? winner : null };
    }),
  };
}

function bo2DotElements() {
  return bo2Editor ? [...bo2Editor.querySelectorAll('.bo2-dot')] : [];
}

function writeBo2ToDom(bo2) {
  if (!bo2Editor) return;
  const normalized = normalizeBo2(bo2);
  if (bo2Enabled) bo2Enabled.checked = normalized.enabled;
  bo2DotElements().forEach((dot) => {
    const team = dot.closest('.bo2-row')?.dataset.team;
    const winner = normalized.games[Number(dot.dataset.game)]?.winner ?? null;
    dot.dataset.state = winner === null ? 'pending' : winner === team ? 'win' : 'lose';
  });
}

function readBo2FromDom() {
  const games = [0, 1].map((gameIndex) => {
    const blue = bo2Editor?.querySelector(`.bo2-row[data-team="blue"] .bo2-dot[data-game="${gameIndex}"]`);
    if (blue?.dataset.state === 'win') return { winner: 'blue' };
    const red = bo2Editor?.querySelector(`.bo2-row[data-team="red"] .bo2-dot[data-game="${gameIndex}"]`);
    if (red?.dataset.state === 'win') return { winner: 'red' };
    return { winner: null };
  });
  return { enabled: bo2Enabled?.checked === true, bestOf: 2, games };
}

function bo2PreviewText(bo2, team) {
  return normalizeBo2(bo2).games
    .map((game) => (game.winner === null ? '○' : game.winner === team ? '●' : '✕'))
    .join(' ');
}

function toggleBo2Dot(team, gameIndex) {
  const bo2 = readBo2FromDom();
  const winner = bo2.games[gameIndex].winner;
  bo2.games[gameIndex] = { winner: winner === team ? null : team };
  writeBo2ToDom(bo2);
  const config = readFormValues();
  setConfig(config);
  renderPreview(config);
  pushLiveConfig(config);
}

function renderPreview(config = readFormValues()) {
  const designScale = previewStage.clientWidth / 1280;
  previewStage.replaceChildren();

  const items = [
    ...(config.headerImage ? [['headerImage', config.headerImage, 0, 'transparent']] : []),
    ['tournamentName', config.tournamentName, 12, config.style.mutedColor],
    ['roundName', config.roundName, 12, config.style.mutedColor],
    ['blueLogo', config.blueTeam.logo, 0, config.style.blueAccent],
    ['blueName', config.blueTeam.name, config.style.teamSize, config.style.blueAccent],
    ['blueKills', config.match.blueKills, 28, config.style.goldColor],
    ['matchTimer', `${String(Math.floor(config.match.timer / 60)).padStart(2, '0')}:${String(config.match.timer % 60).padStart(2, '0')}`, config.style.timerSize, config.style.textColor],
    ['redLogo', config.redTeam.logo, 0, config.style.redAccent],
    ['redName', config.redTeam.name, config.style.teamSize, config.style.redAccent],
    ['redKills', config.match.redKills, 28, config.style.goldColor],
    ['blueGold', `${(config.match.blueGold / 1000).toFixed(1)}K`, config.style.baseSize, config.style.goldColor],
    ['redGold', `${(config.match.redGold / 1000).toFixed(1)}K`, config.style.baseSize, config.style.goldColor],
    ['goldDiff', formatGoldDiff(goldDiffOf(config.match)), config.style.baseSize, goldDiffColor(config.match, config.style)],
    ['bo2Blue', bo2PreviewText(config.match.bo2, 'blue'), 16, config.style.blueAccent],
    ['bo2Red', bo2PreviewText(config.match.bo2, 'red'), 16, config.style.redAccent],
    ['turtleBlue', config.match.turtleBlue, 12, config.style.mutedColor],
    ['turtleRed', config.match.turtleRed, 12, config.style.mutedColor],
    ['lordBlue', config.match.lordBlue, 12, config.style.mutedColor],
    ['lordRed', config.match.lordRed, 12, config.style.mutedColor],
    ['towerBlue', config.match.towerBlue, 12, config.style.mutedColor],
    ['towerRed', config.match.towerRed, 12, config.style.mutedColor],
    ['casterName', config.casterName, 12, config.style.goldColor],
    ['hostName', config.hostName, 12, config.style.goldColor],
  ];
  config.customItems.forEach((item) => {
    items.push([item.id, item.type === 'text' ? item.text : item.src, item.type === 'text' ? item.size : 0, item.color || 'transparent']);
  });

  items.forEach(([key, value, size, color]) => {
    const customItem = config.customItems.find((item) => item.id === key);
    const isImage = key.endsWith('Logo') || key === 'headerImage' || customItem?.type === 'image';
    const isEmptyCustomImage = customItem?.type === 'image' && !customItem.src;
    const element = document.createElement(isImage && !isEmptyCustomImage ? 'img' : 'div');
    element.className = 'preview-item';
    element.dataset.layoutKey = key;
    if (isImage) {
      const width = customItem ? customItem.width : key === 'headerImage' ? config.headerWidth : 54;
      element.style.width = `${width * designScale}px`;
      if (key === 'headerImage') {
        element.style.height = 'auto';
        element.style.maxWidth = '100%';
        element.style.maxHeight = '100%';
      } else {
        const height = customItem ? customItem.height : 54;
        element.style.height = `${height * designScale}px`;
      }
      if (isEmptyCustomImage) {
        element.classList.add('preview-item-empty-image');
        element.textContent = 'Gambar';
      } else {
        element.src = value;
        element.alt = key === 'blueLogo' ? 'Blue Team' : key === 'redLogo' ? 'Red Team' : customItem?.name || 'Gameplay header';
      }
    } else {
      const itemStyle = customItem || config.style.items?.[key] || { size, color };
      element.textContent = value ?? '';
      element.style.fontSize = `${itemStyle.size * designScale}px`;
      element.style.color = itemStyle.color;
      element.style.fontFamily = config.style.fontFamily;
    }

    const position = config.layout[key] || { x: 0, y: 0 };
    element.style.left = `${(position.x / 1280) * 100}%`;
    element.style.top = `${(position.y / 720) * 100}%`;
    element.addEventListener('pointerdown', (event) => startPreviewDrag(event, element, config));
    previewStage.append(element);
  });
}

function startPreviewDrag(event, element, currentConfig) {
  event.preventDefault();
  // Pointer capture menjaga item tetap tertangkap walau kursor keluar dari preview. Kalau
  // tidak tersedia, drag tetap jalan normal -- jangan sampai satu panggilan ini
  // menggagalkan seluruh interaksi.
  if (typeof element.setPointerCapture === 'function') {
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      /* pointer sudah tidak aktif, abaikan */
    }
  }
  const startX = event.clientX;
  const startY = event.clientY;
  const position = currentConfig.layout[element.dataset.layoutKey] || { x: 0, y: 0 };
  const startLeft = position.x;
  const startTop = position.y;
  // Preview menampilkan kanvas 1280x720 yang diskalakan jadi lebar sebenarnya, jadi
  // jarak pointer harus dikali rasio itu agar item mengikuti kursor persis. Kalau panel
  // sedang tersembunyi clientWidth = 0 dan rasionya jadi Infinity, jadi abort saja.
  if (!previewStage.clientWidth) return;
  const scale = 1280 / previewStage.clientWidth;
  let nextPosition = { x: startLeft, y: startTop };
  let moved = false;

  const move = (moveEvent) => {
    nextPosition = {
      x: Math.max(0, Math.min(1280, Math.round(startLeft + (moveEvent.clientX - startX) * scale))),
      y: Math.max(0, Math.min(720, Math.round(startTop + (moveEvent.clientY - startY) * scale))),
    };
    moved = true;
    element.style.left = `${(nextPosition.x / 1280) * 100}%`;
    element.style.top = `${(nextPosition.y / 720) * 100}%`;
  };
  const finish = () => {
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', finish);
    element.removeEventListener('pointercancel', finish);

    // Klik tanpa geser tidak perlu membakar satu broadcast ke semua klien OBS.
    if (!moved) return;

    const config = readFormValues();
    config.layout[element.dataset.layoutKey] = nextPosition;
    setConfig(config);
    status.textContent = `Posisi ${element.dataset.layoutKey} tersimpan (${nextPosition.x}, ${nextPosition.y}).`;
    renderPreview(config);
    pushLiveConfig(config);
  };

  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', finish);
  element.addEventListener('pointercancel', finish);
}

function readFormValues() {
  const data = new FormData(form);
  const config = getConfig();

  // config.layout dipakai apa adanya: posisi hanya bisa diubah lewat drag-and-drop di
  // preview (lihat startPreviewDrag). Tidak ada lagi input X/Y yang perlu disinkronkan.
  config.tournamentName = data.get('tournamentName') || config.tournamentName;
  config.roundName = data.get('roundName') || config.roundName;
  config.hostName = data.get('hostName') || config.hostName;
  config.casterName = data.get('casterName') || config.casterName;
  config.blueTeam.name = data.get('blueName') || config.blueTeam.name;
  config.redTeam.name = data.get('redName') || config.redTeam.name;
  config.blueTeam.logo = data.get('blueLogo') || config.blueTeam.logo;
  config.redTeam.logo = data.get('redLogo') || config.redTeam.logo;
  config.headerWidth = Math.min(1280, Math.max(50, Number(data.get('headerWidth') || config.headerWidth)));

  config.match.timer = Number(data.get('timer') || 0);
  config.match.blueKills = Number(data.get('blueKills') || 0);
  config.match.redKills = Number(data.get('redKills') || 0);
  config.match.blueGold = Number(data.get('blueGold') || 0);
  config.match.redGold = Number(data.get('redGold') || 0);
  config.match.turtleBlue = Number(data.get('turtleBlue') || 0);
  config.match.turtleRed = Number(data.get('turtleRed') || 0);
  config.match.lordBlue = Number(data.get('lordBlue') || 0);
  config.match.lordRed = Number(data.get('lordRed') || 0);
  config.match.towerBlue = Number(data.get('towerBlue') || 0);
  config.match.towerRed = Number(data.get('towerRed') || 0);
  config.match.bo2 = readBo2FromDom();

  config.ocr.modes = {
    turtle: data.get('turtleMode') || 'auto',
    lord: data.get('lordMode') || 'auto',
    tower: data.get('towerMode') || 'manual',
  };

  config.style.fontFamily = data.get('fontFamily') || config.style.fontFamily;

  textStyleItems.forEach((key) => {
    const size = Number(data.get(`itemSize_${key}`));
    const color = data.get(`itemColor_${key}`);
    config.style.items[key] = {
      size: Number.isFinite(size) && size > 0 ? size : config.style.items[key].size,
      color: color || config.style.items[key].color,
    };
  });

  const enabled = ['timer', 'blueKills', 'redKills', 'blueGold', 'redGold'];
  if (config.ocr.modes.turtle === 'auto') enabled.push('turtleBlue', 'turtleRed');
  if (config.ocr.modes.lord === 'auto') enabled.push('lordBlue', 'lordRed');
  if (config.ocr.modes.tower === 'auto') enabled.push('towerBlue', 'towerRed');
  config.ocr.enabled = enabled;

  return readCustomItems(config);
}

function populateForm(config) {
  form.elements.tournamentName.value = config.tournamentName;
  form.elements.roundName.value = config.roundName;
  form.elements.hostName.value = config.hostName;
  form.elements.casterName.value = config.casterName;
  form.elements.blueName.value = config.blueTeam.name;
  form.elements.redName.value = config.redTeam.name;
  form.elements.blueLogo.value = config.blueTeam.logo;
  form.elements.redLogo.value = config.redTeam.logo;
  form.elements.headerWidth.value = config.headerWidth;
  headerWidthSlider.value = config.headerWidth;
  form.elements.timer.value = config.match.timer;
  form.elements.blueKills.value = config.match.blueKills;
  form.elements.redKills.value = config.match.redKills;
  form.elements.blueGold.value = config.match.blueGold;
  form.elements.redGold.value = config.match.redGold;
  form.elements.turtleBlue.value = config.match.turtleBlue;
  form.elements.turtleRed.value = config.match.turtleRed;
  form.elements.lordBlue.value = config.match.lordBlue;
  form.elements.lordRed.value = config.match.lordRed;
  form.elements.towerBlue.value = config.match.towerBlue;
  form.elements.towerRed.value = config.match.towerRed;
  form.elements.turtleMode.value = config.ocr.modes.turtle;
  form.elements.lordMode.value = config.ocr.modes.lord;
  form.elements.towerMode.value = config.ocr.modes.tower;
  form.elements.fontFamily.value = config.style.fontFamily;

  textStyleItems.forEach((key) => {
    form.elements[`itemSize_${key}`].value = config.style.items[key].size;
    form.elements[`itemColor_${key}`].value = config.style.items[key].color;
  });
  updateManualControls(config.ocr.modes);
  renderCustomItemEditors(config.customItems);
  writeBo2ToDom(config.match.bo2);
  renderOcrFieldRows();
  applyLockedFieldState(config);
}

function updateManualControls(modes) {
  ['turtle', 'lord', 'tower'].forEach((objective) => {
    const automatic = modes[objective] === 'auto';
    const group = document.querySelector(`[data-manual-group="${objective}"]`);
    group.querySelectorAll('[data-stat]').forEach((button) => {
      button.disabled = automatic;
    });
    group.querySelector(`[data-mode-label="${objective}"]`).textContent = automatic ? '(OCR)' : '(manual)';
  });

  ['turtleBlue', 'turtleRed', 'lordBlue', 'lordRed', 'towerBlue', 'towerRed'].forEach((key) => {
    const outputId = `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}-value`;
    document.getElementById(outputId).textContent = form.elements[key].value;
  });
}

function addCustomItem(type) {
  const config = readFormValues();
  const sequence = ++customIdSequence;
  const isText = type === 'text';
  const item = isText
    ? { id: `customText${sequence}`, type, name: `Teks custom ${sequence}`, text: 'Teks baru', size: 24, color: '#ffffff' }
    : { id: `customImage${sequence}`, type, name: `Gambar custom ${sequence}`, src: '', width: 160, height: 90 };
  config.customItems.push(item);
  config.layout[item.id] = { x: 40, y: Math.max(0, 620 - (config.customItems.length - 2) * 60) };
  setConfig(config);
  renderCustomItemEditors(config.customItems);
  renderPreview(config);
  pushLiveConfig(config);
}

function removeCustomItem(editor) {
  const config = readFormValues();
  const id = editor.dataset.customId;
  config.customItems = config.customItems.filter((item) => item.id !== id);
  delete config.layout[id];
  delete config.style.items[id];
  setConfig(config);
  renderCustomItemEditors(config.customItems);
  renderPreview(config);
  pushLiveConfig(config);
}

saveButton.addEventListener('click', () => {
  const config = readFormValues();
  setConfig(config);
  renderPreview(config);
  status.textContent = describeLiveResult(
    pushLiveConfig(config),
    'Pengaturan dan PNG header tersimpan serta dikirim ke gameplay.',
    'Tersimpan di browser. WebSocket sedang menyambung, update masuk antrean dan dikirim otomatis.',
  );
});

applyButton.addEventListener('click', () => {
  const config = readFormValues();
  setConfig(config);
  renderPreview(config);
  status.textContent = describeLiveResult(
    pushLiveConfig(config),
    'Update live terkirim ke overlay.',
    'Tersimpan di browser. WebSocket belum tersambung, update diantre dan dikirim otomatis.',
  );
});

resetButton.addEventListener('click', () => {
  localStorage.removeItem(configKey);
  localStorage.removeItem(assetsSignatureKey);
  sentAssetsSignature = '';
  populateForm(defaultConfig);
  renderPreview(defaultConfig);
  status.textContent = 'Nilai default dipulihkan.';
});

connectionBadge?.addEventListener('click', () => {
  assetsSyncedForConnection = false;
  sentAssetsSignature = '';
  liveSocket.reconnectNow('permintaan operator');
  pushLiveConfig(getConfig());
  status.textContent = 'Mencoba menyambung ulang dan mengirim ulang data ke overlay...';
});

document.querySelectorAll('[data-stat]').forEach((button) => {
  button.addEventListener('click', () => {
    const config = readFormValues();
    const stat = button.dataset.stat;
    const objective = stat.replace(/(Blue|Red)$/, '').toLowerCase();
    if (config.ocr.modes[objective] === 'auto') return;

    const nextValue = Math.max(0, Number(config.match[stat] || 0) + Number(button.dataset.delta || 0));
    config.match[stat] = nextValue;
    setConfig(config);
    renderPreview(config);

    form.elements[stat].value = nextValue;
    const outputId = `${stat.replace(/([A-Z])/g, '-$1').toLowerCase()}-value`;
    document.getElementById(outputId).textContent = nextValue;

    pushLiveConfig(config);

    const name = objective === 'turtle' ? 'Turtle' : objective === 'lord' ? 'Lord' : 'Tower';
    const team = stat.endsWith('Blue') ? 'Biru' : 'Merah';
    status.textContent = `${name} ${team} diubah ke ${nextValue}.`;
  });
});

populateForm(getConfig());
renderPreview(getConfig());
renderOcrFieldRows();
claimButton?.addEventListener('click', claimCurrentProfile);

async function loadOcrConfigFromServer() {
  const result = await Kit.fetchAux(slug, 'ocr');
  if (!result.ok) return;
  const remote = result.value || {};
  const config = getConfig();
  config.ocr = {
    ...(config.ocr || {}),
    modes: remote.modes || config.ocr?.modes || {},
    thresholds: remote.thresholds || config.ocr?.thresholds || {},
    anchor: remote.anchor || config.ocr?.anchor || {},
    regions: remote.regions && Object.keys(remote.regions).length ? remote.regions : config.ocr?.regions || {},
    ocrEnabled: remote.enabled !== false,
  };
  setConfig(config);
  populateForm(config);
  renderOcrFieldRows();
  applyLockedFieldState(config);
}

if (!isLocalBackend) {
  loadOcrConfigFromServer();
}
initAuxEditors();

if (isLocalBackend) {
  showProfileBanner('');
} else {
  Kit.describe(slug).then(async (result) => {
    if (!result.ok) {
      showProfileBanner(`Profil "${slug}" belum ada di server.`, '');
      return;
    }
    profileMeta = result.profile;
    Kit.rememberOwner(slug, ownerKey, {
      name: result.profile.name,
      template: result.profile.template,
      createdAt: result.profile.createdAt,
    });

    if (!result.profile.claimed) {
      showProfileBanner(
        'Profil ini belum diklaim. Siapa pun yang membuka halaman ini pertama bisa mengambil alih, jadi klaim sekarang sebelum URL-nya dibagikan.',
        'Klaim profil ini',
      );
      return;
    }
    if (!ownerKey) {
      showProfileBanner(
        `Profil "${result.profile.name}" sudah diklaim, tapi ownerKey tidak ada di browser ini. `
        + 'Tempel ownerKey lewat Beranda > Alat ownerKey, kalau tidak halaman ini hanya bisa membaca.',
        '',
      );
      return;
    }
    showProfileBanner('');
    liveSocket.start().then(() => {
      if (liveSocket.isOpen && liveSocket.authState === 'owner') pushLiveConfig(getConfig());
    });
  });
}

document.getElementById('add-custom-text').addEventListener('click', () => addCustomItem('text'));
document.getElementById('add-custom-image').addEventListener('click', () => addCustomItem('image'));

customItemsList.addEventListener('input', () => {
  renderPreview(readFormValues());
});

customItemsList.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-action="remove-custom"]');
  if (removeButton) removeCustomItem(removeButton.closest('.custom-item-editor'));
});

customItemsList.addEventListener('change', (event) => {
  const editor = event.target.closest('.custom-item-editor');
  if (!editor) return;
  if (event.target.dataset.field !== 'file' || !event.target.files?.[0]) {
    renderPreview(readFormValues());
    return;
  }

  const file = event.target.files[0];
  if (file.size > 300_000) {
    status.textContent = 'Gambar custom terlalu besar (maksimum 300 KB).';
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const config = readFormValues();
    const item = config.customItems.find((customItem) => customItem.id === editor.dataset.customId);
    if (!item) return;
    item.src = reader.result;
    setConfig(config);
    renderCustomItemEditors(config.customItems);
    renderPreview(config);
    status.textContent = describeLiveResult(
      pushLiveConfig(config),
      'Gambar custom tersimpan dan dikirim ke gameplay.',
      'Gambar custom tersimpan di browser dan menunggu WebSocket tersambung.',
    );
  }, { once: true });
  reader.readAsDataURL(file);
});

ocrEditor?.addEventListener('change', (event) => {
  if (!event.target.matches('[data-ocr-mode], [data-ocr-threshold], #ocr-enabled')) return;
  saveOcrConfig();
});

bo2Editor?.addEventListener('click', (event) => {
  const dot = event.target.closest('.bo2-dot');
  if (!dot) return;
  toggleBo2Dot(dot.closest('.bo2-row')?.dataset.team, Number(dot.dataset.game));
});

resultEditor?.addEventListener('change', (event) => {
  if (!event.target.matches('#result-visible, input[id^="result-"]')) return;
  saveResultConfig();
});
bo2Enabled?.addEventListener('change', () => {
  const config = readFormValues();
  setConfig(config);
  renderPreview(config);
  pushLiveConfig(config);
  updateResultSeriesNote();
  status.textContent = bo2Enabled.checked
    ? 'Indikator BO2 tampil di overlay.'
    : 'Indikator BO2 disembunyikan dari overlay.';
});
bo2Reset?.addEventListener('click', () => {
  writeBo2ToDom({ enabled: bo2Enabled?.checked === true, bestOf: 2, games: [{ winner: null }, { winner: null }] });
  const config = readFormValues();
  setConfig(config);
  renderPreview(config);
  pushLiveConfig(config);
  status.textContent = 'Seri BO2 dikosongkan.';
});

form.addEventListener('input', () => renderPreview(readFormValues()));
headerWidthSlider.addEventListener('input', () => {
  form.elements.headerWidth.value = headerWidthSlider.value;
  renderPreview(readFormValues());
});
form.elements.headerWidth.addEventListener('input', () => {
  headerWidthSlider.value = form.elements.headerWidth.value;
});
form.querySelectorAll('[name="turtleMode"], [name="lordMode"], [name="towerMode"]').forEach((select) => {
  select.addEventListener('change', () => {
    const config = readFormValues();
    setConfig(config);
    updateManualControls(config.ocr.modes);
    renderPreview(config);
    status.textContent = 'Mode OCR/manual tersimpan. OCR Live akan mengikuti mode ini.';
  });
});

headerImageInput.addEventListener('change', () => {
  const [file] = headerImageInput.files || [];
  if (!file) return;
  if (file.type !== 'image/png') {
    status.textContent = 'Pilih file PNG untuk header gameplay.';
    headerImageInput.value = '';
    return;
  }

  const image = new Image();
  image.addEventListener('load', () => {
    const canvas = document.createElement('canvas');
    try {
      let scale = Math.min(1, 1920 / image.width, 1080 / image.height);
      let headerImage = '';
      while (true) {
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        headerImage = canvas.toDataURL('image/png');
        if (headerImage.length <= 550_000) break;
        if (scale <= 0.2) throw new Error('PNG masih terlalu besar setelah diperkecil.');
        scale = Math.max(0.2, scale * 0.8);
      }

      const config = getConfig();
      config.headerImage = headerImage;
      setConfig(config);
      renderPreview(config);
      status.textContent = describeLiveResult(
        pushLiveConfig(config),
        'PNG header gameplay tersimpan dan dikirim ke overlay.',
        'PNG header tersimpan di browser dan menunggu WebSocket tersambung.',
      );
    } catch (error) {
      status.textContent = `PNG terlalu besar untuk disimpan: ${error.message}`;
    }
    URL.revokeObjectURL(image.src);
  }, { once: true });
  image.src = URL.createObjectURL(file);
});

window.addEventListener('beforeunload', () => liveSocket.stop());

window.addEventListener('storage', (event) => {
  if (event.key !== configKey) return;
  const config = getConfig();
  populateForm(config);
  renderPreview(config);
});
