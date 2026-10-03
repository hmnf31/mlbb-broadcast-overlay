// Alur beranda: "generate dulu, baru opsi link slug muncul". Panel link harus tetap
// tersembunyi sebelum profil dibuat, dan tidak boleh muncul lagi kalau pembuatan gagal.
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, '');

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

function section(title) {
  console.log(`\n== ${title} ==`);
}

async function boot({ createResult } = {}) {
  const [html, appSource, profileSource] = await Promise.all([
    readFile(`${ROOT}/frontend/home/index.html`, 'utf8'),
    readFile(`${ROOT}/frontend/home/app.js`, 'utf8'),
    readFile(`${ROOT}/frontend/shared/profile.js`, 'utf8'),
  ]);
  const dom = new JSDOM(html, { url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const errors = [];
  let created = 0;

  window.eval(profileSource);
  // Semua fetch dijawab gagal supaya beranda tidak bergantung pada server sungguhan; yang
  // diuji adalah alur panel link, bukan registry aset.
  window.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  window.navigator.clipboard = { writeText: async () => true };
  window.ProfileKit.create = async () => {
    created += 1;
    return createResult || { ok: true, slug: 'grandfinal01', ownerKey: 'kunci-rahasia' };
  };
  window.ProfileKit.fetchRegistry = async () => ({ ok: false, error: 'offline' });
  window.ProfileKit.knownProfiles = () => [
    { slug: 'grandfinal01', name: 'Grand Final', template: 'mlbb-gameplay', hasKey: true, createdAt: 1, updatedAt: 2 },
  ];
  window.addEventListener('error', (event) => errors.push(event.message));
  window.console.error = (...args) => errors.push(args.join(' '));
  window.eval(appSource);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { window, document: window.document, errors, createdCount: () => created };
}

section('Panel link tersembunyi sebelum generate');
{
  const { document, errors } = await boot();
  check('boot tanpa error', errors.length === 0, errors.join(' | '));
  const panel = document.getElementById('created-panel');
  check('panel link ada di DOM', Boolean(panel));
  check('panel tersembunyi sebelum profil dibuat', panel.hidden === true, String(panel.hidden));
  check('tombol buat profil ada', Boolean(document.getElementById('create-profile')));
}

section('Gagal generate: panel tetap tersembunyi');
{
  const { document, errors, createdCount } = await boot({ createResult: { ok: false, error: 'Server menolak nama profil.' } });
  document.getElementById('profile-name').value = 'Grand Final';
  document.getElementById('create-profile').dispatchEvent(new document.defaultView.Event('click'));
  await new Promise((resolve) => setTimeout(resolve, 10));

  check('create benar-benar dipanggil', createdCount() === 1, String(createdCount()));
  check('panel tetap tersembunyi setelah gagal', document.getElementById('created-panel').hidden === true);
  check('pesan error ditampilkan', /menolak nama profil/.test(document.getElementById('notice').textContent), document.getElementById('notice').textContent);
  check('tidak ada exception', errors.length === 0, errors.join(' | '));
}

section('Berhasil generate: panel link muncul');
{
  const { document, window, errors } = await boot();
  document.getElementById('profile-name').value = 'Grand Final';
  document.getElementById('create-profile').dispatchEvent(new window.Event('click'));
  await new Promise((resolve) => setTimeout(resolve, 10));

  const panel = document.getElementById('created-panel');
  check('panel muncul setelah profil dibuat', panel.hidden === false, String(panel.hidden));
  check('ringkasan menyebut slug', document.getElementById('created-summary').textContent.includes('grandfinal01'), document.getElementById('created-summary').textContent);

  const links = document.getElementById('created-links').children;
  check('satu kartu per halaman', links.length === 6, String(links.length));

  // pageUrl() selalu menutup path dengan slash, jadi pola pencocokan memperhitungkan itu.
  const codes = [...document.querySelectorAll('#created-links code')].map((code) => code.textContent);
  const has = (suffix) => codes.some((url) => url.endsWith(`${suffix}/`));
  check('link control ada', has('/p/grandfinal01/control'), codes.join(' '));
  check('link gameplay ada', has('/p/grandfinal01/overlay/gameplay'), codes.join(' '));
  check('link draft ada', has('/p/grandfinal01/overlay/draft'), codes.join(' '));
  check('link hasil ada', has('/p/grandfinal01/overlay/result'), codes.join(' '));
  check('link verifikasi ada', has('/p/grandfinal01/verify'), codes.join(' '));
  check('link kalibrasi ada', has('/p/grandfinal01/debug'), codes.join(' '));
  check('semua link memuat slug profil', codes.every((url) => url.includes('/p/grandfinal01/')), codes.join(' '));

  check('ownerKey tidak pernah ditampilkan', !document.getElementById('created-panel').textContent.includes('kunci-rahasia'), 'ownerKey bocor');
  check('input nama dikosongkan', document.getElementById('profile-name').value === '', document.getElementById('profile-name').value);
  check('tombol generate aktif lagi', document.getElementById('create-profile').disabled === false);
  check('tidak ada exception', errors.length === 0, errors.join(' | '));
}

section('Tombol control dan tutup');
{
  const { document, window } = await boot();
  document.getElementById('create-profile').dispatchEvent(new window.Event('click'));
  await new Promise((resolve) => setTimeout(resolve, 10));
  check('tombol buka control ada', Boolean(document.getElementById('created-control')));

  document.getElementById('created-dismiss').dispatchEvent(new window.Event('click'));
  check('tutup menyembunyikan panel', document.getElementById('created-panel').hidden === true, String(document.getElementById('created-panel').hidden));
}

console.log(`\n${'='.repeat(52)}`);
console.log(`home flow: ${passed} ok, ${failed} gagal`);
if (failures.length) {
  console.log('\nGagal:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
process.exit(failed ? 1 : 0);