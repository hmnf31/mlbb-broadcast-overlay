// Regression test aturan timer.
//
// Requirement operator, dan hanya itu: timer di-anchor dari bacaan OCR pertama yang valid lalu
// berjalan terus, tidak pernah mundur, dan TIDAK punya filter lain. Setiap bacaan yang tidak
// lebih besar dari waktu berjalan diterima apa adanya.
//
// Test ini mengunci aturan itu karena ketiganya adalah bug yang pernah nyata: timer diam di
// layar (anchor tertahan verifikasi), timer melompat (pause salah baca), dan — yang paling
// merusak — timer macet permanen karena bacaan yang benar ditolak sebagai "salah baca".
//
// Menjalankan frontend/shared/ocr-timer.js apa adanya, tanpa browser.
import '../frontend/shared/ocr-timer.js';

const { createTracker, MAX_SECONDS } = globalThis.OcrTimer;

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

const T0 = 1_700_000_000_000;

section('Bacaan pertama langsung jadi anchor, tanpa verifikasi');
{
  // Ini inti keluhan operator: dulu timer menunggu grace 10 detik sebelum bergerak, jadi di
  // layar terlihat diam padahal bacaan pertamanya sudah benar.
  const tracker = createTracker();
  check('sebelum bacaan pertama belum ada nilai', tracker.current(T0) === null, String(tracker.current(T0)));

  const first = tracker.observe(600, T0);
  check('bacaan pertama langsung jadi anchor', first.action === 'anchor', first.action);
  check('langsung tidak ditahan verifikasi', first.value === 600, String(first.value));
  check('sudah dianchor', first.anchored === true);
  check('nilai saat itu 600', first.current === 600, String(first.current));

  // Tidak ada jeda: detik berikutnya sudah turun.
  check('satu detik kemudian sudah 599', tracker.current(T0 + 1000) === 599, String(tracker.current(T0 + 1000)));
  check('sepuluh detik kemudian sudah 590', tracker.current(T0 + 10_000) === 590, String(tracker.current(T0 + 10_000)));
}

section('Timer berjalan terus: tidak ada pause sama sekali');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  check('setelah 5 detik nilai 595', tracker.current(T0 + 5_000) === 595, String(tracker.current(T0 + 5_000)));
  check('setelah 65 detik nilai 535', tracker.current(T0 + 65_000) === 535, String(tracker.current(T0 + 65_000)));
  // Tidak ada observe() sama sekali, dan angkanya tetap turun sendiri. Inilah yang menghapus
  // kebutuhan push satu envelope per detik.
  check('tanpa observe: 10 menit tetap dihitung', tracker.current(T0 + 600_000) === 0, String(tracker.current(T0 + 600_000)));

  // Bakean: bagaimana pun it's state, tracker tidak punya konsep beku.
  const frozen = tracker.state();
  check('state tidak punya flag running', !('running' in frozen), Object.keys(frozen).join(','));
  check('state hanya menyimpan anchor', Object.keys(frozen).sort().join(',') === 'anchorAt,current,seconds', Object.keys(frozen).sort().join(','));
}

section('Tidak pernah mundur');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  // Lokal sudah 595, OCR salah baca jadi 18:30 (1110 detik).
  const backward = tracker.observe(1110, T0 + 5_000);
  check('bacaan lebih besar ditolak', backward.action === 'ignore', backward.action);
  check('alasannya mundur', backward.reason === 'backward', backward.reason);
  check('angka tidak berubah', backward.current === 595, String(backward.current));
  check('satu detik saja lebih besar ditolak', tracker.observe(596, T0 + 6_000).reason === 'backward');

  // Bacaan lebih kecil dari nilai berjalan harus tetap diterima.
  check('bacaan tepat sama diterima', tracker.observe(594, T0 + 6_000).action === 'accepted');
  check('bacaan lebih kecil diterima', tracker.observe(593, T0 + 7_000).action === 'accepted');
  check('nilai tetap turun sendiri', tracker.current(T0 + 7_000) === 593, String(tracker.current(T0 + 7_000)));
}

section('Bacaan jatuh jauh tetap diterima -- ini yang pernah macet');
{
  // Bug yang dilaporkan operator: "02:04 | 96%" dibaca benar, tapi tidak pernah masuk, karena
  // satu bacaan salah besar di awal tertangkap sebagai anchor dan setiap bacaan berikutnya
  // ditolak sebagai "jatuh terlalu jauh". Semuanya yang salah ada di filter ini: begitu
  // operator sudah yakin bacaannya benar, filter tidak berhak menolak.
  const tracker = createTracker();
  tracker.observe(735, T0);
  check('nilai berjalan 730', tracker.current(T0 + 5_000) === 730, String(tracker.current(T0 + 5_000)));

  const corrected = tracker.observe(124, T0 + 5_000);
  check('jatuh jauh diterima', corrected.action === 'accepted', corrected.action);
  check('anchor langsung pindah ke 124', tracker.state().seconds === 124, String(tracker.state().seconds));
  check('hitung mundur lanjut dari 124', tracker.current(T0 + 6_000) === 123, String(tracker.current(T0 + 6_000)));
  check('selisihnya tercatat', corrected.drift === 606, String(corrected.drift));

  // Bahkan lompatan besar ke bawah setelah anchor benar harus diterima, karena tidak ada
  // ambang yang boleh menahan angka yang operator sudah pastikan benar.
  const again = tracker.observe(2, T0 + 6_000);
  check('lompatan besar ke bawah tetap diterima', again.action === 'accepted', again.action);
  check('anchor 2', tracker.state().seconds === 2, String(tracker.state().seconds));

  // Yang tetap ditolak hanya yang naik, karena itu akan membuat angka lompat ke belakang.
  check('naik setelah turun tetap ditolak', tracker.observe(3, T0 + 6_000).reason === 'backward');
}

section('Tidak ada ambang koreksi atau batas drop');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  // Selisih satu detik pun harus langsung digeser ke bacaan operator, tanpa ambang.
  const tiny = tracker.observe(570, T0 + 30_000);
  check('selisih 30 detik langsung digeser', tracker.state().seconds === 570, String(tracker.state().seconds));
  check('tidak ada flag shifted', !('shifted' in tiny), Object.keys(tiny).join(','));
  check('reason tetap accepted', tiny.reason === 'accepted', tiny.reason);
  check('MAX_DROP_SECONDS tidak lagi diekspor', globalThis.OcrTimer.MAX_DROP_SECONDS === undefined);
  check('CORRECT_DRIFT_SECONDS tidak lagi diekspor', globalThis.OcrTimer.CORRECT_DRIFT_SECONDS === undefined);
}

section('Bacaan tidak terbaca dan di luar rentang');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  for (const bad of [NaN, null, undefined, 'bukan angka']) {
    const unread = tracker.observe(bad, T0 + 2_000);
    check(`bacaan ${JSON.stringify(bad) ?? String(bad)} ditolak`, unread.action === 'ignore' && unread.reason === 'unreadable', unread.reason);
  }
  check('anchor tidak berubah', tracker.state().anchorAt === T0, String(tracker.state().anchorAt));
  check('nilai tetap jalan', tracker.current(T0 + 2_000) === 598, String(tracker.current(T0 + 2_000)));

  const over = tracker.observe(MAX_SECONDS + 1, T0 + 3_000);
  check('di atas 3600 ditolak', over.reason === 'out_of_range', over.reason);
  check('nilai tetap 3600 atau kurang', tracker.state().seconds === 600, String(tracker.state().seconds));
}

section('Nilai dibekukan di nol');
{
  const tracker = createTracker();
  tracker.observe(3, T0);
  check('tidak pernah negatif', tracker.current(T0 + 30_000) === 0, String(tracker.current(T0 + 30_000)));
  check('sebelum satu detik masih 3', tracker.current(T0 + 999) === 3, String(tracker.current(T0 + 999)));
  check('bacaan 0 setelah habis valid', tracker.observe(0, T0 + 30_000).action === 'accepted');
}

section('reset: dipakai saat operator menekan Start untuk match baru');
{
  const tracker = createTracker();
  tracker.observe(120, T0);
  tracker.reset();
  check('setelah reset belum ada anchor', tracker.current(T0) === null, String(tracker.current(T0)));
  check('anchor kosong', tracker.state().seconds === null && tracker.state().anchorAt === null);

  // Ini yang bikin match kedua bisa jalan: anchor lama sudah sisa match pertama, jadi tanpa
  // reset semua bacaan match kedua akan dianggap mundur.
  const second = tracker.observe(900, T0 + 3_600_000);
  check('bacaan match kedua langsung jadi anchor', second.action === 'anchor', second.action);
  check('anchor 900 diterima', second.value === 900, String(second.value));
  check('timer match kedua jalan lagi', tracker.current(T0 + 3_601_000) === 899, String(tracker.current(T0 + 3_601_000)));
}

section('Konstanta sesuai spesifikasi');
{
  check('batas atas 3600 detik', MAX_SECONDS === 3600, String(MAX_SECONDS));
  check('hanya empat alasan yang tersisa',
    Object.keys(globalThis.OcrTimer.REASON_TEXT).sort().join(',') === 'accepted,anchor,backward,out_of_range,unreadable',
    Object.keys(globalThis.OcrTimer.REASON_TEXT).sort().join(','));
}

console.log(`\n${passed} ok, ${failed} gagal`);
if (failed) {
  console.error('\nGagal:\n- ' + failures.join('\n- '));
  process.exit(1);
}