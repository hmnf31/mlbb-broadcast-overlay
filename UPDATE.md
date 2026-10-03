# MLBB Broadcast Engine — Log Update & Roadmap

File ini adalah catatan tunggal untuk semua perubahan yang sudah selesai, temuan audit, dan
rencana kerja yang belum dikerjakan. Diperbarui: 2026-10-03 (Fase 0–8 selesai; Fase 0–2 pernah
di-deploy lebih dulu, Fase 3–8 baru di-deploy pada sesi terakhir).

Status deploy: `https://mlbb-broadcast-overlay.theahuda.workers.dev`
Version ID produksi: `3a1253b9-7acf-4255-803f-fb290a7d3f38` (Fase 3–8 + perbaikan skala)

> Penting: profil `/p/default/` sekarang **kosong dan belum diklaim**. Claim sekali di
> `/p/default/control/` sebelum dipakai untuk broadcast, kalau tidak siapa pun bisa
> mengambil alih kontrol. Data Worker lama satu-profil **tidak dimigrasi** (lihat BAGIAN 10).

---

## BAGIAN 1 — SUDAH SELESAI (Ronde 1: Perbaikan WebSocket)

### Masalah yang ditemukan

Keluhan asli: "di page control websocket terputus tidak selalu terhubung, jadi hanya
menyimpan secara lokal saja".

Penyebabnya bukan satu bug, tapi lima:

| # | Penyebab | Lokasi | Dampak |
|---|---|---|---|
| 1 | **Tidak ada handler `close` sama sekali** | `control/app.js` `connectSocket()` | Socket yang drop tidak pernah disambung ulang. Setelah itu `sendConfigLive()` selalu `false` → "Pengaturan tersimpan lokal" permanen. |
| 2 | **Handler `error` menghabiskan daftar endpoint lalu menyerah** | `control/app.js` | `index += 1; tryConnect();` — di Cloudflare hanya ada 1 endpoint (`/runtime-config.json` selalu mengembalikan `websocketUrl`). Satu error → `index=1 >= length=1` → menyerah selamanya. |
| 3 | **Socket gagal tidak di-close** | `control/app.js` | Kebocoran socket setiap percobaan gagal. |
| 4 | **Tidak ada heartbeat, tidak ada antrean** | `control/app.js` | Idle socket bisa diputus edge/proxy. Update yang dikirim sebelum socket OPEN hilang selamanya. |
| 5 | **Socket churn di halaman OCR** | `debug/app.js` `connectAndSend()` | OCR Live bikin **WebSocket baru tiap siklus (~1 detik)** kalau `liveSocket` belum OPEN. Ini connect/disconnect terus-menerus ke Durable Object. |

Risiko laten tambahan yang sudah diatasi:

| # | Risiko | Detail |
|---|---|---|
| 6 | **Frame > 1 MiB membuat socket dibunuh runtime** | PNG header base64 800 KB + gambar custom 800 KB = > 1 MiB. Cloudflare Workers punya batas 1 MiB per pesan WebSocket. Ini **pasti** terjadi begitu operator mengunggah header + 1 gambar custom. |
| 7 | **Broadcast memboroskan bandwidth** | Setiap update OCR (1/detik) mengirim ulang snapshot ~1 MB berisi base64 ke **semua** klien. |
| 8 | `console.warn('...', port)` | `port` tidak dideklarasikan → `ReferenceError` di handler error (`overlay/gameplay/app.js`). |

### Yang dikerjakan

**File baru: `frontend/shared/live-socket.js`** — klien WebSocket yang dipakai bersama oleh
ketiga halaman (diklassai via `window.LiveSocket.create()`).

- Reconnect otomatis dengan **exponential backoff + jitter** (700 ms → 15 detik, jitter 0.7–1.3).
- **Antrean pesan** saat socket CONNECTING/offline. Pesan `update` berurutan di-*deep merge*
  supaya antrean tidak membengkak dan tidak menimpa state.
- **Heartbeat** `ping`/`pong` tiap 20 detik; kalau pong tidak dijawab dalam 10 detik socket
  dianggap mati lalu di-reconnect paksa.
- Reconnect instan saat event `online`, `visibilitychange` (tab kembali aktif), atau klik manual.
- Rotasi endpoint hanya kalau ada > 1 endpoint (untuk mode lokal Python); di Cloudflare
  selalu retry URL yang sama.
- Deteksi socket half-open (`readyState === OPEN` tapi traffic mati) lewat watchdog.

**`frontend/control/app.js`**
- Badge koneksi + indicator jumlah klien overlay yang terhubung.
- Klik badge = reconnect manual.
- `pushLiveConfig()`: gambar (header + custom) **dipisah** dari state panas, dikirim sebagai
  pesan `assets` terpisah **hanya saat berubah** (dicek via signature di localStorage).
- Kalau socket tidak tersambung, otomatis fallback `PUT /api/state` lewat HTTP.
- Batas ukuran gambar diturunkan: header PNG 550 KB, gambar custom 300 KB, total payload
  700 KB (di bawah batas frame 1 MiB dengan margin aman).

**`frontend/overlay/gameplay/app.js`**
- Pakai shared client. Ambil gambar dari `/api/assets?v=<version>` (HTTP, cacheable) lalu
  render. Snapshot WS tetap kecil.

**`frontend/debug/app.js`**
- **Satu socket persisten** untuk seluruh halaman (bukan churn per siklus).
- Indikator status koneksi yang bisa diklik.

**`cloudflare/worker.mjs`**
- `webSocketClose` + `webSocketError` → broadcast jumlah klien.
- `alarm()` heartbeat tiap 30 detik Keeps idle socket tetap hidup.
- Guard frame > 900.000 karakter → error message, **tidak** membunuh socket.
- **Pemisahan state panas vs aset**: gambar disimpan di key `assets` terpisah dengan
  `version`. Snapshot WS hanya ~1 KB + `assetsVersion`.
- Endpoint baru: `GET /api/state`, `PUT /api/state` (fallback saat WS mati),
  `GET /api/assets?v=N`.
- Pesan baru: `assets`, `command: request_state`, `assets_changed`, `heartbeat`, `peers`.
- `wrangler.jsonc`: `run_worker_first` diubah ke `["/api/*", "/runtime-config.json"]` supaya
  aset static tidak memanggil Worker (hemat kuota free tier).

**`backend/websocket_server.py`** — protokol yang sama diterapkan ke backend Python lokal
(`_split_assets`, `_apply_assets`, `assetsVersion`, `request_state`).

### Hasil tes

- **22/22 tes backend lulus** (`wrangler dev` lokal): broadcast, echo ke pengirim, pong,
  `request_state`, `assets_changed`, `/api/assets`, snapshot tetap < 5 KB, `GET`/`PUT
  /api/state`, `peers` saat close, state pulih setelah reconnect, aset bertahan, `reset`.
- **14/14 tes logika reconnect client lulus** (mock WebSocket): endpoint dari runtime-config,
  status connecting→online, request state, flush, queue saat offline, reconnect otomatis,
  antrean terkirim setelah reconnect, `stop()` mencegah reconnect, tidak pernah pindah host.

### Utang teknis yang sudah diselesaikan

| Utang | Status |
|---|---|
| `handle_client()` tidak memanggil `match_state.apply_update()` untuk pesan `update` | **Selesai** — `apply_update()` sekarang meneruskan ke `match_state`, `websocket_server.py` |
| `backend/main.py` belum punya endpoint HTTP parity (`/api/state`, `/api/assets`) | **Selesai** — ditambahkan, plus `/api/registry` dan `/runtime-config.json` |
| `startPreviewDrag()` akses `querySelector('[data-field="x"]')` tanpa optional chaining | Masterkan di Fase 1 (bersamaan dengan dihapusnya 40 input posisi) |
| Aset bocor lewat `state` (base64 ikut broadcast tiap detik) | **Selesai** — `_split_assets()`/`splitAssets()` + `assetsVersion` |

---

## BAGIAN 2 — CARA KERJA FITUR OCR (dokumentasi untuk referensi)

**OCR tidak ada di Python sama sekali.** `backend/ocr/` kosong. Seluruhnya jalan di browser
pakai **Tesseract.js** (dimuat dari CDN) di halaman `/frontend/debug/`.

### Alur

1. **"Pilih layar/game"** → `navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 } })`.
   Browser meminta operator memilih jendela game. Stream masuk ke `<video>` yang disembunyikan
   (1×1 px) supaya tidak ikut terekam balik.
2. **Kotak ROI** (drag + resize) disimpan sebagai **fraksi 0..1** dari frame, bukan piksel —
   jadi tahan perubahan resolusi. Nilai default di `defaultRegions` hanya tebakan, wajib
   dikalibrasi manual.
3. **Tes OCR / OCR Live**:
   - `getCrop()` menggambar ROI ke canvas dengan filter `grayscale(1) contrast(1.6)`.
   - `worker.setParameters({ tessedit_char_whitelist })` per jenis field
     (`0123456789:.` untuk timer, `0123456789Kk,.` untuk yang lain).
   - `worker.recognize(canvas)` → `parseRecognizedValue()` mengubah teks jadi angka
     (timer → detik; gold mengenali sufiks `K`).
4. Hasil dikirim dua arah: ditulis ke `localStorage` (`mlbb_overlay_config.match`) **dan**
   dikirim `{ type: 'update', payload: { match: {...} } }` → Durable Object → broadcast → overlay.
5. Field yang di-OCR mengikuti mode di control panel (`auto` / `manual`).

### Celah yang membuat angka berkedip (sudah checklist di Fase 4)

`Plan.md` asli meminta **confidence threshold + debounce + majority vote**. Tidak satu pun
diimplementasikan. `readAllRois()` membaca `result.data.confidence` tapi **tidak pernah
memakainya** — semua angka yang berhasil di-parse langsung dikirim. Master vote juga tidak ada.

### Catatan operasional

- Halaman OCR harus dibuka di browser/perangkat **terpisah** dari jendela game.
- ROI hanya tersimpan di browser itu sendiri (diperbaiki di Fase 5).
- `getDisplayMedia` butuh secure context → Cloudflare (HTTPS) memenuhi syarat.

---

## BAGIAN 3 — TEMUAN AUDIT (bagian yang tidak ada fiturnya)

| Temuan | Status |
|---|---|
| **`goldDiff` (Selisih Gold)** ada di config + input control + dikirim ke server, tapi **tidak ada elemen di overlay** (`overlay/gameplay/index.html` tidak punya `#gold-diff`, `ui` tidak punya entri). Nilainya sudah masuk lalu dibuang diam-diam. | Diperbaiki Fase 2 |
| **`match.status` dan `match.series`** ada di `backend/match_state.py` tapi tidak pernah dikirim control maupun dirender. | Dipakai Fase 3 (BO2) + Fase 6 (Result) |
| **`config/gameplay-layout.json`** — tidak direferensi kode mana pun. File mati. | Dihapus Fase 8 |
| **`data/asset-registry.json`** — tidak direferensi kode mana pun. File mati. Isinya: 2 hero, 5 item, 2 tim. | Dihidupkan Fase 0 (pindah ke `assets/registry.json`), dipakai Fase 7 |
| **`assets/heroes/*`, `assets/items/*`** — ada filenya tapi tidak terpakai (player cards belum ada). | Dipakai Fase 7 (registry 245 entri) |
| **`assets/overlays/gameplay-template.svg`** — ada filenya tapi **tidak terdaftar** di registry. | Ditambahkan ke registry di Fase 0 |
| **`backend/ocr/`, `backend/api/`** — folder kosong. | Dihapus Fase 8 |
| **`frontend/overlay/result/`** — folder kosong (Phase 2 di `Plan.md`). | Diisi Fase 6 |
| **`overlay/gameplay/app.js:232`** `postMessage({type:'overlay-layout-changed'})` ke `window.parent` — **tidak ada receiver-nya di mana pun**. Kode mati. | Dihapus Fase 8 |

---

## BAGIAN 4 — ROADMAP 9 FASE (Fase 0 = fondasi multi-profil)

Fase 0 adalah fondasi untuk semuanya. Detail Fase 1–8 ada di `BAGIAN 7`.

| Fase | Status | Judul | Isi inti |
|---|---|---|---|
| **0** | **Selesai + deploy** | **Multi-profil (fondasi)** | Home, routing `/p/<slug>/`, 1 DO per profil, ownerKey, export/import, registry aset |
| **1** | **Selesai + deploy** | Bersihkan UI control | Hapus 40 input Posisi X/Y → drag-only |
| **2** | **Selesai + deploy** | Selisih Gold | `goldDiff` otomatis + `#gold-diff` |
| **3** | **Selesai + deploy** | BO2 Series Indicator | Titik seri per game per tim + tombol reset seri |
| **4** | **Selesai + deploy** | Stabilisasi OCR | Anchor, confidence threshold, majority vote, validasi |
| **5** | **Selesai + deploy** | OCR & ROI di server | `ocr` key + Field Lock / Manual Override |
| **6** | **Selesai + deploy** | Result Overlay | Browser source kedua `/overlay/result/` |
| **7** | **Selesai + deploy** | Player Cards 5v5 | `players` key + registry 245 aset |
| **8** | **Selesai + deploy** | Kebersihan | README diperbarui, file mati + kode mati dihapus |

Detail Fase 0 ada di `BAGIAN 6`.

---

## BAGIAN 5 — CATATAN LAYANAN

- `npm run build:cloudflare` menyalin `frontend/` + `assets/` ke `cloudflare/public/`.
  **Edit selalu di `frontend/`, bukan `cloudflare/public/`.**
- `wrangler dev` lokal pernah mengunci folder aset → hentikan simulator sebelum `deploy`.
- Batas frame WebSocket Worker = 1 MiB. Jangan kirim gambar lewat `update`; pakai pesan `assets`.
- Quota Durable Object free tier perlu dipantau di dashboard Cloudflare saat broadcast panjang
  (heartbeat alarm 30 detik + OCR 1 Hz + update manual).
- ~~Cloudflare Worker & DO tidak diamankan~~ → **diatasi di Fase 0** dengan slug acak + ownerKey.
- Yang **tidak** Masih terbuka di free tier: pembuatan profil tidak punya autentikasi, jadi
  secara teori bot bisa membuat banyak DO. Tidak ada DB untuk di-abuse dan repo ini statis,
  jadi prioritas rendah. Opsi gratis bila nanti dibutuhkan: Cloudflare Turnstile di form create.

---

## BAGIAN 6 — FASE 0: MULTI-PROFIL (fondasi)

> Tujuan: proyek bisa dipakai **umum**. Satu orang membuat profil sendiri (1 game = 1 paket
> overlay untuk streaming), orang lain membuat profilnya sendiri, dan keduanya tidak saling
> mengganggu.

### A. Keputusan yang sudah diambil

| Topik | Keputusan |
|---|---|
| Identitas | **Tanpa akun.** Slug acak = kunci akses baca, ownerKey = kunci edit |
| URL lama | **Tetap jalan.** `/frontend/*` di-redirect ke profil `default` |
| Cakupan | Sekalian export/import paket |
| Isi Home | Katalog paket + **library aset** (registry) + daftar "Profil Saya" |
| BO2 | Fitur baru, masuk Fase 3 |

### B. Arsitektur

**Prinsip: 1 profil = 1 tenant = 1 Durable Object.** Terpisah secara fisik lewat
`idFromName(slug)` — profil 1 tidak mungkin mengganggu profil 2 bukan karena dicek, tapi karena
objeknya memang berbeda.

```
https://worker.dev/                            → Home (katalog paket + aset + profil saya)
https://worker.dev/p/<slug>/control/           → Control panel
https://worker.dev/p/<slug>/overlay/gameplay/  → Browser source OBS
https://worker.dev/p/<slug>/overlay/result/    → Browser source layar hasil
https://worker.dev/p/<slug>/debug/             → Kalibrasi OCR

POST /api/profiles                → buat profil / import bundel
GET  /api/p/<slug>                → metadata profil (publik)
PUT  /api/p/<slug>                → ubah nama/rotasi slug (WAJIB ownerKey)
DELETE /api/p/<slug>              → hapus profil (WAJIB ownerKey)
GET  /api/p/<slug>/state          → snapshot           (publik)
PUT  /api/p/<slug>/state          → update            (WAJIB ownerKey)
GET  /api/p/<slug>/assets         → gambar + registry (publik, cacheable)
GET  /api/p/<slug>/export         → bundel profil (tanpa ownerKey)
WS   /api/p/<slug>/live           → live sync         (auth via pesan pertama)
GET  /api/registry                → katalog aset global (publik)
```

### C. Durable Objects

| DO | Isi |
|---|---|
| `SiteState` (global) | alias URL legacy, jumlah profil, config situs |
| `idFromName(slug)` | `profile`, `matchState`, `assets`, `ocr`, `result`, `players` |
| `idFromName('mlbb-live-match')` | dibaca sekali saat migrasi, lalu dibiarkan |

### D. Model keamanan

| Aspek | Keputusan |
|---|---|
| Slug | Acak 12 char base62 (~71 bit, mustahil ditebak). Sanitasi `[a-z0-9-]{3,48}` |
| OwnerKey | Acak 32 char. DO **hanya** menyimpan SHA-256 hash-nya. Aslinya ditampilkan sekali + disimpan di `localStorage` |
| Read | Terbuka untuk siapa pun yang punya slug (dipakai OBS) |
| Write REST | Header `x-overlay-key` |
| Write WS | Handshake pesan pertama: DO kirim `{type:'hello'}` → klien `{type:'auth', key}` → `{type:'auth_ok', role}` |
| Role socket | Disimpan di `ws.serializeAttachment({role})` → **`role: 'owner' \| 'viewer'`** sehingga bertahan setelah DO hibernasi |
| Viewer | Socket tanpa ownerKey valid otomatis jadi `viewer`: hanya boleh `ping` dan `request_state` |

Handshake lewat pesan (bukan `?key=` di URL) supaya secret tidak bocor ke log analytics.

### E. Aset & Paket

- `data/asset-registry.json` → **pindah** ke `assets/registry.json`, dilayani static
  (`GET /assets/registry.json`).
- Path di dalam registry diubah dari relatif (`../../assets/...`) jadi **absolut**
  (`/assets/heroes/hero-rose.svg`) supaya bisa dipakai dari route mana pun.
- Tambahkan entri `overlays/gameplay-template` yang selama ini hilang.
- **Katalog paket**: `MLBB Gameplay` (default) dan `MLBB Result`, masing-masing punya default
  layout / style / ROI. BO2 bukan paket terpisah, tapi **toggle per profil** (Fase 3).
- **Pemilihan aset di Home**: template + nama profil + pilih 2 tim dari registry (logo + nama).
- **Library aset penuh** (heroes / items) ada di **control panel**, bukan Home — item milik
  data player di Fase 7, bukan identitas profil.

### F. Export / Import

Export **tidak pernah** menyertakan ownerKey.

```
GET  /api/p/<slug>/export  → { profile, matchState, assets, ocr, result, players, schemaVersion }
POST /api/profiles { template, bundle? }  → profil baru (slug + ownerKey baru)
```

Efeknya import = "buat salinan" — persis kebutuhan "1 tournament = 1 game = 1 profil" — dan
tidak ada jalur membajak kepemilikan lewat file. Batas import 2 MB + validasi schema.

### G. Backward Compatibility

1. `/frontend/overlay/gameplay/` → `302` ke `/p/<alias>/overlay/gameplay/`, alias dibaca dari
   `SiteState` (default `'default'`). **URL OBS yang sudah terpasang tidak perlu configure ulang.**
2. Migrasi: kalau storage `default` kosong, salin dari id lama `mlbb-live-match` sekali,
   tandai `migrated`.
3. Profil `default` belum punya ownerKey → tombol **"Klaim profil ini"** di
   `/p/default/control/`: generate ownerKey → simpan di `localStorage` → tulis hash ke DO.
   Sekali saja.
4. Setelah diklaim, Home menampilkan **"Rotasi slug"** → slug jadi acak, slug lama disimpan
   sebagai alias di `SiteState` supaya URL lama tetap redirect.

⚠️ **Race di langkah 3**: siapa pun yang membuka `/p/default/control/` pertama bisa mengklaim.
Karena `default` hanya untuk Anda sendiri (URL tidak dipublikasikan) risikonya rendah, tapi
**klaim segera setelah deploy**, sebelum URL-nya dibagikan.

### H. Perubahan file

| File | Perubahan |
|---|---|
| `cloudflare/worker.mjs` | DO `SiteState`, slug parsing, routing `/p/*`, proxy `env.ASSETS`, CRUD profil, auth ownerKey, handshake WS, migrasi |
| `cloudflare/wrangler.jsonc` | `run_worker_first` → `["/", "/p/*", "/api/*", "/frontend/*", "/runtime-config.json"]`, `html_handling` → `"none"` |
| `frontend/home/index.html` `.js` `.css` | **Baru** — katalog paket, picker tim, daftar "Profil Saya", import, panel URL OBS + ownerKey, rotasi slug, hapus profil |
| `frontend/shared/profile.js` | **Baru** — parse slug dari `location.pathname`, baca ownerKey, helper auth |
| `frontend/shared/live-socket.js` | Endpoint profile-aware + handshake auth |
| `frontend/control/index.html` | Semua path absolut, banner profil + tombol klaim, dimuat `profile.js` |
| `frontend/control/app.js` | Path absolut, `x-overlay-key`, config key per profil, banner klaim, URL debug per profil |
| `frontend/overlay/gameplay/*` | Path absolut, config key per profil, aset via `ProfileKit` (tanpa ownerKey), `?edit` tetap jalan |
| `frontend/debug/*` | Path absolut, `slug` + `ownerKey` (perangkat OCR menulis sebagai owner), status viewer bila ownerKey salah |
| `scripts/build-cloudflare.mjs` | Salin `assets/registry.json` + validasi setiap path |
| `assets/registry.json` | Dipindah dari `data/asset-registry.json`, path absolut, 10 aset / 4 kategori |
| `scripts/test-multi-profile.mjs` | **Baru** — tes integrasi multi-profil terhadap `wrangler dev` (79 di Fase 0, 103 setelah Fase 3–7) |
| `backend/main.py`, `backend/match_state.py`, `backend/websocket_server.py` | Parity HTTP lokal, path aset absolut, `apply_update` dipanggil |
| `config/gameplay-layout.json` | Dihapus (file mati) |

> ⚠️ `/frontend/*` **wajib** ada di `run_worker_first`, kalau tidak asset server melayani URL lama
> langsung dan redirect ke `/p/<slug>/` tidak pernah terjadi.
>
> ⚠️ `html_handling` harus `"none"`. Dengan `auto-trailing-slash`, permintaan
> `/frontend/control/index.html` di-redirect ke `/frontend/control/` → Worker mengredirect lagi
> ke `/p/default/control/` → halaman tersebut meminta `/frontend/control/index.html` → **loop**.

### I. Referensi path relatif yang sudah jadi absolut

Semua sudah dikonversi, diverifikasi lewat tes HTML:

| Lokasi | Semula | Sekarang |
|---|---|---|
| `debug/index.html` | `../../shared/live-socket.js`, `./app.js` | `/frontend/shared/*.js`, `/frontend/debug/app.js` |
| `control/index.html` | `../debug/` | link debug dibikin per-profil oleh `app.js` |
| `control/index.html` | `../shared/live-socket.js`, `./app.js` | `/frontend/shared/*.js`, `/frontend/control/app.js` |
| `overlay/gameplay/index.html` | `../../../assets/teams/*.svg` | `/assets/teams/*.svg` |
| `overlay/gameplay/index.html` | `../../shared/live-socket.js`, `./app.js` | `/frontend/shared/*.js`, `/frontend/overlay/gameplay/app.js` |
| `control/app.js`, `overlay/gameplay/app.js` | `../../../assets/teams/*.svg` | `/assets/teams/*.svg` |

### J. Tes Fase 0 — `scripts/test-multi-profile.mjs`

Dijalankan terhadap `wrangler dev` port 8787. **Hasil: 79/79 lulus** (kini 103/103, lihat BAGIAN 12.7).

| Area | Yang diuji |
|---|---|
| Static | `/` = Home, `/assets/registry.json` = 200, `gameplay-template` ada, path absolut di HTML |
| Isolasi | 2 profil → update di A **tidak** mengubah snapshot B (REST + WS) |
| Auth REST | `PUT /state` tanpa / salah ownerKey = 403, `reason` benar, state tidak berubah |
| Auth WS | `hello` → `auth` → `auth_ok` dengan role benar; tanpa key = `viewer`, tulis ditolak `forbidden`; `ping` tetap boleh; write owner terkirim ke viewer |
| Klaim | Profil tanpa `includeKey` berstatus unclaimed → klaim sekali berhasil, klaim kedua 409, ownerKey dari klaim gagal tidak bisa menulis |
| Export/Import | Round-trip state identik, ownerKey **baru**, tidak ada `ownerKey`/`ownerKeyHash` di bundel, ownerKey lama tidak berlaku di salinan |
| Alias | Rotasi: state ikut, slug lama → 302 ke slug baru (halaman **dan** API), ownerKey tetap berlaku, hapus profil kembali ke default |
| Guard | Body 2 MB ditolak 400 dan state tidak korup |
| Route | `/p/<slug>` → `/control/`, halaman ngawur → `/control/`, slug invalid di API = 400, slug duplikat = 409 |

Regresi lokal: `python verify_websocket.py` → `websocket_ok 1325 12`.
`npm run build:cloudflare` → registry valid 10 aset pada saat itu (kini 245 aset, lihat 12.1).
`wrangler deploy --dry-run` → 36 file, 35.96 KiB.

#### Bug yang ditemukan oleh tes ini (sudah diperbaiki)

| # | Gejala | Akar masalah |
|---|---|---|
| 1 | `PUT /api/p/<slug>` (rename) & `PUT /state` dengan ownerKey salah → **500** | `stub.authorizeRequest(request)` mengirim objek `Request` lewat RPC DO. Runtime harus.me-*stream* body, jadi body terkunci → `Body has already been used` / `ReadableStream has been locked`. **Perbaikan: RPC hanya menerima string header, dan body dibaca sekali di awal.** |
| 2 | Profil hasil `POST /api/profiles` tanpa `includeKey` **tidak bisa diklaim selamanya** | `ownerKey` selalu di-mint lalu hash-nya disimpan tapi key-nya dibuang → profil terlihat `claimed` dan menolak semua klaim. **Perbaikan: key hanya di-mint kalau `includeKey === true`.** |
| 3 | `POST /api/profiles { slug: "ADA SPASI!" }` → **201** diam-diam | `sanitizeSlug()`lowerscase + menolak, lalu pemanggil jatuh ke `requestedSlug \|\| newSlug()` → profil acak dibuat. **Perbaikan: slug yang diberikan tapi tidak valid → 400.** |
| 4 | `/api/p/HURUF-BESAR/state` → **200** | Sama: slug di-*lowercase* lalu diterima, jadi URL yang diketik bukan URL profilnya. **Perbaikan: `sanitizeSlug` sekarang ketat tanpa lowercase.** |
| 5 | Redirect alias API mengarah ke **halaman HTML** | `Response.redirect` memakai `/p/<slug>/<rest>`, bukan `/api/p/<slug>/<rest>` → `fetch()` ikut ke HTML. **Perbaikan: redirect tetap di jalur `/api/`.** |
| 6 | `/frontend/control/` dilayani asset server, **tidak redirect** | `/frontend/*` tidak ada di `run_worker_first`. **Perbaikan: ditambahkan.** |
| 7 | `/p/<slug>/control/` → **redirect loop** | `html_handling: auto-trailing-slash` membuat `/index.html` → `/` →_worker_ redirect lagi ke `/p/<slug>/control/`. **Perbaikan: `html_handling: "none"`.** |
| 8 | Body 2 MB diterima | Batas 8 MB terlalu longgar untuk state panas. **Perbaikan: state 512 KB, aset 2 MB.** |

---

## BAGIAN 7 — DETAIL FASE 1–8

### Fase 1 · Bersihkan UI control — **SELESAI**
- Hapus 40 input `Posisi X/Y` (`control/index.html`) **dan** field X/Y di editor item custom.
- Posisi tetap hidup lewat **drag & drop** di preview, disimpan ke `layout` di localStorage
  per-profil dan langsung dikirim ke client yang tersambung.
- Teks petunjuk "Seret item di preview untuk memindahkannya." ditambahkan.
- Sinkronisasi input X/Y yang jadi kode mati dibuang dari `readFormValues()` dan
  `populateForm()`; `layout` kini hanya dibaca dari config, bukan dari DOM.
- Bug yang ketemu dan diperbaiki saat pengerjaan:
  - `readCustomItems()` me-reset posisi semua item ke `0,0` setiap kalibrasi ulang.
  - `setPointerCapture()` di browser tanpa Pointer Events mematikan drag.
  - Preview tersembunyi memberi `clientWidth === 0` sehingga skala jadi `Infinity`/`NaN`.
  - Drag bisa keluar kanvas; sekarang di-clamp ke 1280×720.
  - Klik biasa (tanpa movement) ikut mengirim broadcast; sekarang pakai penanda `moved`.
- `startPreviewDrag()` tidak lagi memakai optional chaining pada elemen X/Y yang sudah dihapus.
- Tes regresi: `scripts/test-control-panel.mjs` (jsdom) — **43 passed, 0 failed**.

### Fase 2 · Selisih Gold — **SELESAI + DEPLOY**
- Hapus input `Selisih Gold` dari control.
- Hitung otomatis di `readFormValues()`: `config.match.goldDiff = blueGold - redGold`.
- Tambah elemen `#gold-diff` di `overlay/gameplay/index.html`.
- Tambah `ui.goldDiff` + entry di `applyItemStyles()`.
- Tambah `goldDiff: { size, color }` di `style.items` (default + defaultConfig control).
- Tambah posisi default di `layout` + item di `renderPreview()` control.
- Format bertanda: `+1.3K` / `-2.4K`.
- Warna otomatis mengikuti tim yang sedang unggul, jadi operator tidak perlu membaca angkanya
  dulu untuk tahu siapa di depan.
- Angka di bawah 1000 ditampilkan penuh (`+640`), bukan `+0.6K`, supaya selisih kecil tidak
  ikut hilang.
- Semuanya diturunkan, tidak pernah disimpan terpisah: operator tidak bisa mengetik dua
  angka yang tidak sama dengan selisihnya.

### Fase 3 · BO2 Series Indicator

Tujuan: di control ada **fungsi titik seri** — kalau play 1 win, jadi **titik 1 merah, titik 2 abu**;
kalau match sudah 1-1, maka **di setiap tim ada 1 titik abu dan 1 titik merah**.

#### Model data

Disimpan di `match.bo2` (state panas, sudah ikut alur sinkronisasi yang ada):

```js
match.bo2 = {
  enabled: false,
  bestOf: 2,
  games: [
    { winner: null },   // null | 'blue' | 'red'
    { winner: null },
  ],
}
```

**Hanya ada satu sumber kebenaran** (`games[i].winner`), lalu titik tiap tim **diturunkan**.
Ini mencegah state kontradiktif di mana kedua tim sama-sama menampilkan merah untuk game yang sama.

```
wins('blue', i)  = games[i].winner === 'blue'
wins('red',  i)  = games[i].winner === 'red'
```

#### Tampilan titik

| Kondisi sebuah titik | Bentuk | Warna |
|---|---|---|
| Game **belum** main | Lingkaran kosong (hollow) | Abu-abu `#8a8f98` |
| Tim **menang** di game itu | Lingkaran isi penuh | **Merah** `#e5484d` |
| Tim **kalah** di game itu | Lingkaran abu + tanda `✕` | Abu gelap `#4a4f58` |

> Catatan: permintaan menyebut "abu" untuk kedua kasus (game belum main **dan** kalah), jadi
> keduanya memang sama-sama abu. Bedanya dibedakan secara visual: belum main = hollow,
> kalah = abu + `✕`. Kalau Anda mau kalah juga merah gelap, tinggal ganti warnanya.

#### Contoh yang diminta

| Situasi | Blue | Red |
|---|---|---|
| **Awal** | abu · abu | abu · abu |
| **Play 1, Blue win** | **merah** · abu | ✕ abu · abu |
| **Play 1, Red win** | ✕ abu · abu | **merah** · abu |
| **Match 1-1** | **merah** · ✕ abu | ✕ abu · **merah** |
| **Blue 2-0** | **merah** · **merah** | ✕ abu · ✕ abu |

#### Control

- Section baru **"Seri BO2"** di control panel: dua baris (Blue / Red), masing-masing 2 titik.
- **Klik titik** di baris tim → set `games[i].winner` jadi tim itu.
- **Klik lagi titik yang sama** → mengosongkan game itu (`winner = null`).
- Tombol **"Reset seri"** → semua `winner = null`.
- Checkbox **"Tampilkan indikator BO2"** → `match.bo2.enabled`.
- Titik bisa **di-drag** di preview (pakai sistem drag dari Fase 1) → `layout.bo2Blue`,
  `layout.bo2Red`.

#### Indikator tambahan (opsional, murah)

- **Match point**: kalau satu tim sudah punya 1 win dan game berikutnya belum main → titik game
  berikutnya di overlay berkedip halus.
- **Seri selesai**: kalau satu tim punya 2 win → badge "SET" muncul di overlay dan tombol
  klik dikunci (tombol Reset seri tetap aktif). Mencegah operator salah klik jadi 2-0-1.

#### Yang perlu disentuh

| File | Perubahan |
|---|---|
| `frontend/control/index.html` | Section "Seri BO2" (2 baris × 2 titik + reset + checkbox) |
| `frontend/control/app.js` | `readBo2FromDom()` / `writeBo2ToDom()`, reset, guard auth |
| `frontend/control/app.js` `renderPreview()` | Titik BO2 sebagai item draggable |
| `frontend/overlay/gameplay/index.html` | 4 elemen `.bo2-dot` (2 per tim) |
| `frontend/overlay/gameplay/app.js` | `renderBo2()` dari `match.bo2`, match point, badge "SET" |
| `backend/match_state.py` | Default `match.bo2` |
| `backend/websocket_server.py` | Default saat migrasi state lawas |

Karena `match.bo2` masuk `matchState`, otomatis ikut **export/import** dan **terisolasi per profil**.

#### Tes BO2

1. Default → 4 titik abu.
2. Blue klik game 1 → blue g1 merah, red g1 ✕, semua g2 abu.
3. Red klik game 2 → match 1-1: tiap tim 1 merah + 1 ✕ abu.
4. Klik titik yang sudah merah → game itu kosong lagi.
5. Reset seri → 4 titik abu.
6. `enabled = false` → tidak ada titik di overlay.
7. Konsistensi: `games[i].winner` tidak pernah `'blue'` dan `'red'` bersamaan.

### Fase 4 · Stabilisasi OCR (bagian paling penting)
Semua di `frontend/debug/`.

#### Aturan validasi per field

| Field | Aturan |
|---|---|
| `blueKills`, `redKills` | Monoton naik (tidak boleh turun). `maxDelta = clamp(ceil(elapsedMs / 2500), 1, 5)`. Delta > 5 butuh **2 pembacaan beruntun identik** (multi-kill cepat). Menangkap misread `9 → 15`. |
| `blueGold`, `redGold` | Monoton naik. `maxDelta = max(1200, elapsedSec × 25)` gold/detik. Menangkap bacaan "awal 10" dan loncat-loncat. |
| `timer` | Monoton naik, rentang `0..3600`. Drop > 2 detik ditolak (efek transisi frame). |
| `turtle*`, `lord*`, `tower*` | Integer ≥ 0, monoton, lompatan maks 3. |

#### Mekanisme pendukung

- **Confidence threshold** per field, default 70, dari `result.data.confidence`.
- **Majority vote** 2-dari-3 bacaan terakhir untuk field yang prone berkedip.
- **Anchor + auto re-anchor**: 3 bacaan beruntun identik yang ≥ 30% di bawah anchor →
  anggap itu **game baru**, anchor di-reset. Anchor disimpan **di server** (`ocr.anchor`)
  supaya page reload tidak kehilangan history. Ini juga titik integrasi dengan **BO2 Fase 3**:
  saat anchor ter-reset, game BO2 berikutnya otomatis disiapkan.
- Tombol manual **"Reset anchor OCR"** untuk situasi khusus.
- **Bacaan yang ditolak tidak pernah menimpa nilai yang tampil** → inilah akar kedipannya.
- **Tabel diagnostik** di halaman debug: raw text, confidence, keputusan (terima/tolak +
  alasan), nilai terakhir yang diterima.

#### Catatan tuning dari user
Kill MOBA 5v5 naik bertahap 1→2→3, tidak mungkin +6 mendadak → itu dasar batas atas 5.
Pembacaan gold kadang loncat-loncat (misal bacaan awal "10") → itu dasar aturan monoton.

### Fase 5 · OCR & ROI di server
- `ocr: { regions, modes, thresholds, enabled, anchor }` disimpan di Durable Object.
- Halaman debug load/save ROI ke server; `localStorage` jadi cache offline saja.
- Control panel bisa mengatur **mode + threshold untuk semua field** (bukan hanya
  turtle/lord/tower) → ini memberi **Field Lock / Manual Override** yang diminta `Plan.md`.

### Fase 6 · Result Overlay (Phase 2)
- `frontend/overlay/result/` → `index.html`, `app.js`, `styles.css`.
- State `result` baru di DO:
  `visible`, `seriesScore{blue,red}`, `gameNumber`, `bestOf`, `durationSec`,
  `damageDealt`, `damageTaken`, `mvp`, `headline`, `subline`.
- Section editor di control + tombol pindah scene → browser source kedua untuk OBS.
- `seriesScore` bisa diisi otomatis dari `match.bo2` (Fase 3) → sumber kebenaran tetap satu.

### Fase 7 · Player Cards 5v5
- State `players`: 5 biru + 5 merah — `slot`, `name`, `hero`, `heroImage`, `level`,
  `kills`, `deaths`, `assists`, `items[]`.
- Overlay render dua kolom 5 baris.
- **`assets/registry.json` dipakai**: dikirim di snapshot sebagai `registry`, overlay
  resolve path hero/item/logo.
- Section editor di control + **library aset penuh** (heroes / items) dengan preview.

### Fase 8 · Kebersihan
- Hapus `backend/ocr/`, `backend/api/` (kosong; OCR memang client-side).
- Hapus `config/gameplay-layout.json` (file mati).
- Hapus `overlay/gameplay/app.js` `postMessage` yang tidak ada receiver-nya.
- Update `README.md`: alur OCR, cara kalibrasi ROI di perangkat kedua, arti badge koneksi,
  cara pakai multi-profil + ownerKey, aturan main Cloudflare free-tier.

### Urutan eksekusi

```
Fase 0  Worker (SiteState → routing → auth → endpoint profil)
        → absolute paths → profile.js + live-socket.js → frontend/home/
        → redirect legacy + klaim → tes & deploy

Fase 1-3  Bersihkan UI → goldDiff → BO2 (bertumpung di drag & drop Fase 1)
Fase 4-5  Stabilisasi OCR → ROI server + Field Lock
Fase 6-7  Result overlay → player cards
Fase 8  Kebersihan + README
```

Paritas backend Python (`backend/websocket_server.py` + `backend/main.py`) dikerjakan di awal
Fase 0 supaya tidak menumpuk utang teknis.

---

## CATATAN PENTING SEBELUM DEPLOY FASE 0

1. ~~`backend/websocket_server.py` harus disintaksikan + dites~~ — **sudah selesai**, `verify_websocket.py` hijau.
2. `startPreviewDrag()` harus diperbaiki sebelum 40 input Posisi X/Y dihapus (Fase 1).
3. Klaim `/p/default/control/` segera setelah deploy, sebelum URL-nya dibagikan.
4. ~~Semua path relatif harus jadi absolut~~ — **sudah selesai**, `/frontend/*` dan `run_worker_first` sudah diatur.
5. ~~Smoke test manual setelah deploy~~ — **sudah dijalankan pada 2026-10-03**, lihat
   BAGIAN 10. Yang belum bisa diuji tanpa monitor MLBB asli: akurasi OCR end-to-end.

### Perintah verifikasi

```bash
npm run build:cloudflare                 # validasi registry + salin ke cloudflare/public
npm run d1:schema:local                  # pasang skema D1 ke database lokal
npx wrangler dev --config cloudflare/wrangler.jsonc   # terminal 1
npm run test:profiles                    # terminal 2 → harus 103/103
npm run test:control                     # terminal 2 → harus 43/43
npm run test:overlay                     # terminal 2 → harus 26/26
npm run test:ocr                         # terminal 2 → harus 43/43
npm run test:d1                          # terminal 2 → harus 27/27
python verify_websocket.py               # regresi backend lokal
npm run deploy:cloudflare                # baru setelah semuanya hijau
```

## BAGIAN 9 — D1: DATABASE GRATIS CLOUDFLARE — **SUDAH DI-DEPLOY**

D1 dipakai hanya untuk dua hal yang tidak cocok kalau disimpan di Durable Object:
**galeri paket** dan **kotak masukan**. Detail setup ada di `cloudflare/README-d1.md`.

### Yang ditambahkan
- `cloudflare/schema.sql` + `cloudflare/migrations/0001_init.sql`: tabel `gallery_entries`
  (slug unik, nama, tim, template, waktu) dan `feedback` (jenis, pesan, kontak, waktu).
- Binding D1 `mlbb-db` → `env.DB` di `cloudflare/wrangler.jsonc`.
- `cloudflare/worker.mjs`:
  - `withDatabase()` membungkus handler: binding atau skema yang hilang dibalas `503`
    dengan `reason: no_database`, bukan `500`, dan tidak boleh menggagalkan halaman lain.
  - `handleGallery()` — `GET` publik (maks 50 entri, `?limit=`), `PUT` publish/unpublish
    dengan verifikasi ownerKey lewat `ProfileStore`, `DELETE` unpublish.
  - `handleFeedback()` — `POST` dengan honeypot `website`, minimal 10 karakter, dan whitelist
    jenis `bug` / `fitur` / `lain` / `lainnya` / `other` / `feature`.
- Route `/api/gallery` dan `/api/feedback` di dispatcher utama.
- `frontend/home/index.html` + `app.js`: bagian "Galeri paket" (kartu, "Publish" /
  "Tarik dari galeri", "Salin paket ini") dan "Masukan" (kirim feedback).
- `frontend/home/styles.css`: `.gallery-grid`, `.gallery-card`, `.hp` (honeypot off-screen).
- `scripts/test-d1.mjs` — 27 tes.

### Keputusan yang diambil
- **ownerKey tidak pernah masuk D1.** D1 hanya menerima slug + nama + tim, dan hanya setelah
  `authorizeKey()` membuktikan kepemilikan. Hash ownerKey tetap di Durable Object.
- **State match tidak ikut disalin** saat "Salin paket ini": hanya `template` + `assets`.
  Menyalin `matchState` milik orang lain akan ikut membawa skor pertandingan theirs.
- **D1 boleh tidak ada.** Semua fitur lain tetap jalan; tombol Publish disembunyikan dan
  bagian galeri menampilkan "Galeri tidak aktif". Ini disengaja supaya D1 tidak jadi
  syarat rilis.
- Publish memakai `INSERT ... ON CONFLICT(slug) DO UPDATE`, jadi publish berulang
  memperbarui entri, bukan menumpuk duplikat.

### Status — SELESAI, sudah di-deploy 2026-10-03
- Database produksi dibuat: `mlbb-db`, region APAC, ID `a8bfcfa4-505d-483b-a85b-6177c17a56a1`.
- Skema terpasang ke D1 **produksi**: `gallery_entries`, `feedback`, plus
  `idx_gallery_published_at` dan `idx_feedback_created_at`.
- 27 tes D1 lulus (auth 403, slug 400, upsert, limit, honeypot, body rusak).
- Graceful degradation diverifikasi dengan config tanpa `d1_databases`: `/api/gallery` dan
  `/api/feedback` balas `503`, sedangkan `/`, `/p/default/control/`, aset, dan
  `/api/p/default/state` tetap `200`.
- Smoke test produksi: `GET /api/gallery` → `200 {"entries":[],"enabled":true}`;
  `POST /api/feedback` → `201`, baris benar-benar muncul di D1 produksi lalu dihapus lagi
  supaya database tetap bersih.
- Build + dry-run: 36 file, 40.76 KiB, binding `SITE_STATE` / `PROFILE_STORE` / `DB` /
  `ASSETS` terbaca tanpa warning.

### Utang teknis
- Rate limit untuk `POST /api/feedback` belum ada. Honeypot menahan bot paling naïf, tapi
  endpoint ini publik dan tanpa akun; Free plan tidak menyediakan Turnstile, jadi
  pembatasan harus lewat Durable Object atau WAF rule.
- Masukan tidak pernah dibaca dari UI. Kalau nanti mau moderasi, tambahkan halaman
  admin — jangan sekarang, itu ruang lingkup baru.

## BAGIAN 10 — DEPLOY 2026-10-03 & RETIRE `LiveMatch`

Deploy pertama versi multi-profil tertahan oleh Worker:

```
[ERROR] Durable Object exports reconciliation failed:
[orphaned_provisioned_namespace] class 'LiveMatch': class 'LiveMatch' has a provisioned
Durable Object namespace (b5a58076b57649bb8b1def5bfbce59db) but is neither in code nor
in `exports`. This is an orphan; declare a `deleted` tombstone for the class to retire it.
```

Deploy pertama yang sukses: `40e26f08-2cf1-4f8f-8a96-672f2d76fbe0`,
`Durable Object exports reconciliation: Created: ProfileStore, SiteState / Deleted: LiveMatch`.

### Kenapa datanya tidak bisa dimigrasi
Worker lama memakai class `LiveMatch` (binding `env.LIVE_MATCH`). Worker baru memakai
`ProfileStore`. Keduanya namespace Durable Object yang **berbeda**, jadi datanya tidak
berpindah otomatis.

Yang lebih penting, `migrateLegacyIfNeeded()` cari data lama lewat
`profileStub(env, 'mlbb-live-match')` — itu nama DO di dalam namespace `ProfileStore`, bukan
namespace `LiveMatch`. Artinya, fungsi migrasi itu **tidak akan pernah menemukan data
live** secara struktur, walaupun class lamanya masih ada. Migrasi ini sekarang efektif
dead code untuk produksi.

Screenshot data live sebelum retire sudah disimpan di `live-backup-2026-10-03/`
(`state.json` 3,4 KB, `assets.json` 283 KB): timer 796, blue 22 kill, gold 46200.

### Keputusan
Retire tanpa restore. `/p/default/` mulai kosong.

### Tindakan yang harus dilakukan oleh operator
1. Buka `https://mlbb-broadcast-overlay.theahuda.workers.dev/p/default/control/` dan **claim**
   profil sekali. Sampai itu dilakukan, `ownerKeyHash` kosong dan siapa pun yang tahu URL
   bisa mengklaim kontrol broadcast.
2. Kalau ternyata data lama masih dibutuhkan, import manual dari backup:
   `assets.json` lalu `state.json` via `PUT /api/p/default/assets` dan `PUT /api/p/default/state`.

### Smoke test produksi (semua lulus)
| Cek                                | Hasil                     |
| ---------------------------------- | ------------------------- |
| `/`                                | 200                       |
| `/p/default/control/`              | 200                       |
| `/p/default/overlay/gameplay/`     | 200                       |
| `/p/default/debug/`                | 200                       |
| `/frontend/home/styles.css`        | 200                       |
| `/runtime-config.json`             | 200                       |
| `/frontend/overlay/gameplay/`      | 302 → `/p/default/overlay/gameplay/` |
| `/frontend/control/`               | 302 → `/p/default/control/` |
| `/api/state` (legacy, sudah mati) | 404                       |
| `/api/p/default/state`             | 200, match kosong (0-0)   |
| `/api/gallery`                     | 200, `entries: []`        |
| `POST /api/feedback`               | 201, baris masuk D1 produksi |

### Utang teknis
- `migrateLegacyIfNeeded()` sekarang tidak berguna untuk produksi dan hanya menambah
  kebingungan. Eksekusi setelah enum: hapus blokir, atau tulis ulang agar membaca dari
  namespace yang benar.
- `/api/state` kini 404. Kalau ada tautan lama (bookmark, OBS yang tersimpan, AFF) yang
  masih menunjuk sana, semuanya harus diarahkan ke `/api/p/<slug>/state`.

---

## BAGIAN 11 · Nav Halaman Profil + koreksi aset gambar (2026-10-03 sore)

Versi deploy: `1b5b355a-cd4f-47bd-9d92-f7762c8d93d3`

### 11.1 Nav antar halaman di dalam satu profil

Permintaan: setelah profil dibuat dari beranda, operator langsung mendarat di control panel
dan tidak punya jalan cepat ke halaman lain profilnya.

Halaman dalam satu profil sekarang:

| URL | Isi | Status |
| --- | --- | --- |
| `/` | Beranda: paket, library aset, galeri, Profil Saya | ada |
| `/p/<slug>/control/` | Control panel | ada |
| `/p/<slug>/overlay/gameplay/` | Browser source OBS | ada |
| `/p/<slug>/debug/` | Kalibrasi OCR | ada |
| `/p/<slug>/overlay/result/` | Layar hasil akhir | **sudah ada** (Fase 6) |

Implementasi:
- `frontend/shared/profile.js` dapat `pageUrl(slug, page)` dan `renderNav(container, opts)`.
  Satu implementasi dipakai control **dan** debug, jadi tidak ada duplikasi.
- Nav dirender dari satu sumber (`PROFILE_PAGES`), mengikuti slug yang sedang dibuka, dan
  menandai halaman aktif dengan `aria-current="page"`.
- Isi nav: `Beranda` · `Control` · `Overlay Gameplay (OBS)` · `Kalibrasi OCR` · `Result`
  (aktif sejak Fase 6) · `Salin URL OBS` · `Export JSON`.
- Styling ada di file baru `frontend/shared/profile-nav.css`, bukan inline di tiap halaman.
- Mode lokal (backend Python, tanpa slug) otomatis memakai path `/frontend/...` dan
  menyembunyikan tombol yang butuh ownerKey.
- `/p/<slug>/overlay/result/` tidak lagi 404: route-nya terdaftar di `PAGE_FILES` dan halamannya
  sudah ada.
- Tautan debug lama di control sekarang memakai `Kit.pageUrl()`, jadi ikut benar saat halaman
  dibuka lewat mode lokal.

### 11.2 Endpoint `/api/registry` yang didokumentasikan tapi belum ada
`UPDATE.md` versi lama mencantumkan `GET /api/registry`, tapi Worker membalas 404.
Sekarang endpoint itu melayani `assets/registry.json`, jadi frontend bisa memakai salah satu
bentuk tanpa berbeda.

### 11.3 Bug aset gambar yang tidak pernah dikirim ulang (temuan sesi ini)
Gejala: control page menampilkan preview PNG header + gambar custom, tapi overlay tidak
menampilkan sama sekali dan tidak pernah pulih.

Dua sebab:
1. `buildLivePayload()` selalu mengirim `headerImage: ''` dan `customItems[].src: ''` pada
   pesan `type: 'update'`. `applyUpdate()` dulu memperlakukan string kosong itu sebagai
   "hapus gambar", jadi **setiap** klik Simpan / Kirim Update Live / ubah kill menghapus
   PNG header dan gambar custom di server.
2. Control page hanya mengirim ulang aset kalau `mlbb_overlay_assets_signature` berubah.
   Karena aset hilang di server sementara signature di browser tetap sama, operator tidak
   pernah mengirim ulang. Gambar hilang permanen.

Perbaikan:
- `cloudflare/worker.mjs` `applyUpdate()`: string kosong tidak lagi menimpa aset yang
  tersimpan. Aset hanya berubah lewat pesan `type: 'assets'`.
- `frontend/control/app.js`: aset dipaksa kirim ulang pada setiap koneksi (`pushLiveAssets`
  dipanggil pada snapshot pertama), dan klik badge koneksi melakukan resync penuh
  (state + gambar).
- `npm run test:control` sekarang memuat `profile.js` asli, bukan stub, sehingga nav profil
  ikut teruji: **43 passed, 0 failed** pada sesi terakhir (`test:profiles` 103, `test:d1` 27).

### 11.4 README ditulis ulang
`README.md` sebelumnya berisi cuplikan log sesi yang tidak berguna. Sekarang berisi: daftar
halaman per profil, model akses slug + ownerKey, urutan deploy, tabel endpoint, catatan OCR,
dan catatan kuota free tier.

### 11.5 Smoke test produksi (semua lulus)
| Cek                                        | Hasil                |
| ------------------------------------------ | -------------------- |
| `/`, `/p/default/control/`                 | 200                  |
| `/p/default/overlay/gameplay/`             | 200                  |
| `/p/default/overlay/result/`               | 302 → control        |
| `/p/default/debug/`                        | 200                  |
| `/api/registry`, `/api/p/default/state`    | 200                  |
| `/frontend/shared/profile-nav.css`         | 200                  |
| Nav di `/p/default/control/` dan `/p/default/debug/` | 7 kontrol, 0 error console |
| `#gold-diff` di overlay                    | ter-render           |

---

## BAGIAN 12 · FASE 3–8 (2026-10-03 malam, belum di-deploy)

### 12.1 Asset library (prasyarat Fase 7)

`assets/registry.json` sebelumnya hanya berisi 10 entri (2 hero, 5 item, 2 tim, 1 template).
Sekarang **245 entri** yang semuanya benar-benar punya file:

| Kategori | Jumlah | Sumber |
| --- | --- | --- |
| `heroes` | 133 | `images-hero/` di repo `Ceplin03/database-mlbb.Mobile-Legends-Bang-Bang` |
| `items` | 109 | `logo-equipment/` di repo yang sama |
| `teams` | 2 | logo template bawaan repo ini |
| `overlays` | 1 | `gameplay-template.svg` |

Skrip `scripts/sync-mlbb-assets.mjs` yang menulis ulang registry. Path di dalamnya absolut
(`/assets/heroes/aamon.png`) supaya bisa dipakai dari route mana pun. `npm run build:cloudflare`
memvalidasi registry dan gagal kalau ada path yang tidak ada filenya — registry tidak bisa lagi
menjadi daftar bohong diam-diam.

Grid library di Home diberi `max-height: 420px` + scroll supaya 133 hero tidak membuat
halaman beranda setinggi 20.000 px.

### 12.2 Fase 3 · BO2 Series Indicator

- `match.bo2 = { enabled, bestOf: 2, games: [{ winner }, { winner }] }` di state panas, jadi
  otomatis ikut export/import dan terisolasi per profil.
- `bestOf` **dikunci di 2** dan `games` dipangkas jadi maksimal 2 di server: model data tidak
  mungkin menyimpan game ke-3 atau `bestOf: 7`.
- `winner` yang tidak dikenal (`'biru'`, `null`, angka) dinormalisasi jadi `null` di server,
  jadi overlay tidak pernah menampilkan titik untuk game yang tidak ada.
- Titik diturunkan dari satu sumber kebenaran (`games[i].winner`), jadi kedua tim tidak
  mungkin sama-sama merah untuk game yang sama.
- Match point berkedip, badge **SET** muncul saat 2-0.

### 12.3 Fase 4 + 5 · OCR: stabil, di server, dan bisa dikunci

- `ocr: { enabled, modes, thresholds, regions, anchor }` disimpan di DO per profil.
- `POST /api/p/<slug>/ocr/readings` menegakkan **Field Lock di server**: bacaan untuk field
  berstatus `lock` dikembalikan di `rejected` dan **tidak** pernah ditulis ke state. Field
  lain dalam frame yang sama tetap diproses.
- `anchor` ikut ter-update dari bacaan yang diterima, jadi urutan pembacaan tidak hilang
  saat tab dimuat ulang.
- Tabel diagnostik di `/debug/` menampilkan raw text, confidence, keputusan terima/tolak,
  alasan dalam bahasa manusia, dan nilai terakhir yang diterima.

### 12.4 Fase 6 · Layar hasil akhir

Browser source kedua: `/p/<slug>/overlay/result/`. Isinya:

- Headline (default `VICTORY`), subline, skor seri, nama tim, nomor game, durasi,
  damage diberikan/diterima, MVP.
- **Skor seri diturunkan dari `match.bo2`** selama indikatornya aktif; kalau BO2 dimatikan,
  skor manual dipakai. Karena itu layar ini tidak bisa berbeda dengan indikator BO2.
- `outcome` (`win`/`defeat`) dihitung dari skor seri, jadi warna headline ikut benar tanpa
  operator memilih warna sendiri.
- Editor di control memakai 9 field + checkbox tampilkan, plus link ke browser source-nya.
- `result` punya route sendiri (`GET/PUT /api/p/<slug>/result`) dan ikut dibawa di snapshot,
  jadi overlay tidak perlu fetch kedua.

### 12.5 Fase 7 · Player cards 5v5

- State `players` selalu **5 slot per tim** — server menormalisasi jumlah slot, jadi overlay
  tidak pernah menggambar 4 atau 7 baris. Slot kosong tetap punya bentuk supaya posisinya
  tidak bergeser.
- Kolom: hero (path aset), nama, level, K/D/A, sampai 6 item.
- Control: klik gambar hero → picker 133 hero dengan pencarian; klik slot item → picker 109
  item. Picker memakai registry yang dimuat sekali per halaman.
- Overlay gameplay: dua kolom roster (`#roster-blue`, `#roster-red`), drag-able seperti item
  lain lewat `layout.rosterBlue` / `layout.rosterRed`, dan disembunyikan otomatis kalau
  roster kosong.

### 12.6 Bug yang ditemukan dan diperbaiki di sesi ini

| # | Gejala | Akar masalah | Perbaikan |
| --- | --- | --- | --- |
| 1 | Snapshot yang sudah sampai ke overlay **ditimpa angka default** begitu aset selesai dimuat | `loadRemoteAssets(0).then(() => render(getConfig()))` tidak menerima snapshot, jadi render kedua memakai config localStorage | `render(getConfig(), lastSnapshot)` |
| 2 | Roster 5v5 hilang tepat setelah tampil | `loadPlayers()` (aux read) selesai **setelah** snapshot dan menimpa `players` dengan `null` | `rosterSettled` — aux read dilewati kalau snapshot sudah memberi data |
| 3 | Tes nav gagal setelah halaman result dibuat | Asersi masih memakai aturan lama "halaman belum ada tidak boleh tautan" | Asersi dibalik: result harus tautan |

Bug 1 dan 2 bukan cuma masalah tes: keduanya bisa muncul di produksi kalau aset CDN lambat
saat broadcast mulai. Keduanya ketahuan karena suite render overlay baru (`test:overlay`)
menyuntik snapshot lalu menunggu microtask.

### 12.7 Tes

Suite baru `scripts/test-overlay-render.mjs` (26 tes) menjalankan kedua browser source di jsdom
terhadap markup aslinya, lalu menyuntik snapshot lewat jalur `onMessage` yang sama dengan
socket asli.

| Suite | Perintah | Hasil |
| --- | --- | --- |
| Control panel | `npm run test:control` | 43 passed, 0 failed |
| Overlay render | `npm run test:overlay` | 26 passed, 0 failed |
| OCR guard | `npm run test:ocr` | 43 passed, 0 failed |
| Multi-profil | `npm run test:profiles` | 103 passed, 0 failed |
| D1 | `npm run test:d1` | 27 passed, 0 failed |

`test:profiles` naik dari 79 → 103 karena section baru: OCR + Field Lock, result, players, dan
normalisasi BO2.

### 12.8 Verifikasi di browser sungguhan (Chrome headless, CDP 9333)

Profil smoke `g82k1k2s17xo1g`, state + players + result dikirim lewat HTTP, lalu DOM kedua
browser source dibaca balik:

```
gameplay : {"kills":"21-18","timer":"22:25","goldDiff":"+4.4K","bo2hidden":false,
            "bo2blue":"win/0 pending/1","bo2red":"lose pending","rosterBlueHidden":false,
            "rosterBlueCards":5,"rosterBlueNames":"Kurus,Rekkles,OhMy,Ruben,Semb",
            "heroImg":"/assets/heroes/aamon.png","heroLoaded":true,"itemImgs":2}
result   : {"visible":"true","outcome":"win","headline":"VICTORY","score":"1-0",
            "duration":"24:30","mvp":"Kurus"}
```

`heroLoaded: true` berarti gambar aset benar-benar terunduh dan ter-decode, bukan cuma URL yang
ada di DOM. Skor seri `1-0` diambil dari BO2, bukan dari angka manual.

### 12.9 Fase 8 · Kebersihan

| Item | Aksi |
| --- | --- |
| `backend/ocr/`, `backend/api/` (kosong) | Dihapus |
| `config/gameplay-layout.json` (file mati) | Dihapus beserta folder `config/` |
| `postMessage('overlay-layout-changed')` tanpa receiver | Dihapus dari `enablePositionEditor()`; posisi tetap disimpan ke `localStorage` yang sama dengan control, jadi drag di halaman `?edit` tetap langsung terbaca control |
| `README.md` | Ditambah: dua browser source, section Seri BO2, tabel Field Lock, library aset, `test:overlay` di urutan tes |

### 12.10 Yang belum bisa diuji di sini

- **Akurasi OCR end-to-end** butuh jendela game MLBB sungguhan. Yang bisa diverifikasi hanya
  aturan validasi dan Field Lock, bukan pembacaan Tesseract-nya.
- Tampilan visual 1280×720 diverifikasi lewat DOM, bukan screenshot yang dilihat manusia
  (model ini tidak bisa membaca gambar). Before deploy, cek quick: taruh browser source di
  scene OBS dan lihat roster tidak menutupi skor.
- Rate limit `POST /api/feedback` masih tidak ada (utang lama, tidak disentuh fase ini).

### 12.11 Urutan deploy

1. `npm run build:cloudflare` (aset ikut berubah jadi wajib, bukan opsional).
2. Hentikan `wrangler dev` supaya `cloudflare/public` tidak terkunci.
3. `npm run deploy:cloudflare`.
4. Smoke test: buka `/overlay/result/` (sebelumnya 302, harus 200), cek nav sudah punya
   tautan Result, cek `/assets/heroes/aamon.png` = 200.

### 12.12 Status deploy

Deploy pertama Fase 3–8: `c82398c6-4bc6-4c1c-98ff-1ce92d3343fa` (251 aset baru, 271 file).
Deploy kedua (perbaikan skala layar hasil): `3a1253b9-7acf-4255-803f-fb290a7d3f38`.

Bug skala ditemukan **setelah** deploy pertama, lewat pengecekan produksi: shell result memakai
`display: none` saat disembunyikan, jadi `clientWidth` = 0 dan semua `calc(... * var(--design-scale))`
menyusun ukuran huruf 0 px. Perbaikan: visibility di-set dulu baru skala dihitung, plus fallback
`window.innerWidth` kalau `clientWidth` masih 0. Ada tes regresinya sekarang.

Smoke test produksi (profil smoke dibuat lalu **dihapus** lagi):

| Cek | Hasil |
| --- | --- |
| `/`, `/p/default/control/`, `/p/default/overlay/gameplay/`, `/p/default/overlay/result/`, `/p/default/debug/` | 200 (result sebelumnya 302) |
| `/api/registry` | heroes=133, items=109, teams=2, overlays=1 |
| `/assets/heroes/aamon.png`, `/assets/registry.json`, `/frontend/overlay/result/*` | 200 |
| Nav control | 6 tautan, Result aktif, editor hasil + 10 baris player (5+5) |
| Overlay gameplay | `21-18`, `+4.4K`, BO2 `win/pending`, 5 kartu roster, hero **ter-decode** (`naturalWidth > 0`), scale 0.975 |
| Overlay result | visible, scale 0.9875, font headline 82.95 px, skor `1-0` dari BO2, durasi `24:30` |

`/favicon.ico` memang 404 karena repo ini tidak punya ikon. Kosmetik, tidak berpengaruh ke stream.