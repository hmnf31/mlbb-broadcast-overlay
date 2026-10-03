// Fase 1 regression test: matriks draft harus menghasilkan analitik yang masuk akal dan
// tahan terhadap input rusak. Menjalankan frontend/shared/draft-analytics.js apa adanya,
// persis seperti test-ocr-guard.mjs, supaya yang diuji adalah kode yang benar-benar dipakai
// overlay dan control.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import '../frontend/shared/draft-analytics.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const matrix = JSON.parse(await readFile(path.join(projectRoot, 'assets', 'hero-matrix.json'), 'utf8'));
const { DraftAnalytics } = globalThis;

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

const draft = (blue = [], red = [], extra = {}) => ({
  visible: true,
  round: 1,
  activeSide: 'blue',
  blue: { picks: blue, bans: [] },
  red: { picks: red, bans: [] },
  ...extra,
});

section('Bentuk matriks');
{
  check('source menandai data kurasi', matrix.source === 'curated', matrix.source);
  check('notice menyebut bukan statistik', /BUKAN statistik/i.test(matrix.notice || ''), String(matrix.notice).slice(0, 60));
  check('semua hero punya entri', Object.keys(matrix.heroes).length === 133, String(Object.keys(matrix.heroes).length));
  check('roleAdvantage ikut terbawa', Boolean(matrix.roleAdvantage?.tank?.beats));
  const fanny = matrix.heroes.fanny;
  check('arah counter tersimpan (fanny beats gusion)', fanny?.beats?.gusion === 14, String(fanny?.beats?.gusion));
  check('arah counter terbalik konsisten (gusion loses fanny)', matrix.heroes.gusion?.loses?.fanny === 14, String(matrix.heroes.gusion?.loses?.fanny));
  check('synergy simetris (yve<->hylos)', matrix.heroes.yve?.synergy?.hylos === 12 && matrix.heroes.hylos?.synergy?.yve === 12);
  check('tidak ada hero tanpa nama', Object.values(matrix.heroes).every((entry) => entry?.name));
}

section('Counter dan synergy engine');
{
  const counter = DraftAnalytics.matchupValue(matrix, 'fanny', 'gusion');
  check('fanny counter gusion +14', counter.value === 14 && counter.kind === 'counter', JSON.stringify(counter));

  const risk = DraftAnalytics.matchupValue(matrix, 'gusion', 'fanny');
  check('gusion kalah dari fanny -14', risk.value === -14 && risk.kind === 'risk', JSON.stringify(risk));

  check('matchup simetris besarnya', counter.value === -risk.value, `${counter.value} vs ${risk.value}`);
  check('synergy yve+hylos = 12', DraftAnalytics.synergyValue(matrix, 'yve', 'hylos') === 12);
  check('sinergi simetris', DraftAnalytics.synergyValue(matrix, 'hylos', 'yve') === 12);
  check('tidak ada synergy fanny vs layla', DraftAnalytics.synergyValue(matrix, 'fanny', 'layla') === 0);

  // Dua hero tanpa pasangan kurasi harus tetap dapat baseline dari relasi peran.
  const roleOnly = DraftAnalytics.matchupValue(matrix, 'obsidia', 'argus');
  check('matchup tanpa kurasi jatuh ke relasi peran', roleOnly.kind === 'role' || roleOnly.kind === 'neutral', JSON.stringify(roleOnly));
}

section('Ketahanan input rusak');
{
  const unknown = DraftAnalytics.matchupValue(matrix, 'fanny', 'bukan-hero');
  check('hero asing dihitung netral, tidak crash', unknown.value === 0 && unknown.kind === 'unknown', JSON.stringify(unknown));

  const empty = DraftAnalytics.evaluate(null, matrix);
  check('draft null jadi default', empty.blue.picks.length === 0 && empty.round === 1);
  check('advantage 0 saat draft kosong', empty.advantage === 0, String(empty.advantage));

  const junk = DraftAnalytics.evaluate(
    { blue: { picks: ['fanny', 42, null], bans: 'bukan-array' }, red: { picks: [] } },
    matrix,
  );
  check('pick non-string dibuang', junk.blue.picks.length === 1 && junk.blue.picks[0] === 'fanny', JSON.stringify(junk.blue.picks));
  check('bans bukan array jadi kosong', junk.draft.blue.bans.length === 0);

  const noMatrix = DraftAnalytics.evaluate(draft(['fanny']), null);
  check('matriks null tidak melempar', noMatrix.blue.picks[0] === 'fanny' && noMatrix.source === 'unknown');
  check('semua matchup unknown saat matriks kosong', noMatrix.blue.matchups.length === 0);

  const overfull = DraftAnalytics.evaluate(draft(['fanny', 'gusion', 'ling', 'hayabusa', 'saber', 'claude', 'beatrix']), matrix);
  check('pick melebihi 5 slot dipotong', overfull.blue.picks.length === 5, String(overfull.blue.picks.length));
}

section('Advantage tim');
{
  // Tim biru: khufra + hylos (anti-dive kuat) melawan assault assassin.
  const blueWins = DraftAnalytics.evaluate(draft(['khufra', 'hylos'], ['ling', 'hayabusa']), matrix);
  check('anti-dive biru advantage positif', blueWins.advantage > 0, String(blueWins.advantage));
  check('leader = biru', blueWins.leader === 'blue', blueWins.leader);

  const redWins = DraftAnalytics.evaluate(draft(['ling', 'hayabusa'], ['khufra', 'hylos']), matrix);
  check('simetris: sisi terbalik jadi negatif', redWins.advantage < 0, String(redWins.advantage));
  check('nilai advantage persis berlawanan', blueWins.advantage === -redWins.advantage, `${blueWins.advantage} vs ${redWins.advantage}`);

  const tie = DraftAnalytics.evaluate(draft(['ling'], ['ling']), matrix);
  check('draft identik = seri', tie.advantage === 0 && tie.leader === 'tie', String(tie.advantage));

  const full = DraftAnalytics.evaluate(
    draft(['gusion', 'yve', 'beatrix', 'hylos', 'franco'], ['claude', 'brody', 'hanabi', 'johnson', 'baxia']),
    matrix,
  );
  check('advantage selalu dalam -100..100', full.advantage >= -100 && full.advantage <= 100, String(full.advantage));
  check('matchup tercatat per pasang', full.blue.matchups.length > 0, String(full.blue.matchups.length));
  check('synergy pair tercatat', Array.isArray(full.blue.synergyPairs));
}

section('Rekomendasi pick');
{
  const result = DraftAnalytics.evaluate(draft(['fanny'], ['grock']), matrix);
  const top = result.recommendations.blue[0];
  check('rekomendasi terisi', result.recommendations.blue.length === 5, String(result.recommendations.blue.length));
  check('kandidat yang sudah dipick tidak diusulkan', !result.recommendations.blue.some((entry) => entry.heroId === 'fanny'));
  check('kandidat yang sudah dipick enemy tidak diusulkan', !result.recommendations.blue.some((entry) => entry.heroId === 'grock'));
  check('setiap kandidat punya alasan', top?.reasons?.length > 0, JSON.stringify(top?.reasons));
  check('skor terurut menurun', result.recommendations.blue.every((entry, index, list) => index === 0 || list[index - 1].score >= entry.score));

  // Fanny sudah dipick; kandidat yang counter Grock harus muncul sebagai counter.
  const countersGrock = DraftAnalytics.recommend(matrix, [], ['grock'], { limit: 30 }).find((entry) => entry.heroId === 'gusion');
  check('gusion direkomendasikan vs grock', Boolean(countersGrock), countersGrock ? '' : 'tidak ditemukan');
  check('alasan counter grock tercatat', countersGrock?.reasons.some((reason) => reason.kind === 'counter' && /Grock/.test(reason.label)), JSON.stringify(countersGrock?.reasons));

  const banned = DraftAnalytics.recommend(matrix, [], [], { limit: 5 });
  check('rekomendasi tanpa enemy tetap ada', banned.length === 5);

  const limitOption = DraftAnalytics.recommend(matrix, [], [], { limit: 2 });
  check('opsi limit dihormati', limitOption.length === 2, String(limitOption.length));
}

section('Ban dan round');
{
  const withBan = DraftAnalytics.evaluate(
    { visible: true, round: 3, activeSide: 'red', blue: { picks: ['fanny'], bans: ['grock'] }, red: { picks: [], bans: ['claude'] } },
    matrix,
  );
  check('round diteruskan', withBan.round === 3, String(withBan.round));
  check('activeSide diteruskan', withBan.activeSide === 'red', withBan.activeSide);
  check('gabungan ban kedua tim tercatat', withBan.banned.includes('grock') && withBan.banned.includes('claude'), JSON.stringify(withBan.banned));
  check('pick masuk taken', withBan.taken.includes('fanny'));

  const withBans = DraftAnalytics.recommend(matrix, [], [], { limit: 200, bans: ['grock', 'claude'] }).map((entry) => entry.heroId);
  check('hero yang di-ban tidak masuk rekomendasi', !withBans.includes('claude') && !withBans.includes('grock'), withBans.filter((id) => id === 'claude' || id === 'grock').join(',') || 'bersih');
  check('ban tidak memotong jumlah sisa kandidat', withBans.length === 131, String(withBans.length));
}

console.log(`\n${'='.repeat(52)}`);
console.log(`draft analytics: ${passed} ok, ${failed} gagal`);
if (failures.length) {
  console.log('\nGagal:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
process.exit(failed ? 1 : 0);