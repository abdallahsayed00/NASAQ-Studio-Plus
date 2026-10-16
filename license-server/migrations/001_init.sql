CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, role VARCHAR(16) NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
 status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','suspended','rejected')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_login_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS plans (
 id BIGSERIAL PRIMARY KEY, name VARCHAR(80) NOT NULL, kind VARCHAR(20) NOT NULL CHECK(kind IN ('subscription','lifetime')),
 duration_months INTEGER, price NUMERIC(12,2) NOT NULL DEFAULT 0, currency CHAR(3) NOT NULL DEFAULT 'EGP',
 max_devices INTEGER NOT NULL DEFAULT 1 CHECK(max_devices=1), active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK((kind='lifetime' AND duration_months IS NULL) OR (kind='subscription' AND duration_months BETWEEN 1 AND 36))
);
CREATE TABLE IF NOT EXISTS licenses (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id), plan_id BIGINT REFERENCES plans(id),
 kind VARCHAR(20) NOT NULL CHECK(kind IN ('subscription','lifetime')), status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','revoked')),
 starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ, max_devices INTEGER NOT NULL DEFAULT 1 CHECK(max_devices=1),
 created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK((kind='lifetime' AND expires_at IS NULL) OR kind='subscription')
);
CREATE INDEX IF NOT EXISTS licenses_user_status_idx ON licenses(user_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS devices (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id), device_id UUID NOT NULL,
 label VARCHAR(120), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revoked_at TIMESTAMPTZ,
 UNIQUE(user_id,device_id)
);
CREATE INDEX IF NOT EXISTS devices_user_active_idx ON devices(user_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS payments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id), amount NUMERIC(12,2) NOT NULL CHECK(amount>0),
 currency CHAR(3) NOT NULL DEFAULT 'EGP', method VARCHAR(40) NOT NULL DEFAULT 'manual', reference VARCHAR(160),
 status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','refunded')),
 reviewed_by UUID REFERENCES users(id), reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id BIGSERIAL PRIMARY KEY, actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL, action VARCHAR(80) NOT NULL,
 target_type VARCHAR(40), target_id VARCHAR(100), metadata JSONB NOT NULL DEFAULT '{}'::jsonb, ip_address VARCHAR(64), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
INSERT INTO plans(name,kind,duration_months,price,currency,max_devices,sort_order) VALUES
 ('اشتراك شهري','subscription',1,0,'EGP',1,1),('اشتراك سنوي','subscription',12,0,'EGP',1,2),('ترخيص مدى الحياة','lifetime',NULL,0,'EGP',1,3)
ON CONFLICT DO NOTHING;
