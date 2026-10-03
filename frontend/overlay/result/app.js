// Layar hasil akhir. Browser source kedua di OBS: operator memindahkannya ke scene
// "Result" lalu menyalakan tampilannya lewat checkbox di control panel.
//
// `seriesScore` tidak pernah diisi manual kalau bisa diturunkan: skor seri dihitung dari
// `match.bo2.games`, jadi layar ini tidak bisa berbeda dengan indikator BO2.
//
// `result.mode` memilih dua tampilan yang berbagi state dan header yang sama:
//   mvp        -> kartu MVP (Mode A di UPDATE2.md)
//   scoreboard -> scoreboard 10 pemain (Mode B)
// Ganti mode cukup lewat satu field; tidak ada state tambahan yang perlu disinkronkan.
const Kit = window.ProfileKit;
const slug = Kit.slugFromPath();

const shell = document.getElementById('result-shell');
const ui = {
  headline: document.getElementById('result-headline'),
  subline: document.getElementById('result-subline'),
  blueName: document.getElementById('result-blue-name'),
  redName: document.getElementById('result-red-name'),
  blueScore: document.getElementById('result-blue-score'),
  redScore: document.getElementById('result-red-score'),
  game: document.getElementById('result-game'),
  duration: document.getElementById('result-duration'),
  durationTotal: document.getElementById('result-duration-total'),
  damage: document.getElementById('result-damage'),
  mvp: document.getElementById('result-mvp'),
  // Mode A
  mvpArt: document.getElementById('mvp-hero-art'),
  mvpPlayer: document.getElementById('mvp-player'),
  mvpHeroName: document.getElementById('mvp-heroname'),
  mvpRole: document.getElementById('mvp-role'),
  mvpRating: document.getElementById('mvp-rating'),
  mvpRadar: document.getElementById('mvp-radar'),
  mvpRadarChart: document.getElementById('mvp-radar-chart'),
  mvpRadarLegend: document.getElementById('mvp-radar-legend'),
  mvpKills: document.getElementById('mvp-kills'),
  mvpDeaths: document.getElementById('mvp-deaths'),
  mvpAssists: document.getElementById('mvp-assists'),
  mvpLevel: document.getElementById('mvp-level'),
  mvpGold: document.getElementById('mvp-gold'),
  mvpGpm: document.getElementById('mvp-gpm'),
  mvpDamage: document.getElementById('mvp-damage'),
  mvpDamagePct: document.getElementById('mvp-damage-pct'),
  mvpTurret: document.getElementById('mvp-turret'),
  mvpItems: document.getElementById('mvp-items'),
  mvpSpell: document.getElementById('mvp-spell'),
  mvpEmblem: document.getElementById('mvp-emblem'),
  mvpSignature: document.getElementById('mvp-signature'),
  // Mode B
  boardBlueName: document.getElementById('board-blue-name'),
  boardRedName: document.getElementById('board-red-name'),
  boardBlueSeries: document.getElementById('board-blue-series'),
  boardRedSeries: document.getElementById('board-red-series'),
  boardBlueRows: document.getElementById('board-blue-rows'),
  boardRedRows: document.getElementById('board-red-rows'),
  // Aside
  turtleBlue: document.getElementById('objective-turtle-blue'),
  turtleRed: document.getElementById('objective-turtle-red'),
  lordBlue: document.getElementById('objective-lord-blue'),
  lordRed: document.getElementById('objective-lord-red'),
  turretBlue: document.getElementById('objective-turret-blue'),
  turretRed: document.getElementById('objective-turret-red'),
  casterNote: document.getElementById('result-caster-note'),
  stageLabel: document.getElementById('result-stage-label'),
};

const RADAR_AXES = ['Damage', 'Survival', 'Teamfight', 'Push', 'Farm'];
const SVG_NS = 'http://www.w3.org/2000/svg';

function applyDesignScale() {
  // Shell yang sedang `display: none` melaporkan clientWidth 0, jadi skalanya harus dihitung
  // setelah visibility berubah, bukan sebelumnya.
  const width = shell.clientWidth || window.innerWidth;
  document.documentElement.style.setProperty('--design-scale', String(width / 1280));
}

// Lima sumbu radar dinormalisasi server ke 0-100. Kalau semuanya nol, perlakukan sebagai
// "belum diisi" supaya overlay tidak menampilkan pentagon datar yang terbaca sebagai performa
// nol.
function readRadar(player) {
  const source = Array.isArray(player?.radar) ? player.radar : [];
  const values = RADAR_AXES.map((unused, index) => {
    const numeric = Number(source[index]);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
  });
  return values.some((value) => value > 0) ? values : null;
}

function radarPoints(values, radius, cx = 50, cy = 50) {
  return values.map((value, index) => {
    const angle = (-90 + index * (360 / values.length)) * (Math.PI / 180);
    const scaled = radius * (value / 100);
    return `${(cx + scaled * Math.cos(angle)).toFixed(2)},${(cy + scaled * Math.sin(angle)).toFixed(2)}`;
  });
}

function svgElement(name, attributes) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

// Pentagon lima sumbu, digambar dengan viewBox tetap supaya tidak perlu tahu ukuran piksel
// nyata dan ikut mengikuti --design-scale bersama sisanya.
function buildRadarChart(values) {
  const svg = svgElement('svg', { viewBox: '0 0 100 100', class: 'radar-chart', 'aria-hidden': 'true' });
  for (const ring of [0.25, 0.5, 0.75, 1]) {
    svg.append(svgElement('polygon', {
      class: 'radar-ring',
      points: radarPoints(values.map(() => ring * 100), 38).join(' '),
    }));
  }
  values.forEach((unused, index) => {
    const angle = (-90 + index * (360 / values.length)) * (Math.PI / 180);
    svg.append(svgElement('line', {
      class: 'radar-spoke',
      x1: 50,
      y1: 50,
      x2: (50 + 38 * Math.cos(angle)).toFixed(2),
      y2: (50 + 38 * Math.sin(angle)).toFixed(2),
    }));
  });
  svg.append(svgElement('polygon', { class: 'radar-fill', points: radarPoints(values, 38).join(' ') }));
  values.forEach((value, index) => {
    const angle = (-90 + index * (360 / values.length)) * (Math.PI / 180);
    svg.append(svgElement('circle', {
      class: 'radar-dot',
      cx: (50 + 38 * (value / 100) * Math.cos(angle)).toFixed(2),
      cy: (50 + 38 * (value / 100) * Math.sin(angle)).toFixed(2),
      r: 2,
    }));
  });
  return svg;
}

function buildRadarBars(values) {
  const wrapper = document.createElement('div');
  wrapper.className = 'radar-bars';
  values.forEach((value, index) => {
    const bar = document.createElement('span');
    bar.className = 'radar-bar';
    bar.title = `${RADAR_AXES[index]} ${Math.round(value)}`;
    const fill = document.createElement('i');
    fill.style.height = `${Math.max(4, Math.min(100, value))}%`;
    bar.append(fill);
    wrapper.append(bar);
  });
  return wrapper;
}


function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

// Ambang 1.000 disimpan agar angka gold yang sama tampil sama di scene gameplay dan scene
// hasil. Sebelumnya hasil memakai 10.000, jadi 9.999 tampil "9.9K" di gameplay tapi "9999"
// di layar hasil.
function compact(value) {
  const numeric = Math.max(0, Math.round(Number(value) || 0));
  if (numeric >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M`;
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(1)}K`;
  return String(numeric);
}

function bo2Series(match) {
  const games = Array.isArray(match?.bo2?.games) ? match.bo2.games : [];
  if (!games.length || match?.bo2?.enabled !== true) return null;
  return {
    blue: games.filter((game) => game?.winner === 'blue').length,
    red: games.filter((game) => game?.winner === 'red').length,
  };
}

function sidePlayers(players, side) {
  const list = Array.isArray(players?.[side]) ? players[side] : [];
  return Array.isArray(list) ? list.filter((entry) => entry && (entry.name || entry.hero)) : [];
}

// Kartu MVP dan baris scoreboard sama-sama memvisualisasi lima sumbu radar: `radar`
// dinormalisasi server ke lima angka 0-100. Kalau tidak diisi, blok disembunyikan, bukan
// ditampilkan sebagai pentagon datar yang terbaca sebagai performa nol.
function renderRadar(figure, values, { chart, legend }) {
  if (!values || !figure) {
    if (figure) figure.hidden = true;
    return;
  }
  figure.hidden = false;
  chart.replaceChildren(buildRadarChart(values));
  if (legend) {
    legend.replaceChildren(...values.map((value, index) => {
      const item = document.createElement('span');
      item.className = 'radar-legend-item';
      const label = document.createElement('i');
      label.textContent = RADAR_AXES[index];
      const score = document.createElement('b');
      score.textContent = String(Math.round(value));
      item.append(label, score);
      return item;
    }));
  }
}

// Baris MVP: cari pakai nama yang cocok dengan `result.mvp`. Kalau nama tidak ditemukan,
// ambil skor tertinggi supaya kartu tidak pernah kosong hanya karena salah ketik nama.
//
// `preferredSide` membatasi pencarian ke tim yang menang. Tanpa itu, fallback "skor tertinggi"
// bisa memilih player tim kalah, dan kartu VICTORY biru menampilkan MVP merah — kesalahan
// paling merusak kredibilitas yang bisa terjadi di overlay ini.
function pickMvpPlayer(players, mvpName, preferredSide) {
  const sides = preferredSide ? [preferredSide] : ['blue', 'red'];
  const all = sides.flatMap((side) => sidePlayers(players, side));
  if (!all.length) return null;
  const wanted = String(mvpName || '').trim().toLowerCase();
  if (wanted) {
    const byName = all.find((player) => String(player.name || '').trim().toLowerCase() === wanted);
    if (byName) return byName;
    const partial = all.find((player) => String(player.name || '').trim().toLowerCase().includes(wanted));
    if (partial) return partial;
  }
  // `!best` guarding elemen pertama. Versi lama memakai reduce dengan initial `null` dan
  // perbandingan `score > bestScore`, sehingga player dengan skor negatif (0 kill, 0 assist,
  // 3 death -> -3) kalah dari `null` yang bernilai 0 dan kartu MVP berakhir kosong
  // meskipun rosternya terisi.
  const scoreOf = (player) => (Number(player?.kills) || 0) * 3
    + (Number(player?.assists) || 0)
    - (Number(player?.deaths) || 0);
  return all.reduce((best, player) => (!best || scoreOf(player) > scoreOf(best) ? player : best), null);
}

function renderMvpCard(players, result, preferredSide) {
  const player = pickMvpPlayer(players, result?.mvp, preferredSide);
  const rating = Number(player?.rating) || Number(result?.mvpRating) || 0;
  // Tanpa roster yang terisi, kartu menampilkan "--" alih-alih angka nol. Nol adalah klaim
  // performa ("0 kill, 0 damage"), "--" adalah klaim "belum diisi".
  const MISSING = '--';
  const num = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  ui.mvpPlayer.textContent = player?.name || result?.mvp || MISSING;
  ui.mvpHeroName.textContent = player?.hero || MISSING;
  ui.mvpRole.textContent = player?.role || '';
  ui.mvpRating.textContent = rating ? rating.toFixed(1) : MISSING;
  ui.mvpKills.textContent = player ? String(num(player.kills)) : MISSING;
  ui.mvpDeaths.textContent = player ? String(num(player.deaths)) : MISSING;
  ui.mvpAssists.textContent = player ? String(num(player.assists)) : MISSING;
  ui.mvpLevel.textContent = player ? String(num(player.level, 1)) : MISSING;
  ui.mvpGold.textContent = player ? compact(player.gold) : MISSING;
  ui.mvpGpm.textContent = player ? String(num(player.gpm)) : MISSING;
  ui.mvpDamage.textContent = player ? compact(player.damage) : MISSING;
  ui.mvpDamagePct.textContent = player ? `${Math.round(num(player.damagePct))}%` : MISSING;
  ui.mvpTurret.textContent = player ? compact(player.turretDamage) : MISSING;
  ui.mvpSpell.textContent = player?.battleSpell || MISSING;
  ui.mvpEmblem.textContent = player?.emblem || MISSING;
  ui.mvpSignature.textContent = player?.signaturePlay || '';

  renderRadar(ui.mvpRadar, readRadar(player), {
    chart: ui.mvpRadarChart,
    legend: ui.mvpRadarLegend,
  });

  const art = player?.heroImage || '';
  // `heroImage` datang dari operator, jadi path-nya harus dibatasi ke direktori aset hero;
  // string `javascript:` atau path absolut tidak boleh masuk ke atribut src.
  const safeArt = /^\/assets\/heroes\/[A-Za-z0-9_-]+\.png$/.test(art) ? art : '';
  ui.mvpArt.dataset.empty = safeArt ? 'false' : 'true';
  if (safeArt) ui.mvpArt.setAttribute('src', safeArt);
  else ui.mvpArt.removeAttribute('src');

  ui.mvpItems.replaceChildren();
  for (const item of Array.isArray(player?.items) ? player.items.slice(0, 6) : []) {
    const safe = /^\/assets\/items\/[A-Za-z0-9_-]+\.png$/.test(item) ? item : '';
    if (!safe) continue;
    const image = document.createElement('img');
    image.src = safe;
    image.alt = '';
    ui.mvpItems.append(image);
  }
}

function renderScoreboard(players, series) {
  const build = (side) => {
    const container = side === 'blue' ? ui.boardBlueRows : ui.boardRedRows;
    container.replaceChildren();
    const list = sidePlayers(players, side).slice(0, 5);
    for (const player of list) {
      const row = document.createElement('li');
      row.className = 'board-row';

      const art = /^\/assets\/heroes\/[A-Za-z0-9_-]+\.png$/.test(player.heroImage || '') ? player.heroImage : '';
      const image = document.createElement('img');
      image.className = 'board-row-hero';
      if (art) image.src = art;
      image.alt = '';

      const nameCell = document.createElement('span');
      nameCell.className = 'board-row-name';
      nameCell.textContent = player.name || '-';
      const heroName = document.createElement('span');
      heroName.className = 'board-row-hero-name';
      heroName.textContent = player.hero || '';
      nameCell.append(heroName);

      const kda = document.createElement('span');
      kda.className = 'board-row-kda';
      kda.textContent = `${Number(player.kills) || 0}/${Number(player.deaths) || 0}/${Number(player.assists) || 0}`;

      const damage = document.createElement('span');
      damage.className = 'board-row-num';
      damage.textContent = `${Math.round(Number(player.damagePct) || 0)}%`;

      const gpm = document.createElement('span');
      gpm.className = 'board-row-num';
      gpm.textContent = `${Number(player.gpm) || 0}`;

      // Lima sumbu radar per baris: mini bar, tanpa label, supaya lima baris tim muat
      // tanpa membuat kolom nama sempit.
      const radarCell = document.createElement('span');
      radarCell.className = 'board-row-radar';
      const radar = readRadar(player);
      if (radar) radarCell.append(buildRadarBars(radar));

      row.append(image, nameCell, kda, damage, gpm, radarCell);
      container.append(row);
    }
  };

  build('blue');
  build('red');
  ui.boardBlueSeries.textContent = String(series?.blue ?? 0);
  ui.boardRedSeries.textContent = String(series?.red ?? 0);
}

function renderObjectives(result) {
  const objectives = result?.objectives || {};
  const read = (group, key) => Math.max(0, Math.round(Number(objectives?.[group]?.[key]) || 0));
  ui.turtleBlue.textContent = String(read('turtle', 'blue'));
  ui.turtleRed.textContent = String(read('turtle', 'red'));
  ui.lordBlue.textContent = String(read('lord', 'blue'));
  ui.lordRed.textContent = String(read('lord', 'red'));
  ui.turretBlue.textContent = String(read('turret', 'blue'));
  ui.turretRed.textContent = String(read('turret', 'red'));
  ui.casterNote.textContent = result?.casterNote || '';
  ui.stageLabel.textContent = result?.stageLabel || '';
}

function render(payload) {
  const result = payload?.result || {};
  const match = payload?.match || {};
  const teams = payload?.teams || {};
  const players = payload?.players || {};

  // Visibility dulu, baru skala: shell yang tersembunyi punya clientWidth 0.
  shell.dataset.visible = result.visible === true ? 'true' : 'false';
  applyDesignScale();

  const series = bo2Series(match);
  const blueScore = series ? series.blue : Number(result.seriesScore?.blue) || 0;
  const redScore = series ? series.red : Number(result.seriesScore?.red) || 0;

  // Headline menggambarkan game INI, skor seri menggambarkan SELURUH seri. Keduanya tidak
  // boleh saling menimpa: di game 2 dari seri 1-0, operator menulis DEFEAT sementara seri
  // masih biru — warna banner harus mengikuti headline, bukan seri.
  //
  // Regex sebelumnya `/^defeat|kalah|loss/i` dibaca sebagai `(^defeat) | (kalah) | (loss)`,
  // jadi headline apa pun yang MEMBEYCONTAIN "loss" ikut ter-match dan dicat warna kalah.
  // Sekarang semuanya di-anchor ke awal.
  const headline = result.headline || 'VICTORY';
  const typedHeadline = String(result.headline || '').trim();
  const headlineSaysDefeat = /^(defeat|kalah|loss)\b/i.test(typedHeadline);
  const headlineUnset = !typedHeadline || typedHeadline.toUpperCase() === 'VICTORY';
  const hasScore = Boolean(series) || blueScore > 0 || redScore > 0;
  // Skor seri hanya menentukan warna kalau operator tidak menyebut hasil game ini sendiri.
  const outcome = headlineSaysDefeat
    ? 'defeat'
    : (headlineUnset && hasScore && blueScore < redScore ? 'defeat' : 'win');
  shell.dataset.outcome = outcome;
  shell.dataset.mode = result.mode === 'scoreboard' ? 'scoreboard' : 'mvp';
  // Kartu MVP hanya mencari player di tim yang menang supaya tidak pernah menampilkan MVP
  // tim kalah di sebelah headline VICTORY.
  const preferredSide = outcome === 'win' ? 'blue' : 'red';

  ui.headline.textContent = headline;
  ui.subline.textContent = result.subline || '';
  ui.blueName.textContent = teams.blue?.name || 'Blue';
  ui.redName.textContent = teams.red?.name || 'Red';
  ui.blueScore.textContent = String(blueScore);
  ui.redScore.textContent = String(redScore);
  ui.game.textContent = String(Number(result.gameNumber) || 1);
  ui.duration.textContent = formatDuration(result.durationSec);
  ui.durationTotal.textContent = Number(result.bestOf) > 1 ? `Best of ${result.bestOf}` : '-';
  ui.damage.textContent = `${Math.round(Number(result.damageDealt) || 0)} / ${Math.round(Number(result.damageTaken) || 0)}`;
  ui.mvp.textContent = result.mvp || '-';

  ui.boardBlueName.textContent = teams.blue?.name || 'Blue';
  ui.boardRedName.textContent = teams.red?.name || 'Red';
  renderMvpCard(players, result, preferredSide);
  renderScoreboard(players, { blue: blueScore, red: redScore });
  renderObjectives(result);
}

const socket = window.LiveSocket.create({
  role: 'overlay',
  slug,
  onStatus: (state, info) => {
    if (state === 'online') console.log('Result overlay connected to', info.detail);
    if (state === 'offline') console.warn('Result overlay dropped, reconnecting to', info.detail);
  },
  onMessage: (message) => {
    if (message.type === 'snapshot' && message.payload) render(message.payload);
  },
});

if (!slug) {
  // Without a slug there is no profile to read, and /api/state does not exist on the Worker
  // (every live route is /api/p/<slug>/...). The transparent default is the honest state.
  console.warn('Result overlay dibuka tanpa slug profil: layar tetap kosong sampai URL OBS memakai /p/<slug>/.');
  render(null);
} else {
  Promise.all([Kit.fetchAux(slug, 'result'), Kit.fetchAux(slug, 'players')]).then(([result, playersResult]) => {
    render({
      result: result.ok ? result.value : null,
      players: playersResult.ok ? playersResult.value : null,
    });
  });
}

applyDesignScale();
render(null);
socket.start();
window.addEventListener('resize', applyDesignScale);