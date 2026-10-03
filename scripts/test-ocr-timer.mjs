// Regression test aturan timer.
//
// Timer MLBB berjalan tiap detik, jadi membacanya berulang dengan OCR tidak akan pernah
// stabil. Test ini mengunci perilaku yang membuat angka timer tidak berkedip: satu bacaan
// pertama jadi anchor, sisanya berjalan lokal, dan bacaan berikutnya hanya dipakai kalau
// simpangan bertahan lama.
//
// Menjalankan frontend/shared/ocr-timer.js apa adanya, tanpa browser.
import '../frontend/shared/ocr-timer.js';

const { createTracker, TOLERANCE_SECONDS, PAUSE_GRACE_MS, RESYNC_SECONDS } = globalThis.OcrTimer;

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

section('Anchor: bacaan pertama');
{
  const tracker = createTracker();
  const first = tracker.observe(600, T0);
  check('bacaan pertama menjadi anchor', first.action === 'anchor', first.action);
  check('anchor bernilai 600', first.value === 600, String(first.value));
  check('anchor langsung berjalan', first.running === true);
  check('nilai saat anchor sama dengan 600', first.current === 600, String(first.current));
  check('tracker kosong sebelum bacaan pertama', createTracker().current(T0) === null);
}

section('Berjalan lokal: tidak ada drift dan tidak perlu kiriman per detik');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  check('setelah 5 detik nilai 595', tracker.current(T0 + 5_000) === 595, String(tracker.current(T0 + 5_000)));
  check('setelah 65 detik nilai 535', tracker.current(T0 + 65_000) === 535, String(tracker.current(T0 + 65_000)));
  // inilah intinya: tidak ada observe() sama sekali, dan angkanya tetap turun sendiri.
  check('tidak ada observe: 120 detik tetap dihitung', tracker.current(T0 + 120_000) === 480, String(tracker.current(T0 + 120_000)));
  check('tidak ada push per detik', tracker.state().anchorAt === T0, String(tracker.state().anchorAt));
}

section('Toleransi: simpangan kecil tidak menggeser anchor');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  // 2 detik kemudian OCR membaca 598; lokal juga sudah 598, jadi simpangan nol.
  const aligned = tracker.observe(598, T0 + 2_000);
  check('bacaan yang sama dengan nilai lokal diselaraskan', aligned.action === 'resync', aligned.action);
  check('simpangan nol tidak memicu kiriman', aligned.worthSending === false, String(aligned.worthSending));
  check('nilai tetap 598', aligned.current === 598, String(aligned.current));

  // Bacaan 1 detik lebih rendah masih di dalam toleransi 3 detik.
  const small = tracker.observe(596, T0 + 4_000);
  check('simpangan kecil tidak menggeser anchor', tracker.state().anchorAt === T0, String(tracker.state().anchorAt));
  check('simpangan kecil tidak memicu kiriman', small.worthSending === false, String(small.worthSending));
  // Angka lokal tetap dihitung dari anchor, bukan dari bacaan yang kurang tepat.
  check('nilai lokal tetap 596', tracker.current(T0 + 4_000) === 596, String(tracker.current(T0 + 4_000)));
}

section('Salah baca sesaat: ditolak, tidak sampai ke overlay');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  // 40 detik kemudian lokal sudah 560, OCR salah baca 595 (selisih 35 detik).
  const misread = tracker.observe(595, T0 + 40_000);
  check('salah baca besar ditolak', misread.action === 'ignore', misread.action);
  check('alasannya menunggu konfirmasi', misread.reason === 'pending', misread.reason);
  check('tidak layak dikirim', misread.worthSending === false);
  check('angka lokal tetap tidak berubah', misread.current === 560, String(misread.current));
}

section('Grace 10 detik: pause baru diakui setelah simpangan bertahan');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  // Game di-pause saat timer menunjukkan 570, yaitu pada detik ke-30.
  // Lokal masih menghitung mundur, jadi simpangan baru tumbuh sesudah beberapa detik.
  const pausedAt = T0 + 30_000;
  check('bacaan saat pause masih dalam toleransi', tracker.observe(570, pausedAt).reason === 'resync');
  // Empat detik kemudian simpangan sudah 4 detik: baru di luar toleransi 3 detik.
  const driftStart = pausedAt + 4_000;
  const pending = tracker.observe(570, driftStart);
  check('simpangan pertama dicatat', pending.reason === 'pending', pending.reason);
  check('pending tidak mengubah nilai tampil', pending.current === 566, String(pending.current));
  // Selama masih dalam grace, semua bacaan tetap ditahan.
  const within = tracker.observe(570, driftStart + PAUSE_GRACE_MS - 1_000);
  check('masih dalam grace: ditahan', within.action === 'ignore', within.action);
  check('tidak layak dikirim selama grace', within.worthSending === false);
  // Setelah grace terlampaui, pause diakui.
  const after = tracker.observe(570, driftStart + PAUSE_GRACE_MS);
  check('setelah grace: pause diakui', after.action === 'pause', after.action);
  check('timer ditandai berhenti', after.running === false);
  check('nilai dianchor ke bacaan pause', after.value === 570, String(after.value));
  check('pause selalu layak dikirim', after.worthSending === true);
}

section('Anchor lokal tidak bergeser karena noise OCR');
{
  // Inilah yang membuat angka timer tidak berkedip: bacaan yang menyimpang 1-3 detik
  // (masih di dalam toleransi) tidak boleh memindahkan anchor.
  const tracker = createTracker();
  tracker.observe(600, T0);
  // Lokal 595 pada detik ke-5; OCR membaca 594 (noise 1 detik).
  tracker.observe(594, T0 + 5_000);
  check('anchor tetap di detik nol', tracker.state().anchorAt === T0, String(tracker.state().anchorAt));
  check('anchor nilai tetap 600', tracker.state().seconds === 600, String(tracker.state().seconds));
  // Noise dua detik ke arah lain juga tidak boleh menggeser anchor.
  tracker.observe(593, T0 + 7_000);
  check('anchor tetap setelah noise berikutnya', tracker.state().anchorAt === T0, String(tracker.state().anchorAt));
  check('keputusan resync tidak perlu kirim ke server', tracker.state().anchorAt === T0);
  // Lokal tetap berubah hanya karena waktu, bukan karena bacaan.
  check('nilai lokal tetap hitung mundur mulus', tracker.current(T0 + 10_000) === 590, String(tracker.current(T0 + 10_000)));
}

section('Tidak ada push per detik ke server');
{
  // 60 detik game berjalan normal dengan OCR membaca tiap 2 detik: tidak boleh ada anchor
  // baru sama sekali, jadi tidak ada satu pun kiriman per detik.
  const tracker = createTracker();
  tracker.observe(600, T0);
  let pushes = 1; // anchor awal
  for (let i = 1; i <= 30; i += 1) {
    const at = T0 + i * 2_000;
    const outcome = tracker.observe(600 - i * 2, at);
    if (outcome.worthSending) pushes += 1;
  }
  check('tidak ada kiriman tambahan selama 60 detik', pushes === 1, String(pushes));
  check('anchor masih yang pertama', tracker.state().anchorAt === T0, String(tracker.state().anchorAt));
  check('nilai akhir 540', tracker.current(T0 + 60_000) === 540, String(tracker.current(T0 + 60_000)));
}

section('Pause ditahan: nilai tidak terus turun');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  const pausedAt = T0 + 30_000;
  tracker.observe(570, pausedAt);
  const driftStart = pausedAt + 4_000;
  tracker.observe(570, driftStart);
  const frozenAt = driftStart + PAUSE_GRACE_MS;
  tracker.observe(570, frozenAt);
  check('nilai tetap 570 setelah 5 detik pause', tracker.current(frozenAt + 5_000) === 570, String(tracker.current(frozenAt + 5_000)));
  check('nilai tetap 570 setelah 60 detik pause', tracker.current(frozenAt + 60_000) === 570, String(tracker.current(frozenAt + 60_000)));
}

section('Resume: game berjalan lagi setelah pause');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  const pausedAt = T0 + 30_000;
  tracker.observe(570, pausedAt);
  const driftStart = pausedAt + 4_000;
  tracker.observe(570, driftStart);
  const frozenAt = driftStart + PAUSE_GRACE_MS;
  tracker.observe(570, frozenAt);
  // Dilanjutkan 20 detik kemudian: timer 570 -> 550. Karena besar lompatannya (20 detik),
  // resume tidak bisa langsung diasumsikan dari satu bacaan: satu poll OCR yang panjang bisa
  // saja membuat lompatan palsu. Bacaan kedua yang sama-sama turun mengonfirmasi.
  const firstRead = tracker.observe(550, frozenAt + 20_000);
  check('satu bacaan turun besar belum cukup', firstRead.action === 'ignore', firstRead.action);
  check('timer masih beku', firstRead.running === false);
  check('nilai masih 570', firstRead.current === 570, String(firstRead.current));
  // Poll berikutnya tetap turun: game benar-benar berjalan.
  const secondRead = tracker.observe(548, frozenAt + 22_000);
  check('resume dikenali', secondRead.action === 'resume', secondRead.action);
  check('timer kembali berjalan', secondRead.running === true);
  check('resume selalu layak dikirim', secondRead.worthSending === true);
  check('nilai dianchor ke bacaan kedua', tracker.state().anchorAt === frozenAt + 22_000, String(tracker.state().anchorAt));
  check('nilai turun lagi ke 546', tracker.current(frozenAt + 24_000) === 546, String(tracker.current(frozenAt + 24_000)));
}

section('Resume cepat: turun normal langsung diterima tanpa konfirmasi');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  const pausedAt = T0 + 30_000;
  tracker.observe(570, pausedAt);
  const driftStart = pausedAt + 4_000;
  tracker.observe(570, driftStart);
  const frozenAt = driftStart + PAUSE_GRACE_MS;
  tracker.observe(570, frozenAt);
// Lanjutan dua detik kemudian: 570 -> 568, persis dalam toleransi. Ini resume yang jelas,
  // menunggu konfirmasi hanya menambah jeda tanpa menambah keamanan.
  const resumed = tracker.observe(568, frozenAt + 2_000);
  check('resume langsung dikenali', resumed.action === 'resume', resumed.action);
  check('timer berjalan lagi', resumed.running === true);
  check('anchor pindah ke 568', tracker.state().anchorAt === frozenAt + 2_000, String(tracker.state().anchorAt));
  check('lima detik kemudian nilai 563', tracker.current(frozenAt + 7_000) === 563, String(tracker.current(frozenAt + 7_000)));
}

section('Bacaan saat pause masih dibaca sebagai pause, bukan resume');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  const pausedAt = T0 + 30_000;
  tracker.observe(570, pausedAt);
  const driftStart = pausedAt + 4_000;
  tracker.observe(570, driftStart);
  const frozenAt = driftStart + PAUSE_GRACE_MS;
  tracker.observe(570, frozenAt);
  // Timer masih berhenti, jadi OCR terus membaca 570. Ini PASTE.
  const still = tracker.observe(570, frozenAt + 3_000);
  check('bacaan sama saat pause = masih pause', still.reason === 'paused', still.reason);
  check('tidak ada anchor baru', still.worthSending === false);
  check('timer tetap beku', still.running === false);
  check('nilai tetap 570 setelah 20 detik', tracker.current(frozenAt + 20_000) === 570, String(tracker.current(frozenAt + 20_000)));
}

section('Koreksi berkepanjangan: OCR konsisten lebih rendah');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  const t = T0 + 30_000;
  // Lokal masih 570, tapi OCR sudah lama menyebut 540 (misalnya ada timer tersembunyi).
  tracker.observe(540, t);
  const corrected = tracker.observe(540, t + PAUSE_GRACE_MS);
  check('simpangan lama dikoreksi', corrected.action === 'correct', corrected.action);
  check('koreksi tidak mematikan timer', corrected.running === true);
  check('anchor pindah ke 540', corrected.value === 540, String(corrected.value));
  check('nilai berjalan lagi dari 540', tracker.current(t + PAUSE_GRACE_MS + 5_000) === 535, String(tracker.current(t + PAUSE_GRACE_MS + 5_000)));
}

section('Bacaan tidak terbaca: ditolak tanpa merusak state');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  const unread = tracker.observe(NaN, T0 + 2_000);
  check('bacaan NaN ditolak', unread.action === 'ignore', unread.action);
  check('alasannya tidak terbaca', unread.reason === 'unreadable', unread.reason);
  check('anchor tidak berubah', tracker.state().anchorAt === T0, String(tracker.state().anchorAt));
  check('nilai tetap jalan', tracker.current(T0 + 2_000) === 598, String(tracker.current(T0 + 2_000)));
}

section('Nilai tidak turun di bawah nol');
{
  const tracker = createTracker();
  tracker.observe(3, T0);
  check('tidak pernah negatif', tracker.current(T0 + 30_000) === 0, String(tracker.current(T0 + 30_000)));
  check('anchor 0 tidak freezes timer', tracker.current(T0 + 999) === 3, String(tracker.current(T0 + 999)));
}

section('Arah simpangan menentukan keputusan');
{
  // OCR LEBIH BESAR dari hitungan lokal => kita terlalu cepat => game berhenti => pause.
  const ahead = createTracker();
  ahead.observe(600, T0);
  // Lokal sudah 590, bacaan tetap 600: simpangan 10 detik, jadi baru masuk pending.
  check('simpangan besar pertama masuk pending', ahead.observe(600, T0 + 10_000).reason === 'pending');
  const aheadResult = ahead.observe(600, T0 + 10_000 + PAUSE_GRACE_MS);
  check('bacaan lebih besar = pause', aheadResult.action === 'pause', aheadResult.action);
  check('pause mematikan timer', aheadResult.running === false);
  check('anchor berhenti di 600', aheadResult.value === 600, String(aheadResult.value));

  // OCR LEBIH KECIL dari hitungan lokal => hitungan kita meleset => koreksi, timer tetap jalan.
  const behind = createTracker();
  behind.observe(600, T0);
  check('simpangan turun masuk pending', behind.observe(540, T0 + 10_000).reason === 'pending');
  const behindResult = behind.observe(540, T0 + 10_000 + PAUSE_GRACE_MS);
  check('bacaan lebih kecil = koreksi', behindResult.action === 'correct', behindResult.action);
  check('koreksi tidak mematikan timer', behindResult.running === true);
  check('anchor pindah ke 540', behindResult.value === 540, String(behindResult.value));
}

section('Salah baca saat pause tidak menghidupkan timer');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  const pausedAt = T0 + 30_000;
  tracker.observe(570, pausedAt);
  const driftStart = pausedAt + 4_000;
  tracker.observe(570, driftStart);
  const frozenAt = driftStart + PAUSE_GRACE_MS;
  tracker.observe(570, frozenAt);
  // Salah baca: satu angka melompat turun jauh, lalu kembali ke 570.
  const misread = tracker.observe(400, frozenAt + 2_000);
  check('salah baca turun besar ditahan', misread.action === 'ignore', misread.action);
  check('angka salah baca tidak sampai ke tampilan', misread.current === 570, String(misread.current));
  check('anchor tidak ikut bergeser', tracker.state().seconds === 570, String(tracker.state().seconds));
  const back = tracker.observe(570, frozenAt + 4_000);
  check('kembali ke nilai pause menahan resume', back.running === false, String(back.running));
  check('alasannya masih pause', back.reason === 'paused', back.reason);
  check('nilai tetap beku di 570', tracker.current(frozenAt + 4_000) === 570, String(tracker.current(frozenAt + 4_000)));
  // Salah baca tidak menyisakan konfirmasi tertinggal: bacaan turun normal berikutnya
  // langsung paham sebagai resume, karena memang itu keadaan sebenarnya.
  const after = tracker.observe(568, frozenAt + 6_000);
  check('resume setelah salah baca langsung dikenali', after.action === 'resume', after.action);
  check('nilai kembali ke hitungan normal', tracker.current(frozenAt + 8_000) === 566, String(tracker.current(frozenAt + 8_000)));
}

section('Arah simpangan berbalik membatalkan pending');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  const t = T0 + 40_000;
  // Lokal 560, OCR 590 (terlalu besar) -> pending ke arah "ahead".
  tracker.observe(590, t);
  // Dua detik kemudian arahnya berbalik (OCR 520, terlalu kecil). Pending lama harus hilang,
  // supaya tidak langsung dihitung sebagai simpangan yang sudah bertahan lama.
  const flipped = tracker.observe(520, t + 2_000);
  check('pending dihitung ulang dari nol', flipped.reason === 'pending', flipped.reason);
  const stillPending = tracker.observe(520, t + 4_000);
  check('durasi dihitung dari belokan, bukan dari bacaan pertama', stillPending.reason === 'pending', stillPending.reason);
}

section('reset');
{
  const tracker = createTracker();
  tracker.observe(600, T0);
  tracker.reset();
  check('setelah reset nilai kosong', tracker.current(T0) === null, String(tracker.current(T0)));
  check('setelah reset bukan running', tracker.state().running === false);
  const reanchored = tracker.observe(120, T0 + 60_000);
  check('bacaan setelah reset jadi anchor baru', reanchored.action === 'anchor', reanchored.action);
  check('anchor baru bernilai 120', reanchored.value === 120, String(reanchored.value));
}

section('Konstanta default sesuai spesifikasi');
{
  check('toleransi 3 detik', TOLERANCE_SECONDS === 3, String(TOLERANCE_SECONDS));
  check('grace pause 10 detik', PAUSE_GRACE_MS === 10_000, String(PAUSE_GRACE_MS));
  check('resync 2 detik', RESYNC_SECONDS === 2, String(RESYNC_SECONDS));
}

console.log(`\n${passed} ok, ${failed} gagal`);
if (failed) {
  console.error('\nGagal:\n- ' + failures.join('\n- '));
  process.exit(1);
}