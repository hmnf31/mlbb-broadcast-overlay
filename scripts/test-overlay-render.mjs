// Fase 3-7 render test: the two browser sources must show the same numbers the control panel
// writes. Runs both overlay pages in jsdom against their real markup, feeding snapshots
// through the same onMessage path the live socket uses.
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

// Live socket stand-in that records the options so the test can push snapshots without a
// server, exactly like production does over the wire.
function stubSocket(window, sink) {
  window.LiveSocket = {
    create: (options) => {
      sink.push(options);
      return {
        start: async () => true,
        stop: () => {},
        send: () => 'sent',
        reconnectNow: () => {},
        get status() { return 'online'; },
      };
    },
  };
}

// Jendela jsdom yang sudah di-boot. Halaman overlay punya timer sendiri (denyut timer
// gameplay menghitung ulang tiap detik) dan WebSocket yg disambungkan ulang, jadi semua
// jendela harus ditutup sebelum proses boleh keluar. Tanpa ini suite ini tidak akan pernah
// selesai, karena tidak ada satu pun aplikasi yang menutup interval-nya sendiri.
const openWindows = [];

function boot(pageDir, url) {
  return Promise.all([
    readFile(`${ROOT}/frontend/${pageDir}/index.html`, 'utf8'),
    readFile(`${ROOT}/frontend/${pageDir}/app.js`, 'utf8'),
    readFile(`${ROOT}/frontend/shared/profile.js`, 'utf8'),
  ]).then(([html, appSource, profileSource]) => {
    const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
    const { window } = dom;
    openWindows.push(window);
    const errors = [];
    window.eval(profileSource);
    const sockets = [];
    stubSocket(window, sockets);
    window.fetch = async () => ({ ok: false, json: async () => ({}) });
    Kit_stub(window);
    window.addEventListener('error', (event) => errors.push(event.message));
    window.console.error = (...args) => errors.push(args.join(' '));
    try {
      window.eval(appSource);
    } catch (error) {
      errors.push(`boot: ${error.message}`);
    }
    return { window, document: window.document, errors, sockets };
  });
}

// Aux reads are what let the overlay pick up saved result/players; stub them per page.
function Kit_stub(window) {
  window.ProfileKit.fetchAux = async () => ({ ok: false });
  window.ProfileKit.fetchAssets = async () => ({ ok: false });
  window.ProfileKit.fetchRegistry = async () => ({ ok: false, error: 'offline' });
}

function getComputedScale(window) {
  return window.getComputedStyle(window.document.documentElement).getPropertyValue('--design-scale').trim();
}

const BO2_SNAPSHOT = {
  match: {
    timer: 1325,
    blueKills: 18,
    redKills: 15,
    blueGold: 42300,
    redGold: 38900,
    bo2: { enabled: true, bestOf: 2, games: [{ winner: 'blue' }, { winner: null }] },
  },
  teams: { blue: { name: 'Blue Phoenix' }, red: { name: 'Red Viper' } },
  presentation: { tournamentName: 'MPL ID S12', roundName: 'Grand Final' },
  assetsVersion: null,
  result: { visible: true, headline: 'VICTORY', gameNumber: 2, durationSec: 1470, damageDealt: 51200, damageTaken: 43100, mvp: 'Kurus' },
  players: {
    blue: [
      { name: 'Kurus', hero: 'Aamon', heroImage: '/assets/heroes/aamon.png', level: 12, kills: 9, deaths: 3, assists: 7, items: ['/assets/items/boots.png'] },
      { name: '', hero: '', heroImage: '', level: 1, kills: 0, deaths: 0, assists: 0, items: [] },
    ],
    red: [{ name: 'Vino', hero: 'Miya', heroImage: '/assets/heroes/miya.png', level: 11, kills: 5, deaths: 6, assists: 9, items: [] }],
  },
};

async function main() {
  // The gameplay overlay renders after the asset promise settles, so let the microtask
  // queue drain before asserting on the DOM.
  const settle = () => new Promise((resolve) => setImmediate(resolve));

// "mm:ss" -> detik, supaya assertion timer bisa mentoleransi satu tick tanpa jadi ambigu.
const toSeconds = (text) => {
  const match = /^(\d+):(\d{2})$/.exec(String(text).trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
};

  section('Overlay gameplay');
  {
    const { document: gameplay, errors, sockets } = await boot('overlay/gameplay', 'http://127.0.0.1:8787/p/testslug12345/overlay/gameplay/');
    check('gameplay boot tanpa exception', errors.length === 0, errors.slice(0, 3).join(' | '));
    // No snapshot yet: the shell must stay hidden so a source that never connects shows an
    // empty frame instead of the placeholder text baked into index.html.
    check('shell tersembunyi sebelum snapshot', gameplay.getElementById('overlay-shell').hidden === true);

    sockets[0].onMessage({ type: 'snapshot', payload: BO2_SNAPSHOT });
    await settle();

    check('shell tampil setelah snapshot', gameplay.getElementById('overlay-shell').hidden === false);

    check('kill match sama', gameplay.getElementById('blue-kills').textContent === '18'
      && gameplay.getElementById('red-kills').textContent === '15',
      `${gameplay.getElementById('blue-kills').textContent}/${gameplay.getElementById('red-kills').textContent}`);
    check('timer dari snapshot', gameplay.getElementById('match-timer').textContent === '22:05', gameplay.getElementById('match-timer').textContent);

    // Tanpa anchor (semua state lama) angka harus DIAM, bukan dikarang mundur sendiri dari
    // waktu lokal: mengarang mundur akan membuat timer melompat begitu tab baru dibuka.
    {
      const before = gameplay.getElementById('match-timer').textContent;
      await new Promise((resolve) => setTimeout(resolve, 1100));
      check('tanpa anchor timer tetap diam', before === '22:05' && gameplay.getElementById('match-timer').textContent === '22:05', gameplay.getElementById('match-timer').textContent);
      check('denyut timer tidak melempar error', errors.length === 0, errors.slice(0, 2).join(' | '));
    }

    // Anchor: overlay mengurangi selisih anchorAt sendiri, dan respects timerRunning.
    {
      const anchorAt = Date.now();
      sockets[0].onMessage({
        type: 'snapshot',
        payload: { ...BO2_SNAPSHOT, match: { ...BO2_SNAPSHOT.match, timer: 300, timerAt: anchorAt, timerRunning: true } },
      });
      await settle();
      check('anchor dipakai langsung', gameplay.getElementById('match-timer').textContent === '05:00', gameplay.getElementById('match-timer').textContent);

      // Berjalan lokal: tanpa kiriman baru, angka tetap turun. Inilah yang menghapus
      // kebutuhan push satu envelope per detik.
      //
      // Tidak boleh assert jumlah detik persis: interval dimulai saat app boot sedangkan
      // anchorAt dibuat di tengah siklus, jadi tick pertama bisa datang hampir satu detik
      // kemudian. Yang diuji adalah "berjalan dan maju", bukan hitungan tick.
      await new Promise((resolve) => setTimeout(resolve, 2100));
      {
        const shown = toSeconds(gameplay.getElementById('match-timer').textContent);
        check('denyut menurunkan angka tanpa kiriman baru', shown < 300 && shown >= 297, `300 -> ${shown}`);
      }

      sockets[0].onMessage({
        type: 'snapshot',
        payload: { ...BO2_SNAPSHOT, match: { ...BO2_SNAPSHOT.match, timer: 300, timerAt: anchorAt - 30_000, timerRunning: true } },
      });
      await settle();
      check('selisih anchor ikut dihitung', toSeconds(gameplay.getElementById('match-timer').textContent) <= 270, gameplay.getElementById('match-timer').textContent);

      sockets[0].onMessage({
        type: 'snapshot',
        payload: { ...BO2_SNAPSHOT, match: { ...BO2_SNAPSHOT.match, timer: 300, timerAt: anchorAt - 600_000, timerRunning: false } },
      });
      await settle();
      check('timerRunning false menahan angka', gameplay.getElementById('match-timer').textContent === '05:00', gameplay.getElementById('match-timer').textContent);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      check('angka tetap beku saat pause', gameplay.getElementById('match-timer').textContent === '05:00', gameplay.getElementById('match-timer').textContent);

      // Kembalikan ke snapshot semula supaya assertion lain tidak terpengaruh.
      sockets[0].onMessage({ type: 'snapshot', payload: BO2_SNAPSHOT });
      await settle();
      check('kembali ke timer snapshot', gameplay.getElementById('match-timer').textContent === '22:05', gameplay.getElementById('match-timer').textContent);
    }
    check('gold diff +3.4K', gameplay.getElementById('gold-diff').textContent === '+3.4K', gameplay.getElementById('gold-diff').textContent);
    check('nama tim dari snapshot', gameplay.getElementById('blue-name').textContent === 'Blue Phoenix');

    const blueBo2 = gameplay.getElementById('bo2-blue');
    const redBo2 = gameplay.getElementById('bo2-red');
    check('baris seri tampil', blueBo2.hidden === false && redBo2.hidden === false);
    const blueDots = [...blueBo2.querySelectorAll('.bo2-dot')];
    check('blue menang game 1', blueDots[0]?.dataset.state === 'win', blueDots[0]?.dataset.state);
    // BO2 selesai di 1 win, jadi begitu blue menang game 1 serinya sudah diputuskan: game 2
    // BUKAN match point. Versi lama memakai `teamWins >= games.length - 1` sehingga masih
    // menandai match point di sini, dan `teamDone = teamWins >= games.length` yang tidak
    // pernah tercapai membuat badge "seri selesai" tidak pernah muncul sama sekali.
    check('blue BO2 sudah menutup seri, bukan match point',
      blueDots[1]?.dataset.state === 'pending' && blueDots[1]?.dataset.matchpoint === undefined,
      blueDots[1]?.dataset.matchpoint);
    const redDots = [...redBo2.querySelectorAll('.bo2-dot')];
    check('red kalah game 1', redDots[0]?.dataset.state === 'lose', redDots[0]?.dataset.state);

    // Best-of tidak lagi dikunci di 2. BO3 selesai di 2 win, jadi blue yang sudah menang
    // game 1 baru berada di match point -- dan game ke-3 tidak boleh terpotong.
    sockets[0].onMessage({
      type: 'snapshot',
      payload: {
        ...BO2_SNAPSHOT,
        match: {
          ...BO2_SNAPSHOT.match,
          bo2: { enabled: true, bestOf: 3, games: [{ winner: 'blue' }, { winner: null }, { winner: null }] },
        },
      },
    });
    await settle();
    const bo3Blue = [...gameplay.getElementById('bo2-blue').querySelectorAll('.bo2-dot')];
    check('BO3 punya 3 titik', bo3Blue.length === 3, String(bo3Blue.length));
    check('BO3 blue di match point',
      bo3Blue[1]?.dataset.matchpoint === '1' && bo3Blue[2]?.dataset.matchpoint === undefined,
      `${bo3Blue[1]?.dataset.matchpoint} / ${bo3Blue[2]?.dataset.matchpoint}`);

    // BO5 selesai di 3 win: satu win sama sekali belum match point.
    sockets[0].onMessage({
      type: 'snapshot',
      payload: {
        ...BO2_SNAPSHOT,
        match: {
          ...BO2_SNAPSHOT.match,
          bo2: { enabled: true, bestOf: 5, games: [{ winner: 'blue' }, { winner: null }, { winner: null }, { winner: null }, { winner: null }] },
        },
      },
    });
    await settle();
    const bo5Blue = [...gameplay.getElementById('bo2-blue').querySelectorAll('.bo2-dot')];
    check('BO5 punya 5 titik', bo5Blue.length === 5, String(bo5Blue.length));
    check('BO5 dengan 1 win belum match point',
      bo5Blue.every((dot) => dot.dataset.matchpoint === undefined),
      bo5Blue.map((dot) => dot.dataset.matchpoint).join(','));

    const rosterBlue = gameplay.getElementById('roster-blue');
    check('roster blue tampil', rosterBlue.hidden === false);
    // Only the filled slot is drawn. The server pads every side to five rows, so rendering
    // the padding too would put blank "-" / 0 0 0 cards on air.
    check('slot kosong tidak dirender', rosterBlue.querySelectorAll('.roster-card').length === 1, String(rosterBlue.querySelectorAll('.roster-card').length));
    check('nama + KDA player tampil', rosterBlue.textContent.includes('Kurus') && rosterBlue.textContent.includes('9'));
    check('hero image dirender', rosterBlue.querySelector('.roster-hero')?.getAttribute('src') === '/assets/heroes/aamon.png');
    check('item player dirender', rosterBlue.querySelectorAll('.roster-items img').length === 1);

    sockets[0].onMessage({ type: 'snapshot', payload: { ...BO2_SNAPSHOT, players: null } });
    check('roster hilang saat players null', gameplay.getElementById('roster-blue').hidden === true);
  }

  section('Overlay result');
  {
    const { document: result, errors, sockets, window: resultWindow } = await boot('overlay/result', 'http://127.0.0.1:8787/p/testslug12345/overlay/result/');
    check('result boot tanpa exception', errors.length === 0, errors.slice(0, 3).join(' | '));

    sockets[0].onMessage({ type: 'snapshot', payload: BO2_SNAPSHOT });

    const shell = result.getElementById('result-shell');
    check('shell tampil saat result.visible', shell.dataset.visible === 'true', shell.dataset.visible);
    check('skala desain bukan nol', Number(getComputedScale(resultWindow)) > 0, getComputedScale(resultWindow));
    check('headline VICTORY', result.getElementById('result-headline').textContent === 'VICTORY');
    check('skor seri dari BO2 = 1-0', result.getElementById('result-blue-score').textContent === '1'
      && result.getElementById('result-red-score').textContent === '0',
      `${result.getElementById('result-blue-score').textContent}-${result.getElementById('result-red-score').textContent}`);
    check('nama tim dari snapshot', result.getElementById('result-blue-name').textContent === 'Blue Phoenix');
    check('durasi 1470 dtk = 24:30', result.getElementById('result-duration').textContent === '24:30', result.getElementById('result-duration').textContent);
    check('game ke-2', result.getElementById('result-game').textContent === '2');
    check('MVP tampil', result.getElementById('result-mvp').textContent === 'Kurus');

    sockets[0].onMessage({
      type: 'snapshot',
      payload: { ...BO2_SNAPSHOT, result: { ...BO2_SNAPSHOT.result, headline: 'DEFEAT' } },
    });
    check('kalah = merah', result.getElementById('result-shell').dataset.outcome === 'defeat', result.getElementById('result-shell').dataset.outcome);

    sockets[0].onMessage({ type: 'snapshot', payload: { ...BO2_SNAPSHOT, result: { visible: false } } });
    check(' disembunyikan saat visible false', result.getElementById('result-shell').dataset.visible === 'false');
  }

  section('Skor seri manual tanpa BO2');
  {
    const { document: result, sockets } = await boot('overlay/result', 'http://127.0.0.1:8787/p/testslug12345/overlay/result/');
    sockets[0].onMessage({
      type: 'snapshot',
      payload: {
        match: { bo2: { enabled: false } },
        result: { visible: true, headline: 'VICTORY', seriesScore: { blue: 2, red: 1 } },
      },
    });
    check('skor seri manual dipakai', result.getElementById('result-blue-score').textContent === '2'
      && result.getElementById('result-red-score').textContent === '1');
  }

  console.log('\n========================================');
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const item of failures) console.log(`  - ${item}`);
  }
  console.log('========================================');
  process.exitCode = failed === 0 ? 0 : 1;
  for (const window of openWindows) window.close();
}

main().catch((error) => {
  console.error('Suite crashed:', error);
  process.exitCode = 1;
  for (const window of openWindows) window.close();
});
