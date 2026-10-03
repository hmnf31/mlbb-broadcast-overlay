// Panel verifikasi: kontrak adapter harus menyaring bacaan buruk, dan panel harus
// memperlakukan Field Lock sebagai batas yang tidak bisa dilewati operator.
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

import '../frontend/shared/ocr-adapter.js';
import '../frontend/shared/ocr-parse.js';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, '');
const { OcrAdapter, OcrParse } = globalThis;

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

section('Provider bawaan');
{
  const providers = OcrAdapter.list();
  check('provider manual terdaftar', providers.some((provider) => provider.id === 'manual'), providers.map((p) => p.id).join(','));
  const manual = providers.find((provider) => provider.id === 'manual');
  check('provider manual ditandai tier manual', manual.tier === 'manual', manual.tier);
  check('fungsi recognize tidak bocor lewat list()', manual.recognize === undefined);
  check('field yang terdaftar sama dengan Field Lock server', OcrAdapter.FIELDS.length === 11, String(OcrAdapter.FIELDS.length));
  check('semua field punya label', OcrAdapter.FIELDS.every((field) => typeof field === 'string' && field.length));
}

section('Normalisasi bacaan');
{
  const normalized = OcrAdapter.normalizeReadings({
    timer: { value: 1325, rawText: '22:05', confidence: 92.4 },
    blueKills: { value: '18', confidence: 80 },
    redKills: { value: 'NaN', confidence: 90 },
    unknownField: { value: 5 },
    blueGold: { value: 42300 },
  });
  check('nilai string angka diterima', normalized.blueKills?.value === 18, String(normalized.blueKills?.value));
  check('NaN dibuang', !('redKills' in normalized));
  check('field tak dikenal dibuang', !('unknownField' in normalized), Object.keys(normalized).join(','));
  check('confidence hilang jadi 0', normalized.blueGold?.confidence === 0, String(normalized.blueGold?.confidence));
  check('rawText dipotong 64 karakter', normalized.timer?.rawText === '22:05');
  check('confidence dibulatkan dan dijepit', normalized.timer?.confidence === 92, String(normalized.timer?.confidence));

  const clamped = OcrAdapter.normalizeReadings({ timer: { value: 5, confidence: 999 } });
  check('confidence >100 dijepit ke 100', clamped.timer.confidence === 100, String(clamped.timer.confidence));
  const negative = OcrAdapter.normalizeReadings({ timer: { value: 5, confidence: -20 } });
  check('confidence negatif dijepit ke 0', negative.timer.confidence === 0, String(negative.timer.confidence));

  check('input bukan object aman', Object.keys(OcrAdapter.normalizeReadings(null)).length === 0);
  check('array aman', Object.keys(OcrAdapter.normalizeReadings([])).length === 0);
}

section('Registrasi dan recognize');
{
  check('registrasi provider cacat ditolak', OcrAdapter.register({ id: 'x' }) === false);
  check('registrasi tanpa id ditolak', OcrAdapter.register({ recognize: async () => ({}) }) === false);

  OcrAdapter.register({
    id: 'paddle',
    label: 'PaddleOCR (dummy)',
    recognize: async () => ({ readings: { timer: { value: 900, confidence: 88 }, blueKills: { value: 4, confidence: 70 } } }),
  });
  check('provider valid diterima', OcrAdapter.has('paddle'));
  check('label ikut tampil', OcrAdapter.list().some((provider) => provider.label === 'PaddleOCR (dummy)'));

  const good = await OcrAdapter.recognize('paddle', { image: 'data:image/png;base64,xx' });
  check('provider terbaca sukses', good.ok === true, good.error);
  check('bacaan diteruskan', good.readings.timer?.value === 900, String(good.readings.timer?.value));
  check('tier diteruskan', good.tier === 'auto', good.tier);

  // Provider yangDiam-diam mengembalikan(field bertipe salah harus dianggap gagal,
  // bukan "berhasil dengan nol field" yang bikin operator mengira angkanya terverifikasi.
  OcrAdapter.register({ id: 'kosong', recognize: async () => ({ readings: { timer: { value: 'bukan angka' } } }) });
  const empty = await OcrAdapter.recognize('kosong', {});
  check('provider tanpa field valid dianggap gagal', empty.ok === false, JSON.stringify(empty));

  OcrAdapter.register({ id: 'gagal', recognize: async () => { throw new Error('engine mati'); } });
  const broken = await OcrAdapter.recognize('gagal', {});
  check('provider yang melempar dilaporkan', broken.ok === false && /engine mati/.test(broken.error), broken.error);

  const unknown = await OcrAdapter.recognize('tidak-ada', {});
  check('provider tak dikenal dilaporkan', unknown.ok === false && /tidak terdaftar/.test(unknown.error), unknown.error);

  const manual = await OcrAdapter.recognize('manual', { image: 'data:,x' });
  check('provider manual gagal dengan pesan jelas', manual.ok === false && /Isi sendiri/.test(manual.error), manual.error);
}

async function boot() {
  const [html, appSource, profileSource, adapterSource] = await Promise.all([
    readFile(`${ROOT}/frontend/verify/index.html`, 'utf8'),
    readFile(`${ROOT}/frontend/verify/app.js`, 'utf8'),
    readFile(`${ROOT}/frontend/shared/profile.js`, 'utf8'),
    readFile(`${ROOT}/frontend/shared/ocr-adapter.js`, 'utf8'),
  ]);
  const dom = new JSDOM(html, {
    url: 'https://example.test/p/abc/verify/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const errors = [];
  const sockets = [];
  const pushed = [];
  window.LiveSocket = {
    create: (options) => {
      sockets.push(options);
      return { start: async () => true, stop: () => {}, send: () => 'sent', reconnectNow: () => {} };
    },
  };
  window.eval(profileSource);
  window.eval(adapterSource);
  // StubHarus dipasang SEBELUM app.js dieval, karena app.js membaca ownerKey sekali saat boot.
  // ownerKey dikasih nilai supaya jalur push benar-benar teruji; tanpa itu panel menolak
  // push dengan benar, tapi jalur responsenya jadi tidak pernah diuji.
  window.ProfileKit.ownerKeyFor = () => 'test-owner-key';
  window.ProfileKit.pushOcrReadings = async (slug, readings) => {
    pushed.push(readings);
    return { ok: true, applied: Object.keys(readings), rejected: [] };
  };
  window.navigator.mediaDevices = undefined;
  window.addEventListener('error', (event) => errors.push(event.message));
  window.console.error = (...args) => errors.push(args.join(' '));
  window.eval(appSource);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { window, document: window.document, errors, sockets, pushed };
}

section('Panel: baris dan ringkasan');
{
  const { document, errors, sockets } = await boot();
  check('boot tanpa error', errors.length === 0, errors.join(' | '));
  const rows = document.getElementById('verify-rows').children;
  check('satu baris per field', rows.length === 11, String(rows.length));
  check('baris pertama = Timer', rows[0].dataset.field === 'timer', rows[0].dataset.field);
  check('input ada di setiap baris', [...rows].every((row) => Boolean(row.querySelector('input'))));
  check('ringkasan awal 0/11', document.getElementById('summary-filled').textContent === '0 / 11', document.getElementById('summary-filled').textContent);
  check('adapter manual terdaftar di UI', document.getElementById('verify-provider').textContent.includes('manual'), document.getElementById('verify-provider').textContent);

  sockets[0].onMessage({
    type: 'snapshot',
    payload: {
      match: { timer: 1325, blueKills: 18, redKills: 15, blueGold: 42300, redGold: 38900 },
      ocr: { modes: { blueKills: 'lock', lordBlue: 'manual' } },
      result: { visible: false },
    },
  });
  check('snapshot tanpa error', errors.length === 0, errors.join(' | '));
  check('timer terisi dari snapshot', [...rows].find((row) => row.dataset.field === 'timer').querySelector('input').value === '1325', [...rows].find((row) => row.dataset.field === 'timer').querySelector('input').value);

  const lockedRow = [...rows].find((row) => row.dataset.field === 'blueKills');
  check('field lock ditandai di baris', lockedRow.dataset.locked === 'true', lockedRow.dataset.locked);
  check('nama sumber lock', lockedRow.querySelector('.verify-row-source').textContent === 'lock', lockedRow.querySelector('.verify-row-source').textContent);
  check('field lock tidak ditimpa dari snapshot', lockedRow.querySelector('input').value === '', lockedRow.querySelector('input').value);

  const manualMode = [...rows].find((row) => row.dataset.field === 'lordBlue');
  check('mode manual diperlakukan seperti lock', manualMode.dataset.locked === 'true', manualMode.dataset.locked);
  check('overlay terlihat报告显示 gameplay', document.getElementById('summary-visible').textContent === 'gameplay', document.getElementById('summary-visible').textContent);
}

section('Panel: jalankan adapter dan diff');
{
  const { document, window, errors } = await boot();
  const before = document.getElementById('capture-status').textContent;
  document.getElementById('capture-run').dispatchEvent(new window.Event('click'));
  await new Promise((resolve) => setTimeout(resolve, 10));
  check('jalankan tanpa gambar ditolak', /Belum ada gambar/.test(document.getElementById('capture-status').textContent), document.getElementById('capture-status').textContent);
  check('pesan awal bukan error', before === '', before);
  check('tidak ada exception', errors.length === 0, errors.join(' | '));
}

section('Panel: push ke stream');
{
  const { document, window, pushed, errors } = await boot();
  // Isi beberapa nilai final lewat input, seperti yang dilakukan operator.
  const setField = (field, value) => {
    const row = [...document.getElementById('verify-rows').children].find((entry) => entry.dataset.field === field);
    const input = row.querySelector('input');
    input.value = String(value);
    input.dispatchEvent(new window.Event('input'));
  };
  setField('timer', 900);
  setField('blueKills', 4);

  check('ringkasan menghitung field terisi', document.getElementById('summary-filled').textContent.startsWith('2 '), document.getElementById('summary-filled').textContent);

  document.getElementById('push-button').dispatchEvent(new window.Event('click'));
  await new Promise((resolve) => setTimeout(resolve, 10));
  check('push memanggil endpoint readings', pushed.length === 1, String(pushed.length));
  check('hanya field terisi yang dipush', Object.keys(pushed[0] || {}).length === 2, Object.keys(pushed[0] || {}).join(','));
  check('nilai dipush berupa angka', pushed[0]?.timer?.value === 900, String(pushed[0]?.timer?.value));
  check('field kosong tidak ikut dipush', !('redKills' in (pushed[0] || {})), Object.keys(pushed[0] || {}).join(','));
  check('status push dilaporkan', /2 field diterapkan/.test(document.getElementById('push-status').textContent), document.getElementById('push-status').textContent);
  check('tidak ada exception saat push', errors.length === 0, errors.join(' | '));

  // Reset hanya mengosongkan tabel lokal, tidak boleh menyentuh server.
  document.getElementById('reset-button').dispatchEvent(new window.Event('click'));
  check('reset mengosongkan tabel', document.getElementById('summary-filled').textContent === '0 / 11', document.getElementById('summary-filled').textContent);
  check('reset tidak memanggil push', pushed.length === 1, String(pushed.length));
  check('status reset menjelaskan dampaknya', /tidak berubah sampai/.test(document.getElementById('push-status').textContent), document.getElementById('push-status').textContent);
}

section('OcrParse: parsing bacaan mentah');
{
  // Logika ini sama persis dengan yang dipakai halaman debug sebelum dipindah ke shared.
  // Kalau salah di sini, angka yang salah tayang di stream.
  check('timer 22:05 jadi detik', OcrParse.parseRecognizedValue('timer', '22:05') === 1325, String(OcrParse.parseRecognizedValue('timer', '22:05')));
  check('timer dengan spasi', OcrParse.parseRecognizedValue('timer', '04 : 30') === 270, String(OcrParse.parseRecognizedValue('timer', '04 : 30')));
  check('timer pakai titik sebagai pemisah', OcrParse.parseRecognizedValue('timer', '09.45') === 585, String(OcrParse.parseRecognizedValue('timer', '09.45')));
  check('timer di atas 60 menit tidak pecah', OcrParse.parseRecognizedValue('timer', '61:00') === 3660, String(OcrParse.parseRecognizedValue('timer', '61:00')));
  check('timer garbage jadi null', OcrParse.parseRecognizedValue('timer', 'menang') === null, String(OcrParse.parseRecognizedValue('timer', 'menang')));

  check('kill polos', OcrParse.parseRecognizedValue('blueKills', '18') === 18, String(OcrParse.parseRecognizedValue('blueKills', '18')));
  check('OCR O jadi 0', OcrParse.parseRecognizedValue('blueKills', 'l8') === 18, String(OcrParse.parseRecognizedValue('blueKills', 'l8')));
  check('OCR l dan I jadi 1', OcrParse.parseRecognizedValue('redKills', '1l') === 11, String(OcrParse.parseRecognizedValue('redKills', '1l')));
  check('pemisah ribuan dibuang untuk kill', OcrParse.parseRecognizedValue('blueKills', '1,024') === 1024, String(OcrParse.parseRecognizedValue('blueKills', '1,024')));
  check('teks kosong jadi null', OcrParse.parseRecognizedValue('blueKills', '   ') === null, String(OcrParse.parseRecognizedValue('blueKills', '   ')));
  check('tanpa angka jadi null', OcrParse.parseRecognizedValue('blueKills', 'lead') === null, String(OcrParse.parseRecognizedValue('blueKills', 'lead')));
  check('label HUD jadi null, bukan angka 1', OcrParse.parseRecognizedValue('blueKills', 'Lead') === null, String(OcrParse.parseRecognizedValue('blueKills', 'Lead')));
  check('kata dengan angka di dalamnya ditolak', OcrParse.parseRecognizedValue('blueKills', 'round1') === null, String(OcrParse.parseRecognizedValue('blueKills', 'round1')));
  check('angka dengan keterangan kata tetap diterima', OcrParse.parseRecognizedValue('blueKills', '18 kills') === 18, String(OcrParse.parseRecognizedValue('blueKills', '18 kills')));

  check('gold 42.3K jadi 42300', OcrParse.parseRecognizedValue('blueGold', '42.3K') === 42300, String(OcrParse.parseRecognizedValue('blueGold', '42.3K')));
  check('gold dengan k kecil', OcrParse.parseRecognizedValue('blueGold', '12.4k') === 12400, String(OcrParse.parseRecognizedValue('blueGold', '12.4k')));
  check('gold tanpa K jadi angka biasa', OcrParse.parseRecognizedValue('blueGold', '42300') === 42300, String(OcrParse.parseRecognizedValue('blueGold', '42300')));
  check('gold berlabel K tidak jadi 423 (harus 42300)', OcrParse.parseRecognizedValue('redGold', '423K') === 423000, String(OcrParse.parseRecognizedValue('redGold', '423K')));
  check('objective tidak dikali 1000 walau ada K', OcrParse.parseRecognizedValue('turtleBlue', '3K') === 3, String(OcrParse.parseRecognizedValue('turtleBlue', '3K')));
  check('undefined aman', OcrParse.parseRecognizedValue('blueKills', undefined) === null, String(OcrParse.parseRecognizedValue('blueKills', undefined)));
}

console.log(`\n${'='.repeat(52)}`);
console.log(`verify panel: ${passed} ok, ${failed} gagal`);
if (failures.length) {
  console.log('\nGagal:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
process.exit(failed ? 1 : 0);