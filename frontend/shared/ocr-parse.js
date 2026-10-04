// Parser OCR.
//
// Fokusnya timer: MLBB menulis `MM:SS`, tapi Tesseract sering kehilangan titik dua dan hanya
// menyisakan empat digit. `0123` itu 01:23, bukan angka 123 dan bukan "tidak terbaca".
//
// Bentuk yang diterima:
//
//   `MM:SS`   02:04 -> 124   bentuk aslinya
//   `MMSS`    0204  -> 124   titik dua hilang
//   `M:SS`    2:04  -> 124   nol di depan menit hilang
//   `MSS`     204   -> 124   titik dua dan nol di depan menit hilang
//
// Bentuk 3 dan 4 digit tanpa pemisah hanya dibaca sebagai menit+detik, tidak pernah sebagai
// detik mentah: `0204` sebagai 204 detik akan berarti 03:24 dan timer melompat jauh. Bentuk
// lain apa pun -- `02:75`, `22.05`, `Time 02:04`, kosong -- menghasilkan `null`.
//
// `null` berarti "belum ada bacaan yang bisa dipakai", bukan "waktu 0". Siklus scan berikutnya
// otomatis mengulangnya, jadi bentuk di luar daftar di atas cukup ditolak, bukan ditebak.
//
// Gold di HUD sering ditulis "12.4K", sedangkan timer ditulis "22:05". Dua bentuk itu perlu
// aturan berbeda: K berarti ribuan.
(function (root) {
  function parseTimer(text) {
    const colon = /^(\d{1,2}):([0-5]\d)$/.exec(text);
    if (colon) return Number(colon[1]) * 60 + Number(colon[2]);

    // Tanpa titik dua: empat digit adalah MMSS, tiga digit adalah MSS. Nol di depan tidak
    // mengubah nilainya, jadi bentuk yang dipadatkan tidak perlu kasus terpisah.
    const digits = /^(\d{3,4})$/.exec(text);
    if (!digits) return null;
    const all = digits[1];
    const minutePart = all.length === 4 ? all.slice(0, 2) : all.slice(0, 1);
    const secondPart = all.length === 4 ? all.slice(2) : all.slice(1);
    return Number(minutePart) * 60 + Number(secondPart);
  }

  function parseRecognizedValue(key, rawText) {
    const text = String(rawText || '').trim().replace(/\s+/g, ' ');
    if (!text) return null;

    if (key === 'timer') return parseTimer(text);

    // OCR sering membaca 0 sebagai O dan 1 sebagai I/l/|. Koreksi ini hanya untuk
    // karakter di posisi digit, bukan teks apa adanya.
    const numericText = text.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
    const numberMatch = numericText.match(/[+-]?\d+(?:[.,]\d+)?/);
    if (!numberMatch) return null;

    // Guard: koreksi O->0 dan l->1 di atas bisa mengubah KATA menjadi angka. "Lead"
    // jadi "1ead" lalu terbaca sebagai kill 1, padahal itu label HUD. Jadi angka hanya
    // diterima kalau tidak ada huruf yang menempel langsung di sisinya. Satuan K/M tetap
    // boleh, itu memang format gold.
    const before = numericText.slice(0, numberMatch.index).trimEnd();
    const after = numericText.slice(numberMatch.index + numberMatch[0].length).trimStart();
    if (/[A-Za-z0-9]/.test(before)) return null;
    if (/^[A-Za-z]/.test(after) && !/^[KMBkmb]/.test(after)) return null;

    const abbreviatedGold = key.endsWith('Gold') && /K/i.test(text);
    const value = abbreviatedGold
      ? Number(numberMatch[0].replace(',', '.')) * 1000
      // Digit kolom ribuan juga sering salah baca sebagai pemisah desimal, jadi semua titik
      // dan koma dibuang untuk field selain gold.
      : Number(numberMatch[0].replace(/[,.]/g, ''));
    return Number.isFinite(value) ? value : null;
  }

  root.OcrParse = { parseRecognizedValue, parseTimer };
}(globalThis));