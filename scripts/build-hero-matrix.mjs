// Membangun assets/hero-matrix.json dari tabel kurasi di draft-matrix-source.mjs.
//
// Matriks ini yang dibaca frontend dan Worker, jadi bentuknya harus stabil: frontend dan
// Worker hanya tahu bentuk file hasil build ini, bukan isi tabel kurasi. Mengganti sumber
// data (feed berlisensi, API resmi, dst) cukup lewat file sumber + build ulang.
//
// Validasi id itu wajib, bukan sekadar Killed: id karangan akan diam-diam jadi hero dengan
// advantage 0 selamanya, dan itu jauh lebih sulit noticed daripada error build.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  MATRIX_PATCH,
  MATRIX_SCHEMA_VERSION,
  ROLE_ADVANTAGE,
  ROLE_WEIGHT,
  COUNTER_PAIRS,
  SYNERGY_PAIRS,
  DEFAULT_TIER,
  TIER_BANDS,
} from './draft-matrix-source.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const NOTICE = [
  'Matriks draft kurasi manual. BUKAN statistik mlbb.tools dan bukan hasil scraping.',
  'Angka `advantage` adalah indeks heuristik, bukan prediksi kemenangan berbasis data pertandingan.',
  'Sumber mlbb.tools tidak dipakai karena /api/ ada di robots.txt Disallow.',
  'Untuk sumber data berlisensi, ganti scripts/draft-matrix-source.mjs lalu jalankan npm run build:matrix.',
].join(' ');

function primaryRole(role) {
  const first = String(role || '').split(',')[0].trim().toLowerCase();
  return ROLE_ADVANTAGE[first] ? first : 'fighter';
}

const registry = JSON.parse(await readFile(path.join(projectRoot, 'assets', 'registry.json'), 'utf8'));
const heroes = registry.categories?.heroes?.items;
if (!Array.isArray(heroes) || !heroes.length) {
  console.error('assets/registry.json tidak punya categories.heroes.items.');
  process.exit(1);
}

const validIds = new Set(heroes.map((hero) => hero.id));
const unknown = new Set();
const claim = (id, context) => {
  if (!validIds.has(id)) unknown.add(`${id}  (${context})`);
};

// Terapkan band tier ke setiap hero yang disebut.
const tierById = new Map();
for (const [tier, ids] of Object.entries(TIER_BANDS)) {
  for (const id of ids) {
    claim(id, `TIER_BANDS tier ${tier}`);
    if (tierById.has(id)) unknown.add(`${id}  (duplikat di TIER_BANDS tier ${tier})`);
    tierById.set(id, Number(tier));
  }
}

// Counter: satu entri berlaku dua arah supaya tabel tidak bisa tidak konsisten.
// Disimpan PER-PASANG, bukan dijumlah jadi angka tunggal. Versi lama menjumlahkannya jadi
// `counters`/`counteredBy` aggregate, dan itu menghapus arah: "Fanny beat Gusion" jadi
// tidak bisa dibedakan dari "Gusion beat Fanny" sehingga tabel kurasi tidak pernah benar-benar
// dipakai. Arah Aggregate hanya dipakai untuk sorting.
const beats = new Map();
const loses = new Map();
const setPair = (map, key, target, value) => map.set(key, { ...(map.get(key) || {}), [target]: value });
for (const [winner, loser, weight] of COUNTER_PAIRS) {
  claim(winner, 'COUNTER_PAIRS');
  claim(loser, 'COUNTER_PAIRS');
  setPair(beats, winner, loser, weight);
  setPair(loses, loser, winner, weight);
}

// Synergy simetris: A+B sama dengan B+A, jadi cukup satu arah saat disimpan.
const synergy = new Map();
const bumpPair = (a, b, value) => {
  synergy.set(a, { ...(synergy.get(a) || {}), [b]: value });
  synergy.set(b, { ...(synergy.get(b) || {}), [a]: value });
};
for (const [a, b, bonus] of SYNERGY_PAIRS) {
  if (a === b) {
    unknown.add(`${a}  (SYNGERGY_PAIRS hero berpasangan dengan dirinya sendiri)`);
    continue;
  }
  claim(a, 'SYNERGY_PAIRS');
  claim(b, 'SYNERGY_PAIRS');
  bumpPair(a, b, bonus);
}

if (unknown.size) {
  console.error('draft-matrix-source.mjs memakai id hero yang tidak ada di assets/registry.json:');
  for (const problem of [...unknown].sort()) console.error(`  - ${problem}`);
  console.error(`\nTotal ${unknown.size} masalah. Perbaiki file sumber lalu jalankan ulang.`);
  process.exit(1);
}

// Tier -> power. Dipakai analytics sebagai baseline kekuatan hero, terpisah dari advantage.
const TIER_POWER = { 1: 12, 2: 7, 3: 2, 4: -3, 5: -8 };

const sumValues = (record) => Object.values(record).reduce((total, value) => total + value, 0);

const entries = {};
for (const hero of heroes) {
  const tier = tierById.get(hero.id) || DEFAULT_TIER;
  const heroBeats = beats.get(hero.id) || {};
  const heroLoses = loses.get(hero.id) || {};
  entries[hero.id] = {
    name: hero.name || hero.id,
    // Path artwork diambil verbatim dari registry. Diturunkan sendiri sebagai
    // `/assets/heroes/<id>.png` di overlay akan merusak setiap hero yang nama filenya bukan
    // id: chang_e -> chang27e.png, lapu_lapu -> lapu-lapu.png, x_borg -> xborg.png,
    // yi_sun_shin -> yi_sun-shin.png.
    art: hero.path,
    role: primaryRole(hero.role),
    tier,
    power: TIER_POWER[tier],
    // Arah penting: `beats[x]` berarti hero ini menang atas x, `loses[x]` berarti x menang
    // atas hero ini.
    beats: heroBeats,
    loses: heroLoses,
    synergy: synergy.get(hero.id) || {},
    strength: {
      beats: sumValues(heroBeats),
      loses: sumValues(heroLoses),
    },
  };
}

const matrix = {
  schemaVersion: MATRIX_SCHEMA_VERSION,
  patch: MATRIX_PATCH,
  source: 'curated',
  notice: NOTICE,
  weights: { role: ROLE_WEIGHT },
  roleAdvantage: ROLE_ADVANTAGE,
  curated: {
    counterPairs: COUNTER_PAIRS.length,
    synergyPairs: SYNERGY_PAIRS.length,
    heroesWithTier: tierById.size,
  },
  heroes: entries,
};

const outputPath = path.join(projectRoot, 'assets', 'hero-matrix.json');
await writeFile(outputPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');

const bytes = Buffer.byteLength(JSON.stringify(matrix));
console.log(`Hero matrix written to ${outputPath}`);
console.log(`  ${Object.keys(entries).length} hero, ${COUNTER_PAIRS.length} counter pair, ${SYNERGY_PAIRS.length} synergy pair`);
console.log(`  ${bytes} bytes${bytes > 900_000 ? '  (PERINGATAN: approaching the 1MB assets budget)' : ''}`);