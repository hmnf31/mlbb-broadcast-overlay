// Timer untuk OCR.
//
// Aturan yang dipakai operator, dan hanya itu:
//
//   1. Bacaan pertama yang valid LANGSUNG jadi anchor dan timer langsung berjalan. Tidak ada
//      tahap verifikasi yang menahan angka.
//   2. Timer tidak pernah mundur. Angkanya hanya boleh turun.
//   3. Tidak ada logika pause sama sekali. Kalau operator mau menahan waktu, itu urusan
//      tombol Start/Finish di control panel, bukan tebakan dari OCR.
//
// Tidak ada filter lain. Sebelumnya tracker juga menolak bacaan yang JAUH lebih kecil dari
// waktu berjalan dengan alasan "salah baca", dan itulah yang membuat layar macet: begitu satu
// bacaan salah besar tertangkap sebagai anchor (mis. "12:30" untuk timer yang sebenarnya
// 02:04), setiap bacaan berikutnya yang benar ditolak karena melompat terlalu jauh -- jadi
// angka yang benar tidak pernah bisa masuk, persis seperti yang dilaporkan operator. Selama
// bacaan operator sudah tepat, angka itu harus diterima apa adanya.
//
// Yang masih ditolak bukan "filter", cuma masukan yang memang tidak bisa jadi waktu:
//
//   - null / undefined / string kosong. `Number(null)` bernilai 0, jadi tanpa pemeriksaan ini
//     bacaan kosong dianggap timer 0 yang sah -- dan tepat di detik-detik akhir match angka
//     itu justru diterima.
//   - nilai yang bukan angka.
//   - lebih dari MAX_SECONDS. Timer MLBB tidak pernah melebihi itu, jadi angka sebesar itu
//     pasti salah baca, bukan kondisi yang perlu ditampilkan.
//
// Pemformatan `mm:ss` ditegakkan di ocr-parse.js, bukan di sini: modul ini menerima detik
// dan tidak tahu bentuk teks OCR-nya.
//
// Modul ini terpisah dari halaman debug supaya aturannya bisa diuji tanpa browser, dan
// dipakai juga oleh panel verifikasi supaya keduanya tidak bisa berbeda.
(function (root) {
  // Batas atas absurdity: timer MLBB tidak pernah lebih dari 3600 detik (1 jam).
  const MAX_SECONDS = 3600;

  const REASON_TEXT = {
    anchor: 'anchor pertama dari OCR, timer mulai jalan',
    accepted: 'bacaan diterima, timer diselaraskan',
    backward: 'bacaan lebih besar dari waktu berjalan, ditolak',
    unreadable: 'bacaan timer tidak terbaca',
    out_of_range: 'di luar rentang timer',
  };

  function createTracker() {
    // null = belum ada anchor. Selama masih null, timer belum tahu jam berapa dan setiap
    // bacaan yang masuk akal langsung diterima.
    let seconds = null;
    let anchorAt = null;

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

      // Belum ada anchor: bacaan pertama yang valid langsung dipakai. Ini yang bikin timer
      // bergerak sejak detik pertama, bukan setelah verifikasi.
      if (seconds === null) {
        seconds = read;
        anchorAt = at;
        return outcomeOf('anchor', 'anchor', at, { read });
      }

      const expected = current(at);

      // Satu-satunya aturan tolak: angka tidak boleh naik. Kalau OCR membaca "10:30" sebagai
      // "18:30", atau salah membaca digit tengah, timer akan melompat ke belakang dan penonton
      // mengira pertandingan dimulai dari nol.
      if (read > expected) return outcomeOf('ignore', 'backward', at, { read, expected });

      // Bacaan turun atau sama: ini koreksi sungguhan, jadi anchor langsung digeser ke
      // angka yang benar operator. Tidak ada ambang minimum, karena ambang itulah yang
      // membuat angka yang benar tidak pernah bisa diterima.
      const drift = expected - read;
      seconds = read;
      anchorAt = at;
      return outcomeOf('accepted', 'accepted', at, { read, expected, drift });
    }

    return { observe, current, state, reset };
  }

  root.OcrTimer = {
    createTracker,
    MAX_SECONDS,
    REASON_TEXT,
  };
}(globalThis));