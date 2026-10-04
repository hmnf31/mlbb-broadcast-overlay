// Lapisan validasi untuk hasil OCR. Dipisah dari halaman debug supaya aturannya bisa
// diuji tanpa browser.
//
// Prinsip: nilai yang DITOLAK tidak pernah menimpa nilai yang sedang tampil. Akar masalah
// angka berkedip di overlay bukan karena OCR salah, tapi karena satu bacaan buruk langsung
// dikirim apa adanya. Di sini setiap bacaan harus lolos beberapa gerbang dulu:
// confidence -> bentuk nilai -> monoton -> batas lonjakan -> majority vote.
(function (root) {
  const DEFAULT_THRESHOLD = 70;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  // Aturan per field. `maxDelta` menerima selisih waktu sejak bacaan terakhir (detik)
  // supaya batas lonjakannya ikut menyesuaikan kecepatan game.
  const FIELD_RULES = {
    blueKills: { kind: 'kills', shape: 'int' },
    redKills: { kind: 'kills', shape: 'int' },
    blueGold: { kind: 'gold', shape: 'int' },
    redGold: { kind: 'gold', shape: 'int' },
    timer: { kind: 'timer', shape: 'int' },
    turtleBlue: { kind: 'objective', shape: 'int' },
    turtleRed: { kind: 'objective', shape: 'int' },
    lordBlue: { kind: 'objective', shape: 'int' },
    lordRed: { kind: 'objective', shape: 'int' },
    towerBlue: { kind: 'objective', shape: 'int' },
    towerRed: { kind: 'objective', shape: 'int' },
  };

  // Gold hanya boleh naik, dan tidak boleh meloncat dari puluhan ribu ke ratusan ribu dalam
  // sekali poll. Batasnya longgar supaya fase awal tetap bisa masuk: dari 0 ke 2.500 itu hal
  // wajar, jadi lantai playground-nya cukup tinggi untuk menerimanya.
  const GOLD_JUMP_RATIO = 1.5;
  const GOLD_MIN_JUMP = 12000;
  // Objective (Lord/Tower) berubah sangat jarang dan sudah diurus operator secara manual, jadi
  // tidak ada filter temporal sama sekali: apa pun yang terbaca langsung dipakai. Satu-satunya
  // penolakan adalah angka yang jelas-jelas sampah (misal "99" dari karakter lain yang terbaca),
  // dan batasnya dibuat longgar supaya tidak pernah menahan nilai yang mungkin sah.
  const OBJECTIVE_MAX = 20;

  const REASON_TEXT = {
    accepted: 'diterima',
    same: 'nilai sama',
    unreadable: 'tidak terbaca',
    confidence: 'confidence di bawah ambang',
    shape: 'bentuk angka tidak valid',
    range: 'di luar rentang',
    dropped: 'nilai turun',
    jump: 'lonjakan melebihi batas',
    confirm: 'menunggu konfirmasi bacaan kedua',
    majority: 'menunggu majority 2 dari 3',
  };

  // Hanya field 'kills' yang lagi memakai batas lonjakan berbasis waktu. Gold, timer, dan
  // objective sudah punya filter sendiri di atas, jadi cabang untuk mereka di sini mati.
  function maxDeltaOf(rule, elapsedSec) {
    if (rule.kind === 'kills') return clamp(Math.ceil(elapsedSec / 2.5), 1, 5);
    return 3;
  }

  function shapeOk(rule, value) {
    if (!Number.isFinite(value)) return false;
    if (rule.shape === 'int') return Number.isInteger(value);
    return true;
  }

  function createGuard(options = {}) {
    const thresholds = { ...(options.thresholds || {}) };
    const majority = new Set(options.majorityFields || []);
    const reanchor = options.reanchor !== false;
    const onReanchor = typeof options.onReanchor === 'function' ? options.onReanchor : null;

    const state = {
      values: {},
      samples: {},
      pending: {},
      lowRun: {},
      decisions: {},
      rejected: {},
    };

    if (options.anchor && typeof options.anchor === 'object') state.values = { ...options.anchor };

    function anchorSnapshot() {
      return { ...state.values };
    }

    function reset() {
      for (const field of Object.keys(state.values)) delete state.values[field];
      for (const field of Object.keys(state.samples)) delete state.samples[field];
      for (const field of Object.keys(state.pending)) delete state.pending[field];
      for (const field of Object.keys(state.lowRun)) delete state.lowRun[field];
      for (const field of Object.keys(state.rejected)) delete state.rejected[field];
    }

    function pushSample(field, value) {
      const list = state.samples[field] || [];
      list.push(value);
      while (list.length > 3) list.shift();
      state.samples[field] = list;
      return list;
    }

    function majorityReached(field, list, value) {
      if (!majority.has(field)) return true;
      if (list.length < 2) return false;
      return list.filter((entry) => entry === value).length >= 2;
    }

    function noteRejection(field) {
      state.rejected[field] = (state.rejected[field] || 0) + 1;
    }

    function decide(field, sample = {}) {
      const rule = FIELD_RULES[field];
      const value = Number(sample.value);
      const at = Number(sample.at) || 0;
      const threshold = Number(thresholds[field] ?? sample.threshold ?? DEFAULT_THRESHOLD);
      const previous = state.values[field];
      const elapsedSec = previous !== undefined && state.lastAt?.[field]
        ? Math.max(0, (at - state.lastAt[field]) / 1000)
        : 5;

      const finish = (accepted, decision, extra = {}) => {
        const record = {
          field,
          accepted,
          value: accepted ? value : (previous ?? null),
          reason: decision,
          reasonText: REASON_TEXT[decision] || decision,
          rawText: sample.rawText ?? '',
          confidence: sample.confidence ?? null,
          at,
          ...extra,
        };
        state.decisions[field] = record;
        if (!accepted) noteRejection(field);
        return record;
      };

      if (!rule) return finish(false, 'unreadable');
      if (sample.value === null || sample.value === undefined || sample.value === '') return finish(false, 'unreadable');
      if (!Number.isFinite(value)) return finish(false, 'unreadable');
      if (!shapeOk(rule, value)) return finish(false, 'shape');
      if (rule.kind === 'timer' && (value < 0 || value > 3600)) return finish(false, 'range');
      if (rule.kind !== 'timer' && value < 0) return finish(false, 'range');
      if (Number.isFinite(Number(sample.confidence)) && Number(sample.confidence) < threshold) {
        return finish(false, 'confidence', { threshold });
      }

      if (rule.kind === 'timer') {
        // Timer TIDAK boleh memakai aturan monoton di bawah: aturan itu menganggap angka turun
        // sebagai salah baca, padahal timer MLBB memang hitung mundur dan berubah tiap detik,
        // jadi setiap bacaan valid akan ditolak sebagai 'dropped'.
        //
        // Guard hanya menjaga bentuk, rentang, dan confidence. Keputusan temporal timer
        // milik OcrTimer, yang memakai satu bacaan sebagai anchor lalu menghitung sendiri --
        // satu-satunya cara supaya timer tidak diam di layar.
        return finish(true, 'accepted');
      }

      // Gold: dua filter saja, sesuai yang diminta operator.
      //
      //   1. Tidak pernah turun. Gold hanya bisa bertambah.
      //   2. Tidak boleh meloncat dari puluhan ribu ke ratusan ribu dalam sekali poll.
      //
      // sengaja tidak memakai majority vote atau "tunggu konfirmasi" yang dulu ada di sini:
      // keduanya membuat angka gold tertahan beberapa detik setelah sebenarnya sudah benar,
      // dan operator lebih suka angka yang sudah naik dengan filter sederhana daripada angka
      // yang "aman" tapi tidak bergerak.
      if (rule.kind === 'gold') {
        if (previous === undefined || value === previous) {
          state.values[field] = value;
          state.lastAt = { ...(state.lastAt || {}), [field]: at };
          return finish(true, previous === undefined ? 'accepted' : 'same');
        }
        if (value < previous) return finish(false, 'dropped', { previous });

        const jumpLimit = Math.max(GOLD_MIN_JUMP, previous * GOLD_JUMP_RATIO);
        if (value - previous > jumpLimit) {
          return finish(false, 'jump', { previous, jumpLimit });
        }
        state.values[field] = value;
        state.lastAt = { ...(state.lastAt || {}), [field]: at };
        return finish(true, 'accepted', { delta: value - previous });
      }

      // Objective (Lord/Tower): terima apa pun yang masuk akal. Kenaikan dari 0 ke 1 ke 2 terjadi
      // sangat jarang, jadi tidak ada gunanya menuntut bacaan sering atau konsisten; yang penting
      // angka yang tampil benar saat terbaca.
      if (rule.kind === 'objective') {
        if (value > OBJECTIVE_MAX) return finish(false, 'range', { max: OBJECTIVE_MAX });
        if (previous === undefined || value === previous) {
          state.values[field] = value;
          state.lastAt = { ...(state.lastAt || {}), [field]: at };
          return finish(true, previous === undefined ? 'accepted' : 'same');
        }
        state.values[field] = value;
        state.lastAt = { ...(state.lastAt || {}), [field]: at };
        return finish(true, 'accepted', { delta: value - previous });
      }

      if (previous !== undefined) {
        if (value === previous) {
          state.lastAt = { ...(state.lastAt || {}), [field]: at };
          pushSample(field, value);
          return finish(true, 'same');
        }

        // Auto re-anchor dicek SEBELUM aturan monoton. Game baru selalu membuat angka turun
        // drastis (kill, gold, timer kembali ke nol), jadi penurunan besar tidak boleh
        // langsung dianggap misread. Tiga bacaan beruntun yang sama dan jauh di bawah nilai
        // lama berarti game baru.
        if (reanchor && previous > 0 && value <= previous * 0.7) {
          const run = state.lowRun[field];
          const lowRun = run && run.value === value ? { ...run, count: run.count + 1 } : { value, count: 1 };
          state.lowRun[field] = lowRun;
          if (lowRun.count >= 3) {
            reset();
            if (onReanchor) onReanchor({ field, value, previous });
            state.values[field] = value;
            state.samples[field] = [value];
            state.lastAt = { ...(state.lastAt || {}), [field]: at };
            return finish(true, 'accepted', { reanchored: true, previous });
          }
          return finish(false, 'confirm', { previous, awaitingReanchor: lowRun.count });
        }
        delete state.lowRun[field];

        if (value < previous) return finish(false, 'dropped', { previous });
      }

      const maxDelta = maxDeltaOf(rule, elapsedSec);
      const delta = previous === undefined ? 0 : value - previous;
      if (previous !== undefined && delta > maxDelta) {
        const pending = state.pending[field];
        if (pending && pending.value === value) {
          delete state.pending[field];
        } else {
          state.pending[field] = { value, at };
          return finish(false, 'confirm', { previous, delta, maxDelta });
        }
      }

      const list = pushSample(field, value);
      if (!majorityReached(field, list, value)) return finish(false, 'majority', { samples: [...list] });

      state.values[field] = value;
      state.lastAt = { ...(state.lastAt || {}), [field]: at };
      delete state.pending[field];
      return finish(true, 'accepted', { delta, maxDelta });
    }

    return {
      decide,
      reset,
      anchor: anchorSnapshot,
      values: () => ({ ...state.values }),
      decisionFor: (field) => state.decisions[field] || null,
      rejectedCount: (field) => (field ? state.rejected[field] || 0 : Object.values(state.rejected).reduce((a, b) => a + b, 0)),
      summary: () => Object.values(state.decisions).map((entry) => ({ ...entry })),
    };
  }

  root.OcrGuard = { FIELD_RULES, REASON_TEXT, createGuard, maxDeltaOf };
}(typeof globalThis !== 'undefined' ? globalThis : this));