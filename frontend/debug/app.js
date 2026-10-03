// ROI OCR runs on a second device, so it writes to the same profile as the control
// panel. It authenticates as owner, which is why it needs the local ownerKey.
const Kit = window.ProfileKit;
const slug = Kit.slugFromPath();
const ownerKey = slug ? Kit.ownerKeyFor(slug) : '';
const configKey = slug ? `mlbb_overlay_config_${slug}` : 'mlbb_overlay_config';
const defaultRegions = {
  timer: { label: 'Time', group: 'blue', x: 0.455, y: 0.02, w: 0.09, h: 0.07 },
  blueKills: { label: 'Kill Biru', group: 'blue', x: 0.36, y: 0.07, w: 0.055, h: 0.065 },
  redKills: { label: 'Kill Merah', group: 'red', x: 0.585, y: 0.07, w: 0.055, h: 0.065 },
  blueGold: { label: 'Gold Biru', group: 'blue', x: 0.02, y: 0.02, w: 0.12, h: 0.07 },
  redGold: { label: 'Gold Merah', group: 'red', x: 0.86, y: 0.02, w: 0.12, h: 0.07 },
  // Turtle tidak punya ROI: hanya Lord dan Tower yang discan OCR. Jumlah turtle diisi
  // manual lewat tombol +/- di control panel, jadi tidak ada area gambar untuk discan.
  lordBlue: { label: 'Lord Biru', group: 'blue', x: 0.30, y: 0.21, w: 0.055, h: 0.06 },
  lordRed: { label: 'Lord Merah', group: 'red', x: 0.645, y: 0.21, w: 0.055, h: 0.06 },
  towerBlue: { label: 'Tower Biru', group: 'blue', x: 0.30, y: 0.28, w: 0.055, h: 0.06 },
  towerRed: { label: 'Tower Merah', group: 'red', x: 0.645, y: 0.28, w: 0.055, h: 0.06 },
};
const requiredFields = ['timer', 'blueKills', 'redKills', 'blueGold', 'redGold'];
const optionalFields = ['lordBlue', 'lordRed', 'towerBlue', 'towerRed'];
const allFields = [...requiredFields, ...optionalFields];
const defaultModes = { lord: 'auto', tower: 'manual' };
const stage = document.getElementById('source-frame');
const image = document.getElementById('source-image');
const video = document.getElementById('source-video');
const roiLayer = document.getElementById('roi-layer');
const status = document.getElementById('status');
const results = document.getElementById('results');
const captureButton = document.getElementById('capture-screen');
const testButton = document.getElementById('test-ocr');
const startLiveButton = document.getElementById('start-live-ocr');
const stopLiveButton = document.getElementById('stop-live-ocr');
const liveLink = document.getElementById('live-link');
Kit.renderNav(document.getElementById('profile-nav'), { active: 'debug' });
let screenStream = null;
let activeSource = null;
let ocrWorker = null;
let ocrRunning = false;
let currentRegions = loadRegions();
let liveLinkState = 'Menunggu koneksi live server.';

// OCR hanya boleh mengubah angka yang tampil kalau bacaannya lolos gerbang validasi.
// Anchor disimpan di luar observernya supaya reset anchor (atau anchor baru dari server di
// sesi berikutnya) tidak hilang saat halaman dimuat ulang.
const savedOcr = getConfig().ocr || {};
const ocrGuard = window.OcrGuard.createGuard({
  anchor: savedOcr.anchor || {},
  thresholds: savedOcr.thresholds || {},
  majorityFields: ['lordBlue', 'lordRed', 'towerBlue', 'towerRed'],
  onReanchor: () => {
    status.textContent = 'Anchor OCR direset: angka turun jauh dan stabil, ini game baru.';
  },
});

function saveAnchor() {
  const config = getConfig();
  config.ocr = { ...(config.ocr || {}), anchor: ocrGuard.anchor() };
  localStorage.setItem(configKey, JSON.stringify(config));
}

const ocrSocket = window.LiveSocket.create({
  role: 'ocr',
  slug,
  ownerKey,
  onStatus: (state, info) => {
    if (state === 'online' && info.authState === 'viewer') {
      liveLinkState = 'Terhubung, tapi ownerKey tidak cocok. Update OCR tidak akan terkirim.';
    } else if (state === 'online') {
      liveLinkState = 'Live server tersambung.';
    } else if (state === 'connecting') {
      liveLinkState = `Menyambung ke ${info.detail || 'live server'}...`;
    } else if (state === 'offline') {
      liveLinkState = 'Live server terputus, mencoba menyambung lagi...';
    }
    if (liveLink) {
      liveLink.dataset.state = state;
      liveLink.textContent = liveLinkState;
    }
  },
  onMessage: () => {},
});

ocrSocket.start();
liveLink?.addEventListener('click', () => ocrSocket.reconnectNow('permintaan operator'));

function getConfig() {
  return JSON.parse(localStorage.getItem(configKey) || '{}');
}

function loadRegions() {
  const config = getConfig();
  return { ...defaultRegions, ...(config.ocr?.regions || {}) };
}

function getActiveFields() {
  const modes = { ...defaultModes, ...(getConfig().ocr?.modes || {}) };
  return [
    ...requiredFields,
    ...(modes.lord === 'auto' ? ['lordBlue', 'lordRed'] : []),
    ...(modes.tower === 'auto' ? ['towerBlue', 'towerRed'] : []),
  ];
}

function saveRegions() {
  const config = getConfig();
  config.ocr = {
    ...(config.ocr || {}),
    enabled: getActiveFields(),
    regions: currentRegions,
  };
  localStorage.setItem(configKey, JSON.stringify(config));
  saveOcrConfigToServer();
}

// Server adalah sumber utama ROI: halaman ini bisa dibuka dari perangkat kedua, jadi ROI
// tidak boleh ikut hilang bersama localStorage browser tersebut. localStorage tetap dipakai
// sebagai cache supaya halaman tetap jalan saat offline.
let ocrConfigSaveTimer = null;
function saveOcrConfigToServer() {
  if (!slug || !ownerKey) return;
  clearTimeout(ocrConfigSaveTimer);
  ocrConfigSaveTimer = setTimeout(async () => {
    const saved = getConfig().ocr || {};
    const result = await Kit.pushAux(slug, 'ocr', {
      enabled: true,
      regions: currentRegions,
      modes: saved.modes || {},
      thresholds: saved.thresholds || {},
      anchor: ocrGuard.anchor(),
    }, ownerKey);
    if (!result.ok) {
      status.textContent = `ROI tersimpan di browser, tapi gagal ke server: ${result.error || result.status}`;
    }
  }, 400);
}

async function loadOcrConfigFromServer() {
  if (!slug) return false;
  const result = await Kit.fetchAux(slug, 'ocr');
  if (!result.ok) return false;
  const remote = result.value || {};
  const config = getConfig();
  config.ocr = {
    ...(config.ocr || {}),
    modes: { ...(config.ocr?.modes || {}), ...(remote.modes || {}) },
    thresholds: { ...(config.ocr?.thresholds || {}), ...(remote.thresholds || {}) },
    anchor: remote.anchor || config.ocr?.anchor || {},
  };
  if (remote.regions && Object.keys(remote.regions).length) {
    currentRegions = { ...defaultRegions, ...remote.regions };
  }
  localStorage.setItem(configKey, JSON.stringify(config));
  return true;
}

function renderRegions() {
  roiLayer.replaceChildren();
  allFields.forEach((key) => {
    const region = currentRegions[key];
    const box = document.createElement('div');
    box.className = 'roi';
    box.dataset.key = key;
    box.dataset.group = region.group;
    box.style.left = `${region.x * 100}%`;
    box.style.top = `${region.y * 100}%`;
    box.style.width = `${region.w * 100}%`;
    box.style.height = `${region.h * 100}%`;
    box.innerHTML = `<span class="roi-label">${region.label}</span>`;
    box.addEventListener('pointerdown', startDrag);
    box.addEventListener('pointerup', saveBoxSize);
    box.addEventListener('pointercancel', saveBoxSize);
    roiLayer.append(box);
  });
}

function startDrag(event) {
  if (event.target !== event.currentTarget && event.target.classList.contains('roi-label')) {
    event.preventDefault();
  }
  const box = event.currentTarget;
  const bounds = stage.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const startLeft = box.offsetLeft;
  const startTop = box.offsetTop;
  const handleSize = 20;
  const resizing = event.clientX > bounds.left + startLeft + box.offsetWidth - handleSize
    && event.clientY > bounds.top + startTop + box.offsetHeight - handleSize;
  if (resizing) return;
  event.preventDefault();
  box.setPointerCapture(event.pointerId);

  const move = (moveEvent) => {
    const left = Math.min(Math.max(0, startLeft + moveEvent.clientX - startX), bounds.width - box.offsetWidth);
    const top = Math.min(Math.max(0, startTop + moveEvent.clientY - startY), bounds.height - box.offsetHeight);
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
  };
  const finish = () => {
    box.removeEventListener('pointermove', move);
    box.removeEventListener('pointerup', finish);
    box.removeEventListener('pointercancel', finish);
    saveBoxSize({ currentTarget: box });
  };
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', finish);
  box.addEventListener('pointercancel', finish);
}

function saveBoxSize(event) {
  const box = event.currentTarget;
  const bounds = stage.getBoundingClientRect();
  const key = box.dataset.key;
  currentRegions[key] = {
    ...currentRegions[key],
    x: box.offsetLeft / bounds.width,
    y: box.offsetTop / bounds.height,
    w: box.offsetWidth / bounds.width,
    h: box.offsetHeight / bounds.height,
  };
  saveRegions();
}

function setImageSource(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  image.src = url;
  image.style.display = 'block';
  video.style.display = 'none';
  video.classList.add('capture-source');
  document.getElementById('source-placeholder').style.display = 'none';
  activeSource = image;
  image.onload = () => {
    status.textContent = `Screenshot siap (${image.naturalWidth} x ${image.naturalHeight}). Atur kotak ROI lalu jalankan tes.`;
  };
}

async function captureScreen() {
  try {
    if (screenStream) screenStream.getTracks().forEach((track) => track.stop());
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
    video.srcObject = screenStream;
    await video.play();
    video.classList.remove('capture-source');
    video.style.display = 'block';
    image.style.display = 'none';
    document.getElementById('source-placeholder').style.display = 'none';
    activeSource = video;
    status.textContent = `Capture aktif (${video.videoWidth} x ${video.videoHeight}). Pilih layar game, bukan tab kalibrasi.`;
    screenStream.getVideoTracks()[0].addEventListener('ended', () => {
      activeSource = null;
      video.style.display = 'none';
      video.classList.add('capture-source');
      document.getElementById('source-placeholder').style.display = 'grid';
      status.textContent = 'Capture layar dihentikan.';
    }, { once: true });
  } catch (error) {
    status.textContent = `Capture layar gagal: ${error.message}`;
  }
}

function getSourceSize(source) {
  if (source === video) return { width: video.videoWidth, height: video.videoHeight };
  return { width: image.naturalWidth, height: image.naturalHeight };
}

function getCrop(source, region) {
  const { width, height } = getSourceSize(source);
  const canvas = document.getElementById('crop-canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const x = Math.round(region.x * width);
  const y = Math.round(region.y * height);
  const cropWidth = Math.max(1, Math.round(region.w * width));
  const cropHeight = Math.max(1, Math.round(region.h * height));
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  context.filter = 'grayscale(1) contrast(1.6)';
  context.drawImage(source, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  context.filter = 'none';
  return canvas;
}

function parseRecognizedValue(key, rawText) {
  // Implementasi parsing dipindah ke shared/ocr-parse.js supaya halaman ini dan panel
  // verifikasi tidak bisa berbeda. Logikanya tidak diubah saat dipindah.
  return window.OcrParse.parseRecognizedValue(key, rawText);
}

async function connectAndSend(matchUpdate) {
  if (slug) {
    const result = await Kit.pushOcrReadings(slug, matchUpdate, ocrGuard.anchor(), ownerKey);
    if (result.ok) {
      const blocked = result.rejected.length
        ? ` ${result.rejected.length} field terkunci (Field Lock) diabaikan.`
        : '';
      return { sent: true, detail: blocked };
    }
    if (result.error === 'ownerKey belum dipasang.') {
      status.textContent = 'Update ditolak: ownerKey tidak dipasang di perangkat ini. Pasang lewat Beranda > Alat ownerKey.';
      return { sent: false, detail: '' };
    }
    // Socket dan endpoint readings sama-sama gagal: pakai jalur state biasa supaya
    // broadcast tetap tidak hilang.
    const fallbackResult = ocrSocket.send({ type: 'update', payload: { match: matchUpdate } });
    if (fallbackResult === 'rejected') {
      status.textContent = 'Update ditolak: ownerKey tidak cocok atau profil belum diklaim.';
      return { sent: false, detail: '' };
    }
    return { sent: fallbackResult === 'sent', detail: ' (jalur fallback)' };
  }

  const result = ocrSocket.send({ type: 'update', payload: { match: matchUpdate } });
  if (result === 'rejected') {
    status.textContent = 'Update ditolak: ownerKey tidak cocok atau profil belum diklaim. Pasang ownerKey lewat Beranda > Alat ownerKey.';
    return { sent: false, detail: '' };
  }
  return { sent: result === 'sent', detail: '' };
}

async function createOcrWorker() {
  if (!window.Tesseract) throw new Error('Engine OCR belum termuat. Periksa koneksi internet lalu muat ulang halaman.');
  return window.Tesseract.createWorker('eng', 1, {
    logger: (event) => {
      if (event.status) status.textContent = `Engine OCR: ${event.status}${event.progress ? ` ${Math.round(event.progress * 100)}%` : ''}`;
    },
  });
}

async function readAllRois(worker) {
  const updates = {};
  for (const key of getActiveFields()) {
    status.textContent = `Membaca ${currentRegions[key].label}...`;
    await worker.setParameters({
      tessedit_char_whitelist: key === 'timer' ? '0123456789:.' : '0123456789Kk,.',
    });
    const result = await worker.recognize(getCrop(activeSource, currentRegions[key]));
    const rawText = result.data.text.trim();
    const value = parseRecognizedValue(key, rawText);
    const confidence = Number(result.data.confidence) || 0;
    const decision = ocrGuard.decide(key, { value, rawText, confidence, at: Date.now() });

    let resultCard = document.getElementById(`result-${key}`);
    if (!resultCard) {
      resultCard = document.createElement('div');
      resultCard.className = 'result';
      resultCard.id = `result-${key}`;
      const title = document.createElement('strong');
      title.textContent = currentRegions[key].label;
      const line = document.createElement('span');
      const detail = document.createElement('small');
      resultCard.append(title, line, detail);
      results.append(resultCard);
    }
    const accepted = decision.accepted && decision.value !== null;
    const shown = accepted ? decision.value : ocrGuard.values()[key];
    const displayValue = key === 'timer' && shown !== undefined
      ? `${Math.floor(shown / 60)}:${String(shown % 60).padStart(2, '0')}`
      : shown;
    resultCard.dataset.accepted = String(accepted);
    resultCard.dataset.decision = decision.reason;
    resultCard.querySelector('span').textContent = `${rawText || '(kosong)'} | ${Math.round(confidence)}% | nilai: ${displayValue ?? '-'}`;
    resultCard.querySelector('small').textContent = decision.accepted
      ? decision.reasonText
      : `${decision.reasonText} - ditolak, angka di overlay tidak berubah`;

    if (accepted) updates[key] = decision.value;
  }
  return updates;
}

function persistOcrResult(updates) {
  const savedConfig = getConfig();
  savedConfig.match = { ...(savedConfig.match || {}), ...updates };
  savedConfig.ocr = {
    ...(savedConfig.ocr || {}),
    enabled: getActiveFields(),
    regions: currentRegions,
    lastTest: updates,
    anchor: ocrGuard.anchor(),
  };
  localStorage.setItem(configKey, JSON.stringify(savedConfig));
}

async function runOcr() {
  if (!activeSource) {
    status.textContent = 'Pilih layar/game atau screenshot terlebih dahulu.';
    return;
  }
  if (ocrRunning) {
    status.textContent = 'Tes satu kali tidak berjalan saat OCR Live aktif.';
    return;
  }

  testButton.disabled = true;
  results.replaceChildren();
  try {
    ocrWorker = await createOcrWorker();
    const updates = await readAllRois(ocrWorker);
    persistOcrResult(updates);
    const sent = await connectAndSend(updates);
    status.textContent = `Tes selesai: ${Object.keys(updates).length}/${getActiveFields().length} ROI terbaca.${sent.detail} ${sent.sent ? 'Nilai dikirim ke overlay.' : `Nilai diantre di ${liveLinkState}`}`;
  } catch (error) {
    status.textContent = `Tes OCR gagal: ${error.message}`;
  } finally {
    if (ocrWorker) await ocrWorker.terminate();
    ocrWorker = null;
    testButton.disabled = false;
  }
}

async function startLiveOcr() {
  if (activeSource !== video || video.readyState < 2) {
    status.textContent = 'Pilih layar/game terlebih dahulu untuk OCR Live.';
    return;
  }
  if (ocrRunning) return;

  ocrRunning = true;
  testButton.disabled = true;
  startLiveButton.disabled = true;
  stopLiveButton.disabled = false;
  results.replaceChildren();

  try {
    ocrWorker = await createOcrWorker();
    while (ocrRunning && activeSource === video && video.readyState >= 2) {
      const startedAt = Date.now();
      const updates = await readAllRois(ocrWorker);
      persistOcrResult(updates);
      const sent = await connectAndSend(updates);
      status.textContent = `OCR Live aktif: ${Object.keys(updates).length}/${getActiveFields().length} ROI terbaca.${sent.detail} ${sent.sent ? 'Data terkirim ke overlay.' : `Data diantre. ${liveLinkState}`}`;
      const waitTime = Math.max(0, 1000 - (Date.now() - startedAt));
      if (ocrRunning && waitTime) await new Promise((resolve) => window.setTimeout(resolve, waitTime));
    }
  } catch (error) {
    status.textContent = `OCR Live gagal: ${error.message}`;
  } finally {
    ocrRunning = false;
    if (ocrWorker) await ocrWorker.terminate();
    ocrWorker = null;
    testButton.disabled = false;
    startLiveButton.disabled = false;
    stopLiveButton.disabled = true;
    if (activeSource !== video) {
      status.textContent = 'Capture layar berhenti; OCR Live dinonaktifkan.';
    } else if (status.textContent.startsWith('Menghentikan OCR Live')) {
      status.textContent = 'OCR Live dihentikan.';
    }
  }
}

function stopLiveOcr() {
  ocrRunning = false;
  stopLiveButton.disabled = true;
  status.textContent = 'Menghentikan OCR Live setelah pembacaan saat ini selesai...';
}

document.getElementById('image-file').addEventListener('change', (event) => setImageSource(event.target.files?.[0]));
captureButton.addEventListener('click', captureScreen);
testButton.addEventListener('click', runOcr);
startLiveButton.addEventListener('click', startLiveOcr);
stopLiveButton.addEventListener('click', stopLiveOcr);
document.getElementById('save-roi').addEventListener('click', () => {
  saveRegions();
  status.textContent = slug && ownerKey
    ? 'ROI tersimpan di server profil dan dipakai perangkat OCR mana pun.'
    : 'ROI tersimpan di browser dan akan dipakai lagi saat halaman dibuka.';
});
document.getElementById('reset-roi').addEventListener('click', () => {
  currentRegions = structuredClone(defaultRegions);
  saveRegions();
  renderRegions();
  status.textContent = 'ROI dikembalikan ke posisi contoh.';
});
document.getElementById('reset-anchor').addEventListener('click', () => {
  ocrGuard.reset();
  saveAnchor();
  saveOcrConfigToServer();
  status.textContent = 'Anchor OCR direset. Bacaan berikutnya menjadi nilai baru.';
});

renderRegions();
if (slug) {
  loadOcrConfigFromServer().then((loaded) => {
    if (loaded) {
      renderRegions();
      status.textContent = 'ROI, mode, dan anchor dimuat dari server profil ini.';
    } else if (!ownerKey) {
      status.textContent = 'Profil dimuat, tapi ownerKey belum ada di perangkat ini. OCR hanya bisa tes baca.';
    }
  });
}

window.addEventListener('beforeunload', () => {
  screenStream?.getTracks().forEach((track) => track.stop());
  ocrSocket.stop();
});
