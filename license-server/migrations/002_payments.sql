-- Optional: nasaq-payments.js creates these automatically (IF NOT EXISTS) on first start.
-- Run this by hand only if your database user is not allowed to CREATE TABLE at runtime.
-- 100% additive: no existing table or row is changed.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  plan VARCHAR(20) NOT NULL CHECK(plan IN ('monthly','yearly','lifetime')),
  amount NUMERIC(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EGP',
  method VARCHAR(40) NOT NULL DEFAULT 'vodafone_cash',
  sender_phone VARCHAR(30),
  proof_mime VARCHAR(30) NOT NULL,
  proof_data BYTEA NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','replaced')),
  admin_note VARCHAR(300),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payment_requests_user_idx ON payment_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_requests_status_idx ON payment_requests(status, created_at DESC);
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(60) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
