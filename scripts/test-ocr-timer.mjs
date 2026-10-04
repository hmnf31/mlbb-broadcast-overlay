// Regression test aturan timer.
//
// Requirement operator, dan hanya itu: timer di-anchor dari bacaan OCR pertama yang valid lalu
// berjalan terus. Tidak ada verifikasi yang menahan angka, tidak ada logika pause, dan waktu
// tidak boleh mundur.
//
// Test ini mengunci ketiga hal itu sekaligus, karena ketiganya adalah bug yang pernah nyata:
// timer diam di layar (anchor tertahan verifikasi), timer melompat (pause salah baca), dan
// timer maju-mundur (angka tidak pernah turun).
//
// Menjalankan frontend/shared/ocr-timer.js apa adanya, tanpa browser.
import '../frontend/shared/ocr-timer.js';

const { createTracker, MAX_DROP_SECONDS, CORRECT_DRIFT_SECONDS, MAX_SECONDS } = globalThis.OcrTimer;

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

section('Bacaan jatuh jauh ditolak sebagai salah baca');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  // Lokal 595, tapi OCR salah baca "10:30" jadi "1:30".
  const misread = tracker.observe(90, T0 + 5_000);
  check('jatuh jauh ditolak', misread.action === 'ignore', misread.action);
  check('alasannya salah baca', misread.reason === 'misread_drop', misread.reason);
  check('angka tidak berubah', misread.current === 595, String(misread.current));
  check('limit yang dipakai tercatat', misread.dropLimit === MAX_DROP_SECONDS + 5, String(misread.dropLimit));

  // Selisih sebesar ini masih mungkin: timer memang berjalan.
  const plausible = tracker.observe(594, T0 + 6_000);
  check('selisih 1 detik diterima', plausible.action === 'accepted', plausible.action);
}

section('Batas bawah yang bergerak mengikuti waktu');
{
  // Drop limit harus nambah seiring waktu, kalau tidak setiap bacaan yang sah akan mulai
  // ditolak sekitar menit ke-1: nilai berjalan sudah 540 tapi anchor masih 600.
  const tracker = createTracker();
  tracker.observe(600, T0);
  const at = T0 + 90_000;
  check('nilai berjalan 90 detik = 510', tracker.current(at) === 510, String(tracker.current(at)));
  const read = tracker.observe(505, at);
  check('bacaan 505 pada menit ke-1,5 diterima', read.action === 'accepted', `${read.action}/${read.reason}`);
  check('limit mengikuti waktu', read.dropLimit === undefined || read.dropLimit > MAX_DROP_SECONDS);
}

section('Noise kecil tidak menggeser angka di layar');
{
  // Kalau anchor digeser ke setiap bacaan, digit terakhir timer akan maju-mundur tiap poll.
  // Yang diuji bukan variabel internal anchor, tapi angka yang benar-benar dilihat penonton:
  // harus selalu turun, dan tidak boleh pernah naik satu detik pun.
  const tracker = createTracker();
  tracker.observe(900, T0);
  let rises = 0;
  let wobble = 0;
  let previous = 900;
  for (let i = 1; i <= 60; i += 1) {
    const noise = [0, 1, -1, 0, 1][i % 5];
    tracker.observe(900 - i * 2 + noise, T0 + i * 2_000);
    const shown = tracker.current(T0 + i * 2_000);
    if (shown > previous) rises += 1;
    // Selisih lebih dari 1 detik dari laju ideal (2 detik per poll) berarti anchor bergeser.
    const ideal = 900 - i * 2;
    if (Math.abs(shown - ideal) > 1) wobble += 1;
    previous = shown;
  }
  check('angka tidak pernah naik', rises === 0, String(rises));
  check('angka tidak pernah melenceng > 1 detik', wobble === 0, String(wobble));
  check('nilai akhir tepat 780', tracker.current(T0 + 120_000) === 780, String(tracker.current(T0 + 120_000)));
}

section('Koreksi sungguhan tetap dibolehkan');
{
  // Poll yang terlewat atau timer sempat tidak terbaca bikin selisih jauh. Itu koreksi yang
  // memang perlu, dan hanya di sini anchor digeser.
  const tracker = createTracker();
  tracker.observe(600, T0);
  const at = T0 + 30_000;
  check('nilai berjalan 570', tracker.current(at) === 570, String(tracker.current(at)));
  const corrected = tracker.observe(540, at);
  check('selisih jauh dikoreksi', corrected.action === 'corrected', corrected.action);
  check('anchor digeser', corrected.shifted === true);
  check('anchor pindah ke 540', tracker.state().seconds === 540, String(tracker.state().seconds));
  check('hitung mundur lanjut dari 540', tracker.current(at + 5_000) === 535, String(tracker.current(at + 5_000)));

  // Selisih di bawah ambang koreksi tidak boleh menggeser anchor.
  const small = createTracker();
  small.observe(600, T0);
  const at2 = T0 + 30_000;
  const tiny = small.observe(567, at2);
  check('selisih kecil tidak menggeser anchor', tiny.shifted === false, String(tiny.shifted));
  check('anchor tetap 600', small.state().seconds === 600, String(small.state().seconds));
  check('ambang koreksi 10 detik dipakai', CORRECT_DRIFT_SECONDS === 10, String(CORRECT_DRIFT_SECONDS));
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
  check('batas drop 60 detik', MAX_DROP_SECONDS === 60, String(MAX_DROP_SECONDS));
  check('ambang koreksi 10 detik', CORRECT_DRIFT_SECONDS === 10, String(CORRECT_DRIFT_SECONDS));
  check('batas atas 3600 detik', MAX_SECONDS === 3600, String(MAX_SECONDS));
}

console.log(`\n${passed} ok, ${failed} gagal`);
if (failed) {
  console.error('\nGagal:\n- ' + failures.join('\n- '));
  process.exit(1);
}
