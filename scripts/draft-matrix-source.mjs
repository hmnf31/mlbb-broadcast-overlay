// Sumber kurasi untuk matriks draft (Fase 1).
//
// PENTING soal asal data: angka di sini BUKAN statistik mlbb.tools dan bukan hasil scraping.
// `/api/` mlbb.tools ada di robots.txt `Disallow`, dan winrate-nya tidak ada di HTML yang
// dikirim server, jadi matriks itu tidak bisa diambil secara sah tanpa izin. Yang dipakai
// di sini adalah tabel hubungan antahero yang dikurasi manual, dipakai sebagai fallback
// yang bisa dipertanggungjawabkan.
//
// Konsekuensinya harus jujur di UI: `source: "curated"` dan advantagenya adalah indeks
// heuristik, bukan prediksi kemenangan berbasis data pertandingan. Kalau nanti ada sumber
// data berlisensi atau API resmi, tabel di file ini tinggal diganti lalu
// `npm run build:matrix` dijalankan ulang; frontend dan Worker tidak berubah karena hanya
// membaca bentuk datanya.
//
// ATURAN: semua id di bawah harus ada di assets/registry.json. build-hero-matrix.mjs
// memvalidasi tiap id dan gagal keras kalau ada yang tidak dikenal, jadi id karangan tidak
// bisa diam-diam lolos ke matriks.

export const MATRIX_SCHEMA_VERSION = 1;
export const MATRIX_PATCH = 'curated-2026-10';

// Relasi peran jadi baseline untuk hero yang belum punya pasangan kurasi.
// `primaryRole` di build script mengambil bagian pertama role gabungan ("fighter, assassin").
export const ROLE_ADVANTAGE = {
  tank: { beats: ['assassin', 'marksman'], loses: ['mage', 'fighter'] },
  fighter: { beats: ['tank', 'support'], loses: ['assassin', 'mage'] },
  assassin: { beats: ['mage', 'marksman'], loses: ['tank', 'fighter'] },
  mage: { beats: ['tank', 'fighter'], loses: ['assassin', 'marksman'] },
  marksman: { beats: ['tank', 'fighter'], loses: ['assassin', 'mage'] },
  support: { beats: [], loses: ['fighter', 'assassin'] },
};

// Counter kurasi sengaja jauh lebih besar daripada relasi peran supaya tabel manual
// dominate, dan relasi peran hanya jadi baseline.
export const ROLE_WEIGHT = 3;

// [penakluk, yang dikalahi, bobot]. Satu entri sudah otomatis berlaku dua arah: A menang atas
// B berarti B kalah dari A.
export const COUNTER_PAIRS = [
  // Assassin dan dive ke target rapuh
  ['fanny', 'gusion', 14], ['fanny', 'kimmy', 12], ['fanny', 'yve', 11], ['fanny', 'pharsa', 11],
  ['hayabusa', 'claude', 15], ['hayabusa', 'brody', 14], ['hayabusa', 'hanabi', 13], ['hayabusa', 'edith', 12],
  ['ling', 'beatrix', 15], ['ling', 'irithel', 14], ['ling', 'layla', 13], ['ling', 'harley', 12],
  ['lancelot', 'carmilla', 13], ['lancelot', 'chang_e', 12], ['lancelot', 'kagura', 12],
  ['saber', 'gusion', 14], ['saber', 'harith', 13], ['saber', 'martis', 12],
  ['karina', 'yve', 12], ['karina', 'claude', 12],
  ['aamon', 'kagura', 12], ['benedetta', 'claude', 13],
  ['gusion', 'grock', 13], ['gusion', 'minotaur', 12], ['gusion', 'franco', 12],

  // Anti-dive ke assassin dan fighter yang melompat
  ['franco', 'hayabusa', 14], ['franco', 'lancelot', 14], ['franco', 'ling', 13], ['franco', 'karina', 12],
  ['khufra', 'lancelot', 15], ['khufra', 'ling', 15], ['khufra', 'mathilda', 12], ['khufra', 'fanny', 12],
  ['hylos', 'lancelot', 15], ['hylos', 'ling', 14], ['hylos', 'yu_zhong', 13], ['hylos', 'fanny', 12],
  ['cecilion', 'ling', 13], ['cecilion', 'karina', 12],
  ['akai', 'fanny', 13], ['akai', 'karina', 12],
  ['atlas', 'lancelot', 14], ['atlas', 'ling', 13], ['atlas', 'ruby', 12],
  ['lolita', 'lancelot', 13], ['lolita', 'khaleed', 12],
  ['grock', 'ling', 13], ['grock', 'lancelot', 12],
  ['johnson', 'lancelot', 12],

  // Marksman dan fighter ke tank
  ['karrie', 'minotaur', 13], ['karrie', 'grock', 13], ['karrie', 'xavier', 12],
  ['beatrix', 'minotaur', 13], ['beatrix', 'fredrinn', 12],
  ['zilong', 'claude', 14], ['zilong', 'brody', 13], ['zilong', 'hanabi', 13],
  ['layla', 'tigreal', 11], ['irithel', 'grock', 12],
  ['martis', 'yu_zhong', 13], ['martis', 'hylos', 12],
  ['khaleed', 'alice', 14], ['khaleed', 'esmeralda', 12],
  ['baxia', 'gusion', 13], ['baxia', 'harley', 13], ['baxia', 'pharsa', 12],
  ['esmeralda', 'johnson', 13], ['esmeralda', 'minsitthar', 12],
  ['paquito', 'minotaur', 13], ['paquito', 'grock', 12],

  // Support ke burst yang rapuh
  ['estes', 'beatrix', 14], ['estes', 'edith', 13], ['estes', 'cecilion', 13], ['estes', 'joy', 12],
  ['floryn', 'ling', 13], ['floryn', 'lancelot', 12],
  ['diggie', 'gusion', 13], ['diggie', 'yve', 12],
  ['kaja', 'ling', 13], ['kaja', 'lancelot', 12],
  ['barats', 'esmeralda', 12], ['barats', 'minsitthar', 12],
  ['angela', 'gusion', 12], ['franco', 'grock', 11],
  ['nana', 'claude', 12], ['hilda', 'karina', 12],
];

// [a, b, bonus] simetris: dua hero yang saling menguatkan.
export const SYNERGY_PAIRS = [
  ['yve', 'hylos', 12], ['yve', 'khufra', 11], ['yve', 'estes', 11], ['yve', 'grock', 10],
  ['luo_yi', 'estes', 12], ['luo_yi', 'grock', 11], ['luo_yi', 'angela', 10],
  ['phoveus', 'yu_zhong', 12], ['phoveus', 'yve', 11], ['phoveus', 'estes', 10],
  ['ruby', 'martis', 11], ['ruby', 'khaleed', 11], ['ruby', 'grock', 10],
  ['kagura', 'gusion', 13], ['kagura', 'ling', 11],
  ['tigreal', 'lancelot', 12], ['tigreal', 'ling', 12], ['tigreal', 'ruby', 11],
  ['atlas', 'lancelot', 12], ['franco', 'hanabi', 11], ['franco', 'brody', 11],
  ['martis', 'khaleed', 11], ['martis', 'sun', 11],
  ['hylos', 'irithel', 11], ['hylos', 'beatrix', 11], ['hylos', 'miya', 11], ['hylos', 'claude', 11],
  ['natan', 'hylos', 11], ['kaja', 'irithel', 11], ['kaja', 'gusion', 10],
  ['estes', 'miya', 11], ['estes', 'irithel', 11], ['estes', 'karrie', 11],
  ['grock', 'claude', 11], ['minotaur', 'miya', 10],
  ['roger', 'minotaur', 11],
  ['angela', 'yve', 11], ['floryn', 'claude', 11], ['barats', 'claude', 10],
  ['diggie', 'claude', 10], ['fanny', 'ruby', 10], ['khufra', 'beatrix', 10],
  ['terizla', 'angela', 10], ['johnson', 'beatrix', 10],
];

// Tier 1 paling kuat sampai tier 5 terlemah. Hero yang tidak disebut memakai DEFAULT_TIER,
// jadi matriks tetap lengkap untuk seluruh hero di registry tanpa harus mengarang angka
// untuk semuanya.
export const DEFAULT_TIER = 3;

export const TIER_BANDS = {
  1: ['gusion', 'fanny', 'layla', 'claude', 'hanabi', 'khaleed', 'yve', 'baxia', 'martis', 'silvanna'],
  2: ['ling', 'lancelot', 'hayabusa', 'karrie', 'beatrix', 'zhask', 'aamon', 'cecilion',
      'ruby', 'saber', 'esmeralda', 'lolita', 'granger', 'fredrinn', 'grock', 'phoveus'],
  3: ['bruno', 'clint', 'irithel', 'brody', 'miya', 'x_borg', 'zhuxin', 'kagura', 'pharsa',
      'vexana', 'dyrroth', 'mathilda', 'faramis', 'nana', 'hilda', 'angela', 'floryn',
      'diggie', 'barats', 'kaja', 'hylos', 'franco', 'khufra', 'akai', 'tigreal', 'minsitthar',
      'atlas', 'johnson', 'terizla', 'popol_and_kupa', 'gord', 'suyou', 'harley', 'benedetta',
      'carmilla', 'julian', 'vale', 'gloo'],
  4: ['aldous', 'alucard', 'argus', 'arlott', 'aurora', 'belerick', 'chou', 'cici', 'cyclops',
      'edith', 'eudora', 'freya', 'gatotkaca', 'guinevere', 'helcurt', 'jawhead',
      'kalea', 'lylia', 'marcel', 'masha', 'melissa', 'moskov', 'natalia',
      'natan', 'novaria', 'odette', 'paquito', 'rafaela', 'selena', 'sora', 'thamuz', 'uranus', 'valentina',
      'valir', 'wanwan', 'xavier', 'yi_sun_shin', 'yin', 'zetian',
      'aulus', 'alpha', 'chip', 'lukas', 'lunox', 'obsidia', 'hirara'],
  5: [],
};