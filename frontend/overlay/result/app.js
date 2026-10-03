// Layar hasil akhir. Browser source kedua di OBS: operator memindahkannya ke scene
// "Result" lalu menyalakan tampilannya lewat checkbox di control panel.
//
// `seriesScore` tidak pernah diisi manual kalau bisa diturunkan: skor seri dihitung dari
// `match.bo2.games`, jadi layar ini tidak bisa berbeda dengan indikator BO2.
const Kit = window.ProfileKit;
const slug = Kit.slugFromPath();
const configKey = slug ? `mlbb_overlay_config_${slug}` : 'mlbb_overlay_config';

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
};

function applyDesignScale() {
  // Shell yang sedang `display: none` melaporkan clientWidth 0, jadi skalanya harus dihitung
  // setelah visibility berubah, bukan sebelumnya.
  const width = shell.clientWidth || window.innerWidth;
  document.documentElement.style.setProperty('--design-scale', String(width / 1280));
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function bo2Series(match) {
  const games = Array.isArray(match?.bo2?.games) ? match.bo2.games : [];
  if (!games.length || match?.bo2?.enabled !== true) return null;
  return {
    blue: games.filter((game) => game?.winner === 'blue').length,
    red: games.filter((game) => game?.winner === 'red').length,
  };
}

function render(payload) {
  const result = payload?.result || {};
  const match = payload?.match || {};
  const teams = payload?.teams || {};

  // Visibility dulu, baru skala: shell yang tersembunyikan punya clientWidth 0.
  shell.dataset.visible = result.visible === true ? 'true' : 'false';
  applyDesignScale();

  const series = bo2Series(match);
  const blueScore = series ? series.blue : Number(result.seriesScore?.blue) || 0;
  const redScore = series ? series.red : Number(result.seriesScore?.red) || 0;

  // Headline "VICTORY" hanya benar kalau tim biru menang. Kalau seri BO2 sudah 2-0, skor
  // seri lebih kuat daripada skor yang diketik manual.
  const headline = result.headline || 'VICTORY';
  shell.dataset.outcome = /^defeat|kalah|loss/i.test(headline) || (blueScore < redScore && series) ? 'defeat' : 'win';

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
  fetch('/api/state', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((envelope) => render(envelope?.payload))
    .catch(() => render(null));
} else {
  Kit.fetchAux(slug, 'result').then((result) => {
    if (result.ok) render({ result: result.value });
  });
}

applyDesignScale();
render(null);
socket.start();
window.addEventListener('resize', applyDesignScale);