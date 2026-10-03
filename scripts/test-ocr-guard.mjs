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
  const guard = freshGuard();
  guard.decide('blueGold', reading(18_000));
  const step = guard.decide('blueGold', reading(19_000, { at: 1_020_000 }));
  check('kenaikan gold wajar diterima', step.accepted);
  const wild = guard.decide('blueGold', reading(27_000, { at: 1_060_000 }));
  check('gold melonjak ditolak', !wild.accepted, wild.reason);
  check('bacaan "awal 10" ditolak karena turun', !guard.decide('blueGold', reading(10, { at: 1_061_000 })).accepted);
}

section('Timer');
{
  const guard = freshGuard();
  guard.decide('timer', reading(600));
  check('timer naik 1 detik diterima', guard.decide('timer', reading(601, { at: 1_002_000 })).accepted);
  check('timer drop 3 detik ditolak', !guard.decide('timer', reading(598, { at: 1_004_000 })).accepted);
  check('timer di atas 3600 ditolak', !guard.decide('timer', reading(7200, { at: 1_100_000 })).accepted);
}

section('Objective: turtle/lord/tower');
{
  const guard = freshGuard();
  guard.decide('turtleBlue', reading(1));
  check('turtle naik 1 diterima', guard.decide('turtleBlue', reading(2, { at: 1_010_000 })).accepted);
  check('turtle lompat 9 ditolak', !guard.decide('turtleBlue', reading(11, { at: 1_030_000 })).accepted);
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

section('Majority vote untuk field yang prone berkedip');
{
  const guard = createGuard({ majorityFields: ['towerBlue'] });
  guard.decide('towerBlue', reading(1));
  const first = guard.decide('towerBlue', reading(2, { at: 1_001_000 }));
  check('nilai baru menunggu majority', !first.accepted && first.reason === 'majority', first.reason);
  const noisy = guard.decide('towerBlue', reading(9, { at: 1_002_000 }));
  check('bacaan lain ikut masuk sampel', !noisy.accepted);
  const decided = guard.decide('towerBlue', reading(2, { at: 1_003_000 }));
  check('2 dari 3 bacaan sama diterima', decided.accepted && guard.values().towerBlue === 2);
  check('nilai yang ditolak tidak mengubah anchor', guard.values().towerBlue === 2);
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