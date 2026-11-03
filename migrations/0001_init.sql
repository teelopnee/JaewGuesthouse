-- Everything the site saves (Cloudflare D1 / SQLite).

-- One JSON document per key: 'settings', 'bookings' (the admin's booking ledger),
-- 'logbook' (last copy of the bookings pulled from the Jaew Logbook app).
CREATE TABLE IF NOT EXISTS docs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Uploaded room photos, base64 encoded. Large photos are split into parts because a D1 row
-- is limited to 2 MB. name = first 24 hex chars of the photo's SHA-256 + extension.
CREATE TABLE IF NOT EXISTS photos (
  name TEXT NOT NULL,
  part INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (name, part)
);

-- Daily copy of settings + bookings (last 30 days are kept).
CREATE TABLE IF NOT EXISTS backups (
  day TEXT PRIMARY KEY,
  settings TEXT NOT NULL,
  bookings TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Wrong-PIN counter per visitor IP (8 wrong PINs in 10 minutes locks that IP for 10 minutes).
CREATE TABLE IF NOT EXISTS login_failures (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  first_at INTEGER NOT NULL,
  locked_until INTEGER NOT NULL
);
