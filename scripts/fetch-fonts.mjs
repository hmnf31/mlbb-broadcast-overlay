// Font Stitch diambil dari Google Fonts, tapi overlay WAJIB jalan offline di OBS: tidak ada
// CDN boleh dipakai. Jadi file woff2-nya diunduh sekali ke assets/fonts/ dan dilayani lokal
// dari Worker seperti aset gambar.
//
// Subset yang dipakai cuma `latin`; `latin-ext` dan set bahasa lain cuma menambah ukuran tanpa
// mengubah tampilan karakter yang benar-benar muncul di overlay.
//
// Jalankan ulang hanya kalau daftar font di bawah berubah:
//   node scripts/fetch-fonts.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = path.join(projectRoot, 'assets', 'fonts');

// UA modern dipakai supaya Google Fonts mengembalikan woff2. Tanpa ini Google Fonts
// mengembalikan ttf yang jauh lebih besar.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Chivo italic sengaja tidak diambil: tidak ada teks miring di desain maupun di overlay, jadi
// memakainya hanya menambah 15 KB dan membuat browser membuat miring palsu kalau ada yang
// keliru menulis `font-style: italic`.
const FAMILIES = [
  { css: 'Anton', weights: [400] },
  { css: 'Chivo:wght@400;700;800;900', weights: [400, 700, 800, 900] },
  { css: 'JetBrains+Mono:wght@500;700', weights: [500, 700] },
];

// Subset latin dicocokkan dari komentar `/* latin */` tepat sebelum blok @font-face.
function parseFaces(css) {
  // Google Fonts menandai tiap blok @font-face dengan komentar subset, jadi css dipecah pada
  // penanda itu dan hanya `latin` yang diambil.
  const faces = [];
  const parts = css.split(/\/\*\s*([a-z0-9-]+)\s*\*\//i);
  for (let index = 1; index < parts.length; index += 2) {
    const subset = parts[index];
    const body = parts[index + 1] || '';
    const family = /font-family:\s*'([^']+)'/.exec(body)?.[1];
    const weight = /font-weight:\s*(\d+)/.exec(body)?.[1];
    const style = /font-style:\s*(\w+)/.exec(body)?.[1] || 'normal';
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1];
    if (subset === 'latin' && family && weight && url) faces.push({ family, weight, style, url });
  }
  return faces;
}

await mkdir(fontDir, { recursive: true });

const written = [];
for (const family of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${family.css}&display=swap`;
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) {
    console.error(`Gagal ambil CSS ${family.css}: status ${response.status}`);
    process.exit(1);
  }
  const faces = parseFaces(await response.text());
  if (!faces.length) {
    console.error(`Tidak ada subset latin di CSS ${family.css}.`);
    process.exit(1);
  }
  for (const face of faces) {
    if (!family.weights.includes(Number(face.weight))) continue;
    const suffix = face.style === 'italic' ? '-italic' : '';
    const file = `${face.family.toLowerCase().replace(/\s+/g, '-')}-${face.weight}${suffix}.woff2`;
    const fontResponse = await fetch(face.url, { headers: { 'User-Agent': UA } });
    if (!fontResponse.ok) {
      console.error(`Gagal ambil ${file}: status ${fontResponse.status}`);
      process.exit(1);
    }
    const bytes = Buffer.from(await fontResponse.arrayBuffer());
    await writeFile(path.join(fontDir, file), bytes);
    written.push({ file, bytes: bytes.length });
    console.log(`  ${file}  ${(bytes.length / 1024).toFixed(1)} KB`);
  }
}

const total = written.reduce((sum, item) => sum + item.bytes, 0);
console.log(`${written.length} font file, total ${(total / 1024).toFixed(1)} KB di assets/fonts/`);