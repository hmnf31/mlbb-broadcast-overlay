// Regression test aturan timer.
//
// Aturan operator: SATU filter saja, yaitu confidence di bawah 50% ditolak. Selebihnya
// langsung dipakai, termasuk angka yang lebih besar dari hitungan lokal. Ini dibalik dari
// versi lama yang menolak bacaan "mundur" dan bacaan "jatuh jauh" -- dua aturan itu yang
// membuat timer diam di layar.
//
// Skenario yang dikunci di sini adalah yang dilaporkan operator:
//
//   01:18 | 96% | nilai: 0:54 -> bacaan 01:18 | 96% | nilai: 0:54
//   bacaan lebih besar dari waktu berjalan, ditolak supaya angka tidak mundur
//
// Hitungan lokal tertinggal 24 detik, jadi bacaan yang benar justru ditolak. Sekarang
// bacaan itu dipakai apa adanya dan layar ikut ke 01:18.
//
// Menjalankan frontend/shared/ocr-timer.js apa adanya, tanpa browser.
import '../frontend/shared/ocr-timer.js';

const { createTracker, MIN_CONFIDENCE, MAX_SECONDS } = globalThis.OcrTimer;

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
// Menit ikut dipad ke dua digit, karena angka yang dibandingkan operator selalu `mm:ss`.
const mm = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

section('Satu-satunya filter: confidence');
{
  const tracker = createTracker();

  // 49% ditolak, walau angkanya masuk akal.
  const low = tracker.observe(80, T0, 49);
  check('confidence 49% ditolak', low.action === 'ignore', low.action);
  check('alasannya confidence', low.reason === 'low_confidence', low.reason);
  check('ambang ikut dilaporkan', low.minConfidence === MIN_CONFIDENCE, String(low.minConfidence));
  check('belum ada anchor setelah ditolak', tracker.current(T0) === null, String(tracker.current(T0)));

  // 50% tepat di ambang: dipakai.
  const edge = tracker.observe(80, T0, 50);
  check('confidence 50% diterima', edge.action === 'anchor', `${edge.action}/${edge.reason}`);
  check('anchor 80', edge.value === 80, String(edge.value));
  check('tampil 01:20', mm(edge.current) === '01:20', mm(edge.current));

  // 96% seperti bacaan di laporan operator: dipakai.
  const high = tracker.observe(78, T0 + 1000, 96);
  check('confidence 96% dipakai apa adanya', high.action === 'resync' && high.value === 78, `${high.action}/${high.reason}`);

  // Confidence yang tidak dilaporkan tidak boleh jadi alasan menolak.
  const noScore = createTracker();
  const plain = noScore.observe(80, T0);
  check('tanpa confidence tetap dipakai', plain.action === 'anchor', plain.action);
  check('confidence null dilaporkan null', noScore.observe(70, T0 + 1000, null).confidence === null);

  // 0% itu bacaan sampah, harus tetap tertahan.
  const zero = createTracker();
  const none = zero.observe(80, T0, 0);
  check('confidence 0% ditolak', none.reason === 'low_confidence', none.reason);
  check('tidak ada anchor setelah 0%', zero.current(T0) === null, String(zero.current(T0)));
}

section('Bacaan lebih besar dari waktu lokal DITERIMA (laporan operator)');
{
  // Situasi persis di laporan: anchor lama 00:54, bacaan baru 01:18 dengan confidence 96%.
  // Versi lama menolak ini dan layar tetap beku di 0:54.
  const tracker = createTracker();
  tracker.observe(54, T0, 100);
  const at = T0 + 24_000;
  check('sebelum bacaan baru layar 00:30', mm(tracker.current(at)) === '00:30', mm(tracker.current(at)));

  const reading = tracker.observe(78, at, 96);
  check('bacaan 01:18 diterima', reading.action === 'resync', `${reading.action}/${reading.reason}`);
  check('anchor pindah ke 78', tracker.state().seconds === 78, String(tracker.state().seconds));
  check('layar jadi 01:18', mm(reading.current) === '01:18', mm(reading.current));
  check('selisihnya dicatat', reading.drift === 48, String(reading.drift));

  // Dan timer tetap jalan sesudahnya.
  check('satu detik kemudian 01:17', mm(tracker.current(at + 1000)) === '01:17', mm(tracker.current(at + 1000)));
  check('sepuluh detik kemudian 01:08', mm(tracker.current(at + 10_000)) === '01:08', mm(tracker.current(at + 10_000)));
}

section('Bacaan turun juga diterima, tidak ada lagi aturan "jangan mundur"');
{
  const tracker = createTracker();
  tracker.observe(600, T0);

  // Naik satu detik saja: dulu ditolak sebagai 'backward'.
  const up = tracker.observe(596, T0 + 5_000);
  check('bacaan di atas waktu lokal diterima', up.action === 'resync', `${up.action}/${up.reason}`);
  check('anchor 596', tracker.state().seconds === 596, String(tracker.state().seconds));

  // Turun jauh, dulu ditolak sebagai 'misread_lag'. Sekarang diterima, karena ditolak
  // berarti layar diam dan itu yang dikeluhkan operator.
  const down = tracker.observe(540, T0 + 6_000, 96);
  check('bacaan jauh di bawah diterima', down.action === 'resync', down.action);
  check('anchor 540', tracker.state().seconds === 540, String(tracker.state().seconds));
  check('layar ikut ke 09:00', mm(down.current) === '09:00', mm(down.current));

  // Salah baca digit menit pun dipakai, dan bacaan berikutnya yang membetulkannya.
  const misread = tracker.observe(26, T0 + 7_000, 96);
  check('salah baca digit menit tidak lagi ditolak', misread.action === 'resync', misread.action);
  check('salah baca 00:26 dipakai', mm(misread.current) === '00:26', mm(misread.current));

  const fixed = tracker.observe(53, T0 + 8_000, 96);
  check('bacaan benar berikutnya membetulkan', mm(fixed.current) === '00:53', mm(fixed.current));
}

section('Tidak pernah berhenti, berapa pun noise-nya');
{
  // 120 poll. Semua bacaan dipakai apa adanya, jadi angka di layar selalu bergerak: tidak
  // ada keadaan beku yang merupakan keluhan utama operator. Yang dicek di sini justru
  // kebalikannya -- tidak boleh ada siklus yang tidak menghasilkan gerakan sama sekali.
  const tracker = createTracker();
  tracker.observe(900, T0);
  let stalls = 0;
  let maxGap = 0;
  let previous = tracker.current(T0);

  for (let i = 1; i <= 120; i += 1) {
    const at = T0 + i * 1000;
    const truth = 900 - i;
    // Tiga dari lima bacaan benar, sisanya salah baca digit menit (turun satu menit).
    const read = i % 5 === 0 ? truth - 60 : truth;
    tracker.observe(read, at, 96);
    const shown = tracker.current(at);
    if (shown === previous && shown > 0) stalls += 1;
    maxGap = Math.max(maxGap, previous - shown);
    previous = shown;
  }

  check('tidak pernah macet', stalls === 0, String(stalls));
  // i = 120 adalah salah-baca (120 % 5 === 0), jadi layar ikut ke angka yang salah baca itu.
  // Itulah konsekuensi yang disengaja: angka bergerak dan salah baca hanya bertahan satu siklus.
  check('nilai akhir sama dengan bacaan terakhir', tracker.current(T0 + 120_000) === 720, String(tracker.current(T0 + 120_000)));
  // Satu siklus turun 1 detik kalau benar, jadi lonjakan 61 = 1 detik normal + 60 salah baca.
  check('salah baca hanya bertahan satu siklus', maxGap === 61, String(maxGap));
}

section('Confidence rendah tidak boleh menghentikan timer');
{
  // Skenario terburuk yang bisa terjadi: separuh bacaan confidence-nya rendah. Angka tetap
  // jalan karena anchor terakhir yang sedang dihitung, dan begitu confidence naik lagi layar
  // langsung ikut bacaan itu.
  const tracker = createTracker();
  tracker.observe(600, T0, 96);
  let accepted = 0;
  let rejected = 0;

  for (let i = 1; i <= 60; i += 1) {
    const at = T0 + i * 1000;
    const truth = 600 - i;
    const score = i % 2 === 0 ? 20 : 96;
    const outcome = tracker.observe(truth, at, score);
    if (outcome.action === 'ignore') rejected += 1; else accepted += 1;
  }

  check('bacaan confidence rendah ditolak', rejected === 30, String(rejected));
  check('bacaan confidence tinggi diterima', accepted === 30, String(accepted));
  // 30 detik terakhir ditolak, jadi hitungan lokal tetap berjalan dari anchor terakhir
  // yang diterima (i = 59 -> 541 detik), dikurangi 1 detik lagi.
  check('timer tetap berjalan', tracker.current(T0 + 60_000) === 540, String(tracker.current(T0 + 60_000)));
}

section('Bacaan tidak terbaca dan di luar rentang');
{
  const tracker = createTracker();
  tracker.observe(600, T0, 96);
  for (const bad of [NaN, null, undefined, 'bukan angka']) {
    const unread = tracker.observe(bad, T0 + 2_000, 96);
    check(`bacaan ${JSON.stringify(bad) ?? String(bad)} ditolak`, unread.action === 'ignore' && unread.reason === 'unreadable', unread.reason);
  }
  check('anchor tidak berubah', tracker.state().anchorAt === T0, String(tracker.state().anchorAt));
  check('nilai tetap jalan', tracker.current(T0 + 2_000) === 598, String(tracker.current(T0 + 2_000)));

  const over = tracker.observe(MAX_SECONDS + 1, T0 + 3_000, 96);
  check('di atas 3600 ditolak', over.reason === 'out_of_range', over.reason);
  check('nilai tetap 3600 atau kurang', tracker.state().seconds === 600, String(tracker.state().seconds));
}

section('Nilai dibekukan di nol');
{
  const tracker = createTracker();
  tracker.observe(3, T0, 96);
  check('tidak pernah negatif', tracker.current(T0 + 30_000) === 0, String(tracker.current(T0 + 30_000)));
  check('sebelum satu detik masih 3', tracker.current(T0 + 999) === 3, String(tracker.current(T0 + 999)));
  check('bacaan 0 setelah habis valid', tracker.observe(0, T0 + 30_000, 96).action === 'resync');
}

section('reset: dipakai saat operator menekan Start untuk match baru');
{
  const tracker = createTracker();
  tracker.observe(120, T0, 96);
  tracker.reset();
  check('setelah reset belum ada anchor', tracker.current(T0) === null, String(tracker.current(T0)));
  check('anchor kosong', tracker.state().seconds === null && tracker.state().anchorAt === null);

  const second = tracker.observe(900, T0 + 3_600_000, 96);
  check('bacaan match kedua jadi anchor baru', second.action === 'anchor', second.action);
  check('anchor 900', second.value === 900, String(second.value));
  check('timer match kedua jalan lagi', tracker.current(T0 + 3_601_000) === 899, String(tracker.current(T0 + 3_601_000)));
}

section('Konstanta sesuai spesifikasi');
{
  check('ambang confidence 50', MIN_CONFIDENCE === 50, String(MIN_CONFIDENCE));
  check('batas atas 3600 detik', MAX_SECONDS === 3600, String(MAX_SECONDS));
  check('lima alasan yang tersisa',
    Object.keys(globalThis.OcrTimer.REASON_TEXT).sort().join(',')
      === 'anchor,low_confidence,out_of_range,resync,unreadable',
    Object.keys(globalThis.OcrTimer.REASON_TEXT).sort().join(','));
  check('aturan temporal lama sudah hilang', !('LAG_TOLERANCE_SECONDS' in globalThis.OcrTimer));
}

console.log(`\n${passed} ok, ${failed} gagal`);
if (failed) {
  console.error('\nGagal:\n- ' + failures.join('\n- '));
  process.exit(1);
}
