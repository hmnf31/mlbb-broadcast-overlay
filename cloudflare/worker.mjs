import { DurableObject } from 'cloudflare:workers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SLUG = 'default';
const LEGACY_DO_NAME = 'mlbb-live-match';
const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SLUG_LENGTH = 14; // ~72 bits of entropy, unguessable
const KEY_LENGTH = 32;
const OWNER_HEADER = 'x-overlay-key';
const MAX_FRAME_CHARS = 900000;
// Hot state (timer, kills, gold, presentation) is a few KB in practice. 256 KB leaves
// generous headroom for custom items while keeping a single Durable Object storage row
// from being used as free hosting. Images travel through the assets bucket instead.
const MAX_STATE_BYTES = 512 * 1024;
const MAX_ASSETS_BYTES = 2 * 1024 * 1024;
const HEARTBEAT_INTERVAL_MS = 30000;
const SITE_KEY = 'site';
const SCHEMA_VERSION = 1;

const STATE_KEY = 'matchState';
const ASSETS_KEY = 'assets';
const PROFILE_KEY = 'profile';
const OCR_KEY = 'ocr';
const RESULT_KEY = 'result';
const PLAYERS_KEY = 'players';
const DRAFT_KEY = 'draft';
const MIGRATED_KEY = 'migratedFromLegacy';

const PAGE_FILES = {
  'control': '/frontend/control/index.html',
  'overlay/gameplay': '/frontend/overlay/gameplay/index.html',
  'overlay/result': '/frontend/overlay/result/index.html',
  'overlay/draft': '/frontend/overlay/draft/index.html',
  'verify': '/frontend/verify/index.html',
  'debug': '/frontend/debug/index.html',
};

const TEMPLATES = {
  'mlbb-gameplay': { label: 'MLBB Gameplay', description: 'Overlay skor live untuk match MLBB 5v5.' },
  'mlbb-result': { label: 'MLBB Result', description: 'Layar hasil match: skor seri, MVP, damage.' },
  'mlbb-draft': { label: 'MLBB Draft', description: 'Layar draft pick: ban/pick 5v5 dan advantage counter.' },
};

const BASE_TEAMS = {
  blue: { name: 'Blue Phoenix', logo: '/assets/teams/blue-phoenix.svg', kills: 0, gold: 0 },
  red: { name: 'Red Viper', logo: '/assets/teams/red-viper.svg', kills: 0, gold: 0 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, updates) {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(updates || {})) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// deepMerge()+normalisasi bo2 di satu tempat, supaya tidak ada jalur yang lupa
// membersihkan `games`.
function mergeState(state) {
  const merged = stripImageSources(deepMerge(defaultMatchState(), state || {}));
  merged.match.bo2 = normalizeBo2State(merged.match.bo2);
  return merged;
}

// BO2 menyimpan satu sumber kebenaran: `games[i].winner`. titik tiap tim DITURUNKAN dari
// sini. Kalau blue dan red punya hitungan terpisah, state bisa jadi kontradiktif (dua tim
// sama-sama merah untuk game yang sama) dan tidak ada yang mengoreksinya.
// Best-of tidak lagi dikunci di 2. Operator memilih BO2, BO3, BO4, dan seterusnya;
// jumlah game dan logika match point diturunkan dari bestOf, bukan dari angka tetap 2
// yang tersebar di worker, control, dan overlay. Rentang 2..9: di bawah 2 bukan seri,
// di atas 9 titik overlay tidak terbaca lagi dan tidak pernah dipakai.
const BO_MIN = 2;
const BO_MAX = 9;

function normalizeBestOf(value) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return BO_MIN;
  return Math.max(BO_MIN, Math.min(BO_MAX, numeric));
}

function defaultBo2State() {
  return {
    enabled: false,
    bestOf: BO_MIN,
    games: [{ winner: null }, { winner: null }],
  };
}

function normalizeBo2State(value) {
  const fallback = defaultBo2State();
  if (!isPlainObject(value)) return fallback;
  // `bestOf` dipakai hanya setelah di-clamp di sini; client boleh mengirim angka ngawur
  // dan angka itu dinormalisasi, bukan dipercaya.
  const bestOf = normalizeBestOf(value.bestOf ?? fallback.bestOf);
  const games = Array.isArray(value.games) ? value.games : [];
  return {
    enabled: Boolean(value.enabled),
    bestOf,
    games: Array.from({ length: bestOf }, (unused, index) => {
      const winner = games[index]?.winner;
      return { winner: winner === 'blue' || winner === 'red' ? winner : null };
    }),
  };
}

function defaultMatchState() {
  return {
    match: {
      id: 'match-001',
      status: 'live',
      timer: 0,
      // Anchor timer untuk tick lokal di overlay. `timer` adalah nilai pada detik `timerAt`,
      // jadi overlay bisa menghitung sendiri tiap frame tanpa ada push tiap detik dari server.
      // `timerRunning` false berarti game sedang pause dan angka ditahan.
      timerAt: null,
      timerRunning: false,
      series: { best_of: 5, score: { blue: 0, red: 0 } },
      bo2: defaultBo2State(),
      objective: {
        turret: { blue: 0, red: 0 },
        turtle: { blue: 0, red: 0 },
        lord: { blue: 0, red: 0 },
      },
      blueKills: 0,
      redKills: 0,
      blueGold: 0,
      redGold: 0,
      goldDiff: 0,
      turtleBlue: 0,
      turtleRed: 0,
      lordBlue: 0,
      lordRed: 0,
      towerBlue: 0,
      towerRed: 0,
    },
    teams: structuredClone(BASE_TEAMS),
    presentation: {
      tournamentName: 'MLBB Official League',
      roundName: 'Grand Final',
      casterName: '',
      hostName: '',
      headerImage: '',
      headerWidth: 1280,
      layout: {
        headerImage: { x: 0, y: 0 },
        customText1: { x: 40, y: 600 },
        customImage1: { x: 40, y: 480 },
      },
      style: {
        fontFamily: 'Segoe UI, Tahoma, sans-serif',
        items: {
          casterName: { size: 12, color: '#ffd76a' },
          hostName: { size: 12, color: '#ffd76a' },
        },
      },
      customItems: [
        { id: 'customText1', type: 'text', name: 'Teks custom 1', text: 'Teks Custom', size: 24, color: '#ffffff' },
        { id: 'customImage1', type: 'image', name: 'Gambar custom 1', src: '', width: 160, height: 90 },
      ],
    },
  };
}

function defaultResultState() {
  return {
    visible: false,
    seriesScore: { blue: 0, red: 0 },
    gameNumber: 1,
    bestOf: 5,
    durationSec: 0,
    damageDealt: 0,
    damageTaken: 0,
    mvp: '',
    headline: 'VICTORY',
    subline: '',
    mode: 'mvp',
    mvpRating: 0,
    objectives: {
      turtle: { blue: 0, red: 0 },
      lord: { blue: 0, red: 0 },
      turret: { blue: 0, red: 0 },
    },
    casterNote: '',
    stageLabel: '',
  };
}

// `mode` menentukan layar mana yang dinyalakan: `mvp` (kartu MVP) atau `scoreboard`
// (10 pemain). Dua-duanya membaca key yang sama, jadi flipping mode tidak perlu state baru.
function normalizeResultState(value) {
  const fallback = defaultResultState();
  if (!isPlainObject(value)) return fallback;
  const number = (raw, min, max) => {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(min, Math.min(max, Math.round(numeric)));
  };
  const text = (raw, limit) => (typeof raw === 'string' ? raw.slice(0, limit) : '');
  const sideCount = (raw) => ({
    blue: number(raw?.blue, 0, 99),
    red: number(raw?.red, 0, 99),
  });
  return {
    visible: value.visible === true,
    seriesScore: {
      blue: number(value.seriesScore?.blue, 0, 99),
      red: number(value.seriesScore?.red, 0, 99),
    },
    gameNumber: number(value.gameNumber, 1, 99),
    bestOf: number(value.bestOf, 1, 99),
    durationSec: number(value.durationSec, 0, 86400),
    damageDealt: number(value.damageDealt, 0, 9_999_999),
    damageTaken: number(value.damageTaken, 0, 9_999_999),
    mvp: text(value.mvp, 64),
    headline: text(value.headline, 48) || fallback.headline,
    subline: text(value.subline, 120),
    mode: value.mode === 'scoreboard' ? 'scoreboard' : 'mvp',
    mvpRating: number(value.mvpRating, 0, 100),
    objectives: {
      turtle: sideCount(value.objectives?.turtle),
      lord: sideCount(value.objectives?.lord),
      turret: sideCount(value.objectives?.turret),
    },
    casterNote: text(value.casterNote, 240),
    stageLabel: text(value.stageLabel, 80),
  };
}

function defaultOcrState() {
  return { enabled: false, regions: {}, modes: {}, thresholds: {}, anchor: null };
}

// Draft pick (Fase 1). Bentuknya sengaja sama dengan yang dinormalisasi frontend di
// shared/draft-analytics.js supaya snapshot tidak perlu diterjemahkan di dua tempat.
// Analitiknya sendiri tidak dihitung di sini: matriks hero terlalu besar untuk diserialisasi
// per-snapshot, jadi overlay memuat `/assets/hero-matrix.json` sekali dan menghitung sendiri.
const DRAFT_PICK_SLOTS = 5;
const DRAFT_BAN_SLOTS = 5;

function defaultDraftState() {
  return {
    visible: false,
    round: 1,
    activeSide: 'blue',
    blue: { picks: [], bans: [] },
    red: { picks: [], bans: [] },
  };
}

function normalizeDraftState(value) {
  const fallback = defaultDraftState();
  if (!isPlainObject(value)) return fallback;
  const heroIds = (raw) => (Array.isArray(raw) ? raw : [])
    .filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 64)
    .slice(0, DRAFT_PICK_SLOTS + DRAFT_BAN_SLOTS);
  const round = Number(value.round);
  return {
    visible: value.visible === true,
    round: Number.isFinite(round) ? Math.max(1, Math.min(15, Math.round(round))) : 1,
    activeSide: value.activeSide === 'red' ? 'red' : 'blue',
    blue: {
      picks: heroIds(value.blue?.picks).slice(0, DRAFT_PICK_SLOTS),
      bans: heroIds(value.blue?.bans).slice(0, DRAFT_BAN_SLOTS),
    },
    red: {
      picks: heroIds(value.red?.picks).slice(0, DRAFT_PICK_SLOTS),
      bans: heroIds(value.red?.bans).slice(0, DRAFT_BAN_SLOTS),
    },
  };
}

// OCR config datang dari browser, jadi field yang tidak dikenal dibuang, bukan disimpan
// apa adanya. `fieldModes` controls Field Lock: `lock` berarti nilai hanya boleh diubah
// operator, OCR tidak boleh menimpanya.
const OCR_FIELD_MODES = new Set(['auto', 'lock', 'manual']);
// Turtle tidak ada di sini. Jumlah turtle hanya boleh diubah operator lewat control panel,
// jadi bacaan OCR yang menyebutnya harus ditolak, bukan disimpan lalu diam-diam diabaikan.
const OCR_FIELDS = new Set([
  'timer', 'blueKills', 'redKills', 'blueGold', 'redGold',
  'lordBlue', 'lordRed', 'towerBlue', 'towerRed',
]);

function normalizeOcrState(value) {
  if (!isPlainObject(value)) return defaultOcrState();
  const modes = {};
  for (const [field, mode] of Object.entries(isPlainObject(value.modes) ? value.modes : {})) {
    if (!OCR_FIELDS.has(field)) continue;
    modes[field] = OCR_FIELD_MODES.has(mode) ? mode : 'auto';
  }
  const thresholds = {};
  for (const [field, threshold] of Object.entries(isPlainObject(value.thresholds) ? value.thresholds : {})) {
    const numeric = Number(threshold);
    if (!OCR_FIELDS.has(field) || !Number.isFinite(numeric)) continue;
    thresholds[field] = Math.max(0, Math.min(100, Math.round(numeric)));
  }
  const anchor = {};
  if (isPlainObject(value.anchor)) {
    for (const [field, reading] of Object.entries(value.anchor)) {
      const numeric = Number(reading);
      if (!OCR_FIELDS.has(field) || !Number.isFinite(numeric)) continue;
      anchor[field] = numeric;
    }
  }
  const regions = {};
  if (isPlainObject(value.regions)) {
    for (const [field, region] of Object.entries(value.regions)) {
      if (!OCR_FIELDS.has(field) || !isPlainObject(region)) continue;
      const x = Number(region.x);
      const y = Number(region.y);
      const w = Number(region.w);
      const h = Number(region.h);
      if (![x, y, w, h].every(Number.isFinite)) continue;
      regions[field] = {
        ...region,
        x: Math.min(1, Math.max(0, x)),
        y: Math.min(1, Math.max(0, y)),
        w: Math.min(1, Math.max(0.01, w)),
        h: Math.min(1, Math.max(0.01, h)),
      };
    }
  }
  return {
    enabled: value.enabled === true,
    regions,
    modes,
    thresholds,
    anchor: Object.keys(anchor).length ? anchor : null,
  };
}

function ocrLockedFields(ocr) {
  return new Set(Object.entries(ocr?.modes || {})
    .filter(([, mode]) => mode === 'lock' || mode === 'manual')
    .map(([field]) => field));
}

function defaultPlayersState() {
  return { blue: [], red: [] };
}

const PLAYER_SLOTS = 5;

function normalizePlayersState(value) {
  const fallback = defaultPlayersState();
  if (!isPlainObject(value)) return fallback;
  const text = (raw, limit) => (typeof raw === 'string' ? raw.slice(0, limit) : '');
  const number = (raw, max) => {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(max, Math.round(numeric))) : 0;
  };
  // Radar 0-100 per sumbu. Disimpan terpisah dari KDA/DMG karena screen full scoreboard
  // menampilkan lima sumbu radar sementara MVP card menampilkan angka yang sama lewat
  // hitungan turunan.
  const RADAR_AXES = ['damage', 'survival', 'teamfight', 'push', 'farm'];
  const normalizeRadar = (raw) => {
    const source = isPlainObject(raw) ? raw : {};
    return RADAR_AXES.map((axis) => number(source[axis], 100));
  };
  const normalizeSide = (side) => {
    const list = Array.isArray(side) ? side : [];
    return Array.from({ length: PLAYER_SLOTS }, (unused, index) => {
      const player = isPlainObject(list[index]) ? list[index] : {};
      return {
        name: text(player.name, 48),
        hero: text(player.hero, 48),
        heroImage: text(player.heroImage, 256),
        role: text(player.role, 48),
        level: number(player.level, 99),
        kills: number(player.kills, 99),
        deaths: number(player.deaths, 99),
        assists: number(player.assists, 99),
        // Satu angka desimal, bukan skala 0-100 bulat: kartu MVP menampilkannya sebagai
        // "14.2" dan membulatkan jadi "14" kalau disimpan bulat.
        rating: Math.round(number(player.rating, 100) * 10) / 10,
        gold: number(player.gold, 9_999_999),
        damage: number(player.damage, 9_999_999),
        damagePct: number(player.damagePct, 100),
        turretDamage: number(player.turretDamage, 9_999_999),
        gpm: number(player.gpm, 9_999),
        battleSpell: text(player.battleSpell, 48),
        emblem: text(player.emblem, 96),
        signaturePlay: text(player.signaturePlay, 160),
        radar: normalizeRadar(player.radar),
        items: (Array.isArray(player.items) ? player.items : [])
          .slice(0, 6)
          .map((entry) => text(entry, 256))
          .filter(Boolean),
      };
    });
  };
  return { blue: normalizeSide(value.blue), red: normalizeSide(value.red) };
}

function randomToken(alphabet, length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

function newSlug() {
  return randomToken(SLUG_ALPHABET, SLUG_LENGTH);
}

function newOwnerKey() {
  return randomToken(SLUG_ALPHABET, KEY_LENGTH);
}

// Slugs are part of the URL and of the Durable Object name, so they are validated
// strictly instead of being silently rewritten. Silently repairing "ADA SPASI!" into
// "ada-spasi" would hand the caller a different profile than the one they asked for.
function sanitizeSlug(raw) {
  if (typeof raw !== 'string') return null;
  const slug = raw.trim();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/.test(slug)) return null;
  return slug;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function normalizeAssets(assets) {
  return {
    version: Number(assets?.version) || 0,
    headerImage: typeof assets?.headerImage === 'string' ? assets.headerImage : '',
    images: isPlainObject(assets?.images) ? { ...assets.images } : {},
  };
}

function stripImageSources(state) {
  return {
    ...state,
    presentation: {
      ...state.presentation,
      headerImage: '',
      customItems: (state.presentation?.customItems || []).map((item) => (
        isPlainObject(item) && item.type === 'image' ? { ...item, src: '' } : item
      )),
    },
  };
}

// Timer disimpan sebagai anchor, bukan sebagai angka yang diedit setiap detik: `timer` adalah
// nilai pada detik `timerAt`, dan overlay menghitung selisihnya sendiri. Ini yang membuat
// timer bisa berjalan mulus tanpa ada push tiap detik.
//
// Kalau client mengirim `timer` tanpa `timerAt` (semua jalur lama dan panel kontrol masih
// begitu), anchor-nya sengaja diset ke waktu sekarang: angka yang baru dikirim itu adalah
// "sekarang", dan itulah satu-satunya penafsiran yang tidak membuat timer meloncat.
function normalizeTimerAnchor(match, incoming) {
  const timer = Number(match.timer);
  match.timer = Number.isFinite(timer) ? Math.max(0, Math.round(timer)) : 0;
  match.timerRunning = match.timerRunning === true;
  const sentAt = Number(incoming?.timerAt);
  if (Number.isFinite(sentAt) && sentAt > 0) {
    match.timerAt = Math.round(sentAt);
  } else if (incoming?.timer !== undefined) {
    match.timerAt = Date.now();
  } else if (!Number.isFinite(Number(match.timerAt))) {
    match.timerAt = null;
  }
  return match;
}

function applyUpdate(state, assets, payload) {
  const next = stripImageSources(deepMerge(state, payload || {}));
  // Client boleh mengirim games dengan panjang atau winner yang ngawur; apa adanya itu akan
  // diturunkan jadi titik yang salah di overlay.
  next.match.bo2 = normalizeBo2State(next.match.bo2);
  normalizeTimerAnchor(next.match, payload?.match);
  const presentation = payload?.presentation || {};
  let assetsChanged = false;

  if (typeof presentation.headerImage === 'string' && presentation.headerImage && presentation.headerImage !== assets.headerImage) {
    assets.headerImage = presentation.headerImage;
    assetsChanged = true;
  }

  if (Array.isArray(presentation.customItems)) {
    const images = {};
    for (const item of next.presentation.customItems || []) {
      if (!isPlainObject(item) || item.type !== 'image') continue;
      const incoming = presentation.customItems.find((candidate) => candidate?.id === item.id);
      const incomingSrc = typeof incoming?.src === 'string' ? incoming.src : '';
      const src = incomingSrc || (assets.images[item.id] || '');
      if ((assets.images[item.id] || '') !== src) assetsChanged = true;
      images[item.id] = src;
    }
    for (const id of Object.keys(assets.images)) {
      if (!(id in images)) assetsChanged = true;
    }
    assets.images = images;
  }

  return { state: next, assets, assetsChanged };
}

function applyAssets(state, assets, payload) {
  const headerImage = typeof payload?.headerImage === 'string' ? payload.headerImage : assets.headerImage;
  const incoming = isPlainObject(payload?.images) ? payload.images : assets.images;
  const images = {};

  for (const item of state.presentation?.customItems || []) {
    if (!isPlainObject(item) || item.type !== 'image') continue;
    images[item.id] = typeof incoming[item.id] === 'string' ? incoming[item.id] : (assets.images[item.id] || '');
  }

  const assetsChanged = headerImage !== assets.headerImage
    || JSON.stringify(images) !== JSON.stringify(assets.images);

  return { state, assets: { version: assets.version, headerImage, images }, assetsChanged };
}

function jsonHeaders(extra = {}) {
  return { 'Content-Type': 'application/json; charset=utf-8', ...extra };
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders(headers) });
}

function noStore(extra = {}) {
  return jsonHeaders({ 'Cache-Control': 'no-store', ...extra });
}

async function readJsonBody(request, maxBytes = MAX_STATE_BYTES) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > maxBytes) {
    return { error: `Body terlalu besar. Maksimal ${Math.round(maxBytes / 1024)} KB.` };
  }
  const raw = await request.text();
  // Content-Length is absent on chunked requests, so the real length is checked too.
  if (raw.length > maxBytes) {
    return { error: `Body terlalu besar. Maksimal ${Math.round(maxBytes / 1024)} KB.` };
  }
  if (!raw.trim()) return { value: null, raw: '' };
  try {
    return { value: JSON.parse(raw), raw };
  } catch {
    return { error: 'Body harus JSON yang valid.' };
  }
}

function unauthorized(reason) {
  const messages = {
    missing: 'Header x-overlay-key wajib diisi untuk menulis state.',
    unclaimed: 'Profil ini belum diklaim. Klaim dulu lewat halaman control.',
    invalid: 'ownerKey salah.',
  };
  return jsonResponse({ error: messages[reason] || messages.invalid, reason }, 403, noStore());
}

// Peta kind -> key dipakai dua tempat: route `GET/PUT /<kind>` di ProfileStore dan perintah
// `reset_aux` lewat socket. Satu sumber supaya menambah aux baru tidak bisa lupa di salah
// satu dari dua tempat itu.
const AUX_KINDS = {
  ocr: { key: OCR_KEY, normalize: normalizeOcrState },
  result: { key: RESULT_KEY, normalize: normalizeResultState },
  players: { key: PLAYERS_KEY, normalize: normalizePlayersState },
  draft: { key: DRAFT_KEY, normalize: normalizeDraftState },
};

// ---------------------------------------------------------------------------
// SiteState: global, cross-profile bookkeeping
// ---------------------------------------------------------------------------

export class SiteState extends DurableObject {
  async readSite() {
    const site = await this.ctx.storage.get(SITE_KEY);
    return {
      aliases: isPlainObject(site?.aliases) ? site.aliases : {},
      legacyTarget: sanitizeSlug(site?.legacyTarget) || DEFAULT_SLUG,
      profileCount: Number(site?.profileCount) || 0,
    };
  }

  async resolveSlug(slug) {
    const site = await this.readSite();
    let current = slug;
    const seen = new Set();
    while (site.aliases[current] && !seen.has(current)) {
      seen.add(current);
      current = site.aliases[current];
    }
    return current;
  }

  async getLegacyTarget() {
    return (await this.readSite()).legacyTarget;
  }

  async setLegacyTarget(slug) {
    const target = sanitizeSlug(slug);
    if (!target) return this.getLegacyTarget();
    const site = await this.readSite();
    site.legacyTarget = target;
    await this.ctx.storage.put(SITE_KEY, site);
    return target;
  }

  async addAlias(from, to) {
    const site = await this.readSite();
    site.aliases[sanitizeSlug(from)] = sanitizeSlug(to);
    site.legacyTarget = sanitizeSlug(to);
    await this.ctx.storage.put(SITE_KEY, site);
    return site.aliases;
  }

  async adjustCount(delta) {
    const site = await this.readSite();
    site.profileCount = Math.max(0, site.profileCount + delta);
    await this.ctx.storage.put(SITE_KEY, site);
    return site.profileCount;
  }

  async fetch(request) {
    return jsonResponse({ error: 'Use RPC methods on SiteState.' }, 404);
  }
}

// ---------------------------------------------------------------------------
// ProfileStore: one tenant per Durable Object instance
// ---------------------------------------------------------------------------

export class ProfileStore extends DurableObject {
  constructor(ctx, state) {
    super(ctx, state);
    this.heartbeatInterval = HEARTBEAT_INTERVAL_MS;
  }

  // --- profile metadata --------------------------------------------------

  async readProfile() {
    const stored = await this.ctx.storage.get(PROFILE_KEY);
    return {
      name: typeof stored?.name === 'string' ? stored.name : 'Profil tanpa nama',
      template: TEMPLATES[stored?.template] ? stored.template : 'mlbb-gameplay',
      slug: typeof stored?.slug === 'string' ? stored.slug : '',
      createdAt: Number(stored?.createdAt) || Date.now(),
      updatedAt: Number(stored?.updatedAt) || 0,
      ownerKeyHash: typeof stored?.ownerKeyHash === 'string' ? stored.ownerKeyHash : '',
    };
  }

  async describe() {
    const [profile, migrated] = await Promise.all([
      this.readProfile(),
      this.ctx.storage.get(MIGRATED_KEY),
    ]);
    return {
      name: profile.name,
      template: profile.template,
      slug: profile.slug,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      claimed: Boolean(profile.ownerKeyHash),
      migratedFromLegacy: Boolean(migrated),
    };
  }

  async isInitialised() {
    return Boolean(await this.ctx.storage.get(PROFILE_KEY));
  }

  async authorizeKey(presented) {
    if (typeof presented !== 'string' || !presented) return { ok: false, reason: 'missing' };
    const profile = await this.readProfile();
    if (!profile.ownerKeyHash) return { ok: false, reason: 'unclaimed' };
    const digest = await sha256Hex(presented);
    return constantTimeEquals(digest, profile.ownerKeyHash) ? { ok: true } : { ok: false, reason: 'invalid' };
  }

  // A Request is never passed over RPC on purpose: serialising it would read (and lock)
  // the body stream, which then breaks the handler that still has to consume that body.
  // Callers pass the header value as a plain string instead.

  async claim(slug) {
    if ((await this.readProfile()).ownerKeyHash) {
      return { error: 'Profil ini sudah diklaim. Masukkan ownerKey yang benar.' };
    }
    const ownerKey = newOwnerKey();
    const now = Date.now();
    const profile = await this.readProfile();
    await this.ctx.storage.put(PROFILE_KEY, {
      ...profile,
      slug: sanitizeSlug(slug) || DEFAULT_SLUG,
      ownerKeyHash: await sha256Hex(ownerKey),
      updatedAt: now,
    });
    return { ownerKey };
  }

  async adopt(body) {
    const now = Date.now();
    const template = TEMPLATES[body?.template] ? body.template : 'mlbb-gameplay';
    const bundle = isPlainObject(body?.bundle) ? body.bundle : null;
    const slug = sanitizeSlug(body?.slug) || newSlug();

    const record = {
      name: typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : 'Profil saya',
      template,
      slug,
      createdAt: now,
      updatedAt: now,
      ownerKeyHash: typeof body?.ownerKeyHash === 'string' ? body.ownerKeyHash : '',
    };

    const entries = { [PROFILE_KEY]: record };
    if (bundle?.matchState) entries[STATE_KEY] = mergeState(bundle.matchState);
    if (bundle?.assets) entries[ASSETS_KEY] = normalizeAssets(bundle.assets);
    if (bundle?.ocr) entries[OCR_KEY] = { ...defaultOcrState(), ...bundle.ocr };
    if (bundle?.result) entries[RESULT_KEY] = { ...defaultResultState(), ...bundle.result };
    if (bundle?.players) entries[PLAYERS_KEY] = { ...defaultPlayersState(), ...bundle.players };

    await this.ctx.storage.put(entries);
    return { name: record.name, template: record.template, slug: record.slug, createdAt: record.createdAt };
  }

  async rename(name) {
    const profile = await this.readProfile();
    const nextName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : profile.name;
    await this.ctx.storage.put(PROFILE_KEY, { ...profile, name: nextName, updatedAt: Date.now() });
    return nextName;
  }

  async touch() {
    const profile = await this.readProfile();
    await this.ctx.storage.put(PROFILE_KEY, { ...profile, updatedAt: Date.now() });
  }

  async wipe() {
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }

  // --- migration ---------------------------------------------------------

  async readMigrationFlag() {
    return this.ctx.storage.get(MIGRATED_KEY) || '';
  }

  async markMigrated(tag = 'legacy') {
    await this.ctx.storage.put(MIGRATED_KEY, `${tag}:${Date.now()}`);
  }

  async exportAll() {
    const [state, assets, ocr, result, players] = await Promise.all([
      this.ctx.storage.get(STATE_KEY),
      this.ctx.storage.get(ASSETS_KEY),
      this.ctx.storage.get(OCR_KEY),
      this.ctx.storage.get(RESULT_KEY),
      this.ctx.storage.get(PLAYERS_KEY),
    ]);
    return { state: state || null, assets: assets || null, ocr: ocr || null, result: result || null, players: players || null };
  }

  async importAll({ profile, state, assets, ocr, result, players }) {
    const now = Date.now();
    const entries = {
      [PROFILE_KEY]: {
        name: 'Profil Lieberman',
        template: 'mlbb-gameplay',
        slug: DEFAULT_SLUG,
        createdAt: now,
        updatedAt: now,
        ownerKeyHash: '',
      },
      [STATE_KEY]: stripImageSources(deepMerge(defaultMatchState(), state || {})),
      [ASSETS_KEY]: normalizeAssets(assets),
      [OCR_KEY]: { ...defaultOcrState(), ...(ocr || {}) },
      [RESULT_KEY]: { ...defaultResultState(), ...(result || {}) },
      [PLAYERS_KEY]: { ...defaultPlayersState(), ...(players || {}) },
    };
    if (profile && typeof profile === 'object') entries[PROFILE_KEY] = { ...entries[PROFILE_KEY], ...profile };
    await this.ctx.storage.put(entries);
    return true;
  }

  async migrateTo(targetSlug, targetStub) {
    const exported = await this.exportAll();
    const profile = await this.readProfile();
    await targetStub.adopt({
      name: profile.name,
      template: profile.template,
      slug: targetSlug,
      ownerKeyHash: profile.ownerKeyHash,
      bundle: {
        matchState: exported.state,
        assets: exported.assets,
        ocr: exported.ocr,
        result: exported.result,
        players: exported.players,
      },
    });
    return exported;
  }

  // --- state -------------------------------------------------------------

  async loadState() {
    const [state, assets, profile] = await Promise.all([
      this.ctx.storage.get(STATE_KEY),
      this.ctx.storage.get(ASSETS_KEY),
      this.readProfile(),
    ]);
    return {
      state: mergeState(state || {}),
      assets: normalizeAssets(assets),
      profile: {
        name: profile.name,
        template: profile.template,
        slug: profile.slug,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    };
  }

  async loadAuxiliary() {
    const [ocr, result, players, draft] = await Promise.all([
      this.ctx.storage.get(OCR_KEY),
      this.ctx.storage.get(RESULT_KEY),
      this.ctx.storage.get(PLAYERS_KEY),
      this.ctx.storage.get(DRAFT_KEY),
    ]);
    return {
      ocr: normalizeOcrState(ocr),
      result: normalizeResultState(result),
      players: normalizePlayersState(players),
      draft: normalizeDraftState(draft),
    };
  }

  buildSnapshot(state, assets, profile, auxiliary = null) {
    // Snapshot ikut membawa `result`, `players`, dan `draft` supaya overlay tidak perlu
    // fetch tambahan setiap kali nilainya berubah. `ocr` sengaja tidak disertakan: hanya
    // control dan halaman OCR yang membutuhkannya, dan isinya bisa berukuran ROI.
    const extra = auxiliary
      ? { result: auxiliary.result, players: auxiliary.players, draft: auxiliary.draft }
      : {};
    return JSON.stringify({
      type: 'snapshot',
      payload: { ...state, assetsVersion: assets.version, profile, ...extra },
    });
  }

  // --- sockets -----------------------------------------------------------

  broadcast(message) {
    let delivered = 0;
    for (const client of this.ctx.getWebSockets()) {
      try {
        client.send(message);
        delivered += 1;
      } catch {
        try {
          client.close(1011, 'Broadcast failed');
        } catch {
          /* socket already gone */
        }
      }
    }
    return delivered;
  }

  async scheduleHeartbeat() {
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current < Date.now() + HEARTBEAT_INTERVAL_MS) {
      await this.ctx.storage.setAlarm(Date.now() + HEARTBEAT_INTERVAL_MS);
    }
  }

  safeSend(socket, message) {
    try {
      socket.send(message);
    } catch {
      /* socket already gone */
    }
  }

  roleOf(socket) {
    return socket.deserializeAttachment()?.role === 'owner' ? 'owner' : 'viewer';
  }

  async handleUpgrade(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment({ role: 'viewer' });
    this.ctx.acceptWebSocket(server);
    const { state, assets, profile } = await this.loadState();
    this.safeSend(server, JSON.stringify({
      type: 'hello',
      role: 'viewer',
      profile,
      requiresAuth: true,
    }));
    this.safeSend(server, this.buildSnapshot(state, assets, profile, await this.loadAuxiliary()));
    await this.scheduleHeartbeat();
    return new Response(null, { status: 101, webSocket: client });
  }

  // --- persistence -------------------------------------------------------

  async persist(payload) {
    const { state, assets } = await this.loadState();
    const result = applyUpdate(state, assets, payload);
    if (result.assetsChanged) result.assets.version = assets.version + 1;

    await this.ctx.storage.put({ [STATE_KEY]: result.state, [ASSETS_KEY]: result.assets });

    const { profile } = await this.loadState();
    this.broadcast(this.buildSnapshot(result.state, result.assets, profile, await this.loadAuxiliary()));
    if (result.assetsChanged) {
      this.broadcast(JSON.stringify({ type: 'assets_changed', assetsVersion: result.assets.version }));
    }
    return result;
  }

  // --- HTTP --------------------------------------------------------------

  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return this.handleUpgrade(request);
    }

    const route = url.pathname.replace(/^\/+/, '');

    if (route === 'state' && request.method === 'GET') {
      const { state, assets, profile } = await this.loadState();
      return new Response(this.buildSnapshot(state, assets, profile, await this.loadAuxiliary()), { headers: noStore() });
    }

    if (route === 'state' && request.method === 'PUT') {
      const auth = await this.authorizeKey(request.headers.get(OWNER_HEADER) || '');
      if (!auth.ok) return unauthorized(auth.reason);
      const parsed = await readJsonBody(request);
      if (parsed.error) return jsonResponse({ error: parsed.error }, 400);
      if (!isPlainObject(parsed.value)) return jsonResponse({ error: 'Body harus JSON object.' }, 400);
      const result = await this.persist(parsed.value);
      await this.touch();
      return jsonResponse({ ok: true, assetsVersion: result.assets.version }, 200, noStore());
    }

    if (route === 'assets' && request.method === 'GET') {
      const { assets } = await this.loadState();
      const requested = Number(url.searchParams.get('v'));
      const cacheable = Number.isFinite(requested) && requested === assets.version;
      return jsonResponse(assets, 200, {
        'Cache-Control': cacheable ? 'public, max-age=31536000, immutable' : 'no-store',
      });
    }

    if (route === 'ocr' && request.method === 'GET') {
      return jsonResponse(normalizeOcrState(await this.ctx.storage.get(OCR_KEY)), 200, noStore());
    }

    if (route === 'ocr' && request.method === 'PUT') {
      const auth = await this.authorizeKey(request.headers.get(OWNER_HEADER) || '');
      if (!auth.ok) return unauthorized(auth.reason);
      const parsed = await readJsonBody(request);
      if (parsed.error) return jsonResponse({ error: parsed.error }, 400);
      const ocr = normalizeOcrState(parsed.value);
      await this.ctx.storage.put(OCR_KEY, ocr);
      this.broadcast(JSON.stringify({ type: 'aux_changed', kind: 'ocr' }));
      return jsonResponse({ ok: true, ocr }, 200, noStore());
    }

    // Bacaan OCR lewat endpoint sendiri supaya Field Lock ditegakkan di server. Kalau OCR
    // memakai `update` biasa, server tidak bisa tahu mana angka operator dan mana angka
    // mesin, jadi field terkunci bisa saja tertimpa.
    if (route === 'ocr/readings' && request.method === 'POST') {
      const auth = await this.authorizeKey(request.headers.get(OWNER_HEADER) || '');
      if (!auth.ok) return unauthorized(auth.reason);
      const parsed = await readJsonBody(request);
      if (parsed.error) return jsonResponse({ error: parsed.error }, 400);
      if (!isPlainObject(parsed.value)) return jsonResponse({ error: 'Body harus JSON object.' }, 400);

      const ocr = normalizeOcrState(await this.ctx.storage.get(OCR_KEY));
      if (ocr.enabled === false && parsed.value.readings === undefined) {
        return jsonResponse({ error: 'OCR dinonaktifkan di control panel.' }, 409, noStore());
      }

      const locked = ocrLockedFields(ocr);
      const readings = {};
      const rejected = [];
      // Anchor timer dikirim DI DALAM objek readings (satu kiriman untuk semua angka), tapi
      // itu bukan field bacaan: `timerAt` dan `timerRunning` adalah metadata cara menghitung
      // angka timer. Kalau ikut disaring loop bawah, keduanya masuk daftar `rejected` dan
      // operator melihat "field terkunci diabaikan" padahal tidak ada yang dikunci.
      const { timerAt, timerRunning, ...ocrReadings } = isPlainObject(parsed.value.readings)
        ? parsed.value.readings
        : {};
      for (const [field, raw] of Object.entries(ocrReadings)) {
        // Field yang tidak dikenal DITOLAK, bukan di Lewati diam-diam. Versi lama memakai
        // `continue` tanpa mencatat apa pun, jadi bacaan turtle (dan field karangan lain)
        // hilang tanpa jejak: operator melihat `applied: [lordBlue]` dan menyimpulkan
        // turtle juga diterima. Untuk Turtle manual-only itu justru bahaya, karena angka
        // yang diurus manual terlihat seperti berhasil di-update mesin.
        if (!OCR_FIELDS.has(field)) {
          rejected.push(field);
          continue;
        }
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          rejected.push(field);
          continue;
        }
        if (locked.has(field)) {
          rejected.push(field);
          continue;
        }
        readings[field] = value;
      }

      // Anchor timer (`timerAt` + `timerRunning`) sengaja DI LUAR `OCR_FIELDS`: itu bukan
      // bacaan field, melainkan metadata cara menghitung angka timer. Kalau ikut disaring
      // loop di atas, anchor akan hilang, worker menganchor ulang `timer` ke waktu receipt
      // tiap kiriman, dan angka timer di overlay melompat maju-mundur setiap beberapa detik --
      // persis masalah yang OcrTimer dibuatkan untuk dihilangkan.
      //
      // Field Lock tetap berlaku: kalau `timer` terkunci, anchor pun tidak boleh ikut berubah,
      // karena anchor tanpa nilai yang diizinkan akan menggeser angka yang dikunci operator.
      const anchorPatch = readings.timer !== undefined
        ? normalizeTimerAnchor({ timer: readings.timer }, { timerAt, timerRunning })
        : null;

      // Satu persist untuk angka dan anchor sekaligus: dua persist berarti dua kali tulis
      // storage dan dua kali siar, dan client kedua bisa sempat melihat angka tanpa anchor.
      const patch = Object.keys(readings).length ? { match: readings } : null;
      if (anchorPatch) {
        await this.persist({
          match: {
            ...(patch?.match || {}),
            timer: anchorPatch.timer,
            timerAt: anchorPatch.timerAt,
            timerRunning: anchorPatch.timerRunning,
          },
        });
        await this.touch();
      } else if (patch) {
        await this.persist(patch);
        await this.touch();
      }

      const nextAnchor = { ...(ocr.anchor || {}), ...(isPlainObject(parsed.value.anchor) ? parsed.value.anchor : {}) };
      const nextOcr = normalizeOcrState({ ...ocr, anchor: nextAnchor });
      await this.ctx.storage.put(OCR_KEY, nextOcr);
      return jsonResponse({ ok: true, applied: Object.keys(readings), rejected }, 200, noStore());
    }

// Hanya aux yang generik yang lewat loop di bawah. `ocr` sengaja TIDAK ikut: `PUT /ocr`
// punya penggabungan `anchor` sendiri di handler eksplisit di atas, dan memprosesnya lewat
// `normalizeOcrState` yang sama akan diam-diam membuang anchor itu kalau urutan handler
// berubah someday. `ocr` tetap ada di AUX_KINDS karena `reset_aux` memakainya.
const GENERIC_AUX_KINDS = ['result', 'players', 'draft'];

    // `result`, `players`, dan `draft` punya route sendiri karena tidak boleh ikut
    // `PUT /state`: semuanya disiarkan lewat `aux_changed`, bukan lewat snapshot state,
    // supaya tab.result, tab.players, dan overlay draft di browser kedua tidak perlu refresh.
    for (const segment of GENERIC_AUX_KINDS) {
      const { key, normalize } = AUX_KINDS[segment];
      if (route === segment && request.method === 'GET') {
        return jsonResponse(normalize(await this.ctx.storage.get(key)), 200, noStore());
      }
      if (route === segment && request.method === 'PUT') {
        const auth = await this.authorizeKey(request.headers.get(OWNER_HEADER) || '');
        if (!auth.ok) return unauthorized(auth.reason);
        const parsed = await readJsonBody(request);
        if (parsed.error) return jsonResponse({ error: parsed.error }, 400);
        if (!isPlainObject(parsed.value)) return jsonResponse({ error: 'Body harus JSON object.' }, 400);
        const value = normalize(parsed.value);
        await this.ctx.storage.put(key, value);
        this.broadcast(JSON.stringify({ type: 'aux_changed', kind: segment }));
        // Snapshot ikut membawa aux yang baru diubah, jadi dikirim sekali di sini supaya
        // overlay tidak perlu fetch tambahan setelah `aux_changed`.
        const { state, assets, profile } = await this.loadState();
        this.broadcast(this.buildSnapshot(state, assets, profile, await this.loadAuxiliary()));
        await this.scheduleHeartbeat();
        return jsonResponse({ ok: true, [segment]: value }, 200, noStore());
      }
    }

    if (route === 'export' && request.method === 'GET') {
      const { state, assets, profile } = await this.loadState();
      const auxiliary = await this.loadAuxiliary();
      return jsonResponse({
        schemaVersion: SCHEMA_VERSION,
        exportedAt: Date.now(),
        template: profile.template,
        profile: { name: profile.name, createdAt: profile.createdAt, updatedAt: profile.updatedAt },
        matchState: state,
        assets,
        ...auxiliary,
      }, 200, noStore({
        'Content-Disposition': 'attachment; filename="overlay-profile.json"',
      }));
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }

  // --- websocket messages ------------------------------------------------

  async webSocketMessage(socket, message) {
    if (typeof message !== 'string') {
      this.safeSend(socket, JSON.stringify({ type: 'error', message: 'Text JSON messages are required.' }));
      return;
    }
    if (message.length > MAX_FRAME_CHARS) {
      this.safeSend(socket, JSON.stringify({ type: 'error', message: 'Frame terlalu besar. Perkecil gambar yang dikirim.' }));
      return;
    }

    let envelope;
    try {
      envelope = JSON.parse(message);
    } catch {
      this.safeSend(socket, JSON.stringify({ type: 'error', message: 'Invalid JSON payload.' }));
      return;
    }

    if (envelope?.type === 'ping') {
      this.safeSend(socket, JSON.stringify({ type: 'pong', message: 'alive' }));
      return;
    }

    if (envelope?.type === 'auth') {
      const profile = await this.readProfile();
      const auth = await this.authorizeKey(envelope.key);
      const role = auth.ok ? 'owner' : 'viewer';
      socket.serializeAttachment({ role });
      this.safeSend(socket, JSON.stringify({
        type: 'auth_ok',
        role,
        claimed: Boolean(profile.ownerKeyHash),
        message: role === 'owner'
          ? 'Owner terotorisasi.'
          : profile.ownerKeyHash
            ? 'ownerKey ditolak. Mode baca saja.'
            : 'Profil belum diklaim. Mode baca saja.',
      }));
      return;
    }

    if (envelope?.type === 'command' && envelope.command === 'request_state') {
      const { state, assets, profile } = await this.loadState();
      this.safeSend(socket, this.buildSnapshot(state, assets, profile, await this.loadAuxiliary()));
      return;
    }

    if (this.roleOf(socket) !== 'owner') {
      this.safeSend(socket, JSON.stringify({
        type: 'error',
        code: 'forbidden',
        message: 'Socket belum terotorisasi. Kirim { type: "auth", key: <ownerKey> } lebih dulu.',
      }));
      return;
    }

    const { state, assets } = await this.loadState();
    let nextState = state;
    let nextAssets = assets;
    let assetsChanged = false;

    if (envelope?.type === 'update') {
      const result = applyUpdate(state, assets, envelope.payload || {});
      nextState = result.state;
      nextAssets = result.assets;
      assetsChanged = result.assetsChanged;
    } else if (envelope?.type === 'assets') {
      const result = applyAssets(state, assets, envelope.payload || {});
      nextState = result.state;
      nextAssets = result.assets;
      assetsChanged = result.assetsChanged;
    // `set_timer` dan `tick_timer` dihapus. Keduanya mendorong timer sebagai angka mentah tiap
// detik, persis model yang membuat angka timer berkedip di overlay dan menghasilkan satu push
// per detik. Timer sekarang di-anchor lewat `normalizeTimerAnchor` di applyUpdate, jadi
// menambah/mengurangi satu detik tidak lagi berarti menulis ulang angka anchor.
    } else if (envelope?.type === 'command' && envelope.command === 'reset') {
      nextState = stripImageSources(structuredClone(defaultMatchState()));
      nextAssets = normalizeAssets(null);
      assetsChanged = true;
    } else if (envelope?.type === 'command' && envelope.command === 'reset_aux') {
      const kind = envelope.kind;
      const aux = AUX_KINDS[kind];
      if (!aux) {
        this.safeSend(socket, JSON.stringify({ type: 'error', message: `Unsupported kind: ${kind}` }));
        return;
      }
      // Normalizer yang sama dengan route PUT, jadi hasil reset tidak mungkin punya bentuk
      // berbeda dari yang dibaca overlay.
      await this.ctx.storage.put(aux.key, aux.normalize(null));
      this.broadcast(JSON.stringify({ type: 'aux_changed', kind }));
      await this.scheduleHeartbeat();
      return;
    } else {
      this.safeSend(socket, JSON.stringify({ type: 'error', message: `Unsupported message type: ${envelope?.type}` }));
      return;
    }

    if (assetsChanged) nextAssets.version = assets.version + 1;
    await this.ctx.storage.put({ [STATE_KEY]: nextState, [ASSETS_KEY]: nextAssets });

    const { profile } = await this.loadState();
    this.broadcast(this.buildSnapshot(nextState, nextAssets, profile, await this.loadAuxiliary()));
    if (assetsChanged) {
      this.broadcast(JSON.stringify({ type: 'assets_changed', assetsVersion: nextAssets.version }));
    }
    await this.scheduleHeartbeat();
  }

  async webSocketClose(socket, code, reason, wasClean) {
    const clients = Math.max(0, this.ctx.getWebSockets().length - 1);
    this.broadcast(JSON.stringify({ type: 'peers', clients, reason: wasClean ? 'closed' : 'dropped' }));
    if (clients === 0) await this.ctx.storage.deleteAlarm();
  }

  async webSocketError(socket, error) {
    const clients = Math.max(0, this.ctx.getWebSockets().length - 1);
    this.broadcast(JSON.stringify({ type: 'peers', clients, reason: 'error' }));
  }

  async alarm() {
    const clients = this.ctx.getWebSockets();
    if (!clients.length) return;
    this.broadcast(JSON.stringify({ type: 'heartbeat', clients: clients.length, at: Date.now() }));
    await this.scheduleHeartbeat();
  }
}

// ---------------------------------------------------------------------------
// Legacy migration: move the original single profile onto the `default` slug
// ---------------------------------------------------------------------------

async function migrateLegacyIfNeeded(env, slug) {
  if (slug !== DEFAULT_SLUG) return false;
  const stub = profileStub(env, DEFAULT_SLUG);
  if (await stub.readMigrationFlag()) return false;

  const legacy = profileStub(env, LEGACY_DO_NAME);
  const exported = await legacy.exportAll();
  const hasRealData = Boolean(
    exported.state
    && ((Number(exported.state.match?.timer) || 0) > 0
      || (Number(exported.state.match?.blueKills) || 0) > 0
      || (Number(exported.state.teams?.blue?.kills) || 0) > 0),
  );

  if (!hasRealData) {
    await stub.markMigrated('empty');
    return false;
  }

  await stub.importAll({
    profile: { name: 'Profil Lieberman', template: 'mlbb-gameplay', slug: DEFAULT_SLUG },
    state: exported.state,
    assets: exported.assets,
  });
  await stub.markMigrated('legacy-do');
  return true;
}

// ---------------------------------------------------------------------------
// Routing helpers
// ---------------------------------------------------------------------------

function resolveProfileRoute(pathname) {
  const match = /^\/p\/([^/]+)(\/.*)?$/.exec(pathname);
  if (!match) return null;
  const slug = sanitizeSlug(match[1]);
  if (!slug) return null;
  return { slug, page: (match[2] || '/').replace(/^\/+|\/+$/g, '') };
}

function resolveApiRoute(pathname) {
  const match = /^\/api\/p\/([^/]+)(\/.*)?$/.exec(pathname);
  if (!match) return null;
  return {
    slug: sanitizeSlug(match[1]),
    rest: (match[2] || '').replace(/^\/+|\/+$/g, ''),
  };
}

function siteStub(env) {
  return env.SITE_STATE.get(env.SITE_STATE.idFromName('site'));
}

function profileStub(env, slug) {
  return env.PROFILE_STORE.get(env.PROFILE_STORE.idFromName(slug));
}

// D1 adalah bonus, bukan syarat. Kalau binding belum terpasang atau skema belum
// di-apply, endpoint D1 harus jawab dengan jujur dan tidak boleh menggagalkan halaman.
async function withDatabase(env, handler) {
  if (!env.DB) {
    return jsonResponse({ error: 'Database belum dikonfigurasi di server ini.', reason: 'no_database' }, 503, noStore());
  }
  try {
    return await handler(env.DB);
  } catch (error) {
    // Skema yang belum di-apply muncul sebagai prepare error, bukan exception biasa.
    const message = String(error?.message || error);
    const missingSchema = /no such table|SQLITE_ERROR|prepare/i.test(message);
    return jsonResponse({
      error: missingSchema
        ? 'Skema database belum di-apply. Jalankan: npx wrangler d1 execute mlbb-db --remote --file=cloudflare/schema.sql'
        : 'Database sedang bermasalah. Coba lagi nanti.',
      reason: missingSchema ? 'missing_schema' : 'database_error',
    }, 503, noStore());
  }
}

const FEEDBACK_KINDS = new Set(['bug', 'fitur', 'lain']);
const MAX_FEEDBACK_CHARS = 2000;

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

async function handleGallery(env, request, url) {
  if (request.method === 'GET') {
    return withDatabase(env, async (db) => {
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 12));
      // Template literal dengan `?` wajib, jadi nilai limit tidak bisa di-bind.
      const { results } = await db.prepare(
        `SELECT slug, name, template, blue_team, red_team, published_at
         FROM gallery_entries ORDER BY published_at DESC LIMIT ${limit}`,
      ).all();
      return jsonResponse({ entries: results || [], enabled: true }, 200, noStore());
    });
  }

  const parsed = await readJsonBody(request, 32 * 1024);
  if (parsed.error) return jsonResponse({ error: parsed.error }, 400);
  if (!isPlainObject(parsed.value)) return jsonResponse({ error: 'Body harus JSON object.' }, 400);
  const body = parsed.value;

  if (request.method === 'PUT') {
    const slug = sanitizeSlug(body.slug);
    if (!slug) return jsonResponse({ error: 'Slug tidak valid.' }, 400, noStore());
    const auth = await profileStub(env, slug).authorizeKey(cleanText(body.ownerKey, 64));
    if (!auth.ok) return unauthorized(auth.reason);

    const profile = await profileStub(env, slug).describe();
    const name = cleanText(body.name, 80) || profile.name;
    return withDatabase(env, async (db) => {
      await db.prepare(
        `INSERT INTO gallery_entries (slug, name, template, blue_team, red_team, published_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
           name = excluded.name,
           template = excluded.template,
           blue_team = excluded.blue_team,
           red_team = excluded.red_team,
           published_at = excluded.published_at`,
      ).bind(
        slug,
        name,
        profile.template,
        cleanText(body.blueTeam, 80),
        cleanText(body.redTeam, 80),
        Date.now(),
      ).run();
      return jsonResponse({ ok: true, published: true, slug, name }, 200, noStore());
    });
  }

  if (request.method === 'DELETE') {
    const slug = sanitizeSlug(body.slug);
    if (!slug) return jsonResponse({ error: 'Slug tidak valid.' }, 400, noStore());
    const auth = await profileStub(env, slug).authorizeKey(cleanText(body.ownerKey, 64));
    if (!auth.ok) return unauthorized(auth.reason);
    return withDatabase(env, async (db) => {
      await db.prepare('DELETE FROM gallery_entries WHERE slug = ?').bind(slug).run();
      return jsonResponse({ ok: true, published: false, slug }, 200, noStore());
    });
  }

  return jsonResponse({ error: 'Method tidak diizinkan.' }, 405, noStore());
}

async function handleFeedback(env, request) {
  const parsed = await readJsonBody(request, 16 * 1024);
  if (parsed.error) return jsonResponse({ error: parsed.error }, 400);
  if (!isPlainObject(parsed.value)) return jsonResponse({ error: 'Body harus JSON object.' }, 400);
  const body = parsed.value;

  // Honeypot: bot mengisi semua field, manusia tidak. Diam-diam accept supaya bot
  // tidak belajar bahwa field ini adalah jebakan.
  if (cleanText(body.website, 100)) return jsonResponse({ ok: true }, 200, noStore());

  const message = cleanText(body.message, MAX_FEEDBACK_CHARS);
  if (message.length < 10) {
    return jsonResponse({ error: 'Ceritakan kendalanya minimal 10 karakter.' }, 400, noStore());
  }
  const kind = FEEDBACK_KINDS.has(body.kind) ? body.kind : 'lain';

  return withDatabase(env, async (db) => {
    await db.prepare(
      `INSERT INTO feedback (kind, message, contact, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      kind,
      message,
      cleanText(body.contact, 120),
      cleanText(request.headers.get('User-Agent'), 200),
      Date.now(),
    ).run();
    return jsonResponse({ ok: true }, 201, noStore());
  });
}

async function resolveSlug(env, slug) {
  return siteStub(env).resolveSlug(slug);
}

async function handleProfileApi(env, request, slug, rest) {
  await migrateLegacyIfNeeded(env, slug);
  const stub = profileStub(env, slug);
  const url = new URL(request.url);

  // The body is read exactly once, before any auth decision. Answering a request with an
  // early 403 while leaving its stream unread makes the runtime drain that stream a
  // second time, which surfaces as "Body has already been used" and a bogus 500.
  const canHaveBody = request.method === 'PUT' || request.method === 'POST' || request.method === 'PATCH';
  const parsed = canHaveBody
    ? await readJsonBody(request, rest === 'assets' ? MAX_ASSETS_BYTES : MAX_STATE_BYTES)
    : { value: null, raw: '' };
  if (parsed.error) return jsonResponse({ error: parsed.error }, 400, noStore());
  const presentedKey = request.headers.get(OWNER_HEADER) || '';

  if (rest === '' && request.method === 'GET') {
    return jsonResponse({ profile: await stub.describe(), templates: TEMPLATES }, 200, noStore());
  }

  if (rest === '' && request.method === 'PUT') {
    const auth = await stub.authorizeKey(presentedKey);
    if (!auth.ok) return unauthorized(auth.reason);
    if (!isPlainObject(parsed.value)) return jsonResponse({ error: 'Body harus JSON object.' }, 400);
    const name = await stub.rename(parsed.value.name);
    return jsonResponse({ ok: true, profile: { ...(await stub.describe()), name } }, 200, noStore());
  }

  if (rest === '' && request.method === 'DELETE') {
    const auth = await stub.authorizeKey(presentedKey);
    if (!auth.ok) return unauthorized(auth.reason);
    await stub.wipe();
    await siteStub(env).adjustCount(-1);
    return jsonResponse({ ok: true, deleted: slug }, 200, noStore());
  }

  if (rest === 'claim' && request.method === 'POST') {
    const result = await stub.claim(slug);
    if (result.error) return jsonResponse({ error: result.error }, 409, noStore());
    return jsonResponse({ ok: true, slug, ownerKey: result.ownerKey }, 200, noStore());
  }

  if (rest === 'rotate' && request.method === 'POST') {
    const auth = await stub.authorizeKey(presentedKey);
    if (!auth.ok) return unauthorized(auth.reason);
    const nextSlug = newSlug();
    await stub.migrateTo(nextSlug, profileStub(env, nextSlug));
    await siteStub(env).addAlias(slug, nextSlug);
    await stub.wipe();
    return jsonResponse({ ok: true, slug: nextSlug, previousSlug: slug }, 200, noStore());
  }

  // Replay the buffered body so the Durable Object handler still sees a single-use stream.
  const init = { method: request.method, headers: request.headers };
  if (parsed.raw) init.body = parsed.raw;
  return stub.fetch(new Request(new URL(`/${rest || 'state'}`, url), init));
}

async function serveStatic(env, request, file, url) {
  const response = await env.ASSETS.fetch(new Request(new URL(file, url), request));
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, must-revalidate');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Worker entry
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/runtime-config.json') {
      const websocketProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return jsonResponse({
        websocketProtocol,
        origin: url.origin,
        defaultSlug: DEFAULT_SLUG,
        schemaVersion: SCHEMA_VERSION,
        updatedAt: Date.now(),
      }, 200, noStore());
    }

    if (url.pathname === '/api/site' && request.method === 'GET') {
      return jsonResponse({
        templates: TEMPLATES,
        schemaVersion: SCHEMA_VERSION,
        defaultSlug: DEFAULT_SLUG,
      }, 200, noStore());
    }

    if (url.pathname === '/api/registry' && request.method === 'GET') {
      return serveStatic(env, request, '/assets/registry.json', url);
    }

    if (url.pathname === '/api/profiles' && request.method === 'POST') {
      const parsed = await readJsonBody(request);
      if (parsed.error) return jsonResponse({ error: parsed.error }, 400);
      if (!isPlainObject(parsed.value)) return jsonResponse({ error: 'Body harus JSON object.' }, 400);

      const body = parsed.value;
      let slug = null;
      if (body.slug !== undefined && body.slug !== null && body.slug !== '') {
        slug = sanitizeSlug(body.slug);
        if (!slug) {
          return jsonResponse({
            error: 'Slug harus 3-48 karakter: huruf kecil, angka, dan tanda hubung.',
          }, 400, noStore());
        }
        if (await profileStub(env, slug).isInitialised()) {
          return jsonResponse({ error: 'Slug itu sudah dipakai. Coba yang lain.' }, 409, noStore());
        }
      }

      if (!slug) slug = newSlug();
      // An ownerKey is only minted when the caller asks for it. Minting one and then
      // discarding it would store a hash nobody can ever reproduce, permanently locking
      // the profile: it would look claimed and refuse every later claim.
      const wantsKey = body.includeKey === true;
      const ownerKey = wantsKey ? newOwnerKey() : '';
      const record = await profileStub(env, slug).adopt({
        ...body,
        slug,
        ownerKeyHash: wantsKey ? await sha256Hex(ownerKey) : '',
      });

      const site = siteStub(env);
      if (slug === DEFAULT_SLUG || body.legacy === true) await site.setLegacyTarget(slug);
      await site.adjustCount(1);

      const payload = { ok: true, slug, template: record.template, name: record.name, path: `/p/${slug}/` };
      return jsonResponse(
        wantsKey ? { ...payload, ownerKey } : payload,
        201,
        noStore(),
      );
    }

    if (url.pathname === '/api/gallery' && ['GET', 'PUT', 'DELETE'].includes(request.method)) {
      return handleGallery(env, request, url);
    }

    if (url.pathname === '/api/feedback' && request.method === 'POST') {
      return handleFeedback(env, request);
    }

    const apiRoute = resolveApiRoute(url.pathname);
    if (apiRoute) {
      if (!apiRoute.slug) return jsonResponse({ error: 'Slug tidak valid.' }, 400, noStore());
      const resolved = await resolveSlug(env, apiRoute.slug);
      if (resolved !== apiRoute.slug) {
        // Keep the redirect inside /api/ so fetch() callers keep receiving JSON instead
        // of following a redirect to the HTML control page.
        const target = apiRoute.rest ? `/api/p/${resolved}/${apiRoute.rest}` : `/api/p/${resolved}/`;
        return Response.redirect(new URL(target, url), 302);
      }
      return handleProfileApi(env, request, apiRoute.slug, apiRoute.rest);
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      return serveStatic(env, request, '/frontend/home/index.html', url);
    }

    const pageRoute = resolveProfileRoute(url.pathname);
    if (pageRoute) {
      const resolved = await resolveSlug(env, pageRoute.slug);
      if (resolved !== pageRoute.slug) {
        return Response.redirect(new URL(`/p/${resolved}/${pageRoute.page}`, url), 302);
      }
      if (!pageRoute.page || !(pageRoute.page in PAGE_FILES)) {
        return Response.redirect(new URL(`/p/${pageRoute.slug}/control/`, url), 302);
      }
      return serveStatic(env, request, PAGE_FILES[pageRoute.page], url);
    }

    const legacyMatch = /^\/frontend\/(control|overlay\/gameplay|overlay\/result|debug)\/?$/.exec(url.pathname);
    if (legacyMatch) {
      const target = await siteStub(env).getLegacyTarget();
      return Response.redirect(new URL(`/p/${target}/${legacyMatch[1]}/`, url), 302);
    }

    return env.ASSETS.fetch(request);
  },
};