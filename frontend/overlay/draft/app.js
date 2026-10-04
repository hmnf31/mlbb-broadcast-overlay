// Overlay draft pick (Fase 1). Browser source ketiga di OBS: operator memindahkannya ke
// scene "Draft" lalu menyalakan tampilannya lewat checkbox di control panel.
//
// Analitik dihitung DI BROWSER, bukan di server: matriks hero berukuran ~20KB dan dipakai
// terus selama broadcast, jadi lebih hemat menyalinnya di setiap snapshot socket
// daripada Worker menghitung ulang tiap perubahan pick. Yang dikirim server cuma slot
// pick/ban; sisanya diturunkan dari matriks.
const Kit = window.ProfileKit;
const Analytics = window.DraftAnalytics;
const slug = Kit.slugFromPath();

const MATRIX_URL = '/assets/hero-matrix.json';
// Artwork path is copied verbatim from assets/registry.json into the matrix by
// scripts/build-hero-matrix.mjs. Deriving `/assets/heroes/<id>.png` broke every hero whose
// file name is not its id: chang_e -> chang27e.png, lapu_lapu -> lapu-lapu.png,
// x_borg -> xborg.png, yi_sun_shin -> yi_sun-shin.png.
const HERO_ART = (heroId, entry) => entry?.art || `/assets/heroes/${heroId}.png`;

// A missing file used to leave the browser's broken-image glyph inside a slot that otherwise
// looks intentional. Drop the image and keep the hero name instead.
function setHeroImage(image, heroId, entry) {
  const source = HERO_ART(heroId, entry);
  if (!source) return;
  image.addEventListener('error', () => image.remove(), { once: true });
  image.src = source;
}

const shell = document.getElementById('draft-shell');
const ui = {
  phase: document.getElementById('draft-phase'),
  turnSide: document.getElementById('draft-turn-side'),
  turnStep: document.getElementById('draft-turn-step'),
  source: document.getElementById('draft-source'),
  advantage: document.getElementById('advantage'),
  advantageWaiting: document.getElementById('advantage-waiting'),
  advantageFill: document.getElementById('advantage-fill'),
  advantageBlue: document.getElementById('advantage-blue-value'),
  advantageRed: document.getElementById('advantage-red-value'),
  blueName: document.getElementById('advantage-blue-name'),
  redName: document.getElementById('advantage-red-name'),
  blueTitle: document.getElementById('board-blue-title'),
  redTitle: document.getElementById('board-red-title'),
  blueComposition: document.getElementById('composition-blue'),
  redComposition: document.getElementById('composition-red'),
  bluePicks: document.getElementById('board-blue-picks'),
  redPicks: document.getElementById('board-red-picks'),
  blueBans: document.getElementById('board-blue-bans'),
  redBans: document.getElementById('board-red-bans'),
  matchups: document.getElementById('matchup-list'),
  recommend: document.getElementById('recommend'),
  recommendAction: document.getElementById('recommend-action'),
  recommendHint: document.getElementById('recommend-hint'),
  recommendSide: document.getElementById('recommend-side'),
  recommendList: document.getElementById('recommend-list'),
  // Jangkar tengah
  timer: document.getElementById('draft-timer'),
  timerDot: document.querySelector('.anchor-timer-dot'),
  anchorPhase: document.getElementById('anchor-turn-phase'),
  anchorChevron: document.querySelector('.anchor-chevron-live'),
  anchorBlueName: document.getElementById('anchor-blue-name'),
  anchorRedName: document.getElementById('anchor-red-name'),
  anchorSeriesBlue: document.getElementById('anchor-series-blue'),
  anchorSeriesRed: document.getElementById('anchor-series-red'),
};

let matrix = null;
// The whole snapshot payload, not just the draft. Re-rendering needs teams too, and passing
// only the draft made render() see `payload.draft === undefined`, which emptied the board.
let lastPayload = null;

// Matriks dimuat sekali sebelum render pertama. Kalau gagal, overlay tetap harus tampil
// (slot pick/ban tidak butuh matriks), hanya angka advantage dan rekomendasi yang kosong.
async function loadMatrix() {
  try {
    // 'no-cache' revalidates instead of pinning the copy for the whole session, so a rebuilt
    // matrix is picked up on an OBS source reload instead of staying stale all day.
    const response = await fetch(MATRIX_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`status ${response.status}`);
    matrix = await response.json();
    ui.source.textContent = `matriks: ${matrix.source} · ${matrix.patch}`;
    ui.source.dataset.state = matrix.source === 'curated' ? 'curated' : 'loaded';
  } catch (error) {
    matrix = null;
    ui.source.textContent = 'matriks: gagal dimuat · advantage nonaktif';
    ui.source.dataset.state = 'missing';
    console.warn('Draft matrix gagal dimuat', error);
  }
  if (lastPayload) render(lastPayload);
}

function applyDesignScale() {
  // Shell yang sedang `display: none` melaporkan clientWidth 0, jadi skalanya harus dihitung
  // setelah visibility berubah, bukan sebelumnya.
  const width = shell.clientWidth || window.innerWidth;
  document.documentElement.style.setProperty('--design-scale', String(width / 1280));
}

function heroSlot(heroId, options = {}) {
  const item = document.createElement('li');
  item.className = 'hero-slot';
  item.dataset.kind = options.kind || 'pick';
  item.dataset.empty = heroId ? 'false' : 'true';
  // Penanda slot yang harus diisi sekarang datang dari resolveTurn(), bukan dari "slot pick
  // terakhir". Dulu `active` menyalakan slot pick terakhir, padahal urutan ban/pick campur,
  // jadi penandanya bisa muncul di slot yang salah atau sama sekali tidak muncul.
  if (options.next) {
    item.dataset.next = 'true';
    item.dataset.nextLabel = options.kind === 'ban' ? 'BAN' : 'PICK';
    // Tag-nya elemen sungguhan, bukan ::after: slot ban sudah memakai ::after untuk tanda
    // silang, dan slot yang kosong tidak punya .hero-name untuk ditumpuki label.
    const tag = document.createElement('span');
    tag.className = 'hero-next';
    tag.textContent = item.dataset.nextLabel;
    item.append(tag);
  }
  if (heroId) {
    const entry = Analytics.entryFor(matrix, heroId);
    const image = document.createElement('img');
    setHeroImage(image, heroId, entry);
    image.alt = entry?.name || heroId;
    item.append(image);
    // Role asli hero dari matriks, bukan label lane. Urutan pick kita adalah urutan draft,
    // bukan posisi lane, jadi menulis EXP/JUNGLE/GOLD di sini akan jadi klaim yang salah.
    const role = document.createElement('span');
    role.className = 'hero-role';
    role.textContent = entry?.role && entry.role !== 'unknown' ? entry.role : '';
    if (role.textContent) item.append(role);
    const label = document.createElement('span');
    label.className = 'hero-name';
    label.textContent = entry?.name || heroId;
    item.append(label);
  }
  return item;
}

function fillSlots(container, heroIds, options) {
  container.replaceChildren();
  const slots = options.slots;
  for (let index = 0; index < slots; index += 1) {
    container.append(heroSlot(heroIds[index], {
      ...options,
      next: options.turn?.phase === options.kind && options.turn?.side === options.side
        && options.turn?.slotIndex === index,
    }));
  }
}

// Komposisi role per tim. Baris pill kecil supaya alasan rekomendasi "Butuh marksman" punya
// bentuk visual, bukan cuma kalimat.
function renderComposition(container, counts) {
  container.replaceChildren();
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [role, total] of entries) {
    const pill = document.createElement('span');
    pill.className = 'role-pill';
    pill.dataset.role = role;
    pill.textContent = total > 1 ? `${role} ${total}` : role;
    container.append(pill);
  }
}

// Matchup paling menentukan: ambil dari crossing pick biru x merah, ambil yang absolutnya
// terbesar, lalu tampilkan maksimum lima supaya tidak memenuhi layar.
function renderMatchups(report) {
  const crossings = [
    ...report.blue.matchups.map((entry) => ({ ...entry, side: 'blue' })),
    ...report.red.matchups.map((entry) => ({ ...entry, side: 'red' })),
  ];
  const strongest = crossings
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 5);

  ui.matchups.replaceChildren();
  for (const entry of strongest) {
    const row = document.createElement('li');
    row.className = 'matchup-row';

    const winner = document.createElement('span');
    winner.className = entry.value > 0 ? 'matchup-win' : 'matchup-lose';
    const hero = Analytics.entryFor(matrix, entry.hero);
    const against = Analytics.entryFor(matrix, entry.against);
    winner.textContent = `${hero?.name || entry.hero} > ${against?.name || entry.against}`;

    const delta = document.createElement('span');
    delta.className = 'matchup-delta';
    delta.textContent = `${entry.value > 0 ? '+' : ''}${entry.value}`;

    row.append(winner, delta);
    ui.matchups.append(row);
  }
}

function renderRecommendations(report) {
  const turn = report.turn || {};
  // Sisi yang direkomendasikan adalah sisi yang sedang mendapat giliran, bukan `activeSide`
  // yang dulu diisi manual. Kalau keduanya berbeda, panelnya merekomendasikan hero untuk tim
  // yang sedang ban -- kesalahan yang paling mudah terjadi di layar ini.
  const side = turn.side === 'red' ? 'red' : 'blue';
  const purpose = turn.phase === 'ban' ? 'ban' : 'pick';

  ui.recommend.dataset.purpose = purpose;
  ui.recommend.dataset.side = side;
  ui.recommendAction.textContent = purpose === 'ban' ? 'BAN' : 'PICK';
  ui.recommendSide.textContent = side === 'red' ? 'RED' : 'BLUE';
  ui.recommendHint.textContent = purpose === 'ban'
    ? 'paling berbahaya kalau lolos ke lawan'
    : 'terbaik untuk komposisi tim';

  const picks = report.recommendations[side] || [];

  ui.recommendList.replaceChildren();
  for (const entry of picks) {
    const item = document.createElement('li');
    item.className = 'recommend-item';

    const thumb = document.createElement('img');
    thumb.className = 'recommend-thumb';
    thumb.alt = '';
    setHeroImage(thumb, entry.heroId, Analytics.entryFor(matrix, entry.heroId));

    const body = document.createElement('div');
    body.className = 'recommend-body';
    const name = document.createElement('span');
    name.className = 'recommend-name';
    name.textContent = entry.name;
    // Alasan diambil dari reason paling kuat supaya operator tidak perlu membaca semua.
    const reason = entry.reasons.find((item_) => item_.kind === 'counter')
      || entry.reasons.find((item_) => item_.kind === 'risk')
      || entry.reasons.find((item_) => item_.kind === 'synergy')
      || entry.reasons[0];
    const why = document.createElement('span');
    why.className = 'recommend-why';
    why.textContent = reason?.label || '';
    body.append(name, why);

    const score = document.createElement('span');
    score.className = 'recommend-score';
    score.textContent = entry.score > 0 ? `+${entry.score}` : String(entry.score);

    item.append(thumb, body, score);
    ui.recommendList.append(item);
  }
}

// Header: giliran yang sedang berjalan. Urutannya diturunkan dari slot yang terisi, jadi
// operator tidak pernah perlu mengisi "round" atau "sisi aktif" secara manual.
function renderTurn(turn) {
  const phase = turn.complete ? 'done' : (turn.phase || 'done');
  ui.phase.dataset.phase = phase;
  ui.phase.textContent = turn.complete ? 'DONE' : (turn.phase || 'BAN').toUpperCase();

  const side = turn.side || (turn.complete ? null : 'blue');
  if (turn.complete) {
    ui.turnSide.textContent = 'COMPLETE';
    ui.turnSide.removeAttribute('data-side');
  } else {
    ui.turnSide.textContent = side === 'red' ? 'RED' : 'BLUE';
    ui.turnSide.dataset.side = side;
  }
  ui.turnStep.textContent = `${turn.index + 1} / ${turn.total}`;
}

function render(payload) {
  const draft = payload?.draft || {};
  const teams = payload?.teams || {};
  const match = payload?.match || {};
  lastPayload = payload;
  timerSource = match;

  // Visibility dulu, baru skala: shell yang tersembunyi punya clientWidth 0.
  shell.dataset.visible = draft.visible === true ? 'true' : 'false';
  applyDesignScale();

  ui.blueName.textContent = teams.blue?.name || 'BLUE';
  ui.redName.textContent = teams.red?.name || 'RED';
  ui.blueTitle.textContent = teams.blue?.name || 'BLUE';
  ui.redTitle.textContent = teams.red?.name || 'RED';

  const report = Analytics.evaluate(draft, matrix);
  const draftSides = report.draft;
  const turn = report.turn;

  renderTurn(turn);
  renderAnchor(match, turn, teams);

  // Advantage baru ditampilkan setelah kedua tim punya pick. Tanpa gerbang ini angka dari satu
  // hero saja muncul sebagai "+37" yang terlihat seperti hasil analisis padahal cuma
  // membandingkan satu power rating.
  const ready = report.advantageReady && report.hasMatrix;
  ui.advantage.dataset.ready = ready ? 'true' : 'false';
  ui.advantage.dataset.matrix = report.hasMatrix ? 'loaded' : 'missing';
  ui.advantageWaiting.textContent = report.hasMatrix
    ? 'menunggu pick pertama kedua tim'
    : 'matriks gagal dimuat · advantage nonaktif';

  const magnitude = ready ? Math.min(50, Math.abs(report.advantage) / 2) : 0;
  ui.advantageFill.style.width = `${magnitude}%`;
  ui.advantageFill.dataset.leader = report.leader;
  ui.advantageBlue.textContent = ready ? signed(report.advantage) : '--';
  ui.advantageRed.textContent = ready ? signed(-report.advantage) : '--';

  const slotOptions = (kind, side) => ({ kind, side, turn, slots: kind === 'ban' ? Analytics.BAN_SLOTS : Analytics.PICK_SLOTS });
  fillSlots(ui.bluePicks, draftSides.blue.picks, slotOptions('pick', 'blue'));
  fillSlots(ui.redPicks, draftSides.red.picks, slotOptions('pick', 'red'));
  fillSlots(ui.blueBans, draftSides.blue.bans, slotOptions('ban', 'blue'));
  fillSlots(ui.redBans, draftSides.red.bans, slotOptions('ban', 'red'));

  renderComposition(ui.blueComposition, report.composition?.blue);
  renderComposition(ui.redComposition, report.composition?.red);

  renderMatchups(report);
  renderRecommendations(report);
}

function signed(value) {
  const numeric = Math.round(Number(value) || 0);
  return `${numeric > 0 ? '+' : ''}${numeric}`;
}

// Jam dihitung LOKAL dari anchor, sama seperti overlay gameplay: `match.timer` adalah nilai
// pada detik `match.timerAt`. Kalau `timerRunning` true, overlay mengurangi selisih waktu
// sendiri, jadi server tidak perlu push apa pun per detik dan angka tidak pernah berkedip
// karena kiriman yang datang terlambat.
function timerSeconds(match, now = Date.now()) {
  const base = Number(match?.timer) || 0;
  const anchorAt = Number(match?.timerAt);
  if (match?.timerRunning !== true || !Number.isFinite(anchorAt) || anchorAt <= 0) return base;
  const elapsed = Math.floor(Math.max(0, now - anchorAt) / 1000);
  return Math.max(0, base - elapsed);
}

function renderTimer(match) {
  const seconds = timerSeconds(match);
  ui.timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  if (ui.timerDot) ui.timerDot.dataset.running = match?.timerRunning === true ? 'true' : 'false';
}

// Timer harus dihitung ulang tiap detik walau tidak ada snapshot yang masuk. Tanpa ini angka
// hanya berkurang saat ada kiriman state, dan satu anchor akan membekukan jam di layar.
// `timerSource` menyimpan match terakhir yang sudah digabung supaya ticker tidak perlu masuk
// ke logic render lagi.
let timerSource = null;
let timerTicker = null;

function ensureTimerTicker() {
  if (timerTicker) return;
  timerTicker = setInterval(() => {
    if (timerSource) renderTimer(timerSource);
  }, 1000);
  // Di browser ini angka biasa; di Node (harness test yang memuat app.js ini) `unref`
  // mencegah interval ini menahan proses dari keluar.
  timerTicker?.unref?.();
}

// Skor seri digambar sebagai bar, bukan angka: jumlah bar langsung terbaca sebagai
// penghitung seri. Angka asli disimpan di `aria-label` supaya screen reader dan test tidak
// kehilangan angkanya.
function renderSeriesBars(element, won, needed, side) {
  element.replaceChildren();
  element.setAttribute('aria-label', `${side} ${won} dari ${needed}`);
  if (needed < 1 || needed > 5) return;
  for (let index = 0; index < needed; index += 1) {
    const bar = document.createElement('span');
    bar.className = 'anchor-series-bar';
    bar.dataset.state = index < won ? 'win' : 'lose';
    if (side === 'red') bar.dataset.side = 'red';
    element.append(bar);
  }
}

// Jangkar tengah: jam match, arah giliran, dan skor seri. Semuanya diturunkan dari state,
// tidak ada satu pun angka yang diisi manual di halaman ini.
function renderAnchor(match, turn, teams) {
  ui.anchorBlueName.textContent = teams.blue?.name || 'BLUE';
  ui.anchorRedName.textContent = teams.red?.name || 'RED';

  ui.anchorPhase.textContent = turn.complete ? 'DONE' : String(turn.phase || 'BAN').toUpperCase();
  if (turn.complete) {
    ui.anchorChevron.removeAttribute('data-side');
  } else {
    ui.anchorChevron.dataset.side = turn.side === 'red' ? 'red' : 'blue';
  }

  const games = Array.isArray(match?.bo2?.games) ? match.bo2.games : [];
  const active = match?.bo2?.enabled === true && games.length > 0;
  const needed = active ? Math.ceil(Math.max(1, Number(match?.bo2?.bestOf) || 0) / 2) : 0;
  renderSeriesBars(ui.anchorSeriesBlue, active ? games.filter((game) => game?.winner === 'blue').length : 0, needed, 'blue');
  renderSeriesBars(ui.anchorSeriesRed, active ? games.filter((game) => game?.winner === 'red').length : 0, needed, 'red');

  renderTimer(match);
}

const socket = window.LiveSocket.create({
  role: 'overlay',
  slug,
  onStatus: (state, info) => {
    if (state === 'online') console.log('Draft overlay connected to', info.detail);
    if (state === 'offline') console.warn('Draft overlay dropped, reconnecting to', info.detail);
  },
  onMessage: (message) => {
    if (message.type === 'snapshot' && message.payload) render(message.payload);
  },
});

if (!slug) {
  // Without a slug there is no profile to read, and /api/state does not exist on the Worker
  // (the live routes are all /api/p/<slug>/...). Rendering the transparent default is the
  // honest state; the old fetch just produced a 404 on every load.
  console.warn('Draft overlay dibuka tanpa slug profil: board tetap kosong sampai URL OBS memakai /p/<slug>/.');
  render(null);
} else {
  Kit.fetchAux(slug, 'draft').then((result) => {
    if (result.ok) render({ draft: result.value });
  });
}

loadMatrix();
applyDesignScale();
render(null);
ensureTimerTicker();
socket.start();
window.addEventListener('resize', applyDesignScale);