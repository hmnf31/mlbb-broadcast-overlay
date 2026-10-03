// Menarik aset hero + item dari database MLBB publik dan menulis ulang registry.
//
// Sumber: https://github.com/Ceplin03/database-mlbb.Mobile-Legends-Bang-Bang
// Dipakai karena repo itu sudah punya ikon hero (133) dan equipment (104) dengan nama asli.
// Jalankan sekali, lalu jalankan ulang kalau mau update:
//
//   git clone --filter=blob:none --no-checkout --depth 1 <repo> %TEMP%\mlbb-repo
//   git -C %TEMP%\mlbb-repo sparse-checkout set images-hero logo-equipment
//   git -C %TEMP%\mlbb-repo checkout
//   node scripts/sync-mlbb-assets.mjs %TEMP%\mlbb-repo
//
// Kategori tim dan template di registry.json tidak disentuh: file itu bukan dari repo ini.
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = process.argv[2];
if (!sourceRoot || !existsSync(sourceRoot)) {
  console.error('Pemakaian: node scripts/sync-mlbb-assets.mjs <path-clone-repo>');
  process.exit(1);
}

const assetsRoot = path.join(projectRoot, 'assets');
const registryPath = path.join(assetsRoot, 'registry.json');
const registry = JSON.parse(await readFile(registryPath, 'utf8'));

const slugify = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const heroes = JSON.parse(await readFile(path.join(sourceRoot, 'hero.json'), 'utf8'));
const equipment = JSON.parse(await readFile(path.join(sourceRoot, 'equipment.json'), 'utf8'));

await rm(path.join(assetsRoot, 'heroes'), { recursive: true, force: true });
await rm(path.join(assetsRoot, 'items'), { recursive: true, force: true });
await mkdir(path.join(assetsRoot, 'heroes'), { recursive: true });
await mkdir(path.join(assetsRoot, 'items'), { recursive: true });

await cp(path.join(sourceRoot, 'images-hero'), path.join(assetsRoot, 'heroes'), { recursive: true });
await cp(path.join(sourceRoot, 'logo-equipment'), path.join(assetsRoot, 'items'), { recursive: true });

const heroItems = heroes
  .filter((hero) => hero?.['images-hero'])
  .map((hero) => {
    const file = hero['images-hero'];
    // hero.json memakai `name_hero`, equipment.json memakai `name-equipment`.
    const name = hero.name_hero || hero['name-hero'] || path.basename(file, '.png');
    return {
      id: slugify(name),
      name,
      path: `/assets/heroes/${file}`,
      role: (Array.isArray(hero.role) ? hero.role : [hero.role]).filter(Boolean).join(', '),
    };
  });

const itemItems = equipment
  .filter((item) => item?.['logo-equipment'] && (item['name-equipment'] || item.name_equipment))
  .map((item) => {
    const name = item['name-equipment'] || item.name_equipment;
    return {
      id: slugify(name),
      name: name.replace(/\\u0027/g, "'"),
      path: `/assets/items/${item['logo-equipment']}`,
      price: Number(item['prize-gold']) || 0,
    };
  });

registry.schemaVersion = 1;
registry.generatedAt = new Date().toISOString().slice(0, 10);
registry.source = {
  name: 'database-mlbb.Mobile-Legends-Bang-Bang',
  url: 'https://github.com/Ceplin03/database-mlbb.Mobile-Legends-Bang-Bang',
};
registry.categories.heroes = {
  label: 'Hero',
  items: heroItems.sort((a, b) => a.name.localeCompare(b.name)),
};
registry.categories.items = {
  label: 'Item',
  items: itemItems.sort((a, b) => a.name.localeCompare(b.name)),
};

await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
console.log(`heroes: ${heroItems.length}, items: ${itemItems.length}`);
console.log(`registry ditulis: ${registryPath}`);