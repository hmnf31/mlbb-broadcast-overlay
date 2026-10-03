-- Skema D1 untuk MLBB Broadcast Engine.
-- Gratis: 5 juta baris dibaca/hari, 100 ribu baris ditulis/hari, 5 GB penyimpanan.
-- Apply lokal:  npx wrangler d1 execute mlbb-db --local --file=cloudflare/schema.sql
-- Apply produksi: npx wrangler d1 execute mlbb-db --remote --file=cloudflare/schema.sql

-- Galeri paket yang di-publish operator secara sukarela.
-- Yang disimpan hanya metadata yang sudah tampil di UI; ownerKey dan hash-nya
-- tidak pernah masuk ke database ini.
CREATE TABLE IF NOT EXISTS gallery_entries (
  slug         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  template     TEXT NOT NULL,
  blue_team    TEXT NOT NULL DEFAULT '',
  red_team     TEXT NOT NULL DEFAULT '',
  published_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gallery_published_at
  ON gallery_entries (published_at DESC);

-- Laporan bug / permintaan fitur dari form di Beranda.
CREATE TABLE IF NOT EXISTS feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL DEFAULT 'lain',
  message    TEXT NOT NULL,
  contact    TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at
  ON feedback (created_at DESC);