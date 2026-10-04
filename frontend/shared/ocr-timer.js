// Timer untuk OCR.
//
// Aturan yang dipakai operator, dan hanya itu:
//
//   1. SATU filter: bacaan dengan confidence di bawah 50% ditolak. Selebihnya langsung dipakai,
//      apa pun angkanya.
//
//   2. Setiap bacaan yang diterima langsung jadi anchor baru, lalu timer berjalan sendiri dari
//      sana sampai bacaan berikutnya masuk.
//
// Kenapa tidak ada filter lain? Karena kedua filter sebelumnya justru membuat timer berhenti
// di layar. Aturan "tidak boleh mundur" menolak bacaan yang LEBIH BESAR dari hitungan lokal,
// padahal itu justru bacaan yang paling sering benar:
//
//     01:18 | 96% | nilai: 0:54
//     bacaan lebih besar dari waktu berjalan, ditolak supaya angka tidak mundur
//
// Hitungan lokal sudah tertinggal 24 detik di belakang game, jadi bacaan yang benar justru
// ditolak dan angka di layar membeku di 0:54. Aturan "bacaan jauh di bawah ditolak" punya
// masalah yang sama: satu digit menit yang salah baca akan mengunci anchor lama dan semua
// bacaan benar berikutnya ikut ditolak.
//
// Jadi logikanya dibalik. Yang dijaga hanya dua hal yang bukan soal angka: confidence-nya
// cukup, dan angkanya benar-benar bukan sampah. Selebihnya dipercaya begitu saja -- salah
// baca ringan akan kelihatan satu-dua detik lalu dikoreksi bacaan berikutnya, dan itu jauh
// lebih baik daripada angka yang diam.
//
// Konsekuensinya, dan ini yang disengaja: angka DI LAYAR boleh naik dan boleh melompat
// kalau OCR salah baca digit. Yang dijamin hanya tidak berhenti, dan selalu mengikuti game
// selama bacaannya masuk.
//
// Modul ini terpisah dari halaman debug supaya aturannya bisa diuji tanpa browser, dan
// dipakai juga oleh panel verifikasi supaya keduanya tidak bisa berbeda.
(function (root) {
  // Confidence Tesseract di bawah ini berarti regionnya tidak terbaca sama sekali, jadi
  // angkanya jangan dipakai. Di atas 50% angka sudah terbaca dan operator lebih memilih
  // angka yang bergerak dengan satu digit yang mungkin keliru daripada angka yang beku.
  const MIN_CONFIDENCE = 50;
  // Batas atas absurdity: timer MLBB tidak pernah lebih dari 3600 detik (1 jam).
  const MAX_SECONDS = 3600;

  const REASON_TEXT = {
    anchor: 'anchor pertama dari OCR, timer berjalan sendiri sejak sini',
    resync: 'bacaan dipakai apa adanya, anchor dipindahkan ke sini',
    low_confidence: 'confidence di bawah ambang, bacaan diabaikan',
    unreadable: 'bacaan timer tidak terbaca',
    out_of_range: 'di luar rentang timer',
  };

  function createTracker() {
    // null = belum ada anchor. Selama masih null, timer belum tahu jam berapa dan setiap
    // bacaan yang masuk akal langsung dipakai.
    let seconds = null;
    let anchorAt = null;

    // Nilai yang harus tampil sekarang. Selalu turun sendiri dan tidak pernah ada keadaan
    // beku: selama anchor ada, selalu ada angka yang sedang berjalan.
    function current(at = Date.now()) {
      if (seconds === null) return null;
      if (anchorAt === null) return seconds;
      const elapsed = Math.floor(Math.max(0, at - anchorAt) / 1000);
      return Math.max(0, seconds - elapsed);
    }

    function state() {
      return { seconds, anchorAt, current: current() };
    }

    function reset() {
      seconds = null;
      anchorAt = null;
    }

    function outcomeOf(action, reason, at, extra = {}) {
      return {
        action,
        reason,
        reasonText: REASON_TEXT[reason] || reason,
        value: seconds,
        at,
        current: current(at),
        anchored: seconds !== null,
        ...extra,
      };
    }

    // Bacaan OCR masuk, dalam detik. `confidence` boleh tidak dikirim (0.0-100); yang tidak
    // ada dianggap 100 karena pemanggil sudah melihat angkanya sendiri.
    function observe(value, at = Date.now(), confidence = 100) {
      const numeric = Number(value);

      if (value === null || value === undefined || value === '') {
        return outcomeOf('ignore', 'unreadable', at);
      }
      if (!Number.isFinite(numeric)) return outcomeOf('ignore', 'unreadable', at);

      // Satu-satunya filter yang benar-benar menyaring. Confidence yang tidak dilaporkan
      // dianggap tinggi, jadi bacaan dari sumber yang tidak punya skor tidak ikut terbuang.
      const score = confidence === null || confidence === undefined || confidence === ''
        ? null
        : Number(confidence);
      if (score !== null && Number.isFinite(score) && score < MIN_CONFIDENCE) {
        return outcomeOf('ignore', 'low_confidence', at, { confidence: score, minConfidence: MIN_CONFIDENCE });
      }

      const read = Math.max(0, Math.round(numeric));
      if (read > MAX_SECONDS) return outcomeOf('ignore', 'out_of_range', at, { read });

      // Bacaan pertama yang masuk hanya jadi anchor pertama.
      if (seconds === null) {
        seconds = read;
        anchorAt = at;
        return outcomeOf('anchor', 'anchor', at, { read });
      }

      // Setelah itu setiap bacaan diterima apa adanya: naik maupun turun, di bawah maupun di
      // atas hitungan lokal. Selisihnya tetap dicatat supaya halaman debug bisa memperlihatan
      // seberapa jauh hitungan lokal menyimpang dari game, tapi selisih itu tidak pernah
      // menolak apa pun.
      const expected = current(at);
      const drift = read - expected;
      seconds = read;
      anchorAt = at;
      return outcomeOf('resync', 'resync', at, {
        read,
        expected,
        drift,
        confidence: score,
      });
    }

    return { observe, current, state, reset };
  }

  root.OcrTimer = {
    createTracker,
    MIN_CONFIDENCE,
    MAX_SECONDS,
    REASON_TEXT,
  };
}(globalThis));
