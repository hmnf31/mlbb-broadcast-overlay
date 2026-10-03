// The overlay is a viewer: it only needs the slug, never the ownerKey. That way the
// OBS browser source URL can be shared with a co-caster without granting edit rights.
const Kit = window.ProfileKit;
const slug = Kit.slugFromPath();
const configKey = slug ? `mlbb_overlay_config_${slug}` : 'mlbb_overlay_config';

const defaultConfig = {
  tournamentName: 'MLBB Official League',
  roundName: 'Grand Final',
  hostName: 'Lala',
  casterName: 'Adit',
  headerImage: '',
  headerWidth: 1280,
  customItems: [
    { id: 'customText1', type: 'text', name: 'Teks custom 1', text: 'Teks Custom', size: 24, color: '#ffffff' },
    { id: 'customImage1', type: 'image', name: 'Gambar custom 1', src: '', width: 160, height: 90 },
  ],
  blueTeam: { name: 'Blue Phoenix', logo: '/assets/teams/blue-phoenix.svg' },
  redTeam: { name: 'Red Viper', logo: '/assets/teams/red-viper.svg' },
  match: {
    timer: 1325,
    blueKills: 9,
    redKills: 7,
    blueGold: 18840,
    redGold: 17520,
    goldDiff: 1320,
    turtleBlue: 1,
    turtleRed: 0,
    lordBlue: 1,
    lordRed: 0,
    towerBlue: 3,
    towerRed: 2,
  },
  style: {
    fontFamily: 'Segoe UI, Tahoma, sans-serif',
    baseSize: 16,
    textColor: '#edf4ff',
    mutedColor: '#a5b6ca',
    goldColor: '#ffd76a',
    blueAccent: '#5aa9ff',
    redAccent: '#ff6666',
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
    headerImage: { x: 0, y: 0 },
    customText1: { x: 40, y: 600 },
    customImage1: { x: 40, y: 480 },
    tournamentName: { x: 320, y: 28 },
    roundName: { x: 320, y: 54 },
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
  },
};

const ui = {
  headerImage: document.getElementById('header-image'),
  tournamentName: document.getElementById('tournament-name'),
  roundName: document.getElementById('round-name'),
  matchTimer: document.getElementById('match-timer'),
blueGold: document.getElementById('blue-gold'),
    redGold: document.getElementById('red-gold'),
    goldDiff: document.getElementById('gold-diff'),
  bo2Blue: document.getElementById('bo2-blue'),
  bo2Red: document.getElementById('bo2-red'),
  rosterBlue: document.getElementById('roster-blue'),
  rosterRed: document.getElementById('roster-red'),
  turtleBlue: document.getElementById('turtle-blue'),
  turtleRed: document.getElementById('turtle-red'),
  lordBlue: document.getElementById('lord-blue'),
  lordRed: document.getElementById('lord-red'),
  towerBlue: document.getElementById('tower-blue'),
  towerRed: document.getElementById('tower-red'),
  blueKills: document.getElementById('blue-kills'),
  redKills: document.getElementById('red-kills'),
  blueName: document.getElementById('blue-name'),
  redName: document.getElementById('red-name'),
  blueLogo: document.getElementById('blue-logo'),
  redLogo: document.getElementById('red-logo'),
  casterName: document.getElementById('caster-name'),
  hostName: document.getElementById('host-name'),
};

function getConfig() {
  const saved = JSON.parse(localStorage.getItem(configKey) || 'null');
  const config = {
    ...defaultConfig,
    ...saved,
    headerImage: saved?.headerImage || saved?.referenceImage || '',
    customItems: saved?.customItems || defaultConfig.customItems.map((item) => ({ ...item })),
    blueTeam: { ...defaultConfig.blueTeam, ...(saved?.blueTeam || {}) },
    redTeam: { ...defaultConfig.redTeam, ...(saved?.redTeam || {}) },
    match: { ...defaultConfig.match, ...(saved?.match || {}) },
    style: {
      ...defaultConfig.style,
      ...(saved?.style || {}),
      items: { ...defaultConfig.style.items, ...(saved?.style?.items || {}) },
    },
    layout: { ...defaultConfig.layout, ...(saved?.layout || {}) },
    ocr: { ...defaultConfig.ocr, ...(saved?.ocr || {}) },
  };
  delete config.referenceImage;
  return config;
}

function formatTimer(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatGold(value) {
  const numeric = Number(value || 0);
  return `${(numeric / 1000).toFixed(1)}K`;
}

// Selisih gold selalu dihitung dari kedua angka gold, tidak pernah dikirim terpisah.
// Kalau operator salah mengetik, angka yang meleset tetap terlihat dan selisihnya
// tetap benar.
function goldDiffOf(match) {
  return (Number(match?.blueGold) || 0) - (Number(match?.redGold) || 0);
}

function formatGoldDiff(value) {
  const diff = Number(value) || 0;
  if (diff === 0) return '0';
  // Di bawah 1000, tampilkan angka penuh supaya selisih kecil tidak jadi "0.0K".
  if (Math.abs(diff) < 1000) return `${diff > 0 ? '+' : '-'}${Math.abs(diff)}`;
  return `${diff > 0 ? '+' : '-'}${Math.abs(diff / 1000).toFixed(1)}K`;
}

function goldDiffColor(match, style) {
  const diff = goldDiffOf(match);
  if (diff > 0) return style.blueAccent;
  if (diff < 0) return style.redAccent;
  return style.mutedColor;
}

function applyStyle(config) {
  const root = document.documentElement;
  root.style.setProperty('--font-family', config.style.fontFamily || 'Segoe UI, Tahoma, sans-serif');
  root.style.setProperty('--base-size', `${config.style.baseSize || 16}px`);
  root.style.setProperty('--text-color', config.style.textColor || '#edf4ff');
  root.style.setProperty('--muted-color', config.style.mutedColor || '#a5b6ca');
  root.style.setProperty('--gold-color', config.style.goldColor || '#ffd76a');
  root.style.setProperty('--blue-color', config.style.blueAccent || '#5aa9ff');
  root.style.setProperty('--red-color', config.style.redAccent || '#ff6666');
}

function applyItemStyles(config) {
  const elements = {
    tournamentName: ui.tournamentName,
    roundName: ui.roundName,
    blueName: ui.blueName,
    blueKills: ui.blueKills,
    matchTimer: ui.matchTimer,
    redName: ui.redName,
    redKills: ui.redKills,
    blueGold: ui.blueGold,
    redGold: ui.redGold,
    goldDiff: ui.goldDiff,
    turtleBlue: ui.turtleBlue,
    turtleRed: ui.turtleRed,
    lordBlue: ui.lordBlue,
    lordRed: ui.lordRed,
    towerBlue: ui.towerBlue,
    towerRed: ui.towerRed,
    casterName: ui.casterName,
    hostName: ui.hostName,
  };

  Object.entries(elements).forEach(([key, element]) => {
    const itemStyle = config.style.items?.[key];
    if (!itemStyle) return;
    element.style.fontSize = `calc(${Number(itemStyle.size) || 12}px * var(--design-scale))`;
    // Warna bawaan selisih gold mengikuti tim yang unggul, jadi operator tidak perlu
    // membaca angkanya dulu untuk tahu siapa yang di depan.
    element.style.color = itemStyle.color || config.style.textColor;
  });

  if (config.style.items?.goldDiff) {
    ui.goldDiff.style.color = goldDiffColor(config.match, config.style);
  }
}

function applyLayout(config) {
  const loaded = config.layout || defaultConfig.layout;
  Object.entries(loaded).forEach(([key, value]) => {
    const element = document.getElementById(key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));
    if (!element || !value) return;

    element.style.left = `${(Number(value.x || 0) / 1280) * 100}%`;
    element.style.top = `${(Number(value.y || 0) / 720) * 100}%`;
    element.dataset.layoutKey = key;
  });
}

function applyDesignScale() {
  const shell = document.getElementById('overlay-shell');
  document.documentElement.style.setProperty('--design-scale', String(shell.clientWidth / 1280));}

function enablePositionEditor() {
  if (!new URLSearchParams(window.location.search).has('edit')) return;

  document.body.classList.add('position-editor');
  document.querySelectorAll('.item').forEach((element) => {
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      const startX = event.clientX;
      const startY = event.clientY;
      const initialLeft = element.offsetLeft;
      const initialTop = element.offsetTop;

      const move = (moveEvent) => {
        const x = Math.max(0, Math.round(initialLeft + moveEvent.clientX - startX));
        const y = Math.max(0, Math.round(initialTop + moveEvent.clientY - startY));
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
      };

      const finish = () => {
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerup', finish);
        element.removeEventListener('pointercancel', finish);

        const config = getConfig();
        const layoutKey = element.dataset.layoutKey;
        const shell = document.getElementById('overlay-shell');
        config.layout[layoutKey] = {
          x: Math.round((element.offsetLeft / shell.clientWidth) * 1280),
          y: Math.round((element.offsetTop / shell.clientHeight) * 720),
        };
        localStorage.setItem(configKey, JSON.stringify(config));
      };

      element.addEventListener('pointermove', move);
      element.addEventListener('pointerup', finish);
      element.addEventListener('pointercancel', finish);
    });
  });
}

let lastSnapshot = null;
let remoteAssets = { version: null, headerImage: '', images: {} };
let rosterState = null;

// The roster can arrive twice: once from the initial aux read and once inside a snapshot.
// A snapshot is newer, so a slow aux read must not wipe players the snapshot already gave us.
let rosterSettled = false;

async function loadPlayers() {
  const response = slug ? await Kit.fetchAux(slug, 'players') : { ok: false };
  if (rosterSettled) return;
  applyRoster(response.ok ? response.value : null);
}

async function loadRemoteAssets(version) {
  if (version === null || version === undefined || version === remoteAssets.version) return;
  try {
    const response = slug
      ? await Kit.fetchAssets(slug, version)
      : await fetch(`/api/assets?v=${encodeURIComponent(version)}`, { cache: 'no-store' }).then((res) => (
        res.ok ? res.json().then((assets) => ({ ok: true, assets })) : { ok: false }
      ));
    if (!response.ok) return;
    const assets = response.assets;
    remoteAssets = {
      version: assets.version ?? version,
      headerImage: assets.headerImage || '',
      images: assets.images || {},
    };
  } catch {
    // keep last known assets, overlay stays usable offline
  }
}

function resolveCustomItems(items) {
  return (items || []).map((item) => (
    item.type === 'image' && !item.src
      ? { ...item, src: remoteAssets.images[item.id] || '' }
      : item
  ));
}

function render(config, stateOverride = null) {
  const presentation = stateOverride?.presentation || {};
  const configState = {
    ...config,
    tournamentName: presentation.tournamentName ?? config.tournamentName,
    roundName: presentation.roundName ?? config.roundName,
    hostName: presentation.hostName ?? config.hostName,
    casterName: presentation.casterName ?? config.casterName,
    headerImage: stateOverride
      ? (presentation.headerImage || remoteAssets.headerImage || '')
      : (config.headerImage || remoteAssets.headerImage || ''),
    headerWidth: presentation.headerWidth ?? config.headerWidth,
    match: { ...config.match, ...(stateOverride?.match || {}) },
    blueTeam: { ...config.blueTeam, ...(stateOverride?.teams?.blue || {}) },
    redTeam: { ...config.redTeam, ...(stateOverride?.teams?.red || {}) },
    style: {
      ...config.style,
      ...(presentation.style || {}),
      items: { ...config.style.items, ...(presentation.style?.items || {}) },
    },
    customItems: resolveCustomItems(presentation.customItems ?? config.customItems),
    layout: { ...config.layout, ...(presentation.layout || {}), ...(stateOverride?.layout || {}) },
  };

  applyStyle(configState);
  applyItemStyles(configState);
  renderCustomItems(configState);
  applyLayout(configState);

  ui.tournamentName.textContent = configState.tournamentName;
  ui.headerImage.hidden = !configState.headerImage;
  if (configState.headerImage) {
    ui.headerImage.src = configState.headerImage;
    ui.headerImage.style.width = `calc(${Number(configState.headerWidth) || 1280}px * var(--design-scale))`;
  }
  ui.roundName.textContent = configState.roundName;
  ui.blueName.textContent = configState.blueTeam.name;
  ui.redName.textContent = configState.redTeam.name;
  ui.blueLogo.src = configState.blueTeam.logo;
  ui.redLogo.src = configState.redTeam.logo;

  const match = configState.match;
  ui.matchTimer.textContent = formatTimer(Number(match.timer || 0));
  ui.blueKills.textContent = match.blueKills ?? 0;
  ui.redKills.textContent = match.redKills ?? 0;
  ui.blueGold.textContent = formatGold(match.blueGold ?? 0);
  ui.redGold.textContent = formatGold(match.redGold ?? 0);
  ui.goldDiff.textContent = formatGoldDiff(goldDiffOf(match));
  ui.goldDiff.style.color = goldDiffColor(match, configState.style);

  ui.turtleBlue.textContent = match.turtleBlue ?? 0;
  ui.turtleRed.textContent = match.turtleRed ?? 0;
  ui.lordBlue.textContent = match.lordBlue ?? 0;
  ui.lordRed.textContent = match.lordRed ?? 0;
  ui.towerBlue.textContent = match.towerBlue ?? 0;
  ui.towerRed.textContent = match.towerRed ?? 0;
  renderBo2(match);

  ui.casterName.textContent = configState.casterName || '';
  ui.hostName.textContent = configState.hostName || '';
}

function renderRoster(side, container) {
  const players = Array.isArray(rosterState?.[side]) ? rosterState[side] : [];
  const filled = players.filter((player) => player && (player.name || player.heroImage));
  container.hidden = filled.length === 0;
  container.replaceChildren();

  for (const player of players) {
    const card = document.createElement('div');
    card.className = 'roster-card';

    const hero = document.createElement('img');
    hero.className = 'roster-hero';
    hero.src = player?.heroImage || '';
    hero.alt = player?.hero || '';
    hero.hidden = !player?.heroImage;

    const level = document.createElement('span');
    level.className = 'roster-level';
    level.textContent = player?.level > 1 ? String(player.level) : '';

    const name = document.createElement('span');
    name.className = 'roster-name';
    name.textContent = player?.name || player?.hero || '-';

    const stats = document.createElement('span');
    stats.className = 'roster-stats';
    for (const [key, label] of [['kills', 'K'], ['deaths', 'D'], ['assists', 'A']]) {
      const group = document.createElement('span');
      const value = document.createElement('b');
      value.textContent = String(player?.[key] ?? 0);
      const caption = document.createElement('i');
      caption.textContent = label;
      group.append(value, caption);
      stats.append(group);
    }

    card.append(hero, level, name, stats);

    const items = Array.isArray(player?.items) ? player.items.filter(Boolean).slice(0, 6) : [];
    if (items.length) {
      const itemRow = document.createElement('div');
      itemRow.className = 'roster-items';
      for (const path of items) {
        const image = document.createElement('img');
        image.src = path;
        image.alt = '';
        itemRow.append(image);
      }
      card.append(itemRow);
    }

    container.append(card);
  }
}

function applyRoster(players) {
  rosterState = players || null;
  renderRoster('blue', ui.rosterBlue);
  renderRoster('red', ui.rosterRed);
}

function renderPlayers(players) {
  rosterSettled = true;
  applyRoster(players);
}

function renderBo2(match) {
  const bo2 = match?.bo2 || {};
  const games = (Array.isArray(bo2.games) ? bo2.games : []).slice(0, 2);
  const enabled = bo2.enabled === true && games.length > 0;
  const winsOf = (team) => games.filter((game) => game?.winner === team).length;
  const blueWins = winsOf('blue');
  const redWins = winsOf('red');
  const pending = games.filter((game) => !game?.winner).length;

  // Titik tidak pernah menyimpan statusnya sendiri: bentuknya diturunkan dari `games[i].winner`
  // supaya tidak mungkin dua tim sama-sama merah untuk game yang sama.
  for (const [team, element, teamWins] of [
    ['blue', ui.bo2Blue, blueWins],
    ['red', ui.bo2Red, redWins],
  ]) {
    element.hidden = !enabled;
    if (!enabled) continue;

    element.replaceChildren();
    const teamDone = teamWins >= games.length;

    games.forEach((game) => {
      const dot = document.createElement('span');
      dot.className = 'bo2-dot';
      const winner = game?.winner ?? null;
      dot.dataset.state = winner === null ? 'pending' : winner === team ? 'win' : 'lose';
      // Match point: tinggal satu game lagi, dan game itu belum ada pemiliknya.
      if (winner === null && !teamDone && teamWins >= games.length - 1 && pending > 0) {
        dot.dataset.matchpoint = '1';
      }
      element.append(dot);
    });

    if (teamDone) {
      const badge = document.createElement('span');
      badge.className = 'bo2-set';
      badge.textContent = 'SET';
      element.append(badge);
    }
  }
}

function renderCustomItems(config) {
  const layer = document.getElementById('custom-items-layer');
  layer.replaceChildren();
  (config.customItems || []).forEach((item) => {
    if (item.type === 'image' && !item.src) return;
    const isImage = item.type === 'image';
    const element = document.createElement(isImage ? 'img' : 'div');
    const elementId = item.id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    element.className = 'item custom-item';
    element.id = elementId;
    element.dataset.layoutKey = item.id;
    if (isImage) {
      element.src = item.src;
      element.alt = item.name || 'Custom image';
      element.style.width = `calc(${Number(item.width) || 160}px * var(--design-scale))`;
      element.style.height = `calc(${Number(item.height) || 90}px * var(--design-scale))`;
      element.style.objectFit = 'contain';
    } else {
      element.textContent = item.text || '';
      element.style.fontSize = `calc(${Number(item.size) || 24}px * var(--design-scale))`;
      element.style.color = item.color || '#ffffff';
      element.style.fontFamily = config.style.fontFamily;
    }
    layer.append(element);
  });
}

const liveSocket = window.LiveSocket.create({
  role: 'overlay',
  slug,
  onStatus: (state, info) => {
    if (state === 'online') console.log('Overlay live socket connected to', info.detail);
    if (state === 'offline') console.warn('Overlay live socket dropped, reconnecting to', info.detail);
  },
  onMessage: (message) => {
    if (message.type === 'snapshot' && message.payload) {
      lastSnapshot = message.payload;
      loadRemoteAssets(message.assetsVersion).then(() => render(getConfig(), lastSnapshot));
      if (message.payload?.players !== undefined) renderPlayers(message.payload.players);
      return;
    }
    if (message.type === 'assets_changed') {
      loadRemoteAssets(message.assetsVersion).then(() => {
        if (lastSnapshot) render(getConfig(), lastSnapshot);
      });
    }
  },
});

const config = getConfig();
applyDesignScale();
render(config);
applyRoster(config.players || null);
enablePositionEditor();
// Assets arriving after a snapshot must not wipe it: pass lastSnapshot through so a slow
// first fetch cannot re-render the overlay with stale default values.
loadRemoteAssets(0).then(() => render(getConfig(), lastSnapshot));
loadPlayers();
liveSocket.start();

window.addEventListener('resize', applyDesignScale);

window.addEventListener('storage', (event) => {
  if (event.key !== configKey) return;
  render(getConfig());
});
