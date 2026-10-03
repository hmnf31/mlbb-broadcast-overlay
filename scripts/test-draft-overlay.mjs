// Fase 1 render test: overlay draft harus menampilkan slot pick/ban dan advantage dari
// matriks kurasi, dan harus tetap aman kalau matriks gagal dimuat. Menjalankan halaman
// sungguhan di jsdom lewat jalur onMessage yang sama dengan socket live.
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, '');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` -- ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n== ${title} ==`);
}

const matrix = JSON.parse(await readFile(`${ROOT}/assets/hero-matrix.json`, 'utf8'));

function stubSocket(window, sink) {
  window.LiveSocket = {
    create: (options) => {
      sink.push(options);
      return { start: async () => true, stop: () => {}, send: () => 'sent', reconnectNow: () => {} };
    },
  };
}

// `matrixStatus` dikontrol supaya jalur gagal-load bisa diuji. `matrixDelayMs` menunda
// matriks supaya snapshot bisa arrive lebih dulu — itu yang dulu menghapus board.
async function boot({ matrixStatus = 200, matrixDelayMs = 0 } = {}) {
  const [html, appSource, profileSource, analyticsSource] = await Promise.all([
    readFile(`${ROOT}/frontend/overlay/draft/index.html`, 'utf8'),
    readFile(`${ROOT}/frontend/overlay/draft/app.js`, 'utf8'),
    readFile(`${ROOT}/frontend/shared/profile.js`, 'utf8'),
    readFile(`${ROOT}/frontend/shared/draft-analytics.js`, 'utf8'),
  ]);

  const dom = new JSDOM(html, {
    url: 'https://example.test/p/abc/overlay/draft/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const errors = [];
  const sockets = [];
  stubSocket(window, sockets);
  window.eval(profileSource);
  window.eval(analyticsSource);
  window.ProfileKit.fetchAux = async () => ({ ok: false });
  window.fetch = async (url) => {
    if (String(url).includes('hero-matrix')) {
      if (matrixDelayMs) await new Promise((resolve) => setTimeout(resolve, matrixDelayMs));
      if (matrixStatus !== 200) return { ok: false, status: matrixStatus };
      return { ok: true, json: async () => matrix };
    }
    return { ok: false, json: async () => ({}) };
  };
  window.addEventListener('error', (event) => errors.push(event.message));
  window.console.error = (...args) => errors.push(args.join(' '));
  window.eval(appSource);
  // Beri loadMatrix() selesai sebelum render diuji — kecuali saat race sengaja diuji.
  if (!matrixDelayMs) await new Promise((resolve) => setTimeout(resolve, 0));

  return { window, document: window.document, errors, sockets };
}

const DRAFT_SNAPSHOT = {
  teams: { blue: { name: 'ONIC' }, red: { name: 'RRQ' } },
  draft: {
    visible: true,
    round: 3,
    activeSide: 'blue',
    blue: { picks: ['khufra', 'yve'], bans: ['grock'] },
    red: { picks: ['ling'], bans: ['claude'] },
  },
};

section('Boot dan sumber data');
{
  const { document, errors, sockets } = await boot();
  check('halaman boot tanpa error', errors.length === 0, errors.join(' | '));
  check('socket overlay dibuat', sockets.length === 1 && sockets[0].role === 'overlay', String(sockets.length));
  check('socket punya onMessage', typeof sockets[0].onMessage === 'function');

  const source = document.getElementById('draft-source');
  check('sumber matriks ditandai curated', source.dataset.state === 'curated', source.dataset.state);
  check('patch tampil di ticker', source.textContent.includes(matrix.patch), source.textContent);
}

section('Render snapshot draft');
{
  const { document, errors, sockets } = await boot();
  sockets[0].onMessage({ type: 'snapshot', payload: DRAFT_SNAPSHOT });
  check('render tanpa error setelah snapshot', errors.length === 0, errors.join(' | '));

  check('shell terlihat', document.getElementById('draft-shell').dataset.visible === 'true');
  check('round tampil', document.getElementById('draft-round').textContent === '3', document.getElementById('draft-round').textContent);

  const bluePicks = document.getElementById('board-blue-picks').children;
  check('5 slot pick biru dirender', bluePicks.length === 5, String(bluePicks.length));
  check('5 slot ban biru dirender', document.getElementById('board-blue-bans').children.length === 5);

  const image = bluePicks[0].querySelector('img');
  check('slot pick berisi gambar hero', Boolean(image));
  check('src gambar dari aset hero', image?.getAttribute('src') === '/assets/heroes/khufra.png', String(image?.getAttribute('src')));
  check('nama hero tampil di slot', (bluePicks[0].querySelector('.hero-name')?.textContent || '') === 'Khufra', bluePicks[0].querySelector('.hero-name')?.textContent);

  // Slot terkisi terakhir ditandai aktif supaya operator tahu giliran siapa.
  check('slot pick terakhir ditandai aktif', bluePicks[1].dataset.active === 'true');
  check('slot lain tidak aktif', bluePicks[0].dataset.active !== 'true' && bluePicks[2].dataset.active !== 'true');

  check('slot kosong ditandai empty', bluePicks[2].dataset.empty === 'true');
  check('slot ban ditandai kind ban', document.getElementById('board-blue-bans').children[0].dataset.kind === 'ban');
  check('hero ter-ban tidak masuk slot pick biru', bluePicks[2].dataset.empty === 'true');

  check('nama tim biru tampil', document.getElementById('board-blue-title').textContent === 'ONIC');
  check('nama tim merah tampil', document.getElementById('board-red-title').textContent === 'RRQ');

  // Khufra + Yve (anti-dive + scaling) melawan Ling harus biru unggul.
  const blueValue = document.getElementById('advantage-blue-value').textContent;
  check('advantage biru dihitung dari matriks', /^\+[1-9]\d*$/.test(blueValue), blueValue);
  check('advantage merah persis berlawanan', document.getElementById('advantage-red-value').textContent === `-${blueValue.slice(1)}`, document.getElementById('advantage-red-value').textContent);

  const fill = document.getElementById('advantage-fill');
  check('bar advantage terisi', parseFloat(fill.style.width) > 0, fill.style.width);
  check('bar menunjuk leader biru', fill.dataset.leader === 'blue', fill.dataset.leader);

  const matchups = document.getElementById('matchup-list').children;
  check('matchup kunci dirender', matchups.length > 0, String(matchups.length));
  check('matchup kunci menyebut kedua hero', (matchups[0].querySelector('.matchup-win, .matchup-lose')?.textContent || '').includes('>'), matchups[0].textContent);

  const recommendations = document.getElementById('recommend-list').children;
  check('rekomendasi dirender lima', recommendations.length === 5, String(recommendations.length));
  check('rekomendasi punya nama', (recommendations[0].querySelector('.recommend-name')?.textContent || '').length > 0);
  check('rekomendasi punya alasan', (recommendations[0].querySelector('.recommend-why')?.textContent || '').length > 0);
  check('sisi aktif jadi judul rekomendasi', document.getElementById('recommend-side').textContent === 'BLUE');

  const names = [...recommendations].map((item) => item.querySelector('.recommend-name').textContent);
  check('hero yang sudah dipick tidak direkomendasikan', !names.includes('Khufra') && !names.includes('Yve'), names.join(', '));
  check('hero yang ter-ban tidak direkomendasikan', !names.includes('Grock') && !names.includes('Claude'), names.join(', '));
  check('hero yang dipick enemy tidak direkomendasikan', !names.includes('Ling'), names.join(', '));
}

section('Matriks gagal dimuat');
{
  const { document, errors, sockets } = await boot({ matrixStatus: 500 });
  check('boot tetap tanpa error saat matriks gagal', errors.length === 0, errors.join(' | '));
  check('sumber ditandai missing', document.getElementById('draft-source').dataset.state === 'missing', document.getElementById('draft-source').dataset.state);

  sockets[0].onMessage({ type: 'snapshot', payload: DRAFT_SNAPSHOT });
  check('snapshot tetap dirender tanpa matriks', errors.length === 0, errors.join(' | '));
  check('shell tetap terlihat', document.getElementById('draft-shell').dataset.visible === 'true');

  const picks = document.getElementById('board-blue-picks').children;
  check('slot pick tetap lima', picks.length === 5, String(picks.length));
  check('gambar hero tetap pakai path aset', picks[0].querySelector('img')?.getAttribute('src') === '/assets/heroes/khufra.png');

  // Jangan tampilkan "0" palsu yang terlihat seperti hasil hitungan.
  check('advantage disembunyikan, bukan 0', document.getElementById('advantage-blue-value').textContent === '--', document.getElementById('advantage-blue-value').textContent);
  check('bar advantage kosong', parseFloat(document.getElementById('advantage-fill').style.width) === 0, document.getElementById('advantage-fill').style.width);
  check('rekomendasi kosong tanpa matriks', document.getElementById('recommend-list').children.length === 0, String(document.getElementById('recommend-list').children.length));
}

section('Snapshot tidak valid');
{
  const { document, errors, sockets } = await boot();
  sockets[0].onMessage({ type: 'snapshot', payload: {} });
  check('payload kosong tidak melempar', errors.length === 0, errors.join(' | '));
  check('overlay tersembunyi saat draft tidak visible', document.getElementById('draft-shell').dataset.visible === 'false');

  sockets[0].onMessage({ type: 'snapshot', payload: { draft: { visible: true, blue: { picks: 'bukan-array' } } } });
  check('picks rusak tidak melempar', errors.length === 0, errors.join(' | '));
  check('slot tetap lima walau picks rusak', document.getElementById('board-blue-picks').children.length === 5);

  sockets[0].onMessage({ type: 'ping' });
  check('pesan lain diabaikan', errors.length === 0, errors.join(' | '));
}

section('Snapshot sampai sebelum matriks dimuat');
{
  // Regression: loadMatrix() re-rendered with render(lastDraft, lastTeams), but render()
  // takes a single payload and reads payload.draft. Passing the bare draft object made it
  // see draft === undefined, which emptied all 20 slots the moment the matrix resolved.
  const { document, errors, sockets } = await boot({ matrixDelayMs: 20 });
  sockets[0].onMessage({ type: 'snapshot', payload: DRAFT_SNAPSHOT });
  await new Promise((resolve) => setTimeout(resolve, 60));

  check('tanpa error setelah matriks telat', errors.length === 0, errors.join(' | '));
  check('draft tidak hilang saat matriks dimuat',
    document.getElementById('board-blue-picks').children[0].dataset.empty === 'false',
    document.getElementById('board-blue-picks').children[0].dataset.empty);
  check('round tetap 3 setelah matriks dimuat', document.getElementById('draft-round').textContent === '3');
  check('nama tim tetap tampil setelah matriks dimuat', document.getElementById('board-red-title').textContent === 'RRQ');
  check('advantage dihitung setelah matriks dimuat',
    /^\+[1-9]\d*$/.test(document.getElementById('advantage-blue-value').textContent),
    document.getElementById('advantage-blue-value').textContent);
}

section('Path artwork hero dari registry');
{
  // chang_e, lapu_lapu, x_borg dan yi_sun_shin punya nama file yang tidak sama dengan id.
  const { document, sockets } = await boot();
  sockets[0].onMessage({
    type: 'snapshot',
    payload: {
      teams: { blue: { name: 'B' }, red: { name: 'R' } },
      draft: { visible: true, blue: { picks: ['chang_e'] }, red: { picks: [] } },
    },
  });
  const src = document.getElementById('board-blue-picks').children[0].querySelector('img')?.getAttribute('src');
  check('path hero dari matriks, bukan ditebak dari id', src === matrix.heroes.chang_e.art, `${src} vs ${matrix.heroes.chang_e.art}`);
  check('path hero benar-benar ada di registry',
    String(src).endsWith('.png') && String(src).includes('/assets/heroes/'), String(src));

  // Setiap hero di matriks harus punya artwork, kalau tidak slot akan rely on fallback.
  const missingArt = Object.entries(matrix.heroes).filter(([, entry]) => !entry.art).map(([id]) => id);
  check('semua hero punya field art', missingArt.length === 0, missingArt.join(', '));
}

console.log(`\n${'='.repeat(52)}`);
console.log(`draft overlay render: ${passed} ok, ${failed} gagal`);
if (failures.length) {
  console.log('\nGagal:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
process.exit(failed ? 1 : 0);