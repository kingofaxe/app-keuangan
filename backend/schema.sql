-- =============================================
-- CATATAN KEUANGAN - DATABASE SCHEMA v2
-- =============================================

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  is_admin      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  label      VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  wallet_id  INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  type       VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sub_categories (
  id          SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id              SERIAL PRIMARY KEY,
  wallet_id       INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
  sub_category_id INTEGER REFERENCES sub_categories(id) ON DELETE SET NULL,
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  type            VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
  amount          NUMERIC(15,2) NOT NULL,
  date            DATE NOT NULL,
  remark          TEXT DEFAULT '',
  file_path       VARCHAR(500) DEFAULT NULL,
  file_name       VARCHAR(255) DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date   ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_categories_wallet   ON categories(wallet_id);
CREATE INDEX IF NOT EXISTS idx_sub_categories_cat  ON sub_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user        ON wallets(user_id);

-- Tambah kolom baru kalau upgrade dari schema lama
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_admin') THEN
    ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='file_path') THEN
    ALTER TABLE transactions ADD COLUMN file_path VARCHAR(500) DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='file_name') THEN
    ALTER TABLE transactions ADD COLUMN file_name VARCHAR(255) DEFAULT NULL;
  END IF;
END $$;

-- =============================================
-- SCHEMA v3 ADDITIONS
-- =============================================

-- Preferensi user (urutan menu, setting tabungan, show/hide)
CREATE TABLE IF NOT EXISTS user_preferences (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  menu_order      TEXT DEFAULT '["dashboard","tabungan","bulanan","tambah","riwayat","kategori","dompet","settings"]',
  hidden_sections TEXT DEFAULT '[]',
  tab_in_cats     TEXT DEFAULT '[]',
  tab_out_cats    TEXT DEFAULT '[]',
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Saldo awal dompet
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='initial_balance') THEN
    ALTER TABLE wallets ADD COLUMN initial_balance NUMERIC(15,2) DEFAULT 0;
  END IF;
  -- PIN login
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='pin_hash') THEN
    ALTER TABLE users ADD COLUMN pin_hash VARCHAR(255) DEFAULT NULL;
  END IF;
END $$;

-- Item Dashboard Real (saldo di luar app)
CREATE TABLE IF NOT EXISTS real_balance_items (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  label       VARCHAR(200) NOT NULL,
  amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('asset','debt','tab_in','tab_out')),
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_balance_user ON real_balance_items(user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_user  ON user_preferences(user_id);
