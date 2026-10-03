(function () {
  'use strict';

  const Kit = window.ProfileKit;

  const state = {
    template: 'mlbb-gameplay',
    templates: {},
    registry: null,
    blue: 'blue-phoenix',
    red: 'red-viper',
  };

  const el = {
    notice: document.getElementById('notice'),
    templateGrid: document.getElementById('template-grid'),
    profileName: document.getElementById('profile-name'),
    blueTeam: document.getElementById('blue-team'),
    redTeam: document.getElementById('red-team'),
    create: document.getElementById('create-profile'),
    createdPanel: document.getElementById('created-panel'),
    createdSummary: document.getElementById('created-summary'),
    createdLinks: document.getElementById('created-links'),
    createdControl: document.getElementById('created-control'),
    createdDismiss: document.getElementById('created-dismiss'),
    registryStatus: document.getElementById('registry-status'),
    registryBody: document.getElementById('registry-body'),
    profileList: document.getElementById('profile-list'),
    adoptSlug: document.getElementById('adopt-slug'),
    adoptKey: document.getElementById('adopt-key'),
    adopt: document.getElementById('adopt-profile'),
    openBySlug: document.getElementById('open-by-slug'),
    importBundle: document.getElementById('import-bundle'),
    importStatus: document.getElementById('import-status'),
    galleryStatus: document.getElementById('gallery-status'),
    galleryBody: document.getElementById('gallery-body'),
    feedbackKind: document.getElementById('feedback-kind'),
    feedbackContact: document.getElementById('feedback-contact'),
    feedbackMessage: document.getElementById('feedback-message'),
    feedbackWebsite: document.getElementById('feedback-website'),
    sendFeedback: document.getElementById('send-feedback'),
    feedbackStatus: document.getElementById('feedback-status'),
    themeToggle: document.getElementById('theme-toggle'),
  };

  function notice(message, kind = '') {
    el.notice.textContent = message;
    el.notice.className = `notice ${kind}`.trim();
    el.notice.hidden = !message;
  }

  function absolute(url) {
    return new URL(url, window.location.origin).href;
  }

  // --- templates ---------------------------------------------------------

  async function loadTemplates() {
    try {
      const response = await fetch('/api/site', { cache: 'no-store' });
      if (!response.ok) throw new Error('site');
      const data = await response.json();
      state.templates = data.templates || {};
    } catch {
      state.templates = {
        'mlbb-gameplay': { label: 'MLBB Gameplay', description: 'Overlay skor live untuk match MLBB 5v5.' },
        'mlbb-result': { label: 'MLBB Result', description: 'Layar hasil match: skor seri, MVP, damage.' },
      };
    }
    renderTemplates();
  }

  function renderTemplates() {
    el.templateGrid.textContent = '';
    const entries = Object.entries(state.templates);
    if (!entries.length) {
      el.templateGrid.innerHTML = '<p class="empty">Katalog paket tidak bisa dimuat.</p>';
      return;
    }
    for (const [id, meta] of entries) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'template-card';
      card.setAttribute('aria-pressed', String(id === state.template));
      card.innerHTML = `<strong></strong><span></span>`;
      card.querySelector('strong').textContent = meta.label || id;
      card.querySelector('span').textContent = meta.description || '';
      card.addEventListener('click', () => {
        state.template = id;
        renderTemplates();
      });
      el.templateGrid.appendChild(card);
    }
  }

  // --- registry ----------------------------------------------------------

  async function loadRegistry() {
    el.registryStatus.textContent = 'Memuat registry...';
    const result = await Kit.fetchRegistry();
    if (!result.ok) {
      el.registryStatus.textContent = result.error;
      el.registryStatus.style.color = 'var(--danger)';
      return;
    }
    state.registry = result.registry;
    el.registryStatus.textContent = 'Aset siap dipakai. Klik aset untuk seeingkat pasangan tim di atas.';
    el.registryStatus.style.color = '';
    renderRegistry();
    renderTeamPickers();
  }

  function renderRegistry() {
    const categories = state.registry?.categories || {};
    el.registryBody.textContent = '';

    for (const [key, category] of Object.entries(categories)) {
      const group = document.createElement('div');
      group.className = 'registry-group';
      const heading = document.createElement('h3');
      heading.textContent = `${category.label || key} (${(category.items || []).length})`;
      group.appendChild(heading);

      const row = document.createElement('div');
      row.className = 'asset-row';
      for (const item of category.items || []) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'asset-card';
        card.dataset.category = key;
        card.dataset.id = item.id;
        card.setAttribute('aria-pressed', 'false');
        const img = document.createElement('img');
        img.src = item.path;
        img.alt = item.name || item.id;
        const label = document.createElement('small');
        label.textContent = item.name || item.id;
        card.append(img, label);
        card.addEventListener('click', () => onAssetPick(key, item));
        row.appendChild(card);
      }
      group.appendChild(row);
      el.registryBody.appendChild(group);
    }
    el.registryBody.hidden = false;
  }

  function onAssetPick(category, item) {
    if (category !== 'teams') {
      notice(`"${item.name || item.id}" dipilih. Aset ${category} dipakai di control panel (Fase 7).`, '');
      return;
    }
    state.blue = item.id;
    state.red = item.id === state.blue ? '' : state.blue;
    if (!state.blue || state.blue === state.red) {
      state.blue = 'blue-phoenix';
      state.red = 'red-viper';
    }
    renderTeamPickers();
    markPressedAssets();
  }

  function markPressedAssets() {
    for (const card of el.registryBody.querySelectorAll('.asset-card[data-category="teams"]')) {
      const id = card.dataset.id;
      card.setAttribute('aria-pressed', String(id === state.blue || id === state.red));
    }
  }

  function teamItems() {
    return (state.registry?.categories?.teams?.items) || [
      { id: 'blue-phoenix', name: 'Blue Phoenix' },
      { id: 'red-viper', name: 'Red Viper' },
    ];
  }

  function renderTeamPickers() {
    const items = teamItems();
    for (const [select, selected, fallback] of [[el.blueTeam, state.blue, items[0]?.id], [el.redTeam, state.red, items[1]?.id]]) {
      select.textContent = '';
      for (const item of items) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name || item.id;
        select.appendChild(option);
      }
      if (!selected || !items.some((item) => item.id === selected)) {
        state[select === el.blueTeam ? 'blue' : 'red'] = fallback;
      }
      select.value = select === el.blueTeam ? state.blue : state.red;
    }
    markPressedAssets();
  }

  // --- create ------------------------------------------------------------

  // Halaman tujuan profil. Dipakai juga oleh panel "2b. Profil siap dipakai" supaya
  // operator tidak perlu menghafal pola URL tiap kali profil baru dibuat.
  const PROFILE_LINKS = [
    { label: 'Control panel', page: 'control', hint: 'Operator: semua pengaturan dan preview.' },
    { label: 'Overlay Gameplay', page: 'overlay/gameplay', hint: 'OBS browser source, 1920x1080.' },
    { label: 'Overlay Draft', page: 'overlay/draft', hint: 'OBS browser source, layar draft pick.' },
    { label: 'Layar Hasil', page: 'overlay/result', hint: 'OBS browser source, MVP + scoreboard.' },
    { label: 'Verifikasi', page: 'verify', hint: 'Cek bacaan sebelum push ke stream.' },
    { label: 'Kalibrasi OCR', page: 'debug', hint: 'Kroi ROI dan Field Lock.' },
  ];

  function showCreatedPanel(slug, name) {
    const panel = el.createdPanel;
    if (!panel) return;
    el.createdSummary.textContent = `"${name}" dibuat dengan slug ${slug}. Salin link yang kamu butuh:`;
    el.createdLinks.replaceChildren();
    for (const entry of PROFILE_LINKS) {
      const path = Kit.pageUrl(slug, entry.page);
      const block = document.createElement('div');
      block.className = 'created-link';
      const label = document.createElement('span');
      label.className = 'created-link-label';
      label.textContent = entry.label;
      const hint = document.createElement('span');
      hint.className = 'created-link-hint';
      hint.textContent = entry.hint;
      block.append(label, hint, urlRow(entry.label, path));
      el.createdLinks.append(block);
    }
    el.createdControl.onclick = () => window.location.assign(Kit.pageUrl(slug, 'control'));
    panel.hidden = false;
  // Hanya progressif: `scrollIntoView` tidak ada di semua lingkungan (mis. jsdom pada
  // tes), dan kegagalannya tidak boleh menghentikan alur pembuatan profil yang sukses.
  if (typeof panel.scrollIntoView === 'function') {
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

  async function createProfile() {
    notice('');
    const name = el.profileName.value.trim() || 'Profil saya';
    el.create.disabled = true;
    try {
      const bundle = buildSeedBundle();
      const result = await Kit.create({ name, template: state.template, bundle });
      if (!result.ok) {
        notice(result.error, 'error');
        return;
      }
      el.profileName.value = '';
      // Jangan langsung pindah halaman. Tampilkan opsi link dulu supaya operator punya
      // salinan URL di halaman yang sama, lalu memilih mau ke mana.
      notice(`Profil "${name}" dibuat. Opsi link slug muncul di bawah.`, 'ok');
      renderProfiles();
      showCreatedPanel(result.slug, name);
    } finally {
      el.create.disabled = false;
    }
  }

  function buildSeedBundle() {
    const blue = teamItems().find((item) => item.id === state.blue);
    const red = teamItems().find((item) => item.id === state.red);
    return {
      matchState: {
        teams: {
          blue: { name: blue?.name || 'Blue Phoenix', logo: blue?.path || '/assets/teams/blue-phoenix.svg' },
          red: { name: red?.name || 'Red Viper', logo: red?.path || '/assets/teams/red-viper.svg' },
        },
      },
    };
  }

  // --- profiles ----------------------------------------------------------

  function renderProfiles() {
    const profiles = Kit.knownProfiles();
    el.profileList.textContent = '';

    if (!profiles.length) {
      el.profileList.innerHTML = '<p class="empty">Belum ada profil di browser ini. Buat profil di atas.</p>';
      return;
    }

    for (const profile of profiles) {
      el.profileList.appendChild(buildProfileCard(profile));
    }
  }

  function urlRow(label, path) {
    const row = document.createElement('div');
    row.className = 'url-row';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const code = document.createElement('code');
    code.textContent = absolute(path);
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'link-button';
    copy.textContent = 'Salin';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(absolute(path));
        copy.textContent = 'Tersalin';
        window.setTimeout(() => { copy.textContent = 'Salin'; }, 1400);
      } catch {
        notice('Browser menolak akses clipboard. Salin manual dari teks.', 'error');
      }
    });
    row.append(labelEl, code, copy);
    return row;
  }

  function linkButton(label, path) {
    const anchor = document.createElement('a');
    anchor.className = 'link-button';
    anchor.href = path;
    anchor.textContent = label;
    return anchor;
  }

  function buildProfileCard(profile) {
    const card = document.createElement('div');
    card.className = 'profile-card';

    const head = document.createElement('div');
    head.className = 'profile-head';
    const title = document.createElement('strong');
    title.textContent = profile.name || profile.slug;
    const slug = document.createElement('span');
    slug.className = 'profile-slug';
    slug.textContent = `/p/${profile.slug}/`;
    head.append(title, slug);
    card.appendChild(head);

    card.appendChild(urlRow('OBS', Kit.profileUrl(profile.slug, 'overlay/gameplay')));
    card.appendChild(urlRow('Control', Kit.profileUrl(profile.slug, 'control')));

    const nav = document.createElement('div');
    nav.className = 'url-row';
    nav.append(
      linkButton('Buka control', Kit.profileUrl(profile.slug, 'control')),
      linkButton('Buka overlay', Kit.profileUrl(profile.slug, 'overlay/gameplay')),
      linkButton('Kalibrasi OCR', Kit.profileUrl(profile.slug, 'debug')),
      linkButton('Ganti nama', '#'),
    );
    nav.lastChild.addEventListener('click', () => renameProfile(profile));
    card.appendChild(nav);

    const tools = document.createElement('div');
    tools.className = 'actions';
    tools.append(
      button('Export', 'ghost', () => exportProfile(profile)),
      button('Rotasi slug', 'ghost', () => rotateProfile(profile)),
    );
    // Galeri mati bukan salah operator, jadi tombolnya disembunyikan, bukan dikunci.
    if (galleryAvailable) {
      tools.append(button(publishedSlugs.has(profile.slug) ? 'Tarik dari galeri' : 'Publish', 'ghost', () => togglePublish(profile)));
    }
    tools.append(button('Hapus', 'danger', () => removeProfile(profile)));
    card.append(tools);

    return card;
  }

  function button(label, variant, handler) {
    const elButton = document.createElement('button');
    elButton.type = 'button';
    elButton.textContent = label;
    if (variant === 'ghost') elButton.className = 'ghost';
    if (variant === 'danger') elButton.className = 'danger';
    elButton.addEventListener('click', handler);
    return elButton;
  }

  async function renameProfile(profile) {
    const name = window.prompt('Nama profil baru:', profile.name || profile.slug);
    if (name === null) return;
    const result = await Kit.rename(profile.slug, name, Kit.ownerKeyFor(profile.slug));
    if (!result.ok) {
      notice(result.error, 'error');
      return;
    }
    notice('Nama profil diperbarui.', 'ok');
    renderProfiles();
  }

  async function exportProfile(profile) {
    const result = await Kit.exportBundle(profile.slug);
    if (!result.ok) {
      notice(result.error, 'error');
      return;
    }
    const blob = new Blob([JSON.stringify(result.bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${profile.slug}-overlay.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notice('Bundel diunduh. ownerKey tidak ikut disertakan.', 'ok');
  }

  async function rotateProfile(profile) {
    const confirmed = window.confirm(
      `Rotasi slug "${profile.slug}"?\n\n`
      + 'URL lama akan tetap redirect ke URL baru, tapi URL barunya harus dipasang ulang di OBS.',
    );
    if (!confirmed) return;

    const result = await Kit.rotate(profile.slug, Kit.ownerKeyFor(profile.slug));
    if (!result.ok) {
      notice(result.error, 'error');
      return;
    }
    notice(`Slug sekarang "${result.slug}". URL lama tetap redirect ke sini.`, 'ok');
    renderProfiles();
  }

  async function removeProfile(profile) {
    const confirmed = window.confirm(`Hapus profil "${profile.name || profile.slug}"?\n\nData di server dihapus permanen.`);
    if (!confirmed) return;

    const result = await Kit.remove(profile.slug, Kit.ownerKeyFor(profile.slug));
    if (!result.ok) {
      notice(result.error, 'error');
      return;
    }
    notice('Profil dihapus dari server dan dari daftar perangkat ini.', 'ok');
    renderProfiles();
  }

  // --- ownerKey tools ----------------------------------------------------

  async function adoptProfile() {
    const slug = (el.adoptSlug.value || '').trim().toLowerCase();
    const key = (el.adoptKey.value || '').trim();
    if (!slug || !key) {
      notice('Slug dan ownerKey keduanya wajib diisi.', 'error');
      return;
    }

    const result = await Kit.describe(slug);
    if (!result.ok) {
      notice(result.error, 'error');
      return;
    }

    Kit.rememberOwner(slug, key, {
      name: result.profile?.name,
      template: result.profile?.template,
      createdAt: result.profile?.createdAt,
    });
    notice(`ownerKey disimpan untuk "${result.profile?.name || slug}".`, 'ok');
    renderProfiles();
  }

  function openBySlug() {
    const slug = (el.adoptSlug.value || '').trim().toLowerCase();
    if (!slug) {
      notice('Isi slug dulu.', 'error');
      return;
    }
    window.location.assign(Kit.profileUrl(slug, 'control'));
  }

  // --- import ------------------------------------------------------------

  async function importBundle(file) {
    if (!file) return;
    el.importStatus.textContent = 'Membaca bundel...';
    try {
      const bundle = JSON.parse(await file.text());
      if (!bundle || typeof bundle !== 'object') throw new Error('Bundel bukan objek JSON.');
      const name = window.prompt('Nama untuk profil hasil import:', `${bundle.profile?.name || file.name} (salinan)`);
      if (name === null) return;

      const result = await Kit.create({
        name,
        template: bundle.template,
        bundle: {
          matchState: bundle.matchState,
          assets: bundle.assets,
          ocr: bundle.ocr,
          result: bundle.result,
          players: bundle.players,
        },
      });
      if (!result.ok) {
        el.importStatus.textContent = result.error;
        notice(result.error, 'error');
        return;
      }
      el.importStatus.textContent = `Profil baru: ${result.slug}`;
      notice('Bundel diimpor sebagai profil baru dengan slug dan ownerKey baru.', 'ok');
      renderProfiles();
    } catch (error) {
      el.importStatus.textContent = `Gagal: ${error.message}`;
      notice(`Gagal membaca bundel: ${error.message}`, 'error');
    } finally {
      el.importBundle.value = '';
    }
  }

  // --- galeri (D1) ---------------------------------------------------------

const publishedSlugs = new Set();
let galleryAvailable = true;

async function galleryRequest(method, body) {
  const response = await fetch('/api/gallery', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Galeri error ${response.status}`);
  return data;
}

async function loadGallery() {
  if (!el.galleryBody) return;
  try {
    const data = await galleryRequest('GET');
    publishedSlugs.clear();
    for (const entry of data.entries || []) publishedSlugs.add(entry.slug);
    renderGallery(data.entries || []);
    galleryAvailable = true;
  } catch (error) {
    galleryAvailable = false;
    el.galleryStatus.textContent = `Galeri tidak aktif: ${error.message}`;
    el.galleryStatus.hidden = false;
    el.galleryBody.hidden = true;
    return;
  }
  renderProfiles();
}

function renderGallery(entries) {
  if (!el.galleryBody) return;
  el.galleryStatus.textContent = entries.length
    ? `${entries.length} paket dipublish. Klik salah satu untuk menyalin gayanya.`
    : 'Belum ada paket yang dipublish.';
  el.galleryStatus.hidden = false;
  el.galleryBody.replaceChildren();
  el.galleryBody.hidden = entries.length === 0;

  for (const entry of entries) {
    const card = document.createElement('article');
    card.className = 'gallery-card';

    const title = document.createElement('strong');
    title.textContent = entry.name || entry.slug;
    const meta = document.createElement('span');
    meta.className = 'gallery-meta';
    meta.textContent = [entry.template, entry.blue_team, entry.red_team].filter(Boolean).join(' vs ');

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(
      button('Salin paket ini', 'primary', () => copyGalleryEntry(entry)),
      linkButton('Buka overlay', Kit.profileUrl(entry.slug, 'overlay/gameplay')),
    );

    card.append(title, meta, actions);
    el.galleryBody.append(card);
  }
}

async function togglePublish(profile) {
  const key = Kit.ownerKeyFor(profile.slug);
  if (!key) {
    notice('ownerKey profil ini belum ada di perangkat ini. Simpan lewat Alat ownerKey dulu.', 'warn');
    return;
  }
  const isPublished = publishedSlugs.has(profile.slug);
  try {
    await galleryRequest(isPublished ? 'DELETE' : 'PUT', { slug: profile.slug, ownerKey: key });
    notice(isPublished ? 'Profil ditarik dari galeri.' : 'Profil dipublish ke galeri.');
    await loadGallery();
  } catch (error) {
    notice(`Galeri: ${error.message}`, 'warn');
  }
}

async function copyGalleryEntry(entry) {
  // Hanya gaya (template + assets) yang disalin. matchState sengaja dibuang supaya
  // menyalin paket orang lain tidak ikut membawa skor pertandingan theirs.
  const exported = await Kit.exportBundle(entry.slug);
  if (!exported.ok) {
    notice(`Gagal menyalin: ${exported.error}`, 'warn');
    return;
  }
  const bundle = exported.bundle || {};
  const created = await Kit.create({
    name: `${entry.name} (salinan)`,
    template: bundle.template || entry.template,
    bundle: { assets: bundle.assets || {} },
  });
  if (!created.ok) {
    notice(`Gagal menyalin: ${created.error}`, 'warn');
    return;
  }
  notice(`Salinan "${entry.name}" dibuat. Cek di "Profil saya".`);
  renderProfiles();
}

// --- masukan ------------------------------------------------------------

async function sendFeedback() {
  const message = el.feedbackMessage.value.trim();
  if (message.length < 10) {
    el.feedbackStatus.textContent = 'Tulis minimal 10 karakter.';
    return;
  }
  el.sendFeedback.disabled = true;
  el.feedbackStatus.textContent = 'Mengirim...';
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: el.feedbackKind.value,
        message,
        contact: el.feedbackContact.value.trim(),
        // Honeypot: diisi bot, dikosongkan di server.
        website: el.feedbackWebsite.value,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `error ${response.status}`);
    el.feedbackMessage.value = '';
    el.feedbackContact.value = '';
    el.feedbackStatus.textContent = 'Terima kasih, sudah terkirim.';
  } catch (error) {
    el.feedbackStatus.textContent = `Gagal: ${error.message}`;
  } finally {
    el.sendFeedback.disabled = false;
  }
}

// --- theme -------------------------------------------------------------

  function toggleTheme() {
    const light = document.body.classList.toggle('light');
    try {
      window.localStorage.setItem('mlbb_home_theme', light ? 'light' : 'dark');
    } catch {
      /* storage may be blocked */
    }
    el.themeToggle.textContent = light ? 'Mode gelap' : 'Mode terang';
  }

  function restoreTheme() {
    let stored = 'dark';
    try {
      stored = window.localStorage.getItem('mlbb_home_theme') || 'dark';
    } catch {
      /* storage may be blocked */
    }
    document.body.classList.toggle('light', stored === 'light');
    el.themeToggle.textContent = stored === 'light' ? 'Mode gelap' : 'Mode terang';
  }

  // --- boot --------------------------------------------------------------

  function bind() {
    el.create.addEventListener('click', createProfile);
    el.blueTeam.addEventListener('change', () => {
      state.blue = el.blueTeam.value;
      if (state.blue === state.red) {
        state.red = teamItems().find((item) => item.id !== state.blue)?.id || '';
      }
      renderTeamPickers();
    });
    el.redTeam.addEventListener('change', () => {
      state.red = el.redTeam.value;
      if (state.red === state.blue) {
        state.blue = teamItems().find((item) => item.id !== state.red)?.id || '';
      }
      renderTeamPickers();
    });
    el.adopt.addEventListener('click', adoptProfile);
    el.createdDismiss?.addEventListener('click', () => {
      if (el.createdPanel) el.createdPanel.hidden = true;
    });
    el.openBySlug.addEventListener('click', openBySlug);
    el.importBundle.addEventListener('change', (event) => importBundle(event.target.files?.[0]));
    el.sendFeedback?.addEventListener('click', sendFeedback);
    el.themeToggle.addEventListener('click', toggleTheme);
  }

  restoreTheme();
  bind();
  renderProfiles();
  renderTeamPickers();
  loadTemplates();
  loadGallery();
  loadRegistry();
})();