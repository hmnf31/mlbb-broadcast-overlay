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
    enabled: ['timer', 'blueKills', 'redKills', 'blueGold', 'redGold'],
    // `modes` adalah Field Lock PER FIELD dan ini yang bentuknya disimpan server
    // (lihat normalizeOcrState di worker.mjs: key yang bukan nama field dibuang).
    modes: {},
    // `objectiveModes` adalah mode per objective yang mengikat select "Mode Lord/Tower" dan
    // tombol +/- di section Objective. Keduanya tidak boleh berbagi satu key: objective
    // menulis {lord,tower} sementara server menulis {lordBlue,...}. Begitu keduanya berbagi
    // key, config OCR dari server menimpa nilai objective dan select-nya jadi kosong.
    // Turtle tidak punya mode lagi: kirimannya selalu manual.
    objectiveModes: { turtle: 'manual', lord: 'manual', tower: 'manual' },
  },
};

// Nilai objective mode yang selalu sah. Dipakai populateForm supaya tidak pernah menulis
// nilai yang tidak ada di <option> mana pun; browser akan menyisakan selectedIndex -1 dan
// select tampil kosong kalau itu terjadi.
// Lord dan Tower default manual. Versi lama default turtle/lord ke 'auto', sehingga tombol
  // +/- Turtle dan Lord greyed sejak halaman dibuka sementara Tower (default 'manual') bisa
  // langsung dipakai -- persis laporan "Hanya Turtle dan Lord yang tidak bisa manual".
  // Turtle kini tidak punya mode sama sekali: selalu manual.
// Select Mode Turtle/Lord/Tower hidup di dalam card Objective, yang berada DI LUAR
// <form id="control-form"> (form cuma membungkus form pengaturan utama). Jadi select ini
// tidak bisa dibaca lewat form.elements maupun new FormData(form) -- keduanya hanya melihat
// kontrol di dalam form. Versi lama menaruh select-nya di dalam form, 220 baris di atas
// tombol yang dikontrol, supaya operator tidak pernah menemukan switch-nya.
function objectiveModeInputs() {
  const inputs = {};
  // Turtle tidak punya select: OCR hanya-scan Lord dan Tower, Turtle selalu manual.
  ['lord', 'tower'].forEach((objective) => {
    inputs[objective] = document.querySelector(`[data-manual-group="${objective}"] select[name="${objective}Mode"]`);
  });
  return inputs;
}

function readObjectiveModeFromDom() {
  const inputs = objectiveModeInputs();
  const read = (objective) => (inputs[objective]?.value === 'auto' ? 'auto' : 'manual');
  return { turtle: 'manual', lord: read('lord'), tower: read('tower') };
}

function readObjectiveModes(config) {
  const saved = config?.ocr?.objectiveModes || {};
  return {
    turtle: 'manual',
    lord: saved.lord === 'auto' ? 'auto' : 'manual',
    tower: saved.tower === 'auto' ? 'auto' : 'manual',
  };
}

// ObjectiveModes hanya hidup di localStorage, jadi pilihan "Manual" operator hilang begitu
// halaman dibuka di browser lain. Field Lock per-field disimpan di server, jadi dari situ
// mode objective bisa diturunkan kembali: kalau kedua field tim untuk satu objective
// dikunci, objective itu manual. Nilai lokal tetap menang supaya pilihan operator di
// browser ini tidak ditimpa oleh data server yang lebih lama.
function seedObjectiveModes(ocr, remoteModes) {
  const current = readObjectiveModes({ ocr });
  const modes = remoteModes || {};
  const locked = (field) => modes[field] === 'lock' || modes[field] === 'manual';
  const seeded = { ...current };
  ['lord', 'tower'].forEach((objective) => {
    const fields = [`${objective}Blue`, `${objective}Red`];
    if (!fields.some((field) => modes[field])) return;
    const manual = fields.every((field) => locked(field));
    // Default hanya ditulis kalau objective ini belum pernah disentuh operator.
    if (ocr?.objectiveModes?.[objective]) return;
    seeded[objective] = manual ? 'manual' : 'auto';
  });
  return seeded;
}

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
  ['result-mode-input', 'mode', 'mode'],
  ['result-stage-label-input', 'stageLabel', 'text'],
  ['result-headline-input', 'headline', 'text'],
  ['result-subline-input', 'subline', 'text'],
  ['result-game-input', 'gameNumber', 'int'],
  ['result-bestof-input', 'bestOf', 'int'],
  ['result-duration-input', 'durationSec', 'int'],
  ['result-dealt-input', 'damageDealt', 'int'],
  ['result-taken-input', 'damageTaken', 'int'],
  ['result-mvp-input', 'mvp', 'text'],
  ['result-caster-note-input', 'casterNote', 'text'],
];

const defaultResultConfig = {
  visible: false,
  mode: 'mvp',
  stageLabel: '',
  seriesScore: { blue: 0, red: 0 },
  objectives: {
    turtle: { blue: 0, red: 0 },
    lord: { blue: 0, red: 0 },
    turret: { blue: 0, red: 0 },
  },
  gameNumber: 1,
  bestOf: 5,
  durationSec: 0,
  damageDealt: 0,
  damageTaken: 0,
  mvp: '',
  headline: 'VICTORY',
  subline: '',
  casterNote: '',
};

// Nested groups live outside RESULT_FIELDS because that list only walks flat scalars. The
// server normalises exactly these shapes (worker.mjs normalizeResultState).
const RESULT_SERIES_FIELDS = [
  ['result-series-blue-input', 'blue'],
  ['result-series-red-input', 'red'],
];
const RESULT_OBJECTIVE_FIELDS = [
  ['result-turtle-blue-input', 'turtle', 'blue'],
  ['result-turtle-red-input', 'turtle', 'red'],
  ['result-lord-blue-input', 'lord', 'blue'],
  ['result-lord-red-input', 'lord', 'red'],
  ['result-turret-blue-input', 'turret', 'blue'],
  ['result-turret-red-input', 'turret', 'red'],
];

function mergeResultConfig(raw) {
  const value = { ...defaultResultConfig, ...(raw || {}) };
  value.seriesScore = { ...defaultResultConfig.seriesScore, ...(value.seriesScore || {}) };
  value.objectives = { ...defaultResultConfig.objectives, ...(value.objectives || {}) };
  for (const group of ['turtle', 'lord', 'turret']) {
    value.objectives[group] = {
      ...defaultResultConfig.objectives[group],
      ...(value.objectives[group] || {}),
    };
  }
  return value;
}

const defaultPlayer = () => ({
  name: '',
  hero: '',
  heroImage: '',
  level: 1,
  kills: 0,
  deaths: 0,
  assists: 0,
  rating: 0,
  gold: 0,
  gpm: 0,
  damage: 0,
  damagePct: 0,
  turretDamage: 0,
  battleSpell: '',
  emblem: '',
  items: [],
});

function readResultConfig() {
  const config = getConfig();
  const result = mergeResultConfig(config.result);
  for (const [id, key, type] of RESULT_FIELDS) {
    const input = document.getElementById(id);
    if (!input) continue;
    if (type === 'bool') result[key] = input.checked;
    else if (type === 'mode') result[key] = input.value === 'scoreboard' ? 'scoreboard' : 'mvp';
    else if (type === 'int') result[key] = Number(input.value) || 0;
    else result[key] = input.value;
  }
  for (const [id, side] of RESULT_SERIES_FIELDS) {
    const input = document.getElementById(id);
    if (input) result.seriesScore[side] = Number(input.value) || 0;
  }
  for (const [id, group, side] of RESULT_OBJECTIVE_FIELDS) {
    const input = document.getElementById(id);
    if (input) result.objectives[group][side] = Number(input.value) || 0;
  }
  return result;
}

function writeResultConfig(result) {
  const value = mergeResultConfig(result);
  for (const [id, key, type] of RESULT_FIELDS) {
    const input = document.getElementById(id);
    if (!input) continue;
    if (type === 'bool') input.checked = value[key] === true;
    else if (type === 'mode') input.value = value[key] === 'scoreboard' ? 'scoreboard' : 'mvp';
    else input.value = String(value[key] ?? '');
  }
  for (const [id, side] of RESULT_SERIES_FIELDS) {
    const input = document.getElementById(id);
    if (input) input.value = String(value.seriesScore[side]);
  }
  for (const [id, group, side] of RESULT_OBJECTIVE_FIELDS) {
    const input = document.getElementById(id);
    if (input) input.value = String(value.objectives[group][side]);
  }
  renderMvpOptions();
  updateResultSeriesNote();
  const link = document.getElementById('result-obs-link');
  if (link) link.href = Kit.pageUrl(slug, 'overlay/result');
}

function updateResultSeriesNote() {
  const note = document.getElementById('result-series-note');
  if (!note) return;
  const bo2 = document.getElementById('bo2-enabled')?.checked === true;
  note.textContent = bo2
    ? 'Skor seri memakai Seri BO2 di atas selama indikatornya aktif, jadi angka manual diabaikan.'
    : 'Indikator BO2 mati: layar hasil memakai Skor seri manual di bawah.';
}

// The result overlay resolves `result.mvp` with a fuzzy match against the roster, so a typo
// silently highlights a different player. Offer the real roster names as suggestions.
function renderMvpOptions() {
  const datalist = document.getElementById('result-mvp-options');
  if (!datalist || !playersState) return;
  const names = [];
  for (const side of ['blue', 'red']) {
    for (const player of playersState[side] || []) {
      if (player.name) names.push(player.name);
    }
  }
  datalist.replaceChildren(...names.map((name) => {
    const option = document.createElement('option');
    option.value = name;
    return option;
  }));
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

// Single source of truth for the roster editor. The per-row handlers below mutate this
// object and then call savePlayersConfig(); if savePlayersConfig re-read localStorage it
// would rebuild fresh objects from the pre-edit values and silently discard every change,
// which is exactly what happened before. One object, one save path.
// Left null on purpose: readPlayersConfig() touches configKey, which is declared further
// down, so eager initialisation would hit the temporal dead zone.
let playersState = null;

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
  playersState = players;
  const config = getConfig();
  config.players = players;
  setConfig(config);
}

async function savePlayersConfig() {
  if (!slug || !ownerKey) return;
  const players = playersState;
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

// --- Layar draft (Fase 1) ---------------------------------------------------
// Analitik dihitung ulang di sini dari matriks yang sama dengan overlay, jadi angka di panel
// operator persis dengan yang tayang. Yang dikirim ke server tetap cuma slot pick/ban.
const DraftAnalytics = window.DraftAnalytics;
const draftEditor = document.getElementById('draft-editor');
let draftMatrix = null;
const DRAFT_SIDE_SLOTS = { blue: { picks: 'draft-blue-picks', bans: 'draft-blue-bans' }, red: { picks: 'draft-red-picks', bans: 'draft-red-bans' } };

function readDraftConfig() {
  const config = getConfig();
  const state = DraftAnalytics.normalizeDraft(config.draft);
  state.visible = document.getElementById('draft-visible')?.checked === true;
  state.round = Number(document.getElementById('draft-round-input')?.value) || 1;
  state.activeSide = document.getElementById('draft-active-side')?.value === 'red' ? 'red' : 'blue';
  for (const side of ['blue', 'red']) {
    for (const kind of ['picks', 'bans']) {
      const slots = document.getElementById(DRAFT_SIDE_SLOTS[side][kind]);
      if (!slots) continue;
      const values = [...slots.querySelectorAll('select')]
        .map((select) => select.value)
        .filter(Boolean);
      state[side][kind] = values;
    }
  }
  return state;
}

function writeDraftConfig(value) {
  const state = DraftAnalytics.normalizeDraft(value);
  const visible = document.getElementById('draft-visible');
  const round = document.getElementById('draft-round-input');
  const activeSide = document.getElementById('draft-active-side');
  if (visible) visible.checked = state.visible;
  if (round) round.value = String(state.round);
  if (activeSide) activeSide.value = state.activeSide;
  for (const side of ['blue', 'red']) {
    for (const kind of ['picks', 'bans']) {
      const slots = document.getElementById(DRAFT_SIDE_SLOTS[side][kind]);
      if (!slots) continue;
      const selects = [...slots.querySelectorAll('select')];
      const values = state[side][kind];
      selects.forEach((select, index) => {
        select.value = values[index] || '';
      });
    }
  }
  renderDraftAnalytics(state);
}

function buildDraftSlotSelects() {
  const heroes = [...(registryCache?.categories?.heroes?.items || [])].sort((a, b) =>
    (a.name || a.id).localeCompare(b.name || b.id),
  );
  for (const side of ['blue', 'red']) {
    for (const [kind, id] of Object.entries(DRAFT_SIDE_SLOTS[side])) {
      const container = document.getElementById(id);
      if (!container) continue;
      const slots = kind === 'picks' ? DraftAnalytics.PICK_SLOTS : DraftAnalytics.BAN_SLOTS;
      container.replaceChildren();
      for (let index = 0; index < slots; index += 1) {
        const select = document.createElement('select');
        select.dataset.side = side;
        select.dataset.kind = kind;
        const blank = document.createElement('option');
        blank.value = '';
        blank.textContent = '-';
        select.append(blank);
        for (const hero of heroes) {
          const option = document.createElement('option');
          option.value = hero.id;
          option.textContent = hero.name || hero.id;
          select.append(option);
        }
        select.addEventListener('change', () => renderDraftAnalytics(readDraftConfig()));
        container.append(select);
      }
    }
  }
}

function renderDraftAnalytics(state) {
  if (!draftEditor) return;
  const report = DraftAnalytics.evaluate(state, draftMatrix);
  const hasMatrix = Boolean(draftMatrix);

  const fill = document.getElementById('draft-advantage-fill');
  if (fill) {
    fill.style.width = `${hasMatrix ? Math.min(50, Math.abs(report.advantage) / 2) : 0}%`;
    fill.dataset.leader = report.leader;
  }
  const blue = document.getElementById('draft-blue-advantage');
  const red = document.getElementById('draft-red-advantage');
  if (blue) blue.textContent = hasMatrix ? signedDraft(report.advantage) : '--';
  if (red) red.textContent = hasMatrix ? signedDraft(-report.advantage) : '--';

  const list = document.getElementById('draft-recommend-list');
  const sideLabel = document.getElementById('draft-recommend-side');
  if (sideLabel) sideLabel.textContent = report.activeSide === 'red' ? 'RED' : 'BLUE';
  if (list) {
    list.replaceChildren();
    for (const entry of report.recommendations[report.activeSide] || []) {
      const item = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = entry.name;
      const reason = entry.reasons.find((item_) => item_.kind === 'counter')
        || entry.reasons.find((item_) => item_.kind === 'synergy')
        || entry.reasons[0];
      const why = document.createElement('span');
      why.className = 'draft-recommend-why';
      why.textContent = reason?.label || '';
      const score = document.createElement('span');
      score.className = 'draft-recommend-score';
      score.textContent = entry.score > 0 ? `+${entry.score}` : String(entry.score);
      item.append(name, why, score);
      list.append(item);
    }
  }

  const teams = getConfig().teams || {};
  const blueTeam = document.getElementById('draft-blue-team');
  const redTeam = document.getElementById('draft-red-team');
  if (blueTeam) blueTeam.textContent = teams.blue?.name || 'BLUE';
  if (redTeam) redTeam.textContent = teams.red?.name || 'RED';
}

function signedDraft(value) {
  const numeric = Math.round(Number(value) || 0);
  return `${numeric > 0 ? '+' : ''}${numeric}`;
}

async function saveDraftConfig() {
  if (!slug || !ownerKey) return;
  const draft = readDraftConfig();
  const config = getConfig();
  config.draft = draft;
  setConfig(config);
  const response = await Kit.pushAux(slug, 'draft', draft, ownerKey);
  if (!response.ok) {
    status.textContent = `Layar draft gagal disimpan: ${response.error || response.status}`;
    return;
  }
  status.textContent = 'Layar draft tersimpan di server profil.';
}

async function loadDraftMatrix() {
  const note = document.getElementById('draft-source-note');
  try {
    const response = await fetch('/assets/hero-matrix.json', { cache: 'force-cache' });
    if (!response.ok) throw new Error(`status ${response.status}`);
    draftMatrix = await response.json();
    if (note) {
      // Sumber data ditampilkan, bukan disembunyikan: advantage ini bukan statistik.
      note.textContent = `Matriks: ${draftMatrix.source} · ${draftMatrix.patch} — indeks heuristik, bukan statistik pertandingan.`;
    }
  } catch (error) {
    draftMatrix = null;
    if (note) note.textContent = 'Matriks gagal dimuat. Advantage dan rekomendasi tidak tersedia.';
    console.warn('Matriks draft gagal dimuat', error);
  }
  if (draftEditor) renderDraftAnalytics(readDraftConfig());
}

// Slot pick/ban dibangun di sini, bukan di fungsi init sendiri, karena `initAuxEditors`
// sudah menunggu registry lalu menulis nilai draft dari server tepat setelahnya.
function attachDraftEditorListeners() {
  if (!draftEditor) return;
  document.getElementById('draft-obs-link')?.setAttribute('href', Kit.pageUrl(slug, 'overlay/draft'));
  document.getElementById('draft-reset')?.addEventListener('click', () => {
    writeDraftConfig(DraftAnalytics.defaultDraft());
    saveDraftConfig();
  });
  loadDraftMatrix();
}

// --- Preview semua fase -------------------------------------------------------
// Tiap overlay punya scene OBS sendiri. iframe memakai URL yang persis sama dengan browser
// source OBS, jadi kalau angka di preview ini salah, angka di stream juga salah. Yang tidak
// ditampilkan (control, verify, kalibrasi) tidak masuk preview karena bukan output stream.
const PREVIEW_PHASES = [
  { page: 'overlay/gameplay', title: 'Gameplay', tag: 'Scene: Gameplay' },
  { page: 'overlay/draft', title: 'Draft', tag: 'Scene: Draft' },
  { page: 'overlay/result', title: 'Hasil akhir', tag: 'Scene: Result' },
];

function renderPreviewPanel() {
  const grid = document.getElementById('preview-grid');
  if (!grid || !slug) return;
  grid.replaceChildren();

  for (const phase of PREVIEW_PHASES) {
    const path = Kit.pageUrl(slug, phase.page);
    const card = document.createElement('div');
    card.className = 'preview-card';

    const head = document.createElement('div');
    head.className = 'preview-card-head';
    const title = document.createElement('span');
    title.className = 'preview-card-title';
    title.textContent = phase.title;
    const tag = document.createElement('span');
    tag.className = 'preview-card-tag';
    tag.textContent = phase.tag;
    head.append(title, tag);

    const frame = document.createElement('div');
    frame.className = 'preview-frame';
    const iframe = document.createElement('iframe');
    iframe.src = path;
    iframe.title = `Preview ${phase.title}`;
    // Reload saat operator mengembalikan fokus ke tab control: overlay live dikirim lewat
    // socket, tapi me-restart preview yang menganggur memastikan state paling baru tampil
    // tanpa harus menutup dan membuka control panel.
    iframe.setAttribute('loading', 'lazy');
    frame.append(iframe);

    const links = document.createElement('div');
    links.className = 'preview-card-links';
    const open = document.createElement('a');
    open.href = path;
    open.target = '_blank';
    open.rel = 'noopener';
    open.textContent = 'Buka penuh';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'secondary';
    copy.textContent = 'Salin URL';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
        copy.textContent = 'Tersalin';
        window.setTimeout(() => { copy.textContent = 'Salin URL'; }, 1400);
      } catch {
        copy.textContent = 'Gagal';
      }
    });
    links.append(open, copy);

    card.append(head, frame, links);
    grid.append(card);
  }
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
    const items = group?.items || [];
    // An empty dialog with no explanation was indistinguishable from "no heroes match", and
    // the only way out was a click outside.
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'preview-hint';
      empty.textContent = group
        ? 'Tidak ada aset yang cocok. Hapus kata kunci pencarian.'
        : `Kategori "${category}" belum termuat. Registry aset gagal dimuat — jalankan npm run build:cloudflare lalu muat ulang halaman.`;
      grid.append(empty);
      return;
    }
    for (const asset of items) {
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
    if (!grid.children.length) {
      const empty = document.createElement('p');
      empty.className = 'preview-hint';
      empty.textContent = `Tidak ada aset yang cocok dengan "${filter.trim()}".`;
      grid.append(empty);
    }
  };

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'asset-picker-close';
  closeButton.textContent = 'Tutup';
  closeButton.addEventListener('click', close);

  search.addEventListener('input', () => paint(search.value));
  search.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  dialog.append(search, grid, closeButton);
  document.body.append(dialog);
  paint();
  search.focus();
}

function renderPlayersEditor() {
  if (!playersState) playersState = readPlayersConfig();
  const players = playersState;
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
      // No fallback image: an empty hero slot must not advertise Aamon to the operator.
      if (player.heroImage) hero.src = player.heroImage;
      hero.alt = player.hero || 'Pilih hero';
      hero.title = 'Klik untuk ganti hero';
      if (!player.heroImage) hero.classList.add('is-empty');
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

      const stat = (key, title, max = 99, step = 1) => {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = String(max);
        if (step !== 1) input.step = String(step);
        input.value = String(player[key] || 0);
        input.title = title;
        input.addEventListener('change', () => {
          player[key] = Number(input.value) || 0;
          savePlayersConfig();
        });
        return input;
      };

      // Layar hasil (Fase 3) membaca rating/gold/gpm/damage/damagePct/turretDamage/
      // battleSpell/emblem dari roster yang sama. Tanpa baris ini semua angka itu nol dan
      // kartu MVP tampil kosong.
      const detail = document.createElement('div');
      detail.className = 'player-detail';
      const labelled = (label, control) => {
        const wrap = document.createElement('label');
        wrap.className = 'player-field';
        const caption = document.createElement('span');
        caption.textContent = label;
        wrap.append(caption, control);
        return wrap;
      };
      const freeText = (key, label, placeholder, maxLength) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = player[key] || '';
        input.placeholder = placeholder;
        input.maxLength = maxLength;
        input.addEventListener('change', () => {
          player[key] = input.value;
          savePlayersConfig();
        });
        return labelled(label, input);
      };

      detail.append(
        labelled('PTS', stat('rating', 'Rating / PTS', 100, 0.1)),
        labelled('Gold', stat('gold', 'Total gold', 9_999_999)),
        labelled('GPM', stat('gpm', 'Gold per menit', 9_999)),
        labelled('Damage', stat('damage', 'Total damage', 9_999_999)),
        labelled('DMG %', stat('damagePct', 'Persentase damage tim', 100)),
        labelled('Turret', stat('turretDamage', 'Damage ke turret', 9_999_999)),
        freeText('battleSpell', 'Spell', 'mis. Floryn', 48),
        freeText('emblem', 'Emblem', 'mis. Elixir 2', 96),
      );

      const items = document.createElement('div');
      items.className = 'player-items';
      for (let slot = 0; slot < 6; slot += 1) {
        const path = player.items[slot];
        const cell = document.createElement('img');
        // src="" resolves to the document URL and renders a broken-image glyph, so an empty
        // slot gets no src attribute at all and is dimmed instead.
        if (path) cell.src = path;
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
      const wrapper = document.createElement('div');
      wrapper.className = 'player-block';
      wrapper.append(row, detail);
      container.append(wrapper);
    });
  });
}

async function initAuxEditors() {
  await loadRegistry();
  const config = getConfig();
  writeResultConfig(config.result);
  renderPlayersEditor();
  renderPreviewPanel();
  if (!slug) {
    buildDraftSlotSelects();
    attachDraftEditorListeners();
    const note = document.getElementById('players-note');
    if (note) note.textContent = 'Mode lokal: data tetap di browser dan dikirim lewat live socket.';
    return;
  }
  const [result, players, draft] = await Promise.all([
    Kit.fetchAux(slug, 'result'),
    Kit.fetchAux(slug, 'players'),
    Kit.fetchAux(slug, 'draft'),
  ]);
  const next = getConfig();
  if (result.ok) next.result = result.value;
  if (players.ok) next.players = players.value;
  if (draft.ok) next.draft = draft.value;
  setConfig(next);
  writeResultConfig(next.result);
  playersState = readPlayersConfig();
  renderPlayersEditor();
  writeDraftConfig(next.draft);
  // The draft selects only become interactive here, after the server copy has been applied.
  // Building them before the fetch above let an operator pick be overwritten by the fetch.
  buildDraftSlotSelects();
  attachDraftEditorListeners();
}

// Field Lock berlaku per field, bukan per objective. Satu daftar ini dipakai untuk tabel
// mode OCR di control, untuk menandai input manual, dan untuk validate bacaan di server.
const ocrFieldLabels = {
  timer: 'Timer',
  blueKills: 'Kill Blue',
  redKills: 'Kill Red',
  blueGold: 'Gold Blue',
  redGold: 'Gold Red',
  lordBlue: 'Lord Blue',
  lordRed: 'Lord Red',
  towerBlue: 'Tower Blue',
  towerRed: 'Tower Red',
};

function ocrFieldModes() {
  const saved = getConfig().ocr || {};
  // Table Field Lock (per-field) dan select objective (per-objective) hidup di key
  // berbeda. Versi lama membaca `saved.modes.turtle` dari object yang isinya per-field,
  // jadi turunannya selalu undefined dan memilih "Manual" untuk Turtle/Lord tidak pernah
  // tampil di table. Turtle tidak ada di sini: field-nya tidak pernah disentuh OCR.
  const modes = { ...(saved.modes || {}) };
  const objectives = readObjectiveModes({ ocr: saved });
  ['lord', 'tower'].forEach((objective) => {
    if (modes[`${objective}Blue`] || modes[`${objective}Red`]) return;
    const mode = objectives[objective] === 'auto' ? 'auto' : 'lock';
    modes[`${objective}Blue`] = mode;
    modes[`${objective}Red`] = mode;
  });
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

// A truncated or hand-edited value used to throw straight out of getConfig(), which is
// called from ~20 places starting at top level. One bad byte then left the page with no
// listeners registered at all. Fall back to defaults and keep going.
function readStoredConfig() {
  const raw = localStorage.getItem(configKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('Konfigurasi rusak di localStorage, memakai default.', error);
    return null;
  }
}

function getConfig() {
  const saved = readStoredConfig();
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
      modes: { ...(saved?.ocr?.modes || {}) },
      objectiveModes: readObjectiveModes(saved),
    },
  };
  config.headerImage = saved?.headerImage || saved?.referenceImage || '';
  config.customItems = saved?.customItems || defaultConfig.customItems.map((item) => ({ ...item }));
  delete config.referenceImage;
  return config;
}

function setConfig(config) {
  // The header PNG plus custom images are base64 in this one key, so the ~5 MB per-origin
  // budget is reachable. Without a catch, QuotaExceededError was thrown inside the click
  // handler: the preview and the push never ran, no status was written, and the edit was
  // lost with the button looking dead.
  try {
    localStorage.setItem(configKey, JSON.stringify(config));
    return true;
  } catch (error) {
    const overQuota = error?.name === 'QuotaExceededError' || error?.code === 22;
    if (overQuota) {
      status.textContent = 'Penyimpanan browser penuh. Hapus gambar custom atau klik "Reset Default", lalu ulangi. Perubahan ini belum tersimpan.';
    } else {
      status.textContent = `Gagal menyimpan ke browser: ${error?.message || error}. Perubahan ini belum tersimpan.`;
    }
    return false;
  }
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

// A rejected write is never retried, so it must never be reported as "queued and will be
// sent automatically" — that combination told the operator their change was safe when the
// server had permanently dropped it.
const REJECTED_MESSAGE = 'Perubahan ditolak: ownerKey tidak cocok atau profil belum diklaim. Buka beranda untuk mengklaim profil ini, lalu muat ulang halaman ini — socket yang sudah terbuka tidak bisa di-upgrade di tempat.';

function describeLiveResult(result, sentText, queuedText) {
  if (result === 'sent') return sentText;
  if (result === 'rejected') return REJECTED_MESSAGE;
  return queuedText;
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
    status.textContent = REJECTED_MESSAGE;
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

  // Mode objective disimpan di key sendiri, bukan di `modes`. `modes` milik Field Lock
  // per-field dan bentuknya sudah tentu tidak cocok di sini.
  config.ocr.objectiveModes = readObjectiveModeFromDom();

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
  if (config.ocr.objectiveModes.lord === 'auto') enabled.push('lordBlue', 'lordRed');
  if (config.ocr.objectiveModes.tower === 'auto') enabled.push('towerBlue', 'towerRed');
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
  const objectiveModes = readObjectiveModes(config);
const modeInputs = objectiveModeInputs();
modeInputs.lord.value = objectiveModes.lord;
modeInputs.tower.value = objectiveModes.tower;
  form.elements.fontFamily.value = config.style.fontFamily;

  textStyleItems.forEach((key) => {
    form.elements[`itemSize_${key}`].value = config.style.items[key].size;
    form.elements[`itemColor_${key}`].value = config.style.items[key].color;
  });
  updateManualControls(objectiveModes);
  renderCustomItemEditors(config.customItems);
  writeBo2ToDom(config.match.bo2);
  renderOcrFieldRows();
  applyLockedFieldState(config);
}

function updateManualControls(modes) {
  // `modes` selalu dinormalisasi dulu supaya tidak mungkin undefined. Versi lama membaca
  // config.ocr.modes langsung, dan setelah config OCR server dimuat key {turtle,lord,tower}
  // sudah hilang dari sana: tombol turtle/lord ikut terkunci, atau lebih buruk tampak aktif
  // lalu mati begitu diklik karena guard klik menolaknya sebagai 'auto'.
  const resolved = readObjectiveModes({ ocr: { objectiveModes: modes } });
  ['turtle', 'lord', 'tower'].forEach((objective) => {
    const automatic = resolved[objective] === 'auto';
    const group = document.querySelector(`[data-manual-group="${objective}"]`);
    group.querySelectorAll('[data-stat]').forEach((button) => {
      button.disabled = automatic;
    });
    group.querySelector(`[data-mode-label="${objective}"]`).textContent = automatic ? '(OCR)' : '(manual)';
    // Operator tidak bisa menebak apa yang salah dari tombol greyed, jadi card itu selalu
    // bilang kenapa tombolnya mati dan apa yang harus dilakukan. Card Turtle punya teks
    // statis (kiriman tetap manual), jadi tidak ada hint dinamis untuknya.
    const hint = group.querySelector(`[data-mode-hint="${objective}"]`);
    if (hint) {
      hint.textContent = automatic
        ? 'Mode OCR aktif, jadi tombol +/- dimatikan. Pilih Manual di atas untuk mengubah sendiri.'
        : '';
    }
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
  const stored = setConfig(config);
  renderPreview(config);
  formDirty = false;
  staleNoticeShown = false;
  if (!stored) return;
  status.textContent = describeLiveResult(
    pushLiveConfig(config),
    'Pengaturan dan PNG header tersimpan serta dikirim ke gameplay.',
    'Tersimpan di browser. WebSocket sedang menyambung, update masuk antrean dan dikirim otomatis.',
  );
});

applyButton.addEventListener('click', () => {
  const config = readFormValues();
  const stored = setConfig(config);
  renderPreview(config);
  formDirty = false;
  staleNoticeShown = false;
  if (!stored) return;
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
    if (readObjectiveModes(config)[objective] === 'auto') return;

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
  // `remote.modes` adalah Field Lock per-field; objectiveModes tidak boleh ikut tertimpa
  // dari sini. Versi lama menulis `modes: remote.modes || ...` dan karena `{}` tetap
  // truthy, objectiveModes lenyap setiap config OCR server dimuat; itulah bug tombol
  // Turtle/Lord mati. Table Field Lock juga ikut hilang karena `remote.modes ||` membiarkan
  // object kosong menimpa apa yang sudah ada di memori.
  const remoteModes = Object.keys(remote.modes || {}).length ? remote.modes : config.ocr?.modes || {};
  config.ocr = {
    ...(config.ocr || {}),
    modes: { ...remoteModes },
    thresholds: Object.keys(remote.thresholds || {}).length ? remote.thresholds : config.ocr?.thresholds || {},
    anchor: remote.anchor || config.ocr?.anchor || {},
    regions: remote.regions && Object.keys(remote.regions).length ? remote.regions : config.ocr?.regions || {},
    ocrEnabled: remote.enabled !== false,
  };
  config.ocr.objectiveModes = seedObjectiveModes(config.ocr, remote.modes);
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
  // The mode picker is a <select>; matching input[id^="result-"] alone skipped it entirely.
  if (!event.target.matches('#result-visible, input[id^="result-"], select[id^="result-"]')) return;
  saveResultConfig();
});

// Slot pick/ban dan toggle draft langsung disimpan, sama seperti editor hasil: operator
// tidak boleh perlu menekan "Simpan Pengaturan" yang juga mengirim config gameplay.
draftEditor?.addEventListener('change', (event) => {
  if (!event.target.matches('select, #draft-visible, #draft-round-input, #draft-active-side')) return;
  saveDraftConfig();
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

form.addEventListener('input', () => {
  formDirty = true;
  renderPreview(readFormValues());
});
headerWidthSlider.addEventListener('input', () => {
  form.elements.headerWidth.value = headerWidthSlider.value;
  renderPreview(readFormValues());
});
form.elements.headerWidth.addEventListener('input', () => {
  headerWidthSlider.value = form.elements.headerWidth.value;
});
document.querySelectorAll('[data-manual-group] select[name$="Mode"]').forEach((select) => {
  select.addEventListener('change', () => {
const config = readFormValues();
    setConfig(config);
    updateManualControls(config.ocr.objectiveModes);
    renderPreview(config);
    // Table Field Lock harus ikut berubah di mata operator, kalau tidak select "Manual" dan
    // table "auto (OCR boleh)" akan saling bertentangan di halaman yang sama. Dan karena
    // table inilah yang disimpan ke server,_objective yang tidak ikut berubah akan hilang
    // begitu halaman dibuka di browser lain.
    renderOcrFieldRows();
    applyLockedFieldState(config);
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

// Set while the operator has unsaved edits or is typing into the form. The OCR page writes
// this same localStorage key roughly once a second while live OCR runs, and repainting the
// whole form on each write reverted every character typed after it.
let formDirty = false;
let staleNoticeShown = false;

function focusInsideForm() {
  const active = document.activeElement;
  return Boolean(active && form && form.contains(active) && active !== document.body);
}

function markStaleState() {
  if (staleNoticeShown) return;
  staleNoticeShown = true;
  status.textContent = 'State di server berubah (mis. dari halaman OCR). Form tidak ditimpa selama kamu masih mengetik — tekan "Simpan Pengaturan" untuk memakai nilai di layar.';
}

window.addEventListener('storage', (event) => {
  if (event.key !== configKey) return;
  if (formDirty || focusInsideForm()) {
    markStaleState();
    return;
  }
  const config = getConfig();
  populateForm(config);
  renderPreview(config);
});
