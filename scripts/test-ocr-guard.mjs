// Fase 4 regression test: aturan validasi OCR harus mencegah angka berkedip di overlay,
// bukan sekadar membaca ROI. Menjalankan frontend/shared/ocr-guard.js apa adanya.
import '../frontend/shared/ocr-guard.js';

const { createGuard } = globalThis.OcrGuard;

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

const freshGuard = (options = {}) => createGuard({ majorityFields: [], ...options });
const reading = (value, extra = {}) => ({ value, rawText: String(value), confidence: 95, at: 1_000_000, ...extra });

section('Kill: monoton dan batas lonjakan');
{
  const guard = freshGuard();
  check('bacaan pertama diterima', guard.decide('blueKills', reading(9)).accepted);
  check('kill naik 1 diterima', guard.decide('blueKills', reading(10, { at: 1_003_000 })).accepted);
  const jump = guard.decide('blueKills', reading(15, { at: 1_006_000 }));
  check('kill naik 6 ditolak (max 5)', !jump.accepted, jump.reason);
  check('alasan penolakan tercatat', jump.reason === 'confirm', jump.reason);
  check('nilai yang ditolak tidak menimpa nilai tampil', guard.values().blueKills === 10, String(guard.values().blueKills));
  const confirmed = guard.decide('blueKills', reading(15, { at: 1_007_000 }));
  check('bacaan kedua yang sama mengonfirmasi lonjakan', confirmed.accepted && guard.values().blueKills === 15);
  const drop = guard.decide('blueKills', reading(14, { at: 1_010_000 }));
  check('kill turun sedikit ditolak', !drop.accepted && drop.reason === 'dropped', drop.reason);
  const bigDrop = guard.decide('blueKills', reading(2, { at: 1_011_000 }));
  check('kill turun drastis ditahan sampai 3x konfirmasi (game baru)', !bigDrop.accepted && bigDrop.reason === 'confirm', bigDrop.reason);
  check('nilai turun tidak pernah menimpa nilai tampil', guard.values().blueKills === 15, String(guard.values().blueKills));
}

section('Kill: multi-kill cepat butuh dua bacaan');
{
  const guard = freshGuard();
  guard.decide('redKills', reading(4));
  const first = guard.decide('redKills', reading(11, { at: 1_004_000 }));
  check('lonjakan besar ditahan dulu', !first.accepted);
  const second = guard.decide('redKills', reading(11, { at: 1_005_000 }));
  check('dua bacaan identik baru diterima', second.accepted && guard.values().redKills === 11);
}

section('Gold: monoton dengan batas per detik');
{
  // Gold: hanya dua filter, sesuai permintaan operator -- tidak boleh turun, dan tidak boleh
  // meloncat dari puluhan ribu ke ratusan ribu dalam sekali poll.
  const guard = freshGuard();
  guard.decide('blueGold', reading(18_000));
  check('kenaikan gold wajar diterima', guard.decide('blueGold', reading(19_000, { at: 1_020_000 })).accepted);
  const wild = guard.decide('blueGold', reading(180_000, { at: 1_060_000 }));
  check('gold melonjak ke ratusan ribu ditolak', !wild.accepted, wild.reason);
  check('alasannya lonjakan', wild.reason === 'jump', wild.reason);
  check('nilai ditolak tidak menimpa nilai tampil', guard.values().blueGold === 19_000, String(guard.values().blueGold));
  const down = guard.decide('blueGold', reading(10, { at: 1_061_000 }));
  check('gold turun ditolak', !down.accepted && down.reason === 'dropped', down.reason);
  check('nilai turun tidak mengubah nilai tampil', guard.values().blueGold === 19_000, String(guard.values().blueGold));

  // Lonjakan moderate masih boleh: di antara dua poll bisa saja banyak terjadi karena
  // objective turret, jadi filter tidak boleh membekukan gold.
  check('lonjakan moderate diterima', guard.decide('blueGold', reading(24_000, { at: 1_062_000 })).accepted);

  // Fase awal: dari 0 langsung ke ribuan itu wajar dan harus diterima.
  const early = freshGuard();
  early.decide('blueGold', reading(0));
  check('gold fase awal 0 ke 2.500 diterima', early.decide('blueGold', reading(2_500, { at: 1_001_000 })).accepted);
}

section('Timer: guard hanya menjaga bentuk dan rentang');
{
  // Timer MLBB hitung MUNDUR. Guard lama memakai aturan monoton yang menganggap penurunan
  // sebagai salah baca, jadi setiap bacaan countdown yang valid ditolak sebagai 'dropped'.
  // Karena itu keputusan temporal timer pindah ke OcrTimer (scripts/test-ocr-timer.mjs) dan
  // guard hanya menyisakan pemeriksaan yang tidak bergantung waktu.
  const guard = freshGuard();
  check('bacaan pertama diterima', guard.decide('timer', reading(600)).accepted);
  check('hitung mundur 2 detik diterima', guard.decide('timer', reading(598, { at: 1_002_000 })).accepted);
  check('hitung mundur jauh juga diterima guard', guard.decide('timer', reading(120, { at: 1_004_000 })).accepted);
  // Guard tidak boleh menyimpan nilai timer: OcrTimer yang memegang anchor, jadi dua tempat
  // tidak mungkin menyimpan angka yang berbeda.
  check('guard tidak menyimpan nilai timer', guard.values().timer === undefined, String(guard.values().timer));

  // Batas yang memang masih milik guard:
  const range = freshGuard();
  check('di atas 3600 ditolak', !range.decide('timer', reading(7200)).accepted);
  check('alasan penolakan adalah rentang', range.decide('timer', reading(7200)).reason === 'range');
  check('nilai ditolak tidak menimpa nilai tampil', range.values().timer === undefined, String(range.values().timer));
  check('nilai negatif ditolak', !range.decide('timer', reading(-5)).accepted);
  check('pecahan ditolak', !range.decide('timer', reading(10.5)).accepted);
  check('confidence rendah ditolak', !range.decide('timer', reading(300, { confidence: 10 })).accepted);
  check('nilai 0 itu sah dan diterima', range.decide('timer', reading(0)).accepted);
}

section('Objective (Lord/Tower): tanpa filter temporal');
{
  // Lord/Tower naik sangat-sangat jarang (0 ke 1 ke 2), jadi majortitas vote lama justru
  // menahan angka yang sebenarnya sudah benar. Sekarang bacaan langsung dipakai begitu masuk.
  const guard = freshGuard();
  guard.decide('towerBlue', reading(1));
  check('kenaikan 1 ke 2 langsung diterima', guard.decide('towerBlue', reading(2, { at: 1_001_000 })).accepted);
  check('nilai 2 tersimpan', guard.values().towerBlue === 2, String(guard.values().towerBlue));
  check('bacaan lain tidak menghambat', guard.decide('towerBlue', reading(3, { at: 1_002_000 })).accepted);
  check('nilai 3 tersimpan', guard.values().towerBlue === 3, String(guard.values().towerBlue));
  // Menurun juga bukan salah baca untuk operator: dia yang mengaturnya manual.
  check('penurunan diterima', guard.decide('towerBlue', reading(2, { at: 1_003_000 })).accepted);
  check('nilai turun tersimpan', guard.values().towerBlue === 2, String(guard.values().towerBlue));
  // Yang ditolak hanya angka yang di luar akal.
  check('nilai 99 ditolak', !guard.decide('towerBlue', reading(99, { at: 1_004_000 })).accepted);
  check('nilai ditolak tidak menimpa', guard.values().towerBlue === 2, String(guard.values().towerBlue));

  // Majortitas vote tidak lagi berlaku untuk objective walau diaktifkan di options.
  const withMajority = createGuard({ majorityFields: ['lordBlue'] });
  withMajority.decide('lordBlue', reading(1));
  check('majortitas tidak menahan objective', withMajority.decide('lordBlue', reading(2, { at: 1_001_000 })).accepted);
  withMajority.decide('lordBlue', reading(4, { at: 1_002_000 }));
  check('majortitas juga tidak menahan lompatan', withMajority.decide('lordBlue', reading(7, { at: 1_003_000 })).accepted);
}

section('Objective: turtle/lord/tower');
{
  const guard = freshGuard();
  guard.decide('turtleBlue', reading(1));
  check('turtle naik 1 diterima', guard.decide('turtleBlue', reading(2, { at: 1_010_000 })).accepted);
  // Naik/turun sesuka hati: operator yang mengatur, dan peneliannya memang jarang.
  check('turtle naik lagi diterima', guard.decide('turtleBlue', reading(3, { at: 1_020_000 })).accepted);
  check('turtle turun juga diterima', guard.decide('turtleBlue', reading(1, { at: 1_030_000 })).accepted);
  check('nilai terbaru dipakai', guard.values().turtleBlue === 1, String(guard.values().turtleBlue));
  // Yang ditolak cuma sampah.
  check('nilai 99 ditolak', !guard.decide('turtleBlue', reading(99, { at: 1_040_000 })).accepted);
  check('sampah tidak menimpa nilai', guard.values().turtleBlue === 1, String(guard.values().turtleBlue));
  check('nilai negatif ditolak', !guard.decide('lordRed', reading(-1)).accepted);
}

section('Confidence');
{
  const guard = createGuard({ majorityFields: [], thresholds: { blueKills: 70 } });
  const low = guard.decide('blueKills', reading(5, { confidence: 40 }));
  check('confidence di bawah ambang ditolak', !low.accepted && low.reason === 'confidence', low.reason);
  const high = guard.decide('blueKills', reading(5, { confidence: 91 }));
  check('confidence di atas ambang diterima', high.accepted);
  const perField = createGuard({ majorityFields: [], thresholds: { blueGold: 95 } });
  check('ambang per field dipakai', !perField.decide('blueGold', reading(1000, { confidence: 80 })).accepted);
}

// Semua field sudah punya filter sendiri sekarang, jadi majority vote tidak lagi dipakai untuk
// field mana pun. Bagian ini sengaja dibiarkan sebagai penjaga: kalau suatu saat ada field baru
// yang diaktifkan di majorityFields, test ini harus gagal supaya keputusan itu disengaja.
section('Majority vote tidak lagi dipakai field mana pun');
{
  const guard = createGuard({ majorityFields: ['towerBlue'] });
  guard.decide('towerBlue', reading(1));
  const second = guard.decide('towerBlue', reading(2, { at: 1_001_000 }));
  check('objective langsung diterima walau majorityFields aktif', second.accepted, second.reason);
  const noisy = guard.decide('towerBlue', reading(9, { at: 1_002_000 }));
  check('bacaan lain juga langsung diterima', noisy.accepted, noisy.reason);
  check('nilai terbaru langsung dipakai', guard.values().towerBlue === 9, String(guard.values().towerBlue));
}

section('Auto re-anchor untuk game baru');
{
  let reanchored = 0;
  const guard = createGuard({ majorityFields: [], onReanchor: () => { reanchored += 1; } });
  guard.decide('blueKills', reading(18));
  const dip = (value, at) => guard.decide('blueKills', reading(value, { at }));
  const a = dip(1, 1_100_000);
  const b = dip(1, 1_101_000);
  const c = dip(1, 1_102_000);
  check('tiga bacaan stabil di bawah 70% anchor = game baru', c.accepted && c.reanchored === true, JSON.stringify([a.reason, b.reason, c.reason]));
  check('callback re-anchor terpanggil sekali', reanchored === 1, String(reanchored));
  check('semua anchor direset ke nilai baru', guard.values().blueKills === 1);
  check('anchor lama tidak lagi menahan nilai', guard.decide('blueKills', reading(2, { at: 1_103_000 })).accepted);
}

section('Anchor bisa di-reset manual dan diteruskan');
{
  const guard = freshGuard();
  guard.decide('blueKills', reading(30));
  const exported = guard.anchor();
  const restored = freshGuard({ anchor: exported });
  check('anchor diteruskan ke guard baru', restored.values().blueKills === 30);
  check('nilai turun tetap ditolak setelah anchor diteruskan',
    !restored.decide('blueKills', reading(2, { at: 1_200_000 })).accepted);
  guard.reset();
  check('reset manual mengosongkan anchor', guard.values().blueKills === undefined);
  check('setelah reset, nilai kecil langsung diterima', guard.decide('blueKills', reading(2)).accepted);
}

section('Bacaan rusak');
{
  const guard = freshGuard();
  check('null ditolak', !guard.decide('blueKills', reading(null)).accepted);
  check('NaN ditolak', !guard.decide('blueKills', reading(Number.NaN)).accepted);
  check('field tak dikenal ditolak', !guard.decide('entah', reading(3)).accepted);
  check('angka desimal ditolak untuk field integer', !guard.decide('blueKills', reading(3.5)).accepted);
}

section('Diagnostik');
{
  const guard = freshGuard();
  guard.decide('blueKills', reading(9));
  guard.decide('blueKills', reading(99, { at: 1_002_000 }));
  const decision = guard.decisionFor('blueKills');
  check('keputusan terakhir tersimpan', decision.value === 9, JSON.stringify(decision));
  check('alasan dalam bahasa manusia', typeof decision.reasonText === 'string' && decision.reasonText.length > 0);
  check('jumlah penolakan terhitung', guard.rejectedCount('blueKills') === 1, String(guard.rejectedCount('blueKills')));
  check('confidence ikut tersimpan untuk diagnosa', decision.confidence === 95, String(decision.confidence));
}

console.log(`\n========================================`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const item of failures) console.log(`  - ${item}`);
}
console.log(`========================================`);
process.exit(failed === 0 ? 0 : 1);