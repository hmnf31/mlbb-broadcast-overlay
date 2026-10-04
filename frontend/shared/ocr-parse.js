// Parsing hasil OCR mentah menjadi angka field.
//
// Dipisah supaya halaman debug dan panel verifikasi memakai implementasi yang sama.
// Sebelumnya logika ini hanya ada di debug/app.js; menyalinnya ke panel verifikasi
// berisiko besar karena hasil OCR yang salah akan jadi angka yang tayang di stream, dan
// dua salinan pasti akan berbeda begitu salah satu diperbaiki.
(function (root) {
// Timer dibaca dengan format `mm:ss` yang persis. Regex lama `(\d{1,2})\s*[:.·]\s*(\d{2})`
// mencari di tengah teks dan menerima `.` maupun `·` sebagai pemisah, jadi bacaan seperti
// "1204" atau "22.05" ikut diterima sebagai waktu padahal bukan. Yang lebih merusak, detik
// di atas 59 tidak pernah ditolak: "02:75" dihitung jadi 195 detik, dan itu angka yang
// tayang di stream.
//
// Sekarang satu-satunya bentuk yang diterima adalah mm:ss penuh. Kalau OCR keluar dari
// bentuk itu -- mis. karakter ":" belum terbaca sekecil apa pun -- hasilnya `null`, dan
// `null` berarti "belum ada bacaan yang bisa dipakai", bukan "nilai 0". Siklus scan
// berikutnya otomatis mengulang, jadi tidak ada yang perlu ditebak atau ditahan.
const TIMER_PATTERN = /^(\d{1,2}):([0-5]\d)$/;

// Gold di HUD sering ditulis "12.4K", sedangkan timer ditulis "22:05". Dua format itu
// perlu aturan berbeda: K berarti ribuan, dan titik pada timer berarti pemisah menit.
function parseRecognizedValue(key, rawText) {
  const text = String(rawText || '').trim().replace(/\s+/g, ' ');
  if (!text) return null;

  if (key === 'timer') {
    const timerMatch = text.match(TIMER_PATTERN);
    return timerMatch ? Number(timerMatch[1]) * 60 + Number(timerMatch[2]) : null;
  }

    // OCR sering membaca 0 sebagai O dan 1 sebagai I/l/|. Koreksi ini hanya untuk
    // karakter di posisi digit, bukan teks apa adanya.
    const numericText = text.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
    const numberMatch = numericText.match(/[+-]?\d+(?:[.,]\d+)?/);
    if (!numberMatch) return null;

    // Guard: koreksi O->0 dan l->1 di atas bisa mengubah KATA menjadi angka. "Lead"
    // jadi "1ead" lalu terbaca sebagai kill 1, padahal itu label HUD. Jadi angka hanya
    // diterima kalau tidak ada huruf yang menempel langsung di sisinya. Satuan K/M/B
    // tetap boleh, itu memang format gold.
    const before = numericText.slice(0, numberMatch.index).trimEnd();
    const after = numericText.slice(numberMatch.index + numberMatch[0].length).trimStart();
    if (/[A-Za-z0-9]/.test(before)) return null;
    if (/^[A-Za-z]/.test(after) && !/^[KMBkmb]/.test(after)) return null;

    const abbreviatedGold = key.endsWith('Gold') && /K/i.test(text);
    const value = abbreviatedGold
      ? Number(numberMatch[0].replace(',', '.')) * 1000
      // Digit kolom ribuan juga sering salah baca sebagai pemisah desimal, jadi semua
      // titik dan koma dibuang untuk field selain gold.
      : Number(numberMatch[0].replace(/[,.]/g, ''));
    return Number.isFinite(value) ? value : null;
  }

  root.OcrParse = { parseRecognizedValue };
}(globalThis));