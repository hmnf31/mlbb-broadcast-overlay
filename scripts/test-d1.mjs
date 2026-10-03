// D1 integration test: public gallery + feedback. Needs `wrangler dev` with the D1
// binding and the schema applied (see cloudflare/README-d1.md).
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8787';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` -- ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

const section = (title) => console.log(`\n== ${title} ==`);

async function api(path, options = {}) {
  const target = /^https?:/i.test(path) ? path : `${BASE}${path}`;
  const response = await fetch(target, options);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: response.status, json, text };
}

const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function main() {
  section('Galeri:UTHENTICATED publish');
  const created = await api('/api/profiles', json({ name: 'Profil Galeri', includeKey: true }));
  const slug = created.json.slug;
  const key = created.json.ownerKey;

  const noKey = await api('/api/gallery', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, name: 'Profil Galeri' }),
  });
  check('publish tanpa ownerKey = 403', noKey.status === 403, `status ${noKey.status}`);

  const wrongKey = await api('/api/gallery', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, name: 'X', ownerKey: 'z'.repeat(32) }),
  });
  check('publish dengan ownerKey salah = 403', wrongKey.status === 403, `status ${wrongKey.status}`);

  const badSlug = await api('/api/gallery', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'BUKAN SLUG', ownerKey: key }),
  });
  check('publish slug invalid = 400', badSlug.status === 400, `status ${badSlug.status}`);

  const published = await api('/api/gallery', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, name: 'Final Grand Final', blueTeam: 'Blue Phoenix', redTeam: 'Red Viper', ownerKey: key }),
  });
  check('publish dengan ownerKey benar = 200', published.status === 200, `status ${published.status}`);

  section('Galeri: public read');
  const list = await api('/api/gallery');
  check('GET galeri = 200', list.status === 200, `status ${list.status}`);
  check('galeri menandai fiturnya aktif', list.json?.enabled === true);
  const entry = (list.json?.entries || []).find((e) => e.slug === slug);
  check('entri muncul di galeri', Boolean(entry));
  check('entri menyimpan nama dan tim', entry?.name === 'Final Grand Final' && entry?.blue_team === 'Blue Phoenix' && entry?.red_team === 'Red Viper', JSON.stringify(entry));
  check('galeri tidak membocorkan ownerKey', !JSON.stringify(list.json).includes(key));

  const republish = await api('/api/gallery', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, name: 'Nama Baru', ownerKey: key }),
  });
  check('publish ulang = update (upsert)', republish.status === 200);
  const afterUpdate = await api('/api/gallery');
  const updated = (afterUpdate.json?.entries || []).find((e) => e.slug === slug);
  check('nama ter-update', updated?.name === 'Nama Baru', JSON.stringify(updated?.name));
  check('tidak ada duplikat slug', (afterUpdate.json?.entries || []).filter((e) => e.slug === slug).length === 1);

  const limited = await api('/api/gallery?limit=1');
  check('limit dipatuhi', (limited.json?.entries || []).length <= 1, `${limited.json?.entries?.length} entri`);

  const hugeLimit = await api('/api/gallery?limit=99999');
  check('limit dibatasi maksimal 50', hugeLimit.status === 200 && (hugeLimit.json?.entries || []).length <= 50);

  section('Galeri: unpublish');
  const unpublishBad = await api('/api/gallery', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, ownerKey: 'q'.repeat(32) }),
  });
  check('unpublish tanpa key benar = 403', unpublishBad.status === 403, `status ${unpublishBad.status}`);

  const unpublish = await api('/api/gallery', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, ownerKey: key }),
  });
  check('unpublish = 200', unpublish.status === 200, `status ${unpublish.status}`);

  const afterUnpublish = await api('/api/gallery');
  check('entri hilang dari galeri', !(afterUnpublish.json?.entries || []).some((e) => e.slug === slug));

  const stateStillThere = await api(`/api/p/${slug}/state`);
  check('unpublish tidak menghapus profil', stateStillThere.status === 200, `status ${stateStillThere.status}`);

  section('Feedback');
  const tooShort = await api('/api/feedback', json({ message: 'pendek' }));
  check('pesan terlalu pendek = 400', tooShort.status === 400, `status ${tooShort.status}`);

  const honeypot = await api('/api/feedback', json({ message: 'ini pesan bot yang panjang sekali', website: 'http://spam.example' }));
  check('honeypot diterima diam-diam (200)', honeypot.status === 200, `status ${honeypot.status}`);

  const spamStored = await api('/api/feedback', json({ message: 'pesan bot kedua yang juga panjang', website: 'x' }));
  check('honeypot tidak error', spamStored.status === 200);

  const good = await api('/api/feedback', json({ kind: 'bug', message: 'Tombol reset tidak mereset skor di halaman debug.', contact: 'user@example.com' }));
  check('feedback valid = 201', good.status === 201, `status ${good.status}`);

  const noKind = await api('/api/feedback', json({ message: 'Permintaan fitur baru untuk mode ranking.' }));
  check('feedback tanpa kind tetap diterima', noKind.status === 201, `status ${noKind.status}`);

  const badKind = await api('/api/feedback', json({ kind: '<script>alert(1)</script>', message: 'Jenis tidak dikenal harus difallback.' }));
  check('kind asing tidak cause error', badKind.status === 201, `status ${badKind.status}`);

  const notObject = await fetch(`${BASE}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '"bukan object"',
  });
  check('body bukan object = 400', notObject.status === 400, `status ${notObject.status}`);

  const brokenJson = await fetch(`${BASE}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bukan json',
  });
  check('json rusak = 400', brokenJson.status === 400, `status ${brokenJson.status}`);

  section('Data benar-benar tersimpan');
  const rows = await api('/api/gallery');
  check('query galeri tidak error setelah feedback', rows.status === 200, `status ${rows.status}`);

  console.log(`\n========================================`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const item of failures) console.log(`  - ${item}`);
  }
  console.log(`========================================`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nSuite crashed:', error);
  process.exit(1);
});