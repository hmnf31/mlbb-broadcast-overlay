// Mesin analitik draft (Fase 1). Murni, tanpa DOM dan tanpa network, supaya bisa diuji di
// Node dan dipakai ulang di overlay maupun control panel.
//
// Bentuk draft mengikuti apa yang disimpan Durable Object di key `draft`:
//   { visible, round, activeSide, blue: { picks: [heroId], bans: [heroId] }, red: {...} }
//
// Bentuk matriks dihasilkan oleh scripts/build-hero-matrix.mjs. Entrinya menyimpan arah
// per-pasang (`beats` = hero ini menang atas siapa, `loses` = siapa yang menang atas hero ini)
// supaya tabel kurasi benar-benar dipakai; `strength` hanya agregat untuk sorting.
//
// Semua angka di keluaran ini indeks heuristik dari matriks kurasi, bukan prediksi
// kemenangan. Overlay dan control wajib menampilkan `source` dari matriks supaya
// penonton/operator tahu angka ini bukan statistik pertandingan.
(function (root) {
  const PICK_SLOTS = 5;
  const BAN_SLOTS = 5;

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function heroIds(list) {
    return (Array.isArray(list) ? list : []).filter((id) => typeof id === 'string' && id.length);
  }

  function defaultDraft() {
    return {
      visible: false,
      round: 1,
      activeSide: 'blue',
      blue: { picks: [], bans: [] },
      red: { picks: [], bans: [] },
    };
  }

  function normalizeDraft(value) {
    const fallback = defaultDraft();
    if (!isPlainObject(value)) return fallback;
    const side = (raw) => ({
      picks: heroIds(raw?.picks).slice(0, PICK_SLOTS),
      bans: heroIds(raw?.bans).slice(0, BAN_SLOTS),
    });
    const round = Number(value.round);
    return {
      visible: value.visible === true,
      round: Number.isFinite(round) ? Math.max(1, Math.min(15, Math.round(round))) : 1,
      activeSide: value.activeSide === 'red' ? 'red' : 'blue',
      blue: side(value.blue),
      red: side(value.red),
    };
  }

  // Matriks bisa datang dari build (lengkap) atau dari cache lokal yang sudah kadaluarsa.
  // Hero yang tidak ada di matriks harus tetap bisa dianalisis sebagai netral, bukan
  // membuat crash seluruh overlay.
  function entryFor(matrix, heroId) {
    if (!heroId) return null;
    const source = isPlainObject(matrix?.heroes) ? matrix.heroes[heroId] : null;
    if (!isPlainObject(source)) {
      return { id: heroId, name: heroId, role: 'unknown', tier: 3, power: 0, art: '', beats: {}, loses: {}, synergy: {}, missing: true };
    }
    return {
      id: heroId,
      name: typeof source.name === 'string' && source.name ? source.name : heroId,
      role: typeof source.role === 'string' ? source.role : 'unknown',
      // Path artwork disalin apa adanya dari registry oleh build-hero-matrix.mjs. Kalau tidak
      // ikut diteruskan, overlay menebaknya sebagai /assets/heroes/<id>.png dan gagal untuk
      // hero yang nama filenya berbeda (chang_e, lapu_lapu, x_borg, yi_sun_shin).
      art: typeof source.art === 'string' ? source.art : '',
      tier: Number(source.tier) || 3,
      power: Number(source.power) || 0,
      beats: isPlainObject(source.beats) ? source.beats : {},
      loses: isPlainObject(source.loses) ? source.loses : {},
      synergy: isPlainObject(source.synergy) ? source.synergy : {},
      missing: false,
    };
  }

  function weightOf(record, key) {
    const value = Number(record?.[key]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  // Nilai matchup satu pasang dari sudut pandang `a` terhadap `b`.
  //   1. pasangan kurasi            -> paling kuat, arah persis
  //   2. relasi peran (rock-paper)  -> baseline untuk hero yang belum dikurasi
  //   3. 0                          -> netral
  function matchupValue(matrix, a, b) {
    const left = entryFor(matrix, a);
    const right = entryFor(matrix, b);
    if (!left || !right) return { value: 0, kind: 'none' };
    if (left.missing || right.missing) return { value: 0, kind: 'unknown' };

    const beat = weightOf(left.beats, right.id);
    if (beat) return { value: beat, kind: 'counter' };

    const lose = weightOf(left.loses, right.id);
    if (lose) return { value: -lose, kind: 'risk' };

    const roleWeight = Number(matrix?.weights?.role) || 0;
    const relation = isPlainObject(matrix?.roleAdvantage) ? matrix.roleAdvantage[left.role] : null;
    if (roleWeight && isPlainObject(relation)) {
      if ((relation.beats || []).includes(right.role)) return { value: roleWeight, kind: 'role' };
      if ((relation.loses || []).includes(right.role)) return { value: -roleWeight, kind: 'role' };
    }
    return { value: 0, kind: 'neutral' };
  }

  function synergyValue(matrix, a, b) {
    const left = entryFor(matrix, a);
    const right = entryFor(matrix, b);
    if (!left || !right || left.missing || right.missing) return 0;
    return weightOf(left.synergy, right.id);
  }

  // Agregat satu tim: power, synergy internal, dan matchup lintas tim.
  function teamMetrics(matrix, picks, enemyPicks) {
    const ids = heroIds(picks);
    const enemies = heroIds(enemyPicks);

    let power = 0;
    for (const id of ids) power += entryFor(matrix, id)?.power || 0;

    let synergy = 0;
    const synergyPairs = [];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const value = synergyValue(matrix, ids[i], ids[j]);
        if (!value) continue;
        synergy += value;
        synergyPairs.push({ a: ids[i], b: ids[j], value });
      }
    }

    let matchup = 0;
    const matchups = [];
    for (const id of ids) {
      for (const enemyId of enemies) {
        const result = matchupValue(matrix, id, enemyId);
        if (!result.value) continue;
        matchup += result.value;
        matchups.push({ hero: id, against: enemyId, value: result.value, kind: result.kind });
      }
    }

    return { picks: ids, power, synergy, matchup, synergyPairs, matchups, score: power + synergy + matchup };
  }

  // 5 pick x power 12 = 60; matchup dan synergy masih bisa menumpuk di atas itu, jadi
  // pembagi 90 membuat draft terisi penuh bisa menjangkau ±100 tanpa selalu mentok.
  const ADVANTAGE_SPAN = 90;

  function evaluate(draft, matrix) {
    const state = normalizeDraft(draft);
    const blue = teamMetrics(matrix, state.blue.picks, state.red.picks);
    const red = teamMetrics(matrix, state.red.picks, state.blue.picks);
    const delta = blue.score - red.score;
    const advantage = Math.max(-100, Math.min(100, Math.round((delta / ADVANTAGE_SPAN) * 100)));

    return {
      visible: state.visible,
      round: state.round,
      activeSide: state.activeSide,
      // Bentuk draft yang sudah dinormalisasi. `blue`/`red` di bawah berisi metrik tim,
      // bukan slot pick/ban, jadi sisi yang sudah dinormalisasi ikut dikembalikan supaya
      // overlay bisa membedakan ban merah dari ban biru.
      draft: state,
      blue,
      red,
      advantage,
      leader: advantage > 0 ? 'blue' : advantage < 0 ? 'red' : 'tie',
      banned: [...new Set([...state.blue.bans, ...state.red.bans])],
      taken: [...new Set([...state.blue.picks, ...state.red.picks])],
      source: typeof matrix?.source === 'string' ? matrix.source : 'unknown',
      patch: typeof matrix?.patch === 'string' ? matrix.patch : '',
      notice: typeof matrix?.notice === 'string' ? matrix.notice : '',
      recommendations: {
        blue: recommend(matrix, state.blue.picks, state.red.picks, { bans: [...state.blue.bans, ...state.red.bans] }),
        red: recommend(matrix, state.red.picks, state.blue.picks, { bans: [...state.blue.bans, ...state.red.bans] }),
      },
    };
  }

  // Rekomendasi pick. Setiap kandidat dapat skor dari power + synergy + matchup + kebutuhan
  // role, dan `reasons` menjelaskan tiap komponennya supaya operator bisa menilai sendiri
  // alih-alih menerima angka tanpa konteks.
  //
  // `bans` wajib ikut dipertimbangkan: hero yang sudah di-ban tidak mungkin dipilih, jadi
  // menampilkannya sebagai rekomendasi hanya membuang slot operator.
  function recommend(matrix, ownPicks, enemyPicks, options = {}) {
    const { limit = 5, bans = [] } = isPlainObject(options) ? options : {};
    const heroes = isPlainObject(matrix?.heroes) ? matrix.heroes : {};
    const allies = heroIds(ownPicks);
    const enemies = heroIds(enemyPicks);

    const roleCount = {};
    for (const id of allies) {
      const role = entryFor(matrix, id)?.role;
      if (role && role !== 'unknown') roleCount[role] = (roleCount[role] || 0) + 1;
    }

    const taken = new Set([...allies, ...enemies, ...heroIds(bans)]);

    const candidates = [];
    for (const heroId of Object.keys(heroes)) {
      if (taken.has(heroId)) continue;
      const entry = entryFor(matrix, heroId);
      const reasons = [{ kind: 'power', label: `Power ${entry.power}`, value: entry.power }];
      let score = entry.power;

      for (const allyId of allies) {
        const value = synergyValue(matrix, heroId, allyId);
        if (!value) continue;
        score += value;
        reasons.push({ kind: 'synergy', label: `Sinergi dengan ${entryFor(matrix, allyId).name}`, value });
      }

      for (const enemyId of enemies) {
        const result = matchupValue(matrix, heroId, enemyId);
        if (!result.value) continue;
        score += result.value;
        reasons.push({
          kind: result.value > 0 ? 'counter' : 'risk',
          label: `${result.value > 0 ? 'Counter' : 'Kalah dari'} ${entryFor(matrix, enemyId).name}`,
          value: result.value,
        });
      }

      // Tim 5 orang biasanya butuh komposisi role yang cukup lengkap, tapi bonusnya kecil
      // supaya tidak menimpa matchup yang sudah dihitung.
      if (PICK_SLOTS - allies.length > 1 && !roleCount[entry.role]) {
        score += 2;
        reasons.push({ kind: 'role', label: `Butuh ${entry.role}`, value: 2 });
      }

      candidates.push({ heroId, name: entry.name, role: entry.role, tier: entry.tier, score, reasons });
    }

    candidates.sort((a, b) => b.score - a.score || a.heroId.localeCompare(b.heroId));
    return candidates.slice(0, limit);
  }

  root.DraftAnalytics = {
    PICK_SLOTS,
    BAN_SLOTS,
    ADVANTAGE_SPAN,
    defaultDraft,
    normalizeDraft,
    entryFor,
    matchupValue,
    synergyValue,
    teamMetrics,
    evaluate,
    recommend,
  };
}(globalThis));