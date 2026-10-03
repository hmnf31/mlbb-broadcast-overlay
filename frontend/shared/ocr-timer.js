// Tracker timer untuk OCR.
//
// Timer MLBB ditulis mm:ss dan BERJALAN tiap detik, jadi membacanya dengan OCR berulang
// itu memang tidak akan pernah stabil: setiap siklus angkanya sudah berubah, dan satu
// bacaan salah langsung terpakai. Akibatnya angka timer di overlay berkedip atau melompat
// beberapa detik, dan itu justru field yang paling terlihat oleh penonton.
//
// Aturannya di sini: timer dibaca sekali untuk membuat anchor, lalu BERJALAN sendiri secara
// lokal. OCR hanya dipakai lagi kalau lokal dan OCR menyimpang terus-menerus -- dalam
// praktik itu berarti game sedang di-pause. Baru setelah simpangan bertahan 10 detik
// bacaan OCR diterima sebagai anchor baru, jadi satu salah baca tidak pernah langsung
// diterima.
//
// Modul ini terpisah dari halaman debug supaya aturannya bisa diuji tanpa browser, dan
// dipakai juga oleh panel verifikasi supaya keduanya tidak bisa berbeda.
(function (root) {
  // OCR mm:ss biasanya meleset 1-3 detik. Selama simpangan selama ini, angka lokal sudah
  // dianggap benar dan tidak ada yang dikirim.
  const TOLERANCE_SECONDS = 3;
  // Simpangan harus bertahan selama ini sebelum dianggap pause nyata. Beberapa detik saja
  // terlalu pendek: satu frame buram atau satu salah baca sudah cukup untuk memicu koreksi.
  const PAUSE_GRACE_MS = 10000;
  // RESYNC_SECONDS dipakai sebagai ambang "penyimpangan berarti" untuk laporan ke server, bukan
  // sebagai ambang pengatchet anchor lokal: anchor lokal sengaja hanya digeser saat bacaan
  // menyimpang terus-menerus, supaya angka di layar tetap mulus.
  const RESYNC_SECONDS = 2;
  // Resume tidak memakai grace 10 detik. Setelah pause, nilai yang diharapkan beku, jadi
  // penurunan OCR adalah bukti yang jauh lebih bersih daripada simpangan: satu bacaan
  // turun berarti timer bergerak, dan dua bacaan turun beruntun hampir tidak mungkin salah
  // baca. Cukup dua, supaya resume tidak menambah 10 detik delay yang terasa di layar.
  const RESUME_CONFIRM_READS = 2;

  const REASON_TEXT = {
    anchor: 'anchor pertama dari OCR',
    resync: 'selaras ulang dengan bacaan OCR',
    paused: 'masih pause, angka ditahan',
    pending: 'simpangan belum cukup lama, ditunggu',
    pause: 'timer berhenti 10 detik, dianggap pause',
    resume: 'timer berjalan lagi setelah pause',
    correct: 'simpangan lama dikoreksi ke bacaan OCR',
    unreadable: 'bacaan timer tidak terbaca',
    unchanged: 'nilai sama, tidak ada yang berubah',
  };

  function createTracker(options = {}) {
    const toleranceSeconds = Number.isFinite(options.toleranceSeconds)
      ? options.toleranceSeconds
      : TOLERANCE_SECONDS;
    const pauseGraceMs = Number.isFinite(options.pauseGraceMs) ? options.pauseGraceMs : PAUSE_GRACE_MS;
    const resyncSeconds = Number.isFinite(options.resyncSeconds) ? options.resyncSeconds : RESYNC_SECONDS;

    let seconds = Number.isFinite(options.seconds) ? options.seconds : null;
    let running = options.running !== false && seconds !== null;
    let anchorAt = Number.isFinite(options.anchorAt) ? options.anchorAt : null;
    // Kapan simpangan besar pertama terlihat. null = sedang konsisten.
    let driftSince = null;
    let driftWasAhead = null;
    // Berapa bacaan berturut-turut timer turun sejak terakhir kali kita yakin pause.
    let resumeRun = 0;

    function anchorTo(value, at) {
      seconds = Math.max(0, Math.round(Number(value)));
      anchorAt = at;
    }

    // Timer bergerak lagi setelah beku: anchor pindah ke bacaan supaya hitung mundur lanjut
    // dari posisi yang benar. Ini satu-satunya tempat anchor digeser selain anchor pertama dan
    // koreksi, karena hanya di sini nilai lokal memang sudah tidak bisa dihitung sendiri.
    function resumeAt(read, at) {
      running = true;
      anchorTo(read, at);
      resumeRun = 0;
      driftSince = null;
      driftWasAhead = null;
      return {
        action: 'resume',
        reason: 'resume',
        value: seconds,
        running,
        current: current(at),
        worthSending: true,
      };
    }

    // Nilai yang harus tampil sekarang. Menurun sendiri hanya kalau running; kalau di-pause
    // angka ditahan di nilai anchor.
    function current(at = Date.now()) {
      if (seconds === null) return null;
      if (!running || anchorAt === null) return seconds;
      const elapsed = Math.floor(Math.max(0, at - anchorAt) / 1000);
      return Math.max(0, seconds - elapsed);
    }

    function state() {
      return { seconds, running, anchorAt, current: current() };
    }

    function reset() {
      seconds = null;
      running = false;
      anchorAt = null;
      driftSince = null;
      driftWasAhead = null;
      resumeRun = 0;
    }

    // Bacaan OCR masuk, kembalikan keputusan yang bisa ditindaklanjuti pemanggil:
    // 'anchor' | 'resync' | 'resume' | 'pause' | 'correct' berarti nilai berubah dan
    // layak dikirim; sisanya hanya informasi.
    function observe(value, at = Date.now()) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return { action: 'ignore', reason: 'unreadable', value: null, running, current: current(at) };
      }
      const read = Math.max(0, Math.round(numeric));

      if (seconds === null) {
        anchorTo(read, at);
        running = true;
        driftSince = null;
        return { action: 'anchor', reason: 'anchor', value: seconds, running, current: current(at) };
      }

      const expected = current(at);
      const drift = expected - read;

      const pending = (why) => ({
        action: 'ignore',
        reason: 'pending',
        pendingReason: why,
        value: seconds,
        running,
        current: expected,
        worthSending: false,
      });

      // Kalau kita yakin game pause, `expected` beku di nilai anchor. Dari situ dua kemungkinan
      // yang tidak boleh dicampur:
      //   - bacaan TURUN  => timer bergerak => game berjalan lagi (resume).
      //   - bacaan SAMA/NAIK => game masih beku; ini PASTE, bukan resume.
      // Menyamakan keduanya pernah terjadi dan akibatnya sangat kelihatan: satu salah baca
      // bisa menghidupkan timer yang seharusnya beku.
      if (!running) {
        if (read >= seconds) {
          resumeRun = 0;
          driftSince = null;
          driftWasAhead = null;
          return {
            action: 'resync',
            reason: 'paused',
            value: seconds,
            running,
            current: expected,
            worthSending: false,
          };
        }
        // Bacaan turun. Kalau turunnya cuma sebesar toleransi, itu konsisten dengan timer yang
        // berjalan beberapa detik lalu di-pause ulang -- langsung diterima, tidak perlu konfirmasi.
        if (Math.abs(drift) <= toleranceSeconds) return resumeAt(read, at);
        // Lompatan turun besar tidak mungkin muncul dari timer yang baru jalan sebentar, jadi
        // satu bacaan tidak cukup: tunggu bacaan kedua yang juga turun.
        resumeRun += 1;
        if (resumeRun < RESUME_CONFIRM_READS) return pending('resume');
        return resumeAt(read, at);
      }

      if (Math.abs(drift) <= toleranceSeconds) {
        // Konsisten, jadi pending dihapus. Anchor lokal SENGAJA TIDAK digeser ke bacaan OCR yang
        // sudah dalam toleransi: menganchor ulang membuat noise 1-3 detik jadi lompatan yang
        // terlihat di layar (angka maju satu detik lalu mundur lagi), dan yang lebih buruk,
        // kalau game sedang pause, hitungan lokal selalu dragged mendekati bacaan sehingga
        // simpangan tidak pernah tumbuh melewati toleransi -- pause jadi mustahil dikenali.
        //
        // Hitungan lokal justru lebih akurat dari OCR: satu anchor yang dihitung ulang sendiri
        // tidak punya noise pembacaan sama sekali.
        driftSince = null;
        driftWasAhead = null;
        return {
          action: 'resync',
          reason: 'resync',
          value: seconds,
          running,
          current: expected,
          worthSending: false,
        };
      }

      // Simpangan besar: tunggu dulu, game bisa saja sedang pause atau ini salah baca.
      const ahead = drift < 0; // nilai lokal lebih kecil dari bacaan => kita terlalu cepat
      if (driftSince === null || driftWasAhead !== ahead) {
        driftSince = at;
        driftWasAhead = ahead;
        return pending(ahead ? 'drift-ahead' : 'drift-behind');
      }

      // Simpangan besar di dalam grace: ditahan, anchor lama tidak disentuh.
      if (at - driftSince < pauseGraceMs) {
        return pending(ahead ? 'drift-ahead' : 'drift-behind');
      }

      // Arahnya yang menentukan, dan ARAH INI SERING TERBALIK kalau dibaca sekilas:
      // `drift = expected - read`, jadi `ahead === true` berarti bacaan OCR LEBIH BESAR dari
      // hitungan lokal. Itu persis gejala game berhenti: kita terus menghitung mundur padahal
      // timer di layar berhenti. Jadi `ahead` -> pause, bukan correct.
      running = !ahead;
      anchorTo(read, at);
      driftSince = null;
      driftWasAhead = null;
      return {
        action: ahead ? 'pause' : 'correct',
        reason: ahead ? 'pause' : 'correct',
        value: seconds,
        running,
        current: current(at),
        worthSending: true,
      };
    }

    return { observe, current, state, reset };
  }

  root.OcrTimer = {
    createTracker,
    TOLERANCE_SECONDS,
    PAUSE_GRACE_MS,
    RESYNC_SECONDS,
    REASON_TEXT,
  };
}(globalThis));