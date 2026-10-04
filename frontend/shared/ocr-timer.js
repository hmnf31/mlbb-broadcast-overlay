// Timer untuk OCR.
//
// Aturan yang dipakai operator, dan hanya itu:
//
//   1. HANYA bacaan pertama yang jadi anchor. Sesudah itu angka dihitung sendiri, jadi timer
//      berjalan terus tanpa bergantung pada OCR sama sekali.
//   2. Timer tidak pernah mundur. Angka di layar hanya boleh turun, tidak pernah naik.
//   3. Bacaan yang ditolak tidak menghentikan apa pun. Anchor tetap dipegang dan hitungan
//      lokal tetap jalan, jadi tidak ada keadaan "berhenti" yang bisa terjadi.
//
// Pembacaan berikutnya tidak dipakai untuk mengoreksi timer, melainkan hanya untuk me-reset
// anchor kalau angkanya nyaris sama dengan hitungan lokal. Itu satu-satunya gunanya:
//
//   - bacaan LEBIH BESAR dari waktu berjalan  -> ditolak. Menerimanya membuat angka naik.
//   - bacaan jauh di bawah waktu berjalan    -> ditolak. Contoh yang diberi operator: timer
//     benar-benar 01:25 lalu terbaca "00:26" karena digit menitnya salah baca jadi 0. Angka
//     00:26 itu bukan 26 detik, dan menerimanya akan MELOMPAT mundur satu menit.
//   - selisih kecil                          -> anchor di-reset ke bacaan itu, jadi angka
//     tidak perlahan menyimpang dari game kalau ada scan yang telat atau tab yang throttled.
//
// Filter "jatuh jauh" versi lama justru membuat semua bacaan yang benar ditolak begitu satu
// bacaan salah besar tertangkap, dan itu membuat timer macet permanen. Karena itu di sini
// ada batas toleransi yang tumbuh seiring waktu sejak anchor terakhir, sehingga gap yang
// panjang tidak selalu berarti bacaan salah.
//
// Modul ini terpisah dari halaman debug supaya aturannya bisa diuji tanpa browser, dan
// dipakai juga oleh panel verifikasi supaya keduanya tidak bisa berbeda.
(function (root) {
  // Toleransi dasar untuk bacaan yang tertinggal dari hitungan lokal. Satu siklus OCR
  // memakan sekitar satu detik, dan hasilnya bisa beberapa detik tua karena sudah dibaca
  // sebelum dikirim. 10 detik menutup kedua hal itu tanpa lama-lama berubah menjadi celah
  // untuk bacaan yang benar-benar salah.
  const LAG_TOLERANCE_SECONDS = 10;
  // Batas atas absurdity: timer MLBB tidak pernah lebih dari 3600 detik (1 jam).
  const MAX_SECONDS = 3600;

  const REASON_TEXT = {
    anchor: 'anchor pertama dari OCR, timer berjalan sendiri sejak sini',
    resync: 'bacaan cocok dengan hitungan lokal, anchor disegarkan',
    backward: 'bacaan lebih besar dari waktu berjalan, ditolak supaya angka tidak mundur',
    misread_lag: 'bacaan jauh di bawah waktu berjalan, ditolak sebagai salah baca digit',
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

    // Bacaan OCR masuk, dalam detik.
    function observe(value, at = Date.now()) {
      const numeric = Number(value);

      if (value === null || value === undefined || value === '') {
        return outcomeOf('ignore', 'unreadable', at);
      }
      if (!Number.isFinite(numeric)) return outcomeOf('ignore', 'unreadable', at);

      const read = Math.max(0, Math.round(numeric));
      if (read > MAX_SECONDS) return outcomeOf('ignore', 'out_of_range', at, { read });

      // Aturan 1: hanya bacaan pertama yang jadi anchor.
      if (seconds === null) {
        seconds = read;
        anchorAt = at;
        return outcomeOf('anchor', 'anchor', at, { read });
      }

      const expected = current(at);

      // Aturan 2: angka di layar tidak boleh pernah naik.
      if (read > expected) return outcomeOf('ignore', 'backward', at, { read, expected });

      // Toleransi tumbuh seiring waktu sejak anchor terakhir, supaya gap panjang (tab di
      // belakang, scan yang gagal beberapa kali) tidak otomatis dianggap salah baca. Karena
      // anchor di-reset setiap bacaan yang diterima, gap ini tetap kecil dalam pemakaian
      // normal dan tidak pernah berubah jadi celah bebas.
      const gapSec = anchorAt === null ? 0 : Math.max(0, (at - anchorAt) / 1000);
      const lagLimit = LAG_TOLERANCE_SECONDS + Math.floor(gapSec);

      if (expected - read > lagLimit) {
        return outcomeOf('ignore', 'misread_lag', at, { read, expected, lagLimit });
      }

      // Selisih kecil: bacaan operator dianggap benar, anchor dipindahkan ke sana. Ini yang
      // menjaga angka tetap dekat dengan game tanpa pernah melompat.
      const drift = expected - read;
      seconds = read;
      anchorAt = at;
      return outcomeOf('resync', 'resync', at, { read, expected, drift, lagLimit });
    }

    return { observe, current, state, reset };
  }

  root.OcrTimer = {
    createTracker,
    LAG_TOLERANCE_SECONDS,
    MAX_SECONDS,
    REASON_TEXT,
  };
}(globalThis));