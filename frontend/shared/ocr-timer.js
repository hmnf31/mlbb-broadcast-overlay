// Timer untuk OCR.
//
// Aturan yang dipakai operator, dan hanya itu:
//
//   1. Bacaan pertama yang valid LANGSUNG jadi anchor dan timer langsung berjalan. Tidak ada
//      lagi tahap verifikasi yang menahan angka: dulu timer menunggu grace 10 detik sebelum
//      bergerak, jadi di layar terlihat diam padahal bacaan pertamanya sudah benar.
//   2. Timer tidak pernah mundur. Angkanya hanya boleh turun.
//   3. Tidak ada logika pause sama sekali. Kalau operator mau menahan waktu, itu urusan
//      tombol Start/Finish di control panel, bukan tebakan dari OCR.
//
// Dua aturan tolak, dan hanya dua:
//
//   - Bacaan DI ATAS nilai yang sedang berjalan = waktu mundur. Laguna karena "10:30"
//     salah terbaca jadi "18:30".
//   - Bacaan jauh DI BAWAH nilai yang sedang berjalan = salah baca. Laguna "10:30" jadi
//     "1:30". Timer turun paling banyak satu detik per detik, jadi selisih sebesar itu
//     mustahil terjadi di antara dua poll OCR.
//
// Modul ini terpisah dari halaman debug supaya aturannya bisa diuji tanpa browser, dan
// dipakai juga oleh panel verifikasi supaya keduanya tidak bisa berbeda.
(function (root) {
  // Seberapa jauh turun masih dianggap mungkin. Timer turun 1 detik per detik; dua poll OCR
  // berselang beberapa detik, jadi 60 detik sudah jauh lebih longgar dari fisika game. Yang
  // ditolak hanya lompatan yang jelas salah baca, bukan selisih kecil.
  const MAX_DROP_SECONDS = 60;
  // Selisih sebesar ini baru dianggap koreksi sungguhan, bukan noise. Di bawahnya anchor
  // dibiarkan, supaya digit terakhir timer tidak berkedip.
  const CORRECT_DRIFT_SECONDS = 10;
  // Batas atas absurdity: timer MLBB tidak pernah lebih dari 3600 detik (1 jam).
  const MAX_SECONDS = 3600;

  const REASON_TEXT = {
    anchor: 'anchor pertama dari OCR, timer mulai jalan',
    accepted: 'bacaan diterima, timer diselaraskan',
    corrected: 'selisih jauh dikoreksi ke bacaan OCR',
    unreadable: 'bacaan timer tidak terbaca',
    backward: 'bacaan lebih besar dari waktu berjalan, ditolak',
    misread_drop: 'bacaan jauh lebih kecil dari waktu berjalan, ditolak',
    out_of_range: 'di luar rentang timer',
  };

  function createTracker(options = {}) {
    const maxDropSeconds = Number.isFinite(options.maxDropSeconds) ? options.maxDropSeconds : MAX_DROP_SECONDS;
    const correctDriftSeconds = Number.isFinite(options.correctDriftSeconds)
      ? options.correctDriftSeconds
      : CORRECT_DRIFT_SECONDS;

    // null = belum ada anchor. Selama masih null, timer belum tahu jam berapa dan setiap
    // bacaan yang masuk akal langsung diterima.
    let seconds = null;
    let anchorAt = null;

    function anchorTo(value, at) {
      seconds = Math.max(0, Math.round(Number(value)));
      anchorAt = at;
    }

    // Nilai yang harus tampil sekarang. Selalu turun sendiri; tidak pernah ada keadaan beku
    // karena tracker ini tidak detecting pause sama sekali.
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

    // Bacaan OCR masuk. `anchored` told us apakah ini bacaan pertama: sebelum anchor ada, arah
    // bacaan tidak boleh dibandingkan dengan apa pun karena belum ada nilai sebelumnya untuk
    // dibandingkan.
    function observe(value, at = Date.now()) {
      const numeric = Number(value);
      const outcome = (action, reason, extra = {}) => ({
        action,
        reason,
        reasonText: REASON_TEXT[reason] || reason,
        value: seconds,
        at,
        current: current(at),
        anchored: seconds !== null,
        ...extra,
      });

      // `null`, `undefined`, dan string kosong harus ditolak SEBELUM jadi angka. Tanpa
      // pemeriksaan ini `Number(null)` bernilai 0, jadi bacaan kosong akan dianggap timer 0
      // yang sah -- dan tepat di detik-detik akhir match angka itu justru diterima.
      if (value === null || value === undefined || value === '') {
        return outcome('ignore', 'unreadable');
      }
      if (!Number.isFinite(numeric)) return outcome('ignore', 'unreadable');
      const read = Math.max(0, Math.round(numeric));
      if (read > MAX_SECONDS) return outcome('ignore', 'out_of_range');

      // Belum ada anchor: bacaan pertama yang valid langsung dipakai. Ini yang bikin timer
      // bergerak sejak detik pertama, bukan setelah verifikasi.
      if (seconds === null) {
        anchorTo(read, at);
        return outcome('anchor', 'anchor');
      }

      const expected = current(at);
      // Jarak yang mungkin: waktu sejak anchor terakhir. Timer turun paling banyak satu
      // detik per detik, jadi selisih sebesar MAX_DROP_SECONDS dalam waktu yang jauh lebih
      // singkat hampir pasti salah baca ("10:30" terbaca jadi "1:30").
      const gapSec = anchorAt === null ? 0 : Math.max(0, (at - anchorAt) / 1000);
      const dropLimit = maxDropSeconds + gapSec;

      // Aturan 1: tidak boleh mundur. Angka hanya boleh turun.
      if (read > expected) return outcome('ignore', 'backward', { read, expected });

      // Aturan 2: tidak boleh jatuh jauh. Bandingkan terhadap nilai yang SEDANG BERJALAN,
      // bukan terhadap anchor: kalau dibandingkan ke anchor, selisihnya akan terus menumpuk
      // seiring waktu dan setiap bacaan yang sah akan mulai ditolak sekitar menit ke-1.
      if (expected - read > dropLimit) {
        return outcome('ignore', 'misread_drop', { read, expected, dropLimit });
      }

      const drift = expected - read;
      if (drift === 0) {
        // Bacaan tepat sama dengan hitungan lokal: segarkan anchor tanpa mengubah angka.
        anchorTo(read, at);
        return outcome('accepted', 'accepted');
      }

      if (drift < correctDriftSeconds) {
        // Selisih kecil itu cuma noise pembacaan. Sengaja TIDAK digeser ke sini: menggeser
        // anchor setiap poll akan membuat digit terakhir maju-mundur terus di layar. locally
        // menghitung ulang lebih akurat karena tidak punya noise sama sekali.
        return outcome('accepted', 'accepted', { drift, shifted: false });
      }

      // Selisih sudah meaningfully besar: ini koreksi sungguhan, misalnya ada poll yang
      // terlewat atau timer sempat tidak terbaca. Baru di sini anchor digeser.
      anchorTo(read, at);
      return outcome('corrected', 'corrected', { read, expected, drift, shifted: true });
    }

    return { observe, current, state, reset };
  }

  root.OcrTimer = {
    createTracker,
    MAX_DROP_SECONDS,
    CORRECT_DRIFT_SECONDS,
    MAX_SECONDS,
    REASON_TEXT,
  };
}(globalThis));
