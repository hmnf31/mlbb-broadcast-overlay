import { cp, mkdir, rm, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(projectRoot, 'cloudflare', 'public');

await mkdir(publicRoot, { recursive: true });
await rm(publicRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  .catch((error) => console.warn(`Membersihkan ${publicRoot} gagal (${error.code}), aset akan ditimpa di atas.`));
await cp(path.join(projectRoot, 'frontend'), path.join(publicRoot, 'frontend'), { recursive: true, force: true });
await cp(path.join(projectRoot, 'assets'), path.join(publicRoot, 'assets'), { recursive: true, force: true });

// The registry ships to clients and every entry is fetched straight from the browser,
// so a typo here becomes a broken image on a live stream. Fail the build instead.
const registryPath = path.join(projectRoot, 'assets', 'registry.json');
let registry;
try {
  registry = JSON.parse(await readFile(registryPath, 'utf8'));
} catch (error) {
  console.error(`assets/registry.json tidak bisa dibaca: ${error.message}`);
  process.exit(1);
}

const missing = [];
let entryCount = 0;
for (const [key, category] of Object.entries(registry.categories || {})) {
  if (!Array.isArray(category.items)) {
    console.error(`Registry kategori "${key}" tidak punya array items.`);
    process.exit(1);
  }
  for (const item of category.items) {
    entryCount += 1;
    if (!item.path?.startsWith('/assets/')) {
      missing.push(`${key}/${item.id}: path harus absolut (/assets/...), dapat "${item.path}"`);
      continue;
    }
    const relative = item.path.slice('/assets/'.length);
    try {
      await access(path.join(publicRoot, 'assets', relative));
    } catch {
      missing.push(`${key}/${item.id}: file tidak ada -> ${item.path}`);
    }
  }
}

if (missing.length) {
  console.error('Registry tidak valid:');
  for (const problem of missing) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`Cloudflare assets built in ${publicRoot}`);
console.log(`Registry valid: ${entryCount} aset dari ${Object.keys(registry.categories).length} kategori.`);
