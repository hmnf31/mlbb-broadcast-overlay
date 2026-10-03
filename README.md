# MLBB Broadcast Engine

Overlay Permanuan MLBB untuk OBS / TikTok Live Studio. Prinsipnya: **desain visual dibuat
manual sebagai PNG**, aplikasi hanya menimpa layer dinamis (teks, angka, gambar) di atasnya
lewat WebSocket. Satu operator, satu profil, satu live server.

Prinsip data: `Match State` adalah sumber kebenaran tunggal, disimpan di server (Durable
Object) dan disiarkan ke semua overlay. Tidak ada reload halaman saat nilai berubah.

## Halaman dalam satu profil

Setiap profil punya slug sendiri. Semua URL memakai pola `/p/<slug>/...`:

| URL | Isi | Dibuka oleh |
| --- | --- | --- |
| `/` | Beranda: katalog paket, library aset, galeri, "Profil Saya" | Semua orang |
| `/p/<slug>/control/` | Control panel: preview semua fase, drag posisi, style, header PNG, item custom, Seri BO2, editor hasil akhir, player cards 5v5, editor draft | Owner |
| `/p/<slug>/overlay/gameplay/` | Browser source OBS: skor, timer, gold, selisih gold, turtle/lord/tower, indikator BO2, roster 5v5, header PNG | Viewer |
| `/p/<slug>/overlay/draft/` | Browser source OBS: papan ban/pick 5v5, advantage bar, matchup kunci, rekomendasi | Viewer |
| `/p/<slug>/verify/` | Panel verifikasi: bacaan adapter dibandingkan dengan nilai final sebelum push ke stream | Owner |
| `/p/<slug>/debug/` | Kalibrasi OCR: kotak ROI, tes baca, OCR live | Owner |
| `/p/<slug>/overlay/result/` | Browser source kedua: kartu MVP atau scoreboard 10 pemain | Viewer |

Control dan debug punya nav bar di atas berisi semua halaman profil itu, plus tombol
**Salin URL OBS** dan link **Export JSON**. Nav ikut mengikuti slug yang sedang dibuka, jadi
operator tidak pernah salah menempelkan URL profil lain ke OBS.

URL lama `/frontend/*` masih dialihkan ke profil `default`, jadi browser source yang sudah
terpasang tidak perlu diubah.

## Tiga browser source di OBS

| Scene | URL |
| --- | --- |
| Gameplay | `/p/<slug>/overlay/gameplay/` |
| Draft | `/p/<slug>/overlay/draft/` |
| Hasil akhir | `/p/<slug>/overlay/result/` |

Semuanya memakai kanvas desain 1280×720 yang diskalakan ke ukuran source, jadi ukuran huruf
identik di ketiga scene. Layar hasil dan layar draft disembunyikan sampai operator
mengaktifkan checkboxnya di control.

Control punya **Preview semua fase**: iframe browser source yang persis sama dengan yang
dipakai OBS, jadi angka yang terlihat di preview itu angka yang akan tayang.

## Layar hasil: MVP atau scoreboard

`result.mode` memilih satu dari dua tampilan yang berbagi header dan state yang sama:

- `mvp` — kartu MVP: art hero, rating, K/D/A, gold/GPM, damage dan persentasenya, turret
  damage, 6 item, battle spell, emblem, signature play.
- `scoreboard` — 10 pemain: hero, K/D/A, DMG%, GPM per pemain, dipecah dua kolom tim.

Kolom aside menampilkan Turtle/Lord/Tower per tim plus catatan caster. Field baru ini
opsional; profil lama yang belum mengisinya tetap render dengan `0` dan `-`, jadi tidak
ada profil yang rusak karena upgrade.

## Draft pick dan matriks counter

Overlay draft menampilkan advantage tim (biru vs merah), matchup paling menentukan, dan
lima hero yang direkomendasikan. Analitiknya dihitung di browser dari
`assets/hero-matrix.json`.

> **Matriks ini bukan statistik.** Isinya tabel hubungan antahero yang dikurasi manual
> (`scripts/draft-matrix-source.mjs`): 86 pasangan counter dan 44 pasangan synergy untuk
> 133 hero, ditambah tier per hero. Advantage yang tampil adalah indeks heuristik, bukan
> prediksi kemenangan berbasis data pertandingan. Sumber aslinya (mlbb.tools) tidak dipakai
> karena `/api/`-nya ada di `robots.txt` `Disallow` dan angkanya tidak ada di HTML yang
> dikirim server. Overlay dan control menampilkan sumber datanya supaya ini tidak
> disalahartikan sebagai angka statistik.
>
> Untuk memakai sumber data berlisensi atau API resmi, ganti isi
> `scripts/draft-matrix-source.mjs` lalu jalankan `npm run build:matrix`. Bentuk file
> keluaran tidak berubah, jadi frontend dan Worker tidak perlu disentuh. `build:matrix`
> sudah otomatis jadi bagian dari `build:cloudflare`, jadi matriks tidak bisa basi diam-diam.

Engine analitiknya (`frontend/shared/draft-analytics.js`) murni dan tanpa DOM, jadi angka
advantage yang terlihat di control dan di overlay dijamin berasal dari perhitungan yang sama.

## Seri BO2

Control punya section **Seri BO2**: dua titik per tim, satu per game. Klik titik → tim itu
menang game itu; klik lagi → game dikosongkan. Satu tim yang sudah 2 win memunculkan badge
**SET** di overlay. Skor seri pada layar hasil otomatis mengikuti seri ini, jadi tidak ada
angka yang bisa tidak sinkron.

## Model akses: slug + ownerKey

Tidak ada akun. Dua kunci berbeda dengan sengaja:

| Kunci | Disimpan di | Siapa yang boleh tahu | Fungsi |
| --- | --- | --- | --- |
| `slug` | URL profil | Semua orang yang punya URL | Membaca state (dipakai OBS) |
| `ownerKey` | `localStorage` browser | Operator saja | Mengubah state |

Server hanya menyimpan **hash SHA-256** ownerKey. Socket WebSocket melakukan handshake
`hello` → `auth` → `auth_ok`; tanpa ownerKey yang cocok, socket otomatis jadi `viewer` yang
hanya boleh `ping` dan `request_state`.

Buat profil baru di `/` → profil langsung dibuka di control panelnya. Profil hasil import
memperoleh slug dan ownerKey baru, jadi tidak ada jalur "membajak" kepemilikan lewat file.

## Deploy (Cloudflare Workers)

Produksi: `https://mlbb-broadcast-overlay.theahuda.workers.dev`

```powershell
Set-Location 'C:\Users\Administrator\Desktop\header\mlbb-broadcast'
npm install
npx wrangler login

# sekali saja, kalau D1 belum punya skema
npm run d1:schema:remote

# uji lokal di terminal 1
npm run dev:cloudflare

# terminal 2 - semua harus hijau sebelum deploy
npx wrangler dev --config cloudflare/wrangler.jsonc --port 8787
npm run test:all          # 7 suite tanpa server
npm run test:profiles      # integrasi, butuh wrangler dev di terminal 1
npm run test:d1            # butuh binding D1

# deploy
npm run deploy:cloudflare
```

`test:all` menjalankan draft analytics, draft overlay, result modes, panel verifikasi,
alur beranda, OCR guard, control panel, dan overlay render. Suite yang butuh server
(`test:profiles`, `test:d1`) sengaja tidak ikut supaya `test:all` bisa jalan tanpa
`wrangler dev`.

`npm run deploy:cloudflare` selalu membangun ulang `cloudflare/public` dari `frontend/` dan
`assets/` lebih dulu. **Edit selalu di `frontend/` dan `assets/`, jangan di
`cloudflare/public/`.** Hentikan `wrangler dev` sebelum deploy supaya folder aset tidak
terkunci.

### Endpoint

| Method | URL | Auth | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/runtime-config.json` | - | Konfigurasi runtime |
| `GET` | `/api/site` | - | Katalog template |
| `GET` | `/api/registry` | - | Katalog aset global |
| `POST` | `/api/profiles` | - | Buat profil (balik slug + ownerKey) |
| `GET` | `/api/p/<slug>` | - | Metadata profil |
| `PUT` | `/api/p/<slug>` | ownerKey | Ganti nama |
| `POST` | `/api/p/<slug>/claim` | - | Klaim profil yang belum diklaim |
| `POST` | `/api/p/<slug>/rotate` | ownerKey | Rotasi slug (URL lama tetap redirect) |
| `DELETE` | `/api/p/<slug>` | ownerKey | Hapus profil |
| `GET` | `/api/p/<slug>/state` | - | Snapshot state |
| `PUT` | `/api/p/<slug>/state` | ownerKey | Simpan state (fallback saat WS mati) |
| `GET` | `/api/p/<slug>/assets?v=N` | - | Gambar + versi aset |
| `GET`/`PUT` | `/api/p/<slug>/ocr` | ownerKey untuk tulis | ROI, mode per field, threshold, anchor |
| `POST` | `/api/p/<slug>/ocr/readings` | ownerKey | Bacaan OCR; Field Lock ditegakkan di server |
| `GET`/`PUT` | `/api/p/<slug>/result` | ownerKey untuk tulis | State layar hasil akhir (mode, objectives, MVP) |
| `GET`/`PUT` | `/api/p/<slug>/players` | ownerKey untuk tulis | Roster 5v5 (nama, hero, item, K/D/A, gpm, damage, radar) |
| `GET`/`PUT` | `/api/p/<slug>/draft` | ownerKey untuk tulis | Slot ban/pick draft (Fase 1) |
| `GET` | `/api/p/<slug>/export` | - | Bundel JSON (tanpa ownerKey) |
| `WS` | `/api/p/<slug>/live` | pesan pertama | Sinkronisasi live |
| `GET/PUT/DELETE` | `/api/gallery` | ownerKey untuk tulis | Galeri paket (D1) |
| `POST` | `/api/feedback` | - | Masukan (honeypot) |

### D1 (opsional)

D1 hanya dipakai untuk galeri paket dan kotak masukan. Kalau binding D1 tidak ada, semua
fitur lain tetap jalan: endpoint galeri/feedback membalas `503 no_database`, tombol Publish
disembunyikan. Detail setup: `cloudflare/README-d1.md`.

## OCR

OCR berjalan sepenuhnya di browser memakai Tesseract.js, bukan di Python. Alurnya:
pilih layar/game (`getDisplayMedia`) → atur kotak ROI → baca ROI per field dengan
whitelist karakter → kirim hasilnya ke server. Semua angka yang lolos validasi ikut ke
overlay real-time.

- ROI disimpan sebagai **fraksi 0..1** dari frame, jadi tahan perubahan resolusi, dan
  disimpan di server (`ocr.regions`) supaya kalibrasi tidak hilang saat tab ditutup.
- Halaman OCR harus dibuka di browser/perangkat **terpisah** dari jendela game.
- `getDisplayMedia` butuh secure context, jadi harus lewat HTTPS (URL Worker, bukan
  `file://`).
- Tidak ada `backend/ocr/`; itu keputusan sadar, bukan file yang tertinggal.

### Field Lock dan Manual Override

Setiap field punya mode sendiri di control:

| Mode | Arti |
| --- | --- |
| `auto` | Angka boleh ditulis OCR seperti biasa |
| `lock` | OCR **tidak boleh** menimpa; nilai hanya berubah dari panel operator |
| `manual` | Nicht per-field: nilai diisi manual di form |

Penegakan terjadi **di server** (`POST /ocr/readings`): bacaan untuk field terkunci
ditolak dan dikembalikan sebagai `rejected`, jadi halaman OCR di perangkat lain tidak bisa
melewati aturan hanya dengan mengirim frame berbeda. Ini penting
saat operator sedang menyesuaikan angka satu per satu tanpa ingin ditimpa Tesseract.

`ocr.anchor` (nilai terakhir yang diterima per field) ikut disimpan di server, jadi
urutan pembacaan tidak hilang saat halaman dimuat ulang.

## Panel verifikasi

`/p/<slug>/verify/` adalah safety net antara bacaan OCR dan angka yang tayang. Alurnya:
unggah atau tangkap screenshot → adapter membaca ROI yang sudah dikalibrasi → operator
**membandingkan** bacaan itu dengan nilai final → hanya nilai final yang dipush lewat
`POST /ocr/readings`, jadi Field Lock tetap ditegakkan di server.

Kontrak adapternya ada di `frontend/shared/ocr-adapter.js`: satu fungsi `recognize()` yang
mengembalikan `{ field: { value, rawText, confidence } }`, dengan penyaringan field dan
nilai non-number di dalam adapter. Provider yang terpasang sekarang:

| Provider | Tier | Keterangan |
| --- | --- | --- |
| `tesseract` | auto | Tesseract.js, sama dengan halaman kalibrasi. Membaca ROI per field dari screenshot. |
| `manual` | manual | Tidak mengenali apa pun; dipakai kalau engine gagal dimuat atau memang tidak ada. |

Engine tidak pernah mengarang confidence: kalau sebuah provider tidak menghasilkan satu pun
field valid, `recognize()` mengembalikan kegagalan dan operator diberi tahu, bukan melihat
tabel yang terlihat terverifikasi tapi sebenarnya kosong.

Parsing angka OCR yang dipakai bersama Debug dan Verifikasi ada di
`frontend/shared/ocr-parse.js`, supaya keduanya tidak bisa berbeda. Parser itu menolak bacaan
yang sebenarnya kata — misalnya label HUD "Lead" yang salah baca jadi `1ead`, yang kalau
tidak dijaga akan terbaca sebagai kill 1.

## Library aset

Hero dan item MLBB ada di `assets/heroes/` (133) dan `assets/items/` (109), didaftarkan di
`assets/registry.json` (245 entri: hero, item, logo tim, template overlay). Daftar ini dipakai
di control untuk memilih hero dan item pada tiap kartu player, lalu path-nya ikut disimpan di
state profil — jadi overlay cukup memakai path absolut tanpa perlu registry.

`scripts/sync-mlbb-assets.mjs <path-clone-repo>` mengambil ulang aset dari
`https://github.com/Ceplin03/database-mlbb.Mobile-Legends-Bang-Bang.git` (sparse checkout ke
`images-hero` + `logo-equipment`), dan `npm run build:cloudflare` memvalidasi setiap path
registry sebelum menyalin ke `cloudflare/public/`.

## Menjalankan backend Python lokal

```powershell
python -m pip install -r requirements.txt
python -m backend.main          # atau .\run-local.bat
```

URL lokal memakai `/frontend/...` (tanpa `/p/<slug>/`). Control dan debug tetap bisa dibuka,
nav bar otomatis memakai path lokal. Cocok untuk development tanpa memakai kuota Cloudflare.

## Catatan free tier dan kuota

- Durable Object free tier dihitung harian; heartbeat 30 detik + OCR 1 Hz + update
  manual memakai kuota. Pantau di dashboard Cloudflare saat broadcast panjang.
- Batas frame WebSocket Worker = 1 MiB. Gambar **tidak boleh** dikirim lewat pesan
  `update`; hanya lewat pesan `assets` supaya snapshot tetap kecil.
- Pembuatan profil tidak punya autentikasi, jadi secara teori bot bisa membuat banyak
  Durable Object. Tidak ada data sensitif yang bisa di-abuse, tapi tetap dipantau.

## Status dan rencana

`UPDATE.md` adalah catatan tunggal: apa yang sudah selesai, temuan audit, dan roadmap
9 fase. Fase 0–8 selesai dan sudah di-deploy (versi produksi `3a1253b9`). Kalau aset hero/item
berubah, `npm run build:cloudflare` **wajib** dijalankan ulang sebelum deploy karena registry
dan matriks draft ikut di-build.

Brief requirement asal (dokumen rencana 9 fase) tidak disimpan di repo ini karena berisi
catatan kerja internal; repo hanya memuat kode, `README.md`, dan `UPDATE.md`. Desain
referensi Stitch untuk layar draft dan hasil akhir juga di luar repo: yang dipakai di sini
hanya bentuk visualnya, diterjemahkan ke CSS polos tanpa CDN.