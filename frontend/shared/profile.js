(function (global) {
  'use strict';

  // Resolves which profile the current page belongs to and manages the ownerKey.
  //
  // Page URLs:
  //   /p/<slug>/control/            -> owner
  //   /p/<slug>/overlay/gameplay/   -> viewer (OBS)
  //   /p/<slug>/overlay/result/     -> viewer (OBS)
  //   /p/<slug>/debug/              -> owner
  //   /                            -> home, no profile
  //
  // The slug is the read capability, the ownerKey is the write capability. They are
  // stored separately so the OBS browser source URL can be shared with a co-caster
  // without handing over edit rights.

  const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;
  const OWNER_KEYS_INDEX = 'mlbb_overlay_profile_keys';
  const DEFAULT_SLUG = 'default';

  function slugFromPath(pathname = global.location.pathname) {
    const match = /^\/p\/([^/]+)(?:\/|$)/.exec(pathname || '');
    if (!match) return null;
    const slug = decodeURIComponent(match[1]).toLowerCase();
    return SLUG_PATTERN.test(slug) ? slug : null;
  }

  function pageFromPath(pathname = global.location.pathname) {
    const match = /^\/p\/[^/]+\/([^/]+(?:\/[^/]+)?)\/?$/.exec(pathname || '');
    return match ? match[1] : '';
  }

  function readKeyIndex() {
    try {
      const raw = global.localStorage.getItem(OWNER_KEYS_INDEX);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeKeyIndex(index) {
    try {
      global.localStorage.setItem(OWNER_KEYS_INDEX, JSON.stringify(index));
      return true;
    } catch {
      return false;
    }
  }

  function ownerKeyFor(slug) {
    try {
      return global.localStorage.getItem(`mlbb_overlay_key_${slug}`) || '';
    } catch {
      return '';
    }
  }

  function rememberOwner(slug, key, meta = {}) {
    if (!slug || !key) return false;
    try {
      global.localStorage.setItem(`mlbb_overlay_key_${slug}`, key);
    } catch {
      return false;
    }
    const index = readKeyIndex();
    index[slug] = {
      name: meta.name || index[slug]?.name || slug,
      template: meta.template || index[slug]?.template || 'mlbb-gameplay',
      createdAt: meta.createdAt || index[slug]?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    writeKeyIndex(index);
    return true;
  }

  function forgetOwner(slug) {
    try {
      global.localStorage.removeItem(`mlbb_overlay_key_${slug}`);
    } catch {
      /* storage may be blocked */
    }
    const index = readKeyIndex();
    delete index[slug];
    writeKeyIndex(index);
  }

  function knownProfiles() {
    const index = readKeyIndex();
    return Object.entries(index)
      .filter(([slug]) => SLUG_PATTERN.test(slug))
      .map(([slug, meta]) => ({ slug, ...meta, hasKey: Boolean(ownerKeyFor(slug)) }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function updateLocalMeta(slug, patch = {}) {
    const index = readKeyIndex();
    if (!index[slug]) return false;
    index[slug] = { ...index[slug], ...patch, updatedAt: Date.now() };
    return writeKeyIndex(index);
  }

  function apiBase(slug) {
    return `/api/p/${encodeURIComponent(slug)}`;
  }

  async function describe(slug) {
    const response = await fetch(`${apiBase(slug)}`, { cache: 'no-store' });
    if (!response.ok) {
      return { ok: false, status: response.status, error: (await response.json().catch(() => ({}))).error || 'Gagal memuat profil.' };
    }
    const data = await response.json();
    return { ok: true, profile: data.profile, templates: data.templates };
  }

  async function claim(slug) {
    const response = await fetch(`${apiBase(slug)}/claim`, { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data.error || 'Gagal mengklaim profil.' };
    rememberOwner(slug, data.ownerKey, { name: data.profile?.name, template: data.profile?.template });
    return { ok: true, ownerKey: data.ownerKey };
  }

  async function rename(slug, name, key) {
    const response = await fetch(apiBase(slug), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-overlay-key': key || '' },
      body: JSON.stringify({ name }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data.error || 'Gagal mengganti nama.' };
    updateLocalMeta(slug, { name });
    return { ok: true, profile: data.profile };
  }

  async function remove(slug, key) {
    const response = await fetch(apiBase(slug), {
      method: 'DELETE',
      headers: { 'x-overlay-key': key || '' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data.error || 'Gagal menghapus profil.' };
    forgetOwner(slug);
    return { ok: true };
  }

  async function rotate(slug, key) {
    const response = await fetch(`${apiBase(slug)}/rotate`, {
      method: 'POST',
      headers: { 'x-overlay-key': key || '' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data.error || 'Gagal merotasi slug.' };
    rememberOwner(data.slug, key, {});
    forgetOwner(slug);
    return { ok: true, slug: data.slug, previousSlug: slug };
  }

  async function create({ name, template, slug, bundle } = {}) {
    const body = { name, template, includeKey: true };
    if (slug) body.slug = slug;
    if (bundle) body.bundle = bundle;
    const response = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data.error || 'Gagal membuat profil.' };
    rememberOwner(data.slug, data.ownerKey, { name: data.name, template: data.template });
    return { ok: true, ...data };
  }

  async function exportBundle(slug) {
    const response = await fetch(`${apiBase(slug)}/export`, { cache: 'no-store' });
    if (!response.ok) return { ok: false, error: 'Gagal mengekspor profil.' };
    return { ok: true, bundle: await response.json() };
  }

  async function pushState(slug, payload, key) {
    const response = await fetch(`${apiBase(slug)}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-overlay-key': key || '' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, status: response.status, error: data.error || 'Gagal menyimpan state.' };
    return { ok: true, assetsVersion: data.assetsVersion };
  }

  async function fetchState(slug) {
    const response = await fetch(`${apiBase(slug)}/state`, { cache: 'no-store' });
    if (!response.ok) return { ok: false, error: 'Gagal memuat state.' };
    return { ok: true, envelope: await response.json() };
  }

  async function fetchAssets(slug, version) {
    const suffix = Number.isFinite(version) ? `?v=${version}` : '';
    const response = await fetch(`${apiBase(slug)}/assets${suffix}`, { cache: 'no-store' });
    if (!response.ok) return { ok: false, error: 'Gagal memuat aset.' };
    return { ok: true, assets: await response.json() };
  }

  async function fetchRegistry() {
    const failure = { ok: false, error: 'Registry aset belum tersedia. Jalankan npm run build:cloudflare.' };
    // fetch() itself rejects on a network error or when the page is offline. Without this
    // catch the rejection escapes into the caller's await chain, and because initAuxEditors()
    // awaits it before building any editor, one unreachable asset file used to leave the
    // result, roster and draft editors permanently unbuilt.
    try {
      const response = await fetch('/assets/registry.json', { cache: 'default' });
      if (!response.ok) return failure;
      return { ok: true, registry: await response.json() };
    } catch {
      return failure;
    }
  }

  async function pushAux(slug, kind, payload, key) {
    const response = await fetch(`${apiBase(slug)}/${kind}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-overlay-key': key || '' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, status: response.status, error: data.error || `Gagal menyimpan ${kind}.` };
    return { ok: true, value: data };
  }

  async function fetchAux(slug, kind) {
    if (!slug) return { ok: false };
    try {
      const response = await fetch(`${apiBase(slug)}/${kind}`, { cache: 'no-store' });
      if (!response.ok) return { ok: false, status: response.status };
      return { ok: true, value: await response.json() };
    } catch {
      return { ok: false };
    }
  }

  // Bacaan OCR lewat endpoint sendiri supaya Field Lock ditegakkan di server.
  async function pushOcrReadings(slug, readings, anchor, key) {
    if (!slug) return { ok: false, error: 'Mode lokal: tidak ada endpoint readings.' };
    if (!key) return { ok: false, error: 'ownerKey belum dipasang.' };
    const response = await fetch(`${apiBase(slug)}/ocr/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-overlay-key': key },
      body: JSON.stringify({ readings, anchor }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, status: response.status, error: data.error || 'Gagal mengirim bacaan OCR.' };
    return { ok: true, applied: data.applied || [], rejected: data.rejected || [] };
  }

  function websocketUrl(slug) {
    const protocol = global.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${global.location.host}${apiBase(slug)}/live`;
  }

  function profileUrl(slug, page = 'control') {
    return `/p/${slug}/${page}/`;
  }

  function pageUrl(slug, page = 'control') {
    if (!slug) return `/frontend/${page}/`;
    return profileUrl(slug, page);
  }

  const PROFILE_PAGES = [
    { page: 'control', label: 'Control', ready: true },
    { page: 'overlay/gameplay', label: 'Overlay Gameplay', tag: 'OBS', ready: true },
    { page: 'overlay/draft', label: 'Overlay Draft', tag: 'OBS', ready: true },
    { page: 'debug', label: 'Kalibrasi OCR', ready: true },
    { page: 'verify', label: 'Verifikasi', ready: true },
    { page: 'overlay/result', label: 'Result', tag: 'OBS', ready: true },
  ];

  function navItem(document, tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function renderNav(container, options = {}) {
    if (!container) return;
    const doc = container.ownerDocument;
    const current = options.active || pageFromPath();
    container.textContent = '';
    container.append(navItem(doc, 'span', 'profile-nav-label', slugFromPath()
      ? `Profil ${slugFromPath()}`
      : 'Mode lokal (backend Python)'));

    const addLink = (href, label, page, tag) => {
      const anchor = navItem(doc, 'a', '', label);
      anchor.href = href;
      if (tag) anchor.append(navItem(doc, 'em', '', tag));
      if (page === current) anchor.setAttribute('aria-current', 'page');
      container.append(anchor);
      return anchor;
    };

    const slug = slugFromPath();
    if (slug) addLink('/', 'Beranda', 'home');

    for (const entry of PROFILE_PAGES) {
      if (!entry.ready) {
        const pending = navItem(doc, 'span', 'profile-nav-item is-disabled', entry.label);
        pending.title = 'Halaman ini belum ada. Lihat rencana di UPDATE.md.';
        container.append(pending);
        continue;
      }
      addLink(pageUrl(slug, entry.page), entry.label, entry.page, entry.tag);
    }

    if (!slug) return;

    container.append(navItem(doc, 'span', 'profile-nav-gap', ''));

    const copy = navItem(doc, 'button', '', 'Salin URL OBS');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      const label = 'Salin URL OBS';
      try {
        await global.navigator.clipboard.writeText(new URL(pageUrl(slug, 'overlay/gameplay'), global.location.origin).href);
        copy.textContent = 'Tersalin';
      } catch {
        copy.textContent = 'Browser menolak clipboard';
      }
      global.setTimeout(() => { copy.textContent = label; }, 1600);
    });
    container.append(copy);

    addLink(`${apiBase(slug)}/export`, 'Export JSON', 'export');
  }

  function obsUrl(slug) {
    const resolved = slug || DEFAULT_SLUG;
    return `${global.location.origin}${profileUrl(resolved, 'overlay/gameplay')}`;
  }

  global.ProfileKit = {
    DEFAULT_SLUG,
    slugFromPath,
    pageFromPath,
    apiBase,
    websocketUrl,
    profileUrl,
    pageUrl,
    renderNav,
    obsUrl,
    ownerKeyFor,
    rememberOwner,
    forgetOwner,
    knownProfiles,
    updateLocalMeta,
    describe,
    claim,
    rename,
    remove,
    rotate,
    create,
    exportBundle,
    pushState,
    pushAux,
    fetchAux,
    pushOcrReadings,
    fetchState,
    fetchAssets,
    fetchRegistry,
  };
})(window);