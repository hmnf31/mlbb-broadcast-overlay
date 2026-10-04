// Panel verifikasi admin.
//
// Arah alirnya: operator mengunggah screenshot hasil match, adapter OCR (bila ada yang
// terpasang) mencoba membaca angka, lalu operator MEMBANDINGKAN bacaan itu dengan nilai final
// sebelum push. Kolom "nilai final" adalah satu-satunya yang boleh sampai ke stream.
//
// Verifikasi sengaja hanya menyentuh Field Lock gameplay. Layar hasil dan layar draft punya
// editor sendiri di control panel; menyatukannya di sini justru membuat batas Field Lock
// kabur dan membuat test suite sulit ditugaskan.
const Kit = window.ProfileKit;
const Adapter = window.OcrAdapter;
const slug = Kit.slugFromPath();

const FIELD_LABELS = {
  timer: 'Timer',
  blueKills: 'Kill Blue',
  redKills: 'Kill Merah',
  blueGold: 'Gold Blue',
  redGold: 'Gold Merah',
  lordBlue: 'Lord Blue',
  lordRed: 'Lord Merah',
  towerBlue: 'Tower Blue',
  towerRed: 'Tower Merah',
};

const ui = {
  nav: document.getElementById('verify-nav'),
  provider: document.getElementById('verify-provider'),
  claim: document.getElementById('verify-claim'),
  file: document.getElementById('capture-file'),
  screen: document.getElementById('capture-screen'),
  input: document.getElementById('capture-input'),
  hint: document.getElementById('capture-hint'),
  image: document.getElementById('capture-image'),
  empty: document.getElementById('capture-empty'),
  run: document.getElementById('capture-run'),
  captureStatus: document.getElementById('capture-status'),
  rows: document.getElementById('verify-rows'),
  filled: document.getElementById('summary-filled'),
  diffs: document.getElementById('summary-diffs'),
  rejected: document.getElementById('summary-rejected'),
  visible: document.getElementById('summary-visible'),
  push: document.getElementById('push-button'),
  reset: document.getElementById('reset-button'),
  pushStatus: document.getElementById('push-status'),
};

let ownerKey = '';
let screenshot = null;
// Regions dari halaman kalibrasi OCR. Snapshot sengaja tidak membawa `ocr` (k.dk cukup
// besar), jadi taken dari endpoint aux terpisah.
let regions = {};
let ocrWorker = null;

// Provider yang dipakai panel ini. `tesseract` sudah jadi dependency halaman debug, jadi
// tidak ada CDN baru dan tidak ada binding native. Kalau engine gagal dimuat, panel
// otomatis jatuh ke `manual` dan operator mengetik sendiri.
let ACTIVE_PROVIDER = 'tesseract';

const cropCanvas = document.createElement('canvas');

function cropRegion(image, region) {
  const canvas = cropCanvas;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const x = Math.round(region.x * image.naturalWidth);
  const y = Math.round(region.y * image.naturalHeight);
  const width = Math.max(1, Math.round(region.w * image.naturalWidth));
  const height = Math.max(1, Math.round(region.h * image.naturalHeight));
  canvas.width = width;
  canvas.height = height;
  // Grayscale + kontras adalah preprocessing yang sama dengan halaman debug. Tanpa ini
  // angka HUD kecil jauh lebih sering salah baca.
  context.filter = 'grayscale(1) contrast(1.6)';
  context.drawImage(image, x, y, width, height, 0, 0, width, height);
  context.filter = 'none';
  return canvas;
}

async function getWorker() {
  if (ocrWorker) return ocrWorker;
  if (!window.Tesseract) throw new Error('Engine OCR belum termuat. Periksa koneksi internet lalu muat ulang.');
  ocrWorker = await window.Tesseract.createWorker('eng', 1, {
    logger: () => {},
    errorHandler: () => {},
  });
  return ocrWorker;
}

function registerProviders() {
  Adapter.register({
    id: 'tesseract',
    label: 'Tesseract.js (dalam browser)',
    tier: 'auto',
    note: 'Engine OCR yang sama dengan halaman kalibrasi. Membaca ROI per field dari screenshot.',
    recognize: async ({ image, regions: roi }) => {
      if (!image) return { readings: {} };
      const element = await loadImageElement(image);
      const available = Object.entries(roi || {}).filter(([, region]) => region && Number.isFinite(region.x));
      if (!available.length) return { readings: {} };
      const worker = await getWorker();
      const readings = {};
      for (const [field, region] of available) {
        const result = await worker.recognize(cropRegion(element, region));
        const rawText = String(result?.data?.text || '').trim();
        const value = window.OcrParse.parseRecognizedValue(field, rawText);
        // Field yang tidak menghasilkan angka sengaja dilewati, bukan diisi 0: angka 0
        // yang salah lebih berbahaya daripada field kosong, karena terlihat benar.
        if (value === null || value === undefined) continue;
        readings[field] = { value, rawText, confidence: Number(result?.data?.confidence) || 0 };
      }
      return { readings };
    },
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Gambar tidak bisa dimuat.')));
    image.src = src;
  });
}
// Nilai final operator. Ini yang dipush; bacaan adapter hanya bahan pembanding.
const finalValues = {};
// Bacaan terakhir dari adapter per field: { value, rawText, confidence }
let readings = {};
let lockedFields = new Set();

function setStatus(element, message, tone = '') {
  element.textContent = message;
  if (tone) element.dataset.tone = tone;
  else delete element.dataset.tone;
}

function isLocked(field) {
  return lockedFields.has(field);
}

function buildRows() {
  ui.rows.replaceChildren();
  for (const field of Adapter.FIELDS) {
    const row = document.createElement('tr');
    row.dataset.field = field;
    row.dataset.locked = isLocked(field) ? 'true' : 'false';
    row.dataset.diff = 'false';

    const label = document.createElement('td');
    label.textContent = FIELD_LABELS[field] || field;

    const detected = document.createElement('td');
    detected.className = 'verify-row-detected';
    detected.textContent = '-';

    const confidence = document.createElement('td');
    confidence.className = 'verify-row-confidence';
    confidence.textContent = '-';

    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(finalValues[field] ?? '');
    input.addEventListener('input', () => {
      finalValues[field] = input.value === '' ? '' : Number(input.value);
      renderSummary();
    });

    const source = document.createElement('td');
    source.className = 'verify-row-source';
    source.textContent = isLocked(field) ? 'lock' : 'manual';

    row.append(label, detected, confidence, input, source);
    ui.rows.append(row);
  }
}

function renderRows() {
  for (const row of ui.rows.children) {
    const field = row.dataset.field;
    const reading = readings[field];
    const detected = row.querySelector('.verify-row-detected');
    const confidence = row.querySelector('.verify-row-confidence');
    const source = row.querySelector('.verify-row-source');

    if (reading) {
      detected.textContent = reading.rawText || String(reading.value);
      confidence.textContent = `${reading.confidence}%`;
      confidence.dataset.low = reading.confidence < 70 ? 'true' : 'false';
    } else {
      detected.textContent = '-';
      confidence.textContent = '-';
      delete confidence.dataset.low;
    }

    // Baris berubah kuning kalau operator mengoreksi angka: justru hal paling penting
    // untuk dilihat sebelum push, karena itu nilai yang tidak lagi sama dengan bacaan.
    const differs = Boolean(reading) && finalValues[field] !== '' && Number(finalValues[field]) !== reading.value;
    row.dataset.diff = differs ? 'true' : 'false';
    source.textContent = isLocked(field) ? 'lock' : (reading ? 'adapter → manual' : 'manual');
  }
}

function renderSummary() {
  let filled = 0;
  let diffs = 0;
  let rejected = 0;
  for (const field of Adapter.FIELDS) {
    if (finalValues[field] !== '' && finalValues[field] !== undefined) filled += 1;
    if (readings[field] && finalValues[field] !== '' && Number(finalValues[field]) !== readings[field].value) diffs += 1;
    // Bacaan yang ditolak lock tetap dihitung supaya operator tahu ada yang tidak terpakai.
    if (readings[field] && isLocked(field)) rejected += 1;
  }
  ui.filled.textContent = `${filled} / ${Adapter.FIELDS.length}`;
  ui.diffs.textContent = String(diffs);
  ui.rejected.textContent = String(rejected);
}

async function loadRegions() {
  if (!slug) return;
  const result = await Kit.fetchAux(slug, 'ocr');
  regions = result.ok && result.value?.regions ? result.value.regions : {};
  const count = Object.keys(regions).length;
  const hint = document.getElementById('capture-hint');
  if (hint && screenshot) {
    hint.textContent = count
      ? `Gambar siap. ${count} ROI tersimpan, adapter akan membacanya.`
      : 'Gambar siap, tapi belum ada ROI yang dikalibrasi. Setel ROI di halaman Kalibrasi OCR dulu, atau isi manual.';
  }
}

async function runAdapter() {
  if (!screenshot) {
    setStatus(ui.captureStatus, 'Belum ada gambar. Unggah screenshot dulu.', 'error');
    return;
  }
  setStatus(ui.captureStatus, 'Menjalankan adapter…');
  const result = await Adapter.recognize(ACTIVE_PROVIDER, { image: screenshot, regions });
  if (!result.ok) {
    // Engine tidak tersedia bukan berarti panel harus mati. Jatuh ke input manual dan
    // katakan terus terang, jangan diam-diam menampilkan tabel kosong.
    if (ACTIVE_PROVIDER !== 'manual') {
      ACTIVE_PROVIDER = 'manual';
      renderProviderList();
      setStatus(ui.captureStatus, `${result.error} Beralih ke input manual.`, 'error');
      return;
    }
    setStatus(ui.captureStatus, result.error, 'error');
    // Kegagalan adapter tidak boleh menghapus nilai manual yang sudah diisi operator.
    return;
  }
  const rejected = [];
  for (const [field, reading] of Object.entries(result.readings)) {
    if (isLocked(field)) {
      rejected.push(field);
      continue;
    }
    readings[field] = applyTimerRule(field, reading);
    // Isi nilai final hanya kalau operator belum mengisinya sendiri.
    if (finalValues[field] === '' || finalValues[field] === undefined) finalValues[field] = reading.value;
  }
  renderRows();
  renderSummary();
  const tone = rejected.length ? 'error' : 'ok';
  setStatus(
    ui.captureStatus,
    `${Object.keys(result.readings).length} field terbaca${rejected.length ? `, ${rejected.length} ditolak karena lock (${rejected.join(', ')})` : ''}.`,
    tone,
  );
}

function loadImage(dataUrl) {
  screenshot = dataUrl;
  ui.image.setAttribute('src', dataUrl);
  ui.empty.hidden = Boolean(dataUrl);
  const count = Object.keys(regions).length;
  ui.hint.textContent = dataUrl
    ? (count
      ? `Gambar siap. ${count} ROI tersimpan, adapter akan membacanya.`
      : 'Gambar siap, tapi belum ada ROI yang dikalibrasi. Setel ROI di halaman Kalibrasi OCR dulu, atau isi manual.')
    : 'Belum ada gambar. Unggah screenshot hasil match untuk membandingkan dengan angka di bawah.';
}

// Bacaan timer juga lewat OcrTimer, sama seperti halaman kalibrasi, supaya kedua halaman
// tidak bisa berbeda pendapat soal angka timer. Bedanya di sini: adapter membaca satu
// screenshot, jadi tracker praktis dipakai sebagai penjelasan kenapa angka diterima atau
// ditahan -- operator tetap yang memutuskan nilai final.
const timerTracker = window.OcrTimer?.createTracker() ?? null;

function applyTimerRule(field, reading) {
  if (field !== 'timer' || !timerTracker) return reading;
  const outcome = timerTracker.observe(reading.value, Date.now(), reading.confidence);
  return {
    ...reading,
    value: outcome.value ?? reading.value,
    note: window.OcrTimer.REASON_TEXT[outcome.reason] || outcome.reason,
  };
}

function refreshFromState(payload) {
  const match = payload?.match || {};
  lockedFields = new Set(
    Object.entries(payload?.ocr?.modes || {})
      .filter(([, mode]) => mode === 'lock' || mode === 'manual')
      .map(([field]) => field),
  );
  // Baris tidak ditulis ulang dari state: operator yang mengunci field justru sedang
  // memulasikan angka itu, jadi nilainya harus dibiarkan seperti yang dia isi.
  const seed = {
    timer: match.timer,
    blueKills: match.blueKills,
    redKills: match.redKills,
    blueGold: match.blueGold,
    redGold: match.redGold,
    lordBlue: match.lordBlue,
    lordRed: match.lordRed,
    towerBlue: match.towerBlue,
    towerRed: match.towerRed,
  };
  for (const [field, value] of Object.entries(seed)) {
    if (value === undefined || value === null) continue;
    if (isLocked(field)) continue;
    if (finalValues[field] === '' || finalValues[field] === undefined) finalValues[field] = Number(value) || 0;
  }
  const visible = Boolean(payload?.presentation?.resultVisible ?? payload?.result?.visible);
  ui.visible.textContent = visible ? 'result' : 'gameplay';
  buildRows();
  renderRows();
  renderSummary();
}

async function pushToStream() {
  if (!slug || !ownerKey) {
    setStatus(ui.pushStatus, 'ownerKey belum siap. Klaim profil ini dulu.', 'error');
    return;
  }
  const readingsPayload = {};
  for (const field of Adapter.FIELDS) {
    const value = finalValues[field];
    if (value === '' || value === undefined || Number.isNaN(Number(value))) continue;
    readingsPayload[field] = { value: Number(value), rawText: String(value), confidence: readings[field]?.confidence ?? 0 };
  }
  // Server menegakkan Field Lock; field lock yang lolos dari UI pun ditolak di sana. Jadi
  // angka yang ditolak tidak pernah sampai stream walau UI salah.
  const response = await Kit.pushOcrReadings(slug, readingsPayload, null, ownerKey);
  if (!response.ok) {
    setStatus(ui.pushStatus, `Gagal push: ${response.error || response.status}`, 'error');
    return;
  }
  const rejected = response.rejected || [];
  setStatus(
    ui.pushStatus,
    `${(response.applied || []).length} field diterapkan${rejected.length ? `, ${rejected.length} ditolak oleh Field Lock` : ''}.`,
    rejected.length ? 'error' : 'ok',
  );
}

function resetLocal() {
  for (const field of Object.keys(finalValues)) delete finalValues[field];
  readings = {};
  buildRows();
  renderRows();
  renderSummary();
  setStatus(ui.pushStatus, 'Tabel dikosongkan. Nilai di overlay tidak berubah sampai kamu push.');
}

function renderProviderList() {
  const providers = Adapter.list();
  const active = providers.find((provider) => provider.id === ACTIVE_PROVIDER);
  ui.provider.textContent = providers.length
    ? `Provider: ${providers.map((provider) => `${provider.label} [${provider.tier}]`).join(' · ')}${active ? ` · dipakai: ${active.label}` : ''}`
    : 'Provider: tidak ada';
  ui.provider.title = providers.map((provider) => provider.note).filter(Boolean).join('\n');
}

function initCapture() {
  ui.file.addEventListener('click', () => ui.input.click());
  ui.input.addEventListener('change', () => {
    const file = ui.input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => loadImage(String(reader.result || '')));
    reader.readAsDataURL(file);
  });
  ui.screen.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus(ui.captureStatus, 'Browser ini tidak mendukung tangkapan layar.', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      track.stop();
      loadImage(canvas.toDataURL('image/png'));
    } catch (error) {
      setStatus(ui.captureStatus, `Tangkapan layar dibatalkan: ${error.message}`, 'error');
    }
  });
  ui.run.addEventListener('click', runAdapter);
  ui.push.addEventListener('click', pushToStream);
  ui.reset.addEventListener('click', resetLocal);
}

Kit.renderNav(ui.nav);

const socket = window.LiveSocket.create({
  role: 'overlay',
  slug,
  onStatus: (state) => {
    if (state === 'online') ui.claim.textContent = 'live tersambung';
    if (state === 'offline') ui.claim.textContent = 'live terputus, menyambung ulang…';
  },
  onMessage: (message) => {
    if (message.type === 'auth_ok') {
      ownerKey = message.role === 'owner' ? ownerKey : '';
      ui.claim.textContent = message.claimed ? message.message : 'profil belum diklaim (mode baca saja)';
    }
    if (message.type === 'snapshot' && message.payload) refreshFromState(message.payload);
  },
});

ownerKey = Kit.ownerKeyFor(slug) || '';
registerProviders();
renderProviderList();
loadRegions();
initCapture();
buildRows();
renderRows();
renderSummary();
socket.start();