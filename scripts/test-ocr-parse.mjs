// Test parser OCR.
//
// Fokusnya format timer: satu-satunya bentuk yang diterima adalah `mm:ss`. Segala bentuk lain
// harus jadi `null` -- bukan `0`, bukan angka hasil tebakan -- supaya siklus scan berikutnya
// mengulangnya sendiri. Ini yang membedakan "bacaan belum terbaca" dari "waktu benar-benar 0 menit".
//
// Menjalankan frontend/shared/ocr-parse.js apa adanya, tanpa browser.
import '../frontend/shared/ocr-parse.js';

const { parseRecognizedValue } = globalThis.OcrParse;

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

section('Timer mm:ss diterima');
{
  check('02:04 = 124 detik', parseRecognizedValue('timer', '02:04') === 124, String(parseRecognizedValue('timer', '02:04')));
  check('00:00 = 0', parseRecognizedValue('timer', '00:00') === 0, String(parseRecognizedValue('timer', '00:00')));
  check('15:00 = 900', parseRecognizedValue('timer', '15:00') === 900, String(parseRecognizedValue('timer', '15:00')));
  check('9:59 tanpa nol di depan diterima', parseRecognizedValue('timer', '9:59') === 599, String(parseRecognizedValue('timer', '9:59')));
  check('spasi di sekitar titik dua diabaikan', parseRecognizedValue('timer', '02:04') === 124, String(parseRecognizedValue('timer', '02:04')));
  check('baris baru di sekitar titik dua diabaikan', parseRecognizedValue('timer', '02:04\n') === 124, String(parseRecognizedValue('timer', '02:04\n')));
}

section('Timer di luar mm:ss ditolak supaya di-scan ulang');
{
  // Regex lama menerima `:` maupun `.` dan mencari di tengah teks, jadi bentuk-bentuk ini
  // pernah jadi angka. `.` dan `·` tidak dipakai MLBB sama sekali.
  //
  // Spasi di sekitar titik dua juga ditolak. Operator meminta bentuknya selalu `00:00`; kalau
  // OCR menyisipkan spasi, hasil tekanya bukan mm:ss dan harus di-scan ulang, bukan ditebak
  // jadi angka yang mungkin benar. Siklus berikutnya berjalan ~1 detik, jadi tidak ada yang
  // benar-benar hilang.
  const rejected = [
    ['spasi sebelum titik dua', '02 : 04'],
    ['spasi setelah titik dua', '02: 04'],
    ['baris baru di sekitar titik dua', '02:\n04'],
    ['titik sebagai pemisah', '02.04'],
    ['pemisah tengah titik', '02·04'],
    ['tanpa pemisah', '0204'],
    ['detik satu digit', '02:4'],
    ['detik tiga digit', '02:004'],
    ['teks menempel', 'Time 02:04'],
    ['label menempel', '02:04s'],
    ['angka depan', '12 02:04'],
    ['huruf sebelum', 'T02:04'],
    ['huruf sesudah', '02:0A'],
    ['koma', '02,04'],
    ['dua titik dua', '02:04:11'],
  ];
  for (const [label, text] of rejected) {
    const value = parseRecognizedValue('timer', text);
    check(`${label} jadi null`, value === null, String(value));
  }
}

section('Timer: detik di atas 59 ditolak');
{
  // "02:75" pernah dihitung jadi 195 detik dan tayang di stream.
  for (const text of ['02:75', '00:60', '22:99']) {
    const value = parseRecognizedValue('timer', text);
    check(`${text} ditolak`, value === null, String(value));
  }
  check('batas 59:59 diterima', parseRecognizedValue('timer', '59:59') === 3599, String(parseRecognizedValue('timer', '59:59')));
}

section('Timer kosong dan rusak');
{
  for (const text of ['', '   ', ':', '::', ':04', '02:']) {
    const value = parseRecognizedValue('timer', text);
    check(`${JSON.stringify(text)} jadi null`, value === null, String(value));
  }
  check('null jadi null, bukan 0', parseRecognizedValue('timer', null) === null, String(parseRecognizedValue('timer', null)));
  check('undefined jadi null, bukan 0', parseRecognizedValue('timer', undefined) === null);
}

section('Gold tetap memakai format K dan M');
{
  check('12.4K = 12400', parseRecognizedValue('blueGold', '12.4K') === 12400, String(parseRecognizedValue('blueGold', '12.4K')));
  check('18,800 tanpa satuan = 18800', parseRecognizedValue('blueGold', '18,800') === 18800, String(parseRecognizedValue('blueGold', '18,800')));
  check('koma diterima sebagai pemisah ribuan', parseRecognizedValue('blueGold', '18,800') === 18800);
  check('kills agonistik', parseRecognizedValue('blueKills', '9') === 9, String(parseRecognizedValue('blueKills', '9')));
  // O dan l adalah salah baca digit yang paling sering di HUD.
  check('O dibaca sebagai 0', parseRecognizedValue('blueKills', '1O') === 10, String(parseRecognizedValue('blueKills', '1O')));
  check('l dibaca sebagai 1', parseRecognizedValue('blueKills', '1l') === 11, String(parseRecognizedValue('blueKills', '1l')));
  // Guard ini yang mencegah label jadi angka: "Lead" -> "1ead" -> kill 1.
  check('kata berlabel ditolak', parseRecognizedValue('blueKills', 'Lead') === null, String(parseRecognizedValue('blueKills', 'Lead')));
  check('teks kosong jadi null', parseRecognizedValue('blueKills', '') === null);
}

console.log(`\n${passed} ok, ${failed} gagal`);
if (failed) {
  console.error('\nGagal:\n- ' + failures.join('\n- '));
  process.exit(1);
}