// Fase 0 multi-profile test suite.
// Run against `wrangler dev` on port 8787 from the cloudflare/ directory.
import { readFile } from 'node:fs/promises';

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

async function api(path, options = {}) {
  // Accept both a path ("/api/site") and an absolute URL (a redirect Location header).
  const target = /^https?:/i.test(path) ? path : `${BASE}${path}`;
  const response = await fetch(target, options);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON response */
  }
  return { status: response.status, json, text, headers: response.headers };
}

const jsonHeaders = (key) => ({
  'Content-Type': 'application/json',
  ...(key ? { 'x-overlay-key': key } : {}),
});

async function createProfile(name, template = 'mlbb-gameplay') {
  const result = await api('/api/profiles', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ name, template, includeKey: true }),
  });
  return result.json;
}

async function openSocket(slug) {
  const { WebSocket } = await import('ws').catch(() => ({ WebSocket: globalThis.WebSocket }));
  const socket = new WebSocket(`${BASE.replace('http', 'ws')}/api/p/${slug}/live`);
  const queue = [];
  const waiters = [];

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    queue.push(message);
    for (const waiter of [...waiters]) {
      if (waiter.match(message)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      }
    }
  });

  const socketWrapper = {
    socket,
    opened: new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve);
      socket.addEventListener('error', reject);
    }),
    all: () => [...queue],
    send: (message) => socket.send(JSON.stringify(message)),
    waitFor(match, timeoutMs = 5000) {
      const existing = queue.find(match);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const waiter = { match, resolve };
        waiters.push(waiter);
        setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error('timeout waiting for message'));
        }, timeoutMs);
      });
    },
    close: () => socket.close(),
  };
  await socketWrapper.opened;
  return socketWrapper;
}

function section(title) {
  console.log(`\n== ${title} ==`);
}

async function main() {
  section('Static + routing');
  {
    const home = await api('/');
    check('home page served at /', home.status === 200 && home.text.includes('Beranda'), `status ${home.status}`);

    const registry = await api('/assets/registry.json');
    check('registry served statically', registry.status === 200 && registry.json?.categories, `status ${registry.status}`);
    check('registry has gameplay-template', Boolean(registry.json?.categories?.overlays?.items?.some((i) => i.id === 'gameplay-template')));

    const control = await api('/frontend/control/index.html');
    check('control html uses absolute script paths', control.text.includes('/frontend/shared/profile.js') && !control.text.includes('src="./app.js"'));

    const overlay = await api('/frontend/overlay/gameplay/index.html');
    check('overlay html uses absolute asset paths', overlay.text.includes('src="/assets/teams/blue-phoenix.svg"'));
  }

  section('Legacy redirect');
  let legacySlug = null;
  {
    const legacy = await api('/frontend/overlay/gameplay/', { redirect: 'manual' });
    check('legacy gameplay path redirects', legacy.status === 302, `status ${legacy.status}`);
    legacySlug = legacy.headers.get('location')?.match(/\/p\/([^/]+)\//)?.[1] || null;
    check('legacy redirect points at a profile', Boolean(legacySlug), `location ${legacy.headers.get('location')}`);

    const legacyControl = await api('/frontend/control/', { redirect: 'manual' });
    check('legacy control path redirects', legacyControl.status === 302, `status ${legacyControl.status}`);

    if (legacySlug) {
      const followed = await api(legacy.headers.get('location'));
      check('legacy redirect lands on a working profile page', followed.status === 200 && followed.text.includes('blue-logo'), `status ${followed.status}`);
    }
  }

  section('Profile creation');
  const alpha = await createProfile('Profil Alpha');
  const beta = await createProfile('Profil Beta', 'mlbb-result');
  check('alpha created with 14-char slug', typeof alpha.slug === 'string' && alpha.slug.length === 14, JSON.stringify(alpha.slug));
  check('alpha returns ownerKey once', typeof alpha.ownerKey === 'string' && alpha.ownerKey.length === 32);
  check('beta created', typeof beta.slug === 'string' && beta.slug !== alpha.slug);
  check('beta template honoured', beta.template === 'mlbb-result', beta.template);

  {
    const duplicate = await api('/api/profiles', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: 'Duplikat', slug: alpha.slug }),
    });
    check('duplicate slug rejected with 409', duplicate.status === 409, `status ${duplicate.status}`);

    const noKey = await api('/api/profiles', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: 'Tanpa key' }),
    });
    check('ownerKey omitted unless includeKey', noKey.json && noKey.json.ownerKey === undefined);

    const withKeyState = await api(`/api/p/${alpha.slug}`);
    check('profile created with includeKey is already claimed', withKeyState.json?.profile?.claimed === true);

    const badSlug = await api('/api/profiles', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: 'Buruk', slug: 'ADA SPASI!' }),
    });
    check('invalid slug rejected', badSlug.status === 400, `status ${badSlug.status}`);
  }

  section('Isolation between profiles');
  {
    const write = await api(`/api/p/${alpha.slug}/state`, {
      method: 'PUT',
      headers: jsonHeaders(alpha.ownerKey),
      body: JSON.stringify({ match: { timer: 4242, blueKills: 11 } }),
    });
    check('owner can write state', write.status === 200, `status ${write.status}`);

    const alphaState = await api(`/api/p/${alpha.slug}/state`);
    check('alpha read back its own write', alphaState.json?.payload?.match?.timer === 4242, JSON.stringify(alphaState.json?.payload?.match?.timer));
    check('snapshot carries profile metadata', alphaState.json?.payload?.profile?.name === 'Profil Alpha');

    const betaState = await api(`/api/p/${beta.slug}/state`);
    const betaTimer = betaState.json?.payload?.match?.timer;
    check('beta is unaffected by alpha write', betaTimer !== 4242, `beta timer ${betaTimer}`);
    check('beta has its own profile name', betaState.json?.payload?.profile?.name === 'Profil Beta');
  }

  section('REST auth');
  {
    const missing = await api(`/api/p/${alpha.slug}/state`, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({ match: { timer: 1 } }),
    });
    check('write without ownerKey = 403', missing.status === 403, `status ${missing.status}`);
    check('403 explains the missing header', missing.json?.reason === 'missing', JSON.stringify(missing.json));

    const wrong = await api(`/api/p/${alpha.slug}/state`, {
      method: 'PUT',
      headers: jsonHeaders('a'.repeat(32)),
      body: JSON.stringify({ match: { timer: 1 } }),
    });
    check('write with wrong ownerKey = 403', wrong.status === 403, `status ${wrong.status}`);
    check('403 reason is invalid', wrong.json?.reason === 'invalid');

    const after = await api(`/api/p/${alpha.slug}/state`);
    check('rejected writes did not change state', after.json?.payload?.match?.timer === 4242, JSON.stringify(after.json?.payload?.match?.timer));

    const publicRead = await api(`/api/p/${alpha.slug}/state`);
    check('state read is public (OBS needs it)', publicRead.status === 200);

    const publicAssets = await api(`/api/p/${alpha.slug}/assets`);
    check('assets read is public', publicAssets.status === 200 && publicAssets.json?.images !== undefined);
  }

  section('WebSocket handshake + roles');
  {
    const owner = await openSocket(alpha.slug);
    const hello = await owner.waitFor((m) => m.type === 'hello');
    check('server sends hello on connect', Boolean(hello), JSON.stringify(hello));
    check('hello defaults to viewer role', hello?.role === 'viewer');
    check('hello demands auth', hello?.requiresAuth === true);

    owner.send({ type: 'auth', key: alpha.ownerKey });
    const ownerAuth = await owner.waitFor((m) => m.type === 'auth_ok');
    check('correct ownerKey yields role owner', ownerAuth?.role === 'owner', JSON.stringify(ownerAuth));

    const viewer = await openSocket(alpha.slug);
    await viewer.waitFor((m) => m.type === 'hello');
    viewer.send({ type: 'auth', key: 'b'.repeat(32) });
    const viewerAuth = await viewer.waitFor((m) => m.type === 'auth_ok');
    check('wrong ownerKey yields role viewer', viewerAuth?.role === 'viewer', JSON.stringify(viewerAuth));

    const noAuth = await openSocket(alpha.slug);
    await noAuth.waitFor((m) => m.type === 'hello');
    noAuth.send({ type: 'update', payload: { match: { timer: 999 } } });
    const forbidden = await noAuth.waitFor((m) => m.type === 'error' && m.code === 'forbidden');
    check('unauthenticated write is refused', Boolean(forbidden));
    check('refusal explains the handshake', String(forbidden?.message || '').includes('auth'));

    const ping = await noAuth.waitFor(async () => true, 100).catch(() => null);
    noAuth.send({ type: 'ping' });
    const pong = await noAuth.waitFor((m) => m.type === 'pong');
    check('viewer may still ping', Boolean(pong));

    owner.send({ type: 'update', payload: { match: { timer: 777 } } });
    const broadcast = await viewer.waitFor((m) => m.type === 'snapshot' && m.payload?.match?.timer === 777);
    check('owner write reaches viewer via broadcast', Boolean(broadcast));

    owner.send({ type: 'update', payload: { match: { blueKills: 13 } } });
    await viewer.waitFor((m) => m.type === 'snapshot' && m.payload?.match?.blueKills === 13);

    const betaSocket = await openSocket(beta.slug);
    await betaSocket.waitFor((m) => m.type === 'hello');
    betaSocket.send({ type: 'auth', key: beta.ownerKey });
    await betaSocket.waitFor((m) => m.type === 'auth_ok' && m.role === 'owner');

    owner.send({ type: 'update', payload: { match: { redKills: 21 } } });
    betaSocket.send({ type: 'update', payload: { match: { blueKills: 31 } } });
    await new Promise((resolve) => setTimeout(resolve, 400));

    const alphaFinal = await api(`/api/p/${alpha.slug}/state`);
    const betaFinal = await api(`/api/p/${beta.slug}/state`);
    check('alpha kept only its own values', alphaFinal.json.payload.match.redKills === 21 && alphaFinal.json.payload.match.blueKills !== 31);
    check('beta kept only its own values', betaFinal.json.payload.match.blueKills === 31 && betaFinal.json.payload.match.redKills !== 21);

    owner.close();
    viewer.close();
    noAuth.close();
    betaSocket.close();
  }

  section('Claim flow');
  {
    // A profile is only claimable when it was created without an ownerKey, which is the
    // case for a migrated legacy profile or a slug someone typed by hand.
    const unclaimed = await api('/api/profiles', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: 'Profil Tanpa Nama' }),
    });
    const claimTarget = unclaimed.json;
    check('unclaimed profile returns no ownerKey', claimTarget && claimTarget.ownerKey === undefined, JSON.stringify(claimTarget));
    const beforeClaim = await api(`/api/p/${claimTarget.slug}`);
    check('new profile starts unclaimed', beforeClaim.json?.profile?.claimed === false, JSON.stringify(beforeClaim.json?.profile));

    const claim = await api(`/api/p/${claimTarget.slug}/claim`, { method: 'POST' });
    check('claim succeeds', claim.status === 200 && typeof claim.json?.ownerKey === 'string', `status ${claim.status}`);

    const afterClaim = await api(`/api/p/${claimTarget.slug}`);
    check('profile is claimed afterwards', afterClaim.json?.profile?.claimed === true);

    const secondClaim = await api(`/api/p/${claimTarget.slug}/claim`, { method: 'POST' });
    check('second claim is refused with 409', secondClaim.status === 409, `status ${secondClaim.status}`);

    const staleKey = await api(`/api/p/${claimTarget.slug}/state`, {
      method: 'PUT',
      headers: jsonHeaders('zzz'),
      body: JSON.stringify({ match: { timer: 5 } }),
    });
    check('ownerKey from a refused claim does not work', staleKey.status === 403);

    const realKey = await api(`/api/p/${claimTarget.slug}/state`, {
      method: 'PUT',
      headers: jsonHeaders(claim.json.ownerKey),
      body: JSON.stringify({ match: { timer: 55 } }),
    });
    check('claimed ownerKey can write', realKey.status === 200, `status ${realKey.status}`);
  }

  section('Export / import round-trip');
  let bundle = null;
  {
    await api(`/api/p/${alpha.slug}/state`, {
      method: 'PUT',
      headers: jsonHeaders(alpha.ownerKey),
      body: JSON.stringify({
        presentation: { tournamentName: 'Turnamen Uji' },
        match: { timer: 3141, blueGold: 12345 },
      }),
    });

    const exported = await api(`/api/p/${alpha.slug}/export`);
    check('export returns 200', exported.status === 200, `status ${exported.status}`);
    bundle = exported.json;
    check('export has schemaVersion', bundle?.schemaVersion === 1);
    check('export keeps matchState', bundle?.matchState?.presentation?.tournamentName === 'Turnamen Uji');
    check('export carries tournamentName', bundle?.matchState?.presentation?.tournamentName === 'Turnamen Uji');
    check('export has no ownerKey anywhere', !JSON.stringify(bundle).includes(alpha.ownerKey));
    check('export has no ownerKeyHash', !JSON.stringify(bundle).includes('ownerKeyHash'));
    check('export includes ocr/result/players keys', 'ocr' in bundle && 'result' in bundle && 'players' in bundle);

    const imported = await api('/api/profiles', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: 'Salinan Alpha', template: bundle.template, bundle, includeKey: true }),
    });
    check('import creates a new profile', imported.status === 201 && imported.json?.slug !== alpha.slug, `status ${imported.status}`);
    check('import mints a fresh ownerKey', imported.json?.ownerKey && imported.json.ownerKey !== alpha.ownerKey);

    const cloneState = await api(`/api/p/${imported.json.slug}/state`);
    check('imported state matches source', cloneState.json?.payload?.presentation?.tournamentName === 'Turnamen Uji');
    check('imported match timer matches source', cloneState.json?.payload?.match?.timer === 3141, JSON.stringify(cloneState.json?.payload?.match?.timer));

    const cloneWrite = await api(`/api/p/${imported.json.slug}/state`, {
      method: 'PUT',
      headers: jsonHeaders(alpha.ownerKey),
      body: JSON.stringify({ match: { timer: 1 } }),
    });
    check("alpha's key does not work on the clone", cloneWrite.status === 403, `status ${cloneWrite.status}`);

    const original = await api(`/api/p/${alpha.slug}/state`);
    check('clone writes do not touch the source', original.json?.payload?.match?.timer === 3141);

    var cloneSlug = imported.json.slug;
  }

  section('Rename, rotate, delete');
  {
    const renamed = await api(`/api/p/${beta.slug}`, {
      method: 'PUT',
      headers: jsonHeaders(beta.ownerKey),
      body: JSON.stringify({ name: 'Beta Baru' }),
    });
    check('rename works with ownerKey', renamed.status === 200 && renamed.json?.profile?.name === 'Beta Baru', JSON.stringify(renamed.json?.profile));

    const badRename = await api(`/api/p/${beta.slug}`, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({ name: 'Dibajak' }),
    });
    check('rename without ownerKey = 403', badRename.status === 403);

    const rotated = await api(`/api/p/${cloneSlug}/rotate`, {
      method: 'POST',
      headers: jsonHeaders(alpha.ownerKey),
    });
    check('rotate rejected with the wrong key', rotated.status === 403, `status ${rotated.status}`);
  }

  section('Site state: alias + legacy target follow rotation');
  {
    const created = await createProfile('Profil Untuk Rotasi');
    await api(`/api/p/${created.slug}/state`, {
      method: 'PUT',
      headers: jsonHeaders(created.ownerKey),
      body: JSON.stringify({ match: { timer: 909 } }),
    });

    const rotated = await api(`/api/p/${created.slug}/rotate`, {
      method: 'POST',
      headers: jsonHeaders(created.ownerKey),
    });
    check('rotate returns a new slug', rotated.status === 200 && rotated.json?.slug && rotated.json.slug !== created.slug, JSON.stringify(rotated.json));

    const newSlug = rotated.json.slug;
    const moved = await api(`/api/p/${newSlug}/state`);
    check('rotated profile kept its state', moved.json?.payload?.match?.timer === 909, JSON.stringify(moved.json?.payload?.match?.timer));

    const followOld = await api(`/api/p/${created.slug}/state`, { redirect: 'manual' });
    check('old slug redirects to the new one', followOld.status === 302, `status ${followOld.status}`);
    check('redirect target is the new slug', followOld.headers.get('location')?.includes(newSlug), followOld.headers.get('location'));

    const pageFollow = await api(`/p/${created.slug}/control/`, { redirect: 'manual' });
    check('old page slug redirects', pageFollow.status === 302 && pageFollow.headers.get('location')?.includes(newSlug), pageFollow.headers.get('location'));

    const oldState = await api(`/api/p/${created.slug}/state`);
    check('following the redirect reaches the profile', oldState.status === 200 && oldState.json?.payload?.match?.timer === 909);

    const newWrite = await api(`/api/p/${newSlug}/state`, {
      method: 'PUT',
      headers: jsonHeaders(created.ownerKey),
      body: JSON.stringify({ match: { timer: 1010 } }),
    });
    check('ownerKey survives rotation', newWrite.status === 200, `status ${newWrite.status}`);

    const deleted = await api(`/api/p/${newSlug}`, {
      method: 'DELETE',
      headers: jsonHeaders(created.ownerKey),
    });
    check('delete works with ownerKey', deleted.status === 200, `status ${deleted.status}`);

    const afterDelete = await api(`/api/p/${newSlug}/state`);
    check('deleted profile is back to defaults', afterDelete.json?.payload?.match?.timer !== 1010, JSON.stringify(afterDelete.json?.payload?.match?.timer));

    const badDelete = await api(`/api/p/${alpha.slug}`, {
      method: 'DELETE',
      headers: jsonHeaders(),
    });
    check('delete without ownerKey = 403', badDelete.status === 403);
  }

  section('Frame + payload guards');
  {
    const huge = await api(`/api/p/${alpha.slug}/state`, {
      method: 'PUT',
      headers: jsonHeaders(alpha.ownerKey),
      body: JSON.stringify({ presentation: { tournamentName: 'x'.repeat(2 * 1024 * 1024) } }),
    });
    check('oversized body rejected', huge.status === 400, `status ${huge.status}`);

    const stillFine = await api(`/api/p/${alpha.slug}/state`);
    check('oversized body did not corrupt state', stillFine.json?.payload?.presentation?.tournamentName === 'Turnamen Uji');
  }

  section('Unknown routes');
  {
    const unknown = await api('/p/tidak-ada-profil/control/');
    check('unknown profile page still serves the shell', unknown.status === 200, `status ${unknown.status}`);

    const badPage = await api(`/p/${alpha.slug}/halaman-ngawur/`, { redirect: 'manual' });
    check('unknown profile page redirects to control', badPage.status === 302 && badPage.headers.get('location')?.endsWith('/control/'), badPage.headers.get('location'));

    const noSlash = await api(`/p/${alpha.slug}`, { redirect: 'manual' });
    check('bare /p/<slug> redirects to control', noSlash.status === 302, `status ${noSlash.status}`);

    const badApi = await api('/api/p/INI-BUKAN-SLUG/state');
    check('invalid slug in API = 400', badApi.status === 400, `status ${badApi.status}`);
  }

  section('OCR config di server + Field Lock');
  {
    const put = await api(`/api/p/${alpha.slug}/ocr`, {
      method: 'PUT',
      headers: jsonHeaders(alpha.ownerKey),
      body: JSON.stringify({
        enabled: true,
        modes: { blueKills: 'lock', redKills: 'auto' },
        thresholds: { blueKills: 85 },
        regions: { timer: { x: 0.11, y: 0.22, w: 0.33, h: 0.44 } },
        anchor: { blueKills: 7 },
      }),
    });
    check('PUT /ocr = 200', put.status === 200, `status ${put.status}`);

    const read = await api(`/api/p/${alpha.slug}/ocr`);
    check('mode per field tersimpan', read.json?.modes?.blueKills === 'lock' && read.json?.modes?.redKills === 'auto');
    check('threshold tersimpan', read.json?.thresholds?.blueKills === 85);
    check('ROI tersimpan', read.json?.regions?.timer?.w === 0.33, JSON.stringify(read.json?.regions?.timer));
    check('anchor tersimpan', read.json?.anchor?.blueKills === 7);

    const noAuth = await api(`/api/p/${alpha.slug}/ocr`, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({ modes: { blueKills: 'auto' } }),
    });
    check('PUT /ocr tanpa ownerKey = 403', noAuth.status === 403, `status ${noAuth.status}`);

    await api(`/api/p/${alpha.slug}/state`, {
      method: 'PUT',
      headers: jsonHeaders(alpha.ownerKey),
      body: JSON.stringify({ match: { blueKills: 1, redKills: 1 } }),
    });

    const readings = await api(`/api/p/${alpha.slug}/ocr/readings`, {
      method: 'POST',
      headers: jsonHeaders(alpha.ownerKey),
      body: JSON.stringify({ readings: { blueKills: 42, redKills: 3 }, anchor: { blueKills: 42, redKills: 3 } }),
    });
    check('POST /ocr/readings = 200', readings.status === 200, `status ${readings.status}`);
    check('field terkunci ditolak', readings.json?.rejected?.includes('blueKills'), JSON.stringify(readings.json));
    check('field bebas diterima', readings.json?.applied?.includes('redKills'), JSON.stringify(readings.json));

    const after = await api(`/api/p/${alpha.slug}/state`);
    check('angka terkunci tidak tertimpa OCR', after.json?.payload?.match?.blueKills === 1, String(after.json?.payload?.match?.blueKills));
    check('angka bebas ikut berubah', after.json?.payload?.match?.redKills === 3, String(after.json?.payload?.match?.redKills));

    const anchor = await api(`/api/p/${alpha.slug}/ocr`);
    check('anchor tersimpan dari bacaan', anchor.json?.anchor?.redKills === 3, JSON.stringify(anchor.json?.anchor));
  }

  section('Result + players');
  {
    const putResult = await api(`/api/p/${alpha.slug}/result`, {
      method: 'PUT',
      headers: jsonHeaders(alpha.ownerKey),
      body: JSON.stringify({ visible: true, headline: 'VICTORY', seriesScore: { blue: 2, red: 0 }, gameNumber: 2 }),
    });
    check('PUT /result = 200', putResult.status === 200, `status ${putResult.status}`);

    const readResult = await api(`/api/p/${alpha.slug}/result`);
    check('result tersimpan', readResult.json?.visible === true && readResult.json?.headline === 'VICTORY');
    check('skor seri tersimpan', readResult.json?.seriesScore?.blue === 2);

    const socket = await openSocket(alpha.slug);
    await socket.send({ type: 'auth', key: alpha.ownerKey });
    await socket.waitFor((message) => message.type === 'snapshot');
    const snapshotMessage = await socket.waitFor((message) => message.type === 'snapshot' && message.payload?.result);
    check('snapshot membawa result untuk overlay', snapshotMessage.payload.result.headline === 'VICTORY', JSON.stringify(snapshotMessage.payload?.result?.headline));

    const putPlayers = await api(`/api/p/${alpha.slug}/players`, {
      method: 'PUT',
      headers: jsonHeaders(alpha.ownerKey),
      body: JSON.stringify({ blue: [{ name: 'Player 1', hero: 'Aamon', kills: 4 }] }),
    });
    check('PUT /players = 200', putPlayers.status === 200, `status ${putPlayers.status}`);

    const readPlayers = await api(`/api/p/${alpha.slug}/players`);
    check('players selalu 5 slot per tim', readPlayers.json?.blue?.length === 5 && readPlayers.json?.red?.length === 5, `${readPlayers.json?.blue?.length}/${readPlayers.json?.red?.length}`);
    check('data player tersimpan', readPlayers.json?.blue?.[0]?.name === 'Player 1' && readPlayers.json?.blue?.[0]?.kills === 4);
    check('slot kosong tetap punya bentuk', typeof readPlayers.json?.red?.[0]?.name === 'string');

    await socket.close();
  }

  section('BO2 series');
  {
    await api(`/api/p/${alpha.slug}/state`, {
      method: 'PUT',
      headers: jsonHeaders(alpha.ownerKey),
      body: JSON.stringify({ match: { bo2: { enabled: true, bestOf: 2, games: [{ winner: 'blue' }, { winner: null }] } } }),
    });
    const state = await api(`/api/p/${alpha.slug}/state`);
    check('bo2 tersimpan di match state', state.json?.payload?.match?.bo2?.games?.[0]?.winner === 'blue');
    check('bestOf dikunci di 2', state.json?.payload?.match?.bo2?.bestOf === 2);

    await api(`/api/p/${alpha.slug}/state`, {
      method: 'PUT',
      headers: jsonHeaders(alpha.ownerKey),
      body: JSON.stringify({ match: { bo2: { enabled: true, bestOf: 7, games: [{ winner: 'biru' }, { winner: 'red' }, { winner: 'blue' }] } } }),
    });
    const normalized = await api(`/api/p/${alpha.slug}/state`);
    check('winner tak dikenal dinormalisasi jadi null', normalized.json?.payload?.match?.bo2?.games?.[0]?.winner === null, JSON.stringify(normalized.json?.payload?.match?.bo2?.games));
    check('game berlebih dipangkas jadi 2', normalized.json?.payload?.match?.bo2?.games?.length === 2);
  }

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