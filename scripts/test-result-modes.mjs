// Fase 3 mode test: kartu MVP dan scoreboard 10 pemain harus membaca field baru (gpm,
// damage%, turret, radar, objectives) dan mode switch harus benar-benar menukar panel.
import { readFile, access } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import path from 'node:path';

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

function stubSocket(window, sink) {
  window.LiveSocket = {
    create: (options) => {
      sink.push(options);
      return { start: async () => true, stop: () => {}, send: () => 'sent', reconnectNow: () => {} };
    },
  };
}

async function boot() {
  const [html, appSource, profileSource] = await Promise.all([
    readFile(`${ROOT}/frontend/overlay/result/index.html`, 'utf8'),
    readFile(`${ROOT}/frontend/overlay/result/app.js`, 'utf8'),
    readFile(`${ROOT}/frontend/shared/profile.js`, 'utf8'),
  ]);
  const dom = new JSDOM(html, {
    url: 'https://example.test/p/abc/overlay/result/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const errors = [];
  const sockets = [];
  stubSocket(window, sockets);
  window.eval(profileSource);
  window.ProfileKit.fetchAux = async () => ({ ok: false });
  window.fetch = async () => ({ ok: false, json: async () => ({}) });
  window.addEventListener('error', (event) => errors.push(event.message));
  window.console.error = (...args) => errors.push(args.join(' '));
  window.eval(appSource);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { window, document: window.document, errors, sockets };
}

const bluePlayer = {
  name: 'Kurus', hero: 'Aamon', heroImage: '/assets/heroes/aamon.png', role: 'Assassin',
  level: 15, kills: 9, deaths: 3, assists: 7, rating: 14.2, gold: 24000, damage: 48200,
  damagePct: 27.4, turretDamage: 8400, gpm: 612, battleSpell: 'Retribution', emblem: 'Assassin Emblem',
  signaturePlay: 'Mencuri Lord di 14:20', items: ['/assets/items/boots.png', '/assets/items/endless.png'],
};

const redPlayer = {
  name: 'Vino', hero: 'Miya', heroImage: '/assets/heroes/miya.png', role: 'Marksman',
  level: 14, kills: 5, deaths: 6, assists: 9, rating: 8.4, gold: 18000, damage: 31000,
  damagePct: 18.1, turretDamage: 2100, gpm: 470, battleSpell: 'Sprint', emblem: 'Marksman Emblem',
  signaturePlay: '', items: [],
};

// Override DI LUAR `result`: ini payload lengkap, bukan isi `result`. Menyebbarkan override
// ke dalam `result` membuat kasus uji diam-diam tidak menguji apa yang diklaimnya.
function snapshot(overrides = {}, resultOverrides = {}) {
  return {
    match: { bo2: { enabled: true, bestOf: 2, games: [{ winner: 'blue' }, { winner: null }] } },
    teams: { blue: { name: 'Blue Phoenix' }, red: { name: 'Red Viper' } },
    result: {
      visible: true,
      mode: 'mvp',
      headline: 'VICTORY',
      gameNumber: 2,
      durationSec: 1470,
      damageDealt: 51200,
      damageTaken: 43100,
      mvp: 'Kurus',
      mvpRating: 12,
      objectives: { turtle: { blue: 3, red: 1 }, lord: { blue: 2, red: 0 }, turret: { blue: 7, red: 4 } },
      casterNote: 'Game cuddle,Phantom',
      stageLabel: 'Grand Final',
      ...resultOverrides,
    },
    players: { blue: [bluePlayer, {}], red: [redPlayer, {}] },
    ...overrides,
  };
}

section('Token desain dan font offline');
{
  const { document, errors } = await boot();

  // Font tidak boleh datang dari CDN: OBS sering dipakai tanpa internet, dan CDN yang gagal
  // hanya diam-diam mengubah tipografi tanpa satu baris pun di log.
  const apex = await readFile(`${ROOT}/frontend/shared/apex.css`, 'utf8');
  const fontUrls = [...apex.matchAll(/url\('(\/assets\/fonts\/[^']+)'\)/g)].map((match) => match[1]);
  check('apex.css memuat font secara lokal', fontUrls.length >= 7, String(fontUrls.length));
  check('tidak ada font dari CDN', !/https?:\/\//.test(apex.replace(/fonts\.googleapis|fonts\.gstatic/g, '')));

  const missing = [];
  for (const url of new Set(fontUrls)) {
    try {
      await access(path.join(ROOT, url.replace(/^\//, '').replace(/\//g, path.sep)));
    } catch {
      missing.push(url);
    }
  }
  check('semua file font ada di disk', missing.length === 0, missing.join(', '));

  const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map((node) => node.getAttribute('href'));
  check('token desain ikut dimuat', links.includes('/frontend/shared/apex.css'), links.join(', '));
  check('boot tetap tanpa error', errors.length === 0, errors.join(' | '));
}

section('Mode MVP');
{
  const { document, errors, sockets } = await boot();
  sockets[0].onMessage({ type: 'snapshot', payload: snapshot() });
  check('render tanpa error', errors.length === 0, errors.join(' | '));
  check('mode mvp aktif', document.getElementById('result-shell').dataset.mode === 'mvp');

  check('nama player MVP', document.getElementById('mvp-player').textContent === 'Kurus', document.getElementById('mvp-player').textContent);
  check('nama hero MVP', document.getElementById('mvp-heroname').textContent === 'Aamon');
  check('role MVP tampil', document.getElementById('mvp-role').textContent === 'Assassin');
  check('rating satu desimal', document.getElementById('mvp-rating').textContent === '14.2', document.getElementById('mvp-rating').textContent);

  check('KDA benar', document.getElementById('mvp-kills').textContent === '9'
    && document.getElementById('mvp-deaths').textContent === '3'
    && document.getElementById('mvp-assists').textContent === '7');

  check('level tampil', document.getElementById('mvp-level').textContent === '15');
  check('gold dipadatkan ke K', document.getElementById('mvp-gold').textContent === '24.0K', document.getElementById('mvp-gold').textContent);
  check('gpm tampil', document.getElementById('mvp-gpm').textContent === '612');
  check('damage dipadatkan', document.getElementById('mvp-damage').textContent === '48.2K', document.getElementById('mvp-damage').textContent);
  check('persen damage tampil', document.getElementById('mvp-damage-pct').textContent === '27%', document.getElementById('mvp-damage-pct').textContent);
  // compact() memakai ambang 1.000, sama seperti formatGold() di overlay gameplay, supaya
  // angka gold yang sama tidak tampil "9.9K" di satu scene dan "9999" di scene lain.
  check('turret damage dipadatkan konsisten dengan gameplay', document.getElementById('mvp-turret').textContent === '8.4K', document.getElementById('mvp-turret').textContent);

  check('battle spell tampil', document.getElementById('mvp-spell').textContent === 'Retribution');
  check('emblem tampil', document.getElementById('mvp-emblem').textContent === 'Assassin Emblem');
  check('signature play tampil', document.getElementById('mvp-signature').textContent === 'Mencuri Lord di 14:20');

  check('hero art dipakai', document.getElementById('mvp-hero-art').getAttribute('src') === '/assets/heroes/aamon.png');
  check('dua item dirender', document.getElementById('mvp-items').children.length === 2, String(document.getElementById('mvp-items').children.length));
  check('nama tim di board mode ikut terisi', document.getElementById('board-blue-name').textContent === 'Blue Phoenix');

  check('skor seri dari BO2 tetap 1-0', document.getElementById('result-blue-score').textContent === '1');
  check('durasi tetap 24:30', document.getElementById('result-duration').textContent === '24:30');
  check('MVP lama tetap tampil', document.getElementById('result-mvp').textContent === 'Kurus');
}

section('Objectives dan catatan caster');
{
  const { document, sockets } = await boot();
  sockets[0].onMessage({ type: 'snapshot', payload: snapshot() });
  check('turtle biru', document.getElementById('objective-turtle-blue').textContent === '3');
  check('turtle merah', document.getElementById('objective-turtle-red').textContent === '1');
  check('lord biru', document.getElementById('objective-lord-blue').textContent === '2');
  check('lord merah', document.getElementById('objective-lord-red').textContent === '0');
  check('tower biru', document.getElementById('objective-turret-blue').textContent === '7');
  check('tower merah', document.getElementById('objective-turret-red').textContent === '4');
  check('catatan caster tampil', document.getElementById('result-caster-note').textContent === 'Game cuddle,Phantom');
  check('label stage tampil', document.getElementById('result-stage-label').textContent === 'Grand Final');

  sockets[0].onMessage({ type: 'snapshot', payload: snapshot({}, { objectives: undefined, casterNote: undefined, stageLabel: undefined }) });
  check('objectives kosong jadi 0', document.getElementById('objective-lord-red').textContent === '0');
  check('catatan kosong jadi string kosong', document.getElementById('result-caster-note').textContent === '');
}

section('Mode scoreboard');
{
  const { document, errors, sockets } = await boot();
  sockets[0].onMessage({ type: 'snapshot', payload: snapshot({}, { mode: 'scoreboard' }) });
  check('render tanpa error', errors.length === 0, errors.join(' | '));
  check('mode scoreboard aktif', document.getElementById('result-shell').dataset.mode === 'scoreboard');

  const blueRows = document.getElementById('board-blue-rows').children;
  check('baris biru hanya untuk player terisi', blueRows.length === 1, String(blueRows.length));
  check('nama player di baris', blueRows[0].querySelector('.board-row-name').textContent.includes('Kurus'));
  check('nama hero di baris', blueRows[0].querySelector('.board-row-hero-name').textContent === 'Aamon');
  check('KDA di baris', blueRows[0].querySelector('.board-row-kda').textContent === '9/3/7', blueRows[0].querySelector('.board-row-kda').textContent);

  const redRows = document.getElementById('board-red-rows').children;
  check('baris merah terisi', redRows.length === 1, String(redRows.length));
  check('baris merah KDA', redRows[0].querySelector('.board-row-kda').textContent === '5/6/9');

  // Skor seri digambar sebagai diamond, bukan angka. Nilai aslinya tetap ada di `data-score`
// supaya tidak hilang informasi.
const blueSeries = document.getElementById('board-blue-series');
const redSeries = document.getElementById('board-red-series');
check('seri biru jadi diamond', blueSeries.dataset.score === '1', blueSeries.dataset.score);
check('satu diamond untuk BO2', blueSeries.children.length === 1, String(blueSeries.children.length));
check('diamond biru menyala', blueSeries.children[0]?.dataset.state === 'win', blueSeries.children[0]?.dataset.state);
check('seri merah jadi diamond', redSeries.dataset.score === '0', redSeries.dataset.score);
check('diamond merah padam', redSeries.children[0]?.dataset.state === 'lose', redSeries.children[0]?.dataset.state);
check('seri merah punya warna tim', redSeries.children[0]?.dataset.side === 'red');
check('nama tim biru di board', document.getElementById('board-blue-name').textContent === 'Blue Phoenix');
check('nama tim merah di board', document.getElementById('board-red-name').textContent === 'Red Viper');

  // Tanpa `bestOf` panjang seri tidak diketahui, jadi angka biasa dipakai. Menebak jumlah
  // diamond akan membuat layar ini salah dan tidak ada yang mengoreksinya.
  sockets[0].onMessage({
    type: 'snapshot',
    payload: { ...snapshot({ match: {} }), result: { visible: true, mode: 'scoreboard', headline: 'VICTORY', seriesScore: { blue: 2, red: 1 } } },
  });
  check('tanpa bestOf seri kembali ke angka',
    document.getElementById('board-blue-series').textContent === '2',
    document.getElementById('board-blue-series').textContent);

  // BO3 = dua diamond.
  sockets[0].onMessage({
    type: 'snapshot',
    payload: {
      ...snapshot({ match: { bo2: { enabled: true, bestOf: 3, games: [{ winner: 'blue' }, { winner: null }, { winner: null }] } } }),
      result: { visible: true, mode: 'scoreboard', headline: 'VICTORY' },
    },
  });
  check('BO3 punya dua diamond', document.getElementById('board-blue-series').children.length === 2,
    String(document.getElementById('board-blue-series').children.length));
}

section('MVP fallback dan keamanan path');
{
  // Nama tidak ketemu -> harus jatuh ke skor tertinggi, bukan kartu kosong.
  const fallback = await boot();
  fallback.sockets[0].onMessage({ type: 'snapshot', payload: snapshot({}, { mvp: 'NamaTidakAda' }) });
  check('fallback ke player terbaik, bukan kosong', fallback.document.getElementById('mvp-player').textContent === 'Kurus', fallback.document.getElementById('mvp-player').textContent);

  const partial = await boot();
  partial.sockets[0].onMessage({ type: 'snapshot', payload: snapshot({}, { mvp: 'kur' }) });
  check('nama MVP sebagian tetap cocok', partial.document.getElementById('mvp-player').textContent === 'Kurus', partial.document.getElementById('mvp-player').textContent);

  // Path aset dari operator harus dibatasi ke direktori aset.
  const unsafe = await boot();
  unsafe.sockets[0].onMessage({
    type: 'snapshot',
    payload: snapshot({
      players: {
        blue: [{
          ...bluePlayer,
          heroImage: 'https://evil.test/x.png',
          items: ['javascript:alert(1)', '/assets/items/evil.png', '../../../etc/passwd'],
        }],
        red: [],
      },
    }),
  });
  check('path hero eksternal ditolak', unsafe.document.getElementById('mvp-hero-art').dataset.empty === 'true', unsafe.document.getElementById('mvp-hero-art').dataset.empty);
  check('src hero dikosongkan', !unsafe.document.getElementById('mvp-hero-art').hasAttribute('src'));
  check('item non-aset ditolak, sisanya tetap', unsafe.document.getElementById('mvp-items').children.length === 1, String(unsafe.document.getElementById('mvp-items').children.length));
  check('item yang lolos punya path aset', unsafe.document.getElementById('mvp-items').children[0].getAttribute('src') === '/assets/items/evil.png');

  // players kosong: overlay tidak boleh melempar.
  const empty = await boot();
  empty.sockets[0].onMessage({ type: 'snapshot', payload: snapshot({ players: undefined }) });
  check('players undefined tidak melempar', empty.errors.length === 0, empty.errors.join(' | '));
  check('nama MVP tetap dari result', empty.document.getElementById('mvp-player').textContent === 'Kurus');
  check('baris scoreboard kosong', empty.document.getElementById('board-blue-rows').children.length === 0);
}

section('Outcome, MVP sisi, dan radar');
{
  // Regex sebelumnya `/^defeat|kalah|loss/i` dibaca sebagai `(^defeat)|(kalah)|(loss)`, jadi
  // headline yang MEMBEYCONTAIN "loss" ikut jadi warna kalah.
  const flawless = await boot();
  flawless.sockets[0].onMessage({ type: 'snapshot', payload: snapshot({}, { headline: 'FLAWLESS COMEBACK' }) });
  check('headline win tidak salah jadi defeat', flawless.document.getElementById('result-shell').dataset.outcome === 'win',
    flawless.document.getElementById('result-shell').dataset.outcome);

  const defeated = await boot();
  defeated.sockets[0].onMessage({ type: 'snapshot', payload: snapshot({}, { headline: 'DEFEAT' }) });
  check('headline defeat terdeteksi', defeated.document.getElementById('result-shell').dataset.outcome === 'defeat',
    defeated.document.getElementById('result-shell').dataset.outcome);

  // Skor seri yang sudah ada menang atas teks operator: BO2 0-2 = biru kalah.
  const lostSeries = await boot();
  lostSeries.sockets[0].onMessage({
    type: 'snapshot',
    payload: {
      ...snapshot({ match: { bo2: { enabled: true, bestOf: 2, games: [{ winner: 'red' }, { winner: 'red' }] } } }),
      result: { visible: true, mode: 'mvp', headline: 'VICTORY' },
    },
  });
  check('skor seri 0-2 memastikan biru kalah walau headline VICTORY',
    lostSeries.document.getElementById('result-shell').dataset.outcome === 'defeat',
    lostSeries.document.getElementById('result-shell').dataset.outcome);

  // Kartu VICTORY biru tidak boleh menampilkan player tim merah.
  const mvpSide = await boot();
  mvpSide.sockets[0].onMessage({
    type: 'snapshot',
    payload: snapshot({
      players: {
        blue: [{ ...bluePlayer, name: 'BlueTank', kills: 1, deaths: 9, assists: 0 }],
        red: [{ ...redPlayer, name: 'RedStar', kills: 15, deaths: 1, assists: 10 }],
      },
    }, { mvp: '' }),
  });
  check('MVP dicari hanya di tim menang',
    mvpSide.document.getElementById('mvp-player').textContent === 'BlueTank',
    mvpSide.document.getElementById('mvp-player').textContent);
}

section('Radar: data yang tadinya mati');
{
  const withRadar = await boot();
  withRadar.sockets[0].onMessage({
    type: 'snapshot',
    payload: snapshot({
      players: { blue: [{ ...bluePlayer, radar: [90, 40, 70, 55, 30] }], red: [] },
    }, { mode: 'scoreboard' }),
  });
  const figure = withRadar.document.getElementById('mvp-radar');
  check('blok radar tampil saat data ada', figure.hidden === false);
  check('radar menggambar 4 ring + 5 titik',
    withRadar.document.querySelectorAll('#mvp-radar-chart .radar-ring').length === 4
    && withRadar.document.querySelectorAll('#mvp-radar-chart .radar-dot').length === 5,
    `${withRadar.document.querySelectorAll('#mvp-radar-chart .radar-ring').length} ring`);
  check('legenda radar lima sumbu',
    withRadar.document.getElementById('mvp-radar-legend').children.length === 5,
    String(withRadar.document.getElementById('mvp-radar-legend').children.length));
  check('baris scoreboard punya radar lima bar',
    withRadar.document.querySelectorAll('#board-blue-rows .radar-bar').length === 5,
    String(withRadar.document.querySelectorAll('#board-blue-rows .radar-bar').length));

  // Nol semua = belum diisi, bukan performa nol.
  const noRadar = await boot();
  noRadar.sockets[0].onMessage({
    type: 'snapshot',
    payload: snapshot({ players: { blue: [{ ...bluePlayer, radar: [0, 0, 0, 0, 0] }], red: [] } }),
  });
  check('radar kosong disembunyikan', noRadar.document.getElementById('mvp-radar').hidden === true);
  check('tidak ada pentagon datar', noRadar.document.querySelectorAll('#mvp-radar-chart polygon').length === 0);
}

section('Angka belum diisi memakai "--"');
{
  const bare = await boot();
  bare.sockets[0].onMessage({
    type: 'snapshot',
    payload: snapshot({ players: { blue: [], red: [] } }, { mvp: '' }),
  });
  const ids = ['mvp-kills', 'mvp-deaths', 'mvp-assists', 'mvp-gold', 'mvp-gpm', 'mvp-damage', 'mvp-damage-pct', 'mvp-turret'];
  const zeros = ids.filter((id) => bare.document.getElementById(id).textContent === '0' || bare.document.getElementById(id).textContent === '0%');
  check('tidak ada angka nol palsu saat roster kosong', zeros.length === 0, zeros.join(','));
  check('kills tampil "--"', bare.document.getElementById('mvp-kills').textContent === '--');
  check('DMG% tampil "--" bukan "0%"', bare.document.getElementById('mvp-damage-pct').textContent === '--');
  check('karakter tak dikenal tidak melempar', bare.errors.length === 0, bare.errors.join(' | '));
}

console.log(`\n${'='.repeat(52)}`);
console.log(`result modes: ${passed} ok, ${failed} gagal`);
if (failures.length) {
  console.log('\nGagal:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
process.exit(failed ? 1 : 0);