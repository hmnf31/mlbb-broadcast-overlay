// Fase 1 regression test: the control panel must boot and keep drag positions without
// any Posisi X/Y inputs. Runs app.js inside jsdom against the real control/index.html.
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, '');
const html = await readFile(`${ROOT}/frontend/control/index.html`, 'utf8');
const appSource = await readFile(`${ROOT}/frontend/control/app.js`, 'utf8');
const profileSource = await readFile(`${ROOT}/frontend/shared/profile.js`, 'utf8');

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

const dom = new JSDOM(html, {
  url: 'http://127.0.0.1:8787/p/testslug12345/control/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});

const { window } = dom;
const errors = [];

// The control page talks to ProfileKit and LiveSocket. ProfileKit itself is the real file
// so the profile nav is exercised for real; only the network calls are replaced.
window.eval(profileSource);
const Kit = window.ProfileKit;
window.localStorage.setItem('mlbb_overlay_key_testslug12345', 'k'.repeat(32));
Kit.describe = async () => ({ ok: true, profile: { name: 'Profil Tes', claimed: true } });
Kit.claim = async () => ({ ok: true, ownerKey: 'k'.repeat(32) });
Kit.pushState = async () => ({ ok: true });
Kit.fetchState = async () => ({ ok: false });
const sentMessages = [];
window.LiveSocket = {
  create: (options) => {
    sentMessages.push(options);
    return {
      start: async () => true,
      stop: () => {},
      send: () => 'sent',
      reconnectNow: () => {},
      get status() { return 'online'; },
    };
  },
};
window.addEventListener('error', (event) => errors.push(event.message));
window.console.error = (...args) => errors.push(args.join(' '));

// jsdom does not implement the pointer capture API. Real browsers do; the app must not
// depend on it, and the polyfill lets this test exercise the actual drag maths.
if (typeof window.Element.prototype.setPointerCapture !== 'function') {
  window.Element.prototype.setPointerCapture = function setPointerCapture() {};
  window.Element.prototype.releasePointerCapture = function releasePointerCapture() {};
  window.Element.prototype.hasPointerCapture = function hasPointerCapture() { return false; };
}

try {
  window.eval(appSource);
} catch (error) {
  errors.push(`boot: ${error.message}`);
}

section('Boot tanpa error');
check('app.js boot tanpa exception', errors.length === 0, errors.slice(0, 3).join(' | '));

const { document } = window;
const form = document.getElementById('control-form');

section('Input Posisi X/Y dihapus');
const layoutInputs = [...form.querySelectorAll('[name^="layout_"]')];
check('tidak ada input layout_* di form', layoutInputs.length === 0, `${layoutInputs.length} tersisa`);
check('tidak ada label "Posisi" di form', [...form.querySelectorAll('label')].every((l) => !/Posisi\s+[XY]/i.test(l.textContent)));
check('petunjuk drag tersedia', Boolean(document.querySelector('.preview-hint')), 'elemen .preview-hint tidak ada');

section('Preview dirender dan bisa di-drag');
const previewStage = document.getElementById('preview-stage');
const previewItems = [...previewStage.querySelectorAll('.preview-item')];
check('preview punya item', previewItems.length > 0, `${previewItems.length} item`);
check('semua item punya data-layout-key', previewItems.every((el) => Boolean(el.dataset.layoutKey)));

// Drag the match timer and make sure the new position survives readFormValues(), which is
// where the old code silently reset every custom item back to 0,0.
const timerItem = previewItems.find((el) => el.dataset.layoutKey === 'matchTimer');
check('item matchTimer ada di preview', Boolean(timerItem));
if (timerItem) {
  // jsdom has no layout engine, so clientWidth is always 0. Pin it to 1280 so the drag
  // scale is exactly 1 and the expected position can be asserted precisely.
  Object.defineProperty(previewStage, 'clientWidth', { value: 1280, configurable: true });

  timerItem.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 100, clientY: 100 }));
  timerItem.dispatchEvent(new window.PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 180, clientY: 160 }));
  timerItem.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 180, clientY: 160 }));

  const saved = JSON.parse(window.localStorage.getItem('mlbb_overlay_config_testslug12345') || '{}');
  const moved = saved.layout?.matchTimer || null;
  check('drag benar-benar tersimpan ke localStorage', Boolean(saved.layout), `layout keys: ${Object.keys(saved.layout || {}).length}`);
  // Default is x=520 y=118; pointer moved +80/+60 with scale 1.
  check('posisi timer tepat mengikuti kursor', moved?.x === 600 && moved?.y === 178, JSON.stringify(moved));
  check('posisi tetap di dalam kanvas 1280x720',
    moved !== null && Number.isFinite(moved.x) && moved.x >= 0 && moved.x <= 1280
    && Number.isFinite(moved.y) && moved.y >= 0 && moved.y <= 720,
    JSON.stringify(moved));

  const customImage = saved.layout?.customImage1;
  check('posisi item custom tidak direset ke 0,0', !customImage || (customImage.x !== 0 && customImage.y !== 0),
    JSON.stringify(customImage));
  check('semua item bawaan tetap punya posisi', ['tournamentName', 'blueLogo', 'redGold', 'casterName']
    .every((key) => Number.isFinite(saved.layout?.[key]?.x)), JSON.stringify(Object.keys(saved.layout || {}).length));
  check('tidak ada error setelah drag', errors.length === 0, errors.slice(0, 2).join(' | '));
}

section('Drag tidak bocor keluar kanvas');
{
  // Scale 4 (preview 320px wide): a 5000px pointer jump must be clamped, not stored raw.
  Object.defineProperty(previewStage, 'clientWidth', { value: 320, configurable: true });
  const item = previewItems.find((el) => el.dataset.layoutKey === 'blueLogo') || previewItems[0];
  item.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, pointerId: 3, clientX: 0, clientY: 0 }));
  item.dispatchEvent(new window.PointerEvent('pointermove', { bubbles: true, pointerId: 3, clientX: 5000, clientY: 5000 }));
  item.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerId: 3, clientX: 5000, clientY: 5000 }));
  const saved = JSON.parse(window.localStorage.getItem('mlbb_overlay_config_testslug12345') || '{}');
  const pos = saved.layout?.[item.dataset.layoutKey];
  check('posisi di-clamp ke maksimal kanvas', pos?.x <= 1280 && pos?.y <= 720, JSON.stringify(pos));
}

section('Seri BO2');
{
  const bo2Dot = (team, game) => document.querySelector(`.bo2-row[data-team="${team}"] .bo2-dot[data-game="${game}"]`);
  const bo2EnabledInput = document.getElementById('bo2-enabled');

  check('editor BO2 ada di halaman control', Boolean(bo2Dot('blue', 0) && bo2Dot('red', 1)));
  check('ada 4 titik BO2 (2 game x 2 tim)',
    document.querySelectorAll('#bo2-editor .bo2-dot').length === 4);
  check('semua titik mulai kosong',
    [...document.querySelectorAll('#bo2-editor .bo2-dot')].every((dot) => dot.dataset.state === 'pending'));
  check('titik BO2 ada di preview sebagai item draggable',
    ['bo2Blue', 'bo2Red'].every((key) => document.querySelector(`.preview-item[data-layout-key="${key}"]`)));

  bo2Dot('blue', 0).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('klik blue game 1 = merah', bo2Dot('blue', 0).dataset.state === 'win');
  check('game 1 jadi tanda kalah di tim merah',
    bo2Dot('red', 0).dataset.state === 'lose', bo2Dot('red', 0).dataset.state);
  check('game 2 tetap kosong di kedua tim',
    bo2Dot('blue', 1).dataset.state === 'pending' && bo2Dot('red', 1).dataset.state === 'pending');

  let stored = JSON.parse(window.localStorage.getItem('mlbb_overlay_config_testslug12345') || '{}');
  check('kemenangan tersimpan sebagai satu sumber kebenaran',
    stored.match?.bo2?.games?.[0]?.winner === 'blue' && stored.match?.bo2?.games?.[1]?.winner === null,
    JSON.stringify(stored.match?.bo2));

  bo2Dot('red', 1).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  stored = JSON.parse(window.localStorage.getItem('mlbb_overlay_config_testslug12345') || '{}');
  check('match 1-1: tiap tim punya satu menang satu kalah',
    stored.match.bo2.games[0].winner === 'blue' && stored.match.bo2.games[1].winner === 'red',
    JSON.stringify(stored.match.bo2.games));
  check('bestOf dikunci di 2', stored.match.bo2.bestOf === 2);

  bo2Dot('blue', 0).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  stored = JSON.parse(window.localStorage.getItem('mlbb_overlay_config_testslug12345') || '{}');
  check('klik titik yang sama mengosongkan game itu', stored.match.bo2.games[0].winner === null);
  check('game lain tidak ikut berubah', stored.match.bo2.games[1].winner === 'red');

  document.getElementById('bo2-reset').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  stored = JSON.parse(window.localStorage.getItem('mlbb_overlay_config_testslug12345') || '{}');
  check('reset seri mengosongkan semua game',
    stored.match.bo2.games.every((game) => game.winner === null), JSON.stringify(stored.match.bo2.games));

  bo2EnabledInput.checked = true;
  bo2EnabledInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  stored = JSON.parse(window.localStorage.getItem('mlbb_overlay_config_testslug12345') || '{}');
  check('checkbox mengaktifkan indikator', stored.match.bo2.enabled === true);
  check('game tidak bisa punya dua pemenang sekaligus',
    stored.match.bo2.games.every((game) => game.winner === null || game.winner === 'blue' || game.winner === 'red'));
}

section('Nav halaman profil');
const nav = document.getElementById('profile-nav');
check('nav profil ada di halaman control', Boolean(nav));
const navLinks = nav ? [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [];
check('nav menautkan control', navLinks.includes('/p/testslug12345/control/'));
check('nav menautkan overlay gameplay', navLinks.includes('/p/testslug12345/overlay/gameplay/'));
check('nav menautkan kalibrasi OCR', navLinks.includes('/p/testslug12345/debug/'));
check('nav menautkan beranda', navLinks.includes('/'));
check('nav menandai halaman yang sedang dibuka',
  nav?.querySelector('[aria-current="page"]')?.getAttribute('href') === '/p/testslug12345/control/');
check('nav menautkan layar hasil',
  navLinks.includes('/p/testslug12345/overlay/result/'));
check('navoffers tombol salin URL OBS',
  [...(nav?.querySelectorAll('button') || [])].some((b) => b.textContent.includes('OBS')));

section('Item custom tidak punya input X/Y');
const customEditors = [...document.querySelectorAll('.custom-item-editor')];
check('ada editor item custom', customEditors.length > 0, `${customEditors.length} editor`);
check('editor item custom tidak punya field x/y',
  customEditors.every((editor) => !editor.querySelector('[data-field="x"]') && !editor.querySelector('[data-field="y"]')));
check('editor item custom tetap punya field teks',
  customEditors.some((editor) => editor.querySelector('[data-field="text"]')));

section('Klik tanpa geser tidak membakar broadcast');
{
  const before = sentMessages.length;
  const item = previewItems[0];
  item.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, pointerId: 2, clientX: 10, clientY: 10 }));
  item.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerId: 2, clientX: 10, clientY: 10 }));
  check('klik tanpa movement tidak mengirim update', sentMessages.length === before, `${sentMessages.length - before} pesan extra`);
}

section('Socket profile-aware');
check('liveSocket dibuat dengan slug', sentMessages[0]?.slug === 'testslug12345', JSON.stringify(sentMessages[0]?.slug));
check('liveSocket membawa ownerKey', sentMessages[0]?.ownerKey === 'k'.repeat(32));

console.log(`\n========================================`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const item of failures) console.log(`  - ${item}`);
}
console.log(`========================================`);
window.close();
process.exit(failed === 0 ? 0 : 1);