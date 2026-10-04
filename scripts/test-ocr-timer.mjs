// Regression test aturan timer.
//
// Aturan operator: HANYA bacaan pertama yang jadi anchor. Sesudah itu angka berjalan sendiri,
// tidak pernah mundur, dan tidak pernah berhenti. Pembacaan berikutnya hanya boleh me-reset
// anchor kalau angkanya nyaris sama dengan hitungan lokal.
//
// Skenario yang dikunci di sini adalah yang dilaporkan operator:
//
//   anchor 01:20 -> bacaan 0123 (titik dua hilang) harus dibaca 01:23
//   01:25 -> 00:26 harus berarti 01:26, bukan 26 detik, dan tidak boleh mundur
//   setelah bacaan ditolak, timer harus tetap berjalan
//
// Menjalankan frontend/shared/ocr-timer.js apa adanya, tanpa browser.
import '../frontend/shared/ocr-timer.js';

const { createTracker, LAG_TOLERANCE_SECONDS, MAX_SECONDS } = globalThis.OcrTimer;

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

section('Hanya bacaan pertama yang jadi anchor');
{
  const tracker = createTracker();
  check('sebelum bacaan pertama belum ada nilai', tracker.current(T0) === null, String(tracker.current(T0)));

  // 01:20 = 80 detik, bacaan pertama operator.
  const first = tracker.observe(80, T0);
  check('bacaan pertama jadi anchor', first.action === 'anchor', first.action);
  check('anchor 80', first.value === 80, String(first.value));
  check('tampil sebagai 01:20', mm(first.current) === '01:20', mm(first.current));

  check('satu detik kemudian 01:19', mm(tracker.current(T0 + 1000)) === '01:19', mm(tracker.current(T0 + 1000)));
  check('sepuluh detik kemudian 01:10', mm(tracker.current(T0 + 10_000)) === '01:10', mm(tracker.current(T0 + 10_000)));
}

section('Bacaan kedua hanya me-reset anchor, tidak jadi anchor baru');
{
  const tracker = createTracker();
  tracker.observe(80, T0);
  // Lima detik kemudian 01:15 = 75. Selisih 0 dari hitungan lokal (80 - 5).
  const resync = tracker.observe(75, T0 + 5_000);
  check('bacaan yang cocok jadi resync', resync.action === 'resync', resync.action);
  check('bukan anchor baru', resync.reason === 'resync', resync.reason);
  check('anchor pindah ke 75', tracker.state().seconds === 75, String(tracker.state().seconds));
  check('anchorAt ikut maju', tracker.state().anchorAt === T0 + 5_000, String(tracker.state().anchorAt));

  // Bacaan ketiga: harus tetap resync, tidak pernah kembali jadi anchor.
  const third = tracker.observe(70, T0 + 10_000);
  check('tetap resync', third.action === 'resync', third.action);
  check('anchor 70', tracker.state().seconds === 70, String(tracker.state().seconds));
}

section('Skenario operator: 01:25 lalu 00:26 tidak boleh mundur');
{
  // 01:25 = 85 detik.
  const tracker = createTracker();
  tracker.observe(85, T0);
  check('anchor 01:25', mm(tracker.current(T0)) === '01:25', mm(tracker.current(T0)));

  // OCR salah baca digit menit jadi 0. Angka itu 26, bukan 00:26 yang benar.
  const misread = tracker.observe(26, T0 + 1_000);
  check('bacaan 00:26 ditolak', misread.action === 'ignore', misread.action);
  check('alasannya salah baca digit', misread.reason === 'misread_lag', misread.reason);
  check('anchor tetap 85', tracker.state().seconds === 85, String(tracker.state().seconds));
  check('tampil 01:24, bukan 00:26', mm(tracker.current(T0 + 1_000)) === '01:24', mm(tracker.current(T0 + 1_000)));
  // Dan yang paling penting: penolakan ini tidak menghentikan timer.
  check('timer tetap jalan setelah ditolak', mm(tracker.current(T0 + 6_000)) === '01:19', mm(tracker.current(T0 + 6_000)));
  check('timer jalan 1 menit kemudian', mm(tracker.current(T0 + 60_000)) === '00:25', mm(tracker.current(T0 + 60_000)));
}

section('Bacaan lebih besar ditolak supaya angka tidak pernah naik');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  const backward = tracker.observe(1110, T0 + 5_000);
  check('bacaan lebih besar ditolak', backward.action === 'ignore', backward.action);
  check('alasannya mundur', backward.reason === 'backward', backward.reason);
  check('angka tidak berubah', backward.current === 595, String(backward.current));
  check('satu detik saja lebih besar ditolak', tracker.observe(596, T0 + 6_000).reason === 'backward');

  // Quiz yang diberi operator: timer benar-benar 01:20 lalu terbaca 01:23. Angka itu lebih
  // besar dari hitungan lokal (yang sudah 01:19), jadi ditolak -- dan timer tetap jalan.
  const fresh = createTracker();
  fresh.observe(80, T0);
  const ahead = fresh.observe(83, T0 + 1_000);
  check('bacaan 01:23 saat lokal 01:19 ditolak', ahead.reason === 'backward', ahead.reason);
  check('tetap 01:19', mm(fresh.current(T0 + 1_000)) === '01:19', mm(fresh.current(T0 + 1_000)));
  check('tidak berhenti', mm(fresh.current(T0 + 4_000)) === '01:16', mm(fresh.current(T0 + 4_000)));
}

section('Toleransi tumbuh seiring waktu, jadi gap panjang tidak otomatis salah baca');
{
  // Tab di belakang atau beberapa scan gagal akan meninggalkan gap besar. Kalau toleransinya
  // tetap, anchor pertama akan terkunci dan semua bacaan berikutnya ditolak -- itu penyebab
  // timer macet yang pernah dilaporkan.
  const tracker = createTracker();
  tracker.observe(600, T0);
  const at = T0 + 90_000;
  check('nilai berjalan 510', tracker.current(at) === 510, String(tracker.current(at)));

  const far = tracker.observe(505, at);
  check('bacaan 505 diterima setelah gap 90 detik', far.action === 'resync', `${far.action}/${far.reason}`);
  check('limit sesuai gap', far.lagLimit === LAG_TOLERANCE_SECONDS + 90, String(far.lagLimit));
  check('anchor 505', tracker.state().seconds === 505, String(tracker.state().seconds));

  // Gap pendek tetap ketat: bacaan 60 detik di bawah harus ditolak.
  const quick = createTracker();
  quick.observe(600, T0);
  const tooFar = quick.observe(540, T0 + 5_000);
  check('selisih jauh pada gap pendek ditolak', tooFar.reason === 'misread_lag', tooFar.reason);
  check('limit pada gap pendek', tooFar.lagLimit === LAG_TOLERANCE_SECONDS + 5, String(tooFar.lagLimit));
}

section('Tidak pernah berhenti, berapa pun noise-nya');
{
  // 120 poll dengan bacaan yang bergantian antara benar dan salah baca digit. Angka di layar
  // tidak boleh naik sekali pun, dan tidak boleh berhenti lebih dari satu siklus.
  const tracker = createTracker();
  tracker.observe(900, T0);
  let rises = 0;
  let stalls = 0;
  let previous = tracker.current(T0);

  for (let i = 1; i <= 120; i += 1) {
    const at = T0 + i * 1000;
    const truth = 900 - i;
    // Tiga dari lima bacaan benar, sisanya salah baca digit menit (turun satu menit).
    const read = i % 5 === 0 ? truth - 60 : truth;
    tracker.observe(read, at);
    const shown = tracker.current(at);
    if (shown > previous) rises += 1;
    if (shown === previous && shown > 0) stalls += 1;
    previous = shown;
  }

  check('angka tidak pernah naik', rises === 0, String(rises));
  check('tidak pernah macet', stalls === 0, String(stalls));
  check('nilai akhir 780', tracker.current(T0 + 120_000) === 780, String(tracker.current(T0 + 120_000)));
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
  check('bacaan 0 setelah habis valid', tracker.observe(0, T0 + 30_000).action === 'resync');
}

section('reset: dipakai saat operator menekan Start untuk match baru');
{
  const tracker = createTracker();
  tracker.observe(120, T0);
  tracker.reset();
  check('setelah reset belum ada anchor', tracker.current(T0) === null, String(tracker.current(T0)));
  check('anchor kosong', tracker.state().seconds === null && tracker.state().anchorAt === null);

  // Ini yang bikin match kedua bisa jalan: anchor lama masih memegang sisa match pertama,
  // jadi tanpa reset semua bacaan match kedua akan dianggap mundur.
  const second = tracker.observe(900, T0 + 3_600_000);
  check('bacaan match kedua jadi anchor baru', second.action === 'anchor', second.action);
  check('anchor 900', second.value === 900, String(second.value));
  check('timer match kedua jalan lagi', tracker.current(T0 + 3_601_000) === 899, String(tracker.current(T0 + 3_601_000)));
}

section('Konstanta sesuai spesifikasi');
{
  check('toleransi dasar 10 detik', LAG_TOLERANCE_SECONDS === 10, String(LAG_TOLERANCE_SECONDS));
  check('batas atas 3600 detik', MAX_SECONDS === 3600, String(MAX_SECONDS));
  check('enam alasan yang tersisa',
    Object.keys(globalThis.OcrTimer.REASON_TEXT).sort().join(',')
      === 'anchor,backward,misread_lag,out_of_range,resync,unreadable',
    Object.keys(globalThis.OcrTimer.REASON_TEXT).sort().join(','));
}

console.log(`\n${passed} ok, ${failed} gagal`);
if (failed) {
  console.error('\nGagal:\n- ' + failures.join('\n- '));
  process.exit(1);
}