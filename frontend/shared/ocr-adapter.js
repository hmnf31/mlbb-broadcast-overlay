// Kontrak adapter OCR.
//
// Kenapa file ini ada: UPDATE2.md meminta OpenCV + PaddleOCR untuk pencocokan item dan hero
// lewat template matching. Keduanya butuh binding native dan tidak bisa jalan di Cloudflare
// Worker, jadi mesin OCR itu tidak bisa jadi syarat runtime produksi.
//
// Yang dipasang di sini adalah PIPELINE-nya, bukan mesinnya: satu kontrak `recognize()` yang
// mengembalikan bacaan per field, plus daftar provider yang boleh didaftarkan. Halaman
// verifikasi memakai kontrak ini tidak peduli dari mana bacaan datang, jadi mesin OCR asli
// bisa ditambahkan nanti tanpa menyentuh halaman verifikasi maupun state di server.
//
// Provider bawaan `manual` sengaja tidak mengenali apa pun: kalau tidak ada engine yang
// terpasang, panel harus jujur dan minta input manual, bukan mengarang bacaan dengan
// confidence palsu.
(function (root) {
  const providers = new Map();

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  // Field yang boleh diisi adapter. Sama dengan field Field Lock di server supaya satu
  // bacaan yang lolos di sini juga tidak ditolak server karena nama fieldnya beda.
  // Turtle sengaja tidak ada: hanya Lord dan Tower yang discan OCR. Jumlah turtle diisi
// manual di control panel, jadi membiarkan adapter mengirimkannya hanya menambah bacaan
// yang pasti ditolak worker.
const FIELDS = [
    'timer', 'blueKills', 'redKills', 'blueGold', 'redGold',
    'lordBlue', 'lordRed', 'towerBlue', 'towerRed',
  ];

  function register(provider) {
    if (!isPlainObject(provider) || typeof provider.id !== 'string' || !provider.id) return false;
    if (typeof provider.recognize !== 'function') return false;
    providers.set(provider.id, {
      id: provider.id,
      label: typeof provider.label === 'string' && provider.label ? provider.label : provider.id,
      tier: provider.tier === 'manual' ? 'manual' : 'auto',
      note: typeof provider.note === 'string' ? provider.note : '',
      needsRegions: provider.needsRegions !== false,
      recognize: provider.recognize,
    });
    return true;
  }

  function list() {
    return [...providers.values()].map(({ recognize, ...rest }) => rest);
  }

  function has(providerId) {
    return providers.has(providerId);
  }

  // Bentuk hasil yang dijamin: `readings` = { field: { value, rawText, confidence } }.
  // Field di luar FIELDS atau nilai non-number dibuang di sini, jadi adapter tidak perlu
  // menyortir sendiri dan server tidak pernah menerima field tak dikenal.
  function normalizeReadings(raw) {
    const source = isPlainObject(raw) ? raw : {};
    const readings = {};
    for (const field of FIELDS) {
      const entry = source[field];
      if (!isPlainObject(entry)) continue;
      const numeric = Number(entry.value);
      if (!Number.isFinite(numeric)) continue;
      const confidence = Number(entry.confidence);
      readings[field] = {
        value: numeric,
        rawText: typeof entry.rawText === 'string' ? entry.rawText.slice(0, 64) : String(numeric),
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 0,
      };
    }
    return readings;
  }

  async function recognize(providerId, options = {}) {
    const provider = providers.get(providerId);
    if (!provider) return { ok: false, error: `Provider tidak terdaftar: ${providerId}` };
    try {
      const produced = await provider.recognize({
        image: options.image || null,
        regions: isPlainObject(options.regions) ? options.regions : {},
      });
      const readings = normalizeReadings(produced?.readings);
      // Provider yang mengembalikan apa pun tetap dianggap gagal kalau tidak menghasilkan
      // satu pun field valid: panel lebih baik menampilkan "tidak terbaca" daripada
      // menimpa angka yang sudah benar dengan hasil yang tidak berarti.
      if (!Object.keys(readings).length) {
        return { ok: false, error: provider.tier === 'manual'
          ? 'Provider manual tidak menghasilkan bacaan. Isi sendiri di panel.'
          : 'Provider tidak menghasilkan field yang valid.', readings: {} };
      }
      return { ok: true, provider: provider.id, tier: provider.tier, readings };
    } catch (error) {
      return { ok: false, error: `Provider gagal: ${error.message}` };
    }
  }

  // Provider bawaan. Sengaja tidak mengenali apa pun supaya alur verifikasi tetap bisa
  // diuji end-to-end tanpa engine OCR yang terpasang.
  register({
    id: 'manual',
    label: 'Input manual (tanpa OCR)',
    tier: 'manual',
    needsRegions: false,
    note: 'Engine OCR belum dipasang. Isi angka hasil bacaanmanual di panel ini, lalu push.',
    recognize: async () => ({ readings: {} }),
  });

  root.OcrAdapter = { FIELDS, register, list, has, recognize, normalizeReadings };
}(globalThis));