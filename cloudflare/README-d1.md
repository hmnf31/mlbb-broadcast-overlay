# D1 (database gratis Cloudflare)

D1 dipakai untuk dua hal saja:

| Tabel              | Isi                                                            | Auth            |
| ------------------ | -------------------------------------------------------------- | --------------- |
| `gallery_entries`  | Paket gaya yang dipublish owner: slug, nama, tim, template      | ownerKey write  |
| `feedback`         | Masukan user: jenis, pesan, kontak opsional                     | publik          |

Yang **tidak** masuk D1: state pertandingan, OCR, hasil, aset, dan ownerKey.
State tetap milik Durable Object (`ProfileStore`) karena butuh hot state + single writer.

`ownerKey` tidak pernah disimpan di D1, hanya dipakai sebentar untuk membuktikan kepemilikan
profil saat publish/unpublish. D1 hanya menerima slug + nama + tim.

## Setup produksi

```bash
# 1. Buat database (jalankan sekali)
npx wrangler d1 create mlbb-db

# 2. Salin UUID yang muncul ke cloudflare/wrangler.jsonc -> d1_databases[0].database_id

# 3. Pasang skema ke database produksi
npx wrangler d1 execute mlbb-db --remote --config cloudflare/wrangler.jsonc --file=cloudflare/migrations/0001_init.sql

# 4. Deploy
npm run deploy:cloudflare
```

Sebelum langkah 3, `database_id` masih `00000000-...` dan itu **harus** diganti.
Nilai placeholder itu sengaja tidak point ke database mana pun supaya tidak mungkin
terhapus secara tidak sengaja.

## Testing lokal

```bash
# schema ke database lokal (WAJIB setelah database_id di wrangler.jsonc berubah)
npm run d1:schema:local

# server lokal dengan D1 aktif
npx wrangler dev --port 8787

# di terminal lain
npm run test:d1
```

## Catatan penting

Wrangler menyimpan cache D1 lokal **per `database_id`**. Begitu `database_id` di
`wrangler.jsonc` berubah (misal setelah `d1 create`), cache lokal jadi database kosong
dan semua tes D1 akan balas `503` sampai `npm run d1:schema:local` dijalankan ulang.
Ini yang terjadi saat pertama kali `database_id` diganti dari placeholder ke UUID asli.

## Kalau D1 belum siap

Endpoint `/api/gallery` dan `/api/feedback` membalas `503` dengan
`reason: no_database`, bukan `500`. Halaman Beranda menyembunyikan tombol Publish dan
menampilkan "Galeri tidak aktif". Semua fitur lain tetap jalan normal, jadi D1 boleh
datang belakangan tanpa memblokir rilis.