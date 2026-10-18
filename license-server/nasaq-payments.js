'use strict';
/*
 * NASAQ Studio+ — payment pages + pending-account login (additive module).
 *
 * This file ONLY ADDS things. It never drops/alters existing tables, never touches
 * existing rows, and never changes any existing route's behaviour for approved users:
 *   - new tables (created with IF NOT EXISTS): payment_requests, app_settings
 *   - new routes:   GET  /api/account/plans
 *                   GET  /api/account/status
 *                   POST /api/account/payment
 *                   GET  /api/admin/payment-requests
 *                   GET  /api/admin/payment-requests/:id
 *                   POST /api/admin/payment-requests/:id/approve
 *                   POST /api/admin/payment-requests/:id/reject
 *                   GET/POST /api/admin/settings
 *   - POST /api/auth/login is intercepted ONLY for users who are still pending (or approved
 *     but with no active license) and typed the correct password: they get a limited session
 *     so the app can show the payment page. Everybody else falls through to the original
 *     login handler untouched.
 *
 * Mounted from server.js with one line:  require('./nasaq-payments')(app, pool);
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ISSUER = 'nasaq-studio-license';
const AUDIENCE = 'nasaq-studio-client';
const FACEBOOK_URL = 'https://www.facebook.com/AbdallahSayed09/';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PROOF_BYTES = 3 * 1024 * 1024;

const PLANS = {
  monthly:  { id: 'monthly',  label: 'شهرية',      price: 250,  currency: 'EGP', kind: 'subscription', months: 1 },
  yearly:   { id: 'yearly',   label: 'سنوية',      price: 2000, currency: 'EGP', kind: 'subscription', months: 12 },
  lifetime: { id: 'lifetime', label: 'مدى الحياة', price: 3000, currency: 'EGP', kind: 'lifetime',     months: null }
};
const publicPlans = () => Object.values(PLANS).map(p => ({ id: p.id, label: p.label, price: p.price, currency: p.currency, kind: p.kind, months: p.months }));

const cleanEmail = v => String(v || '').trim().toLowerCase().slice(0, 254);
const safeUser = r => ({ id: r.id, name: r.name, email: r.email, role: r.role, status: r.status, createdAt: r.created_at });

/* Express 4 never catches errors thrown inside async handlers: a failed query leaves the
   request hanging forever (the dashboard just shows nothing). Wrap app.get/app.post handlers
   once so a failure becomes a clean JSON 500 instead. Behaviour of working routes is unchanged. */
function patchAsyncHandlers(app) {
  if (app.__nasaqAsyncPatched) return; app.__nasaqAsyncPatched = true;
  const wrap = fn => function wrapped(req, res, next) {
    const fail = e => { console.error('[route error]', req.method, req.path, e); if (!res.headersSent) res.status(500).json({ ok: false, error: 'خطأ داخلي في الخادم. حاول مرة أخرى.' }); };
    try { const out = fn(req, res, next); if (out && typeof out.catch === 'function') out.catch(fail); } catch (e) { fail(e); }
  };
  for (const method of ['get', 'post']) {
    const original = app[method].bind(app);
    app[method] = function patched(...args) {
      if (method === 'get' && args.length === 1) return original(...args); // app.get('setting')
      return original(...args.map(a => (typeof a === 'function' && a.length < 4 ? wrap(a) : a)));
    };
  }
}

module.exports = function mountPayments(app, pool) {
  patchAsyncHandlers(app);

  /* ---------- schema (additive, idempotent) ---------- */
  const SCHEMA_SQL = `
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
    );`;
  let schemaPromise = null;
  const ensureSchema = () => {
    if (!schemaPromise) {
      schemaPromise = (async () => {
        try { await pool.query(SCHEMA_SQL); }
        catch (e) { await new Promise(r => setTimeout(r, 400)); await pool.query(SCHEMA_SQL); } // two cold starts racing
      })().catch(e => { schemaPromise = null; throw e; });
    }
    return schemaPromise;
  };

  /* ---------- helpers ---------- */
  async function audit(userId, action, targetType, targetId, metadata = {}, ip = '') {
    try { await pool.query('INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address) VALUES($1,$2,$3,$4,$5,$6)', [userId || null, action, targetType || null, targetId || null, JSON.stringify(metadata), String(ip || '').slice(0, 64) || null]); }
    catch (e) { console.error('[audit]', e.message); }
  }
  async function activeLicense(userId) {
    const q = await pool.query("SELECT id,kind,status,starts_at,expires_at,max_devices FROM licenses WHERE user_id=$1 AND status='active' AND starts_at<=NOW() AND (expires_at IS NULL OR expires_at>NOW()) ORDER BY created_at DESC LIMIT 1", [userId]);
    return q.rows[0] || null;
  }
  async function paymentNumber() {
    await ensureSchema();
    const q = await pool.query("SELECT value FROM app_settings WHERE key='vodafone_number'");
    return String((q.rows[0] && q.rows[0].value) || process.env.VODAFONE_CASH_NUMBER || '').trim();
  }
  async function readAuth(req) {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return { status: 401, error: 'سجّل الدخول للمتابعة.' };
    let claims;
    try { claims = jwt.verify(token, process.env.JWT_SECRET, { issuer: ISSUER, audience: AUDIENCE }); }
    catch (_) { return { status: 401, error: 'انتهت الجلسة أو لم تعد صالحة. سجّل الدخول مجددًا.' }; }
    const q = await pool.query('SELECT id,name,email,role,status FROM users WHERE id=$1', [claims.sub]);
    if (!q.rowCount) return { status: 401, error: 'الحساب غير موجود.' };
    return { user: q.rows[0], claims };
  }
  /* any normal user whose account is pending or approved (suspended/rejected are blocked) */
  async function accountAuth(req, res, next) {
    const r = await readAuth(req);
    if (r.error) return res.status(r.status).json({ ok: false, error: r.error });
    if (r.user.role !== 'user' || !['pending', 'approved'].includes(r.user.status)) return res.status(403).json({ ok: false, error: 'الحساب غير مفعل أو تم إيقافه.' });
    req.user = r.user; next();
  }
  async function adminOnly(req, res, next) {
    const r = await readAuth(req);
    if (r.error) return res.status(r.status).json({ ok: false, error: r.error });
    if (r.user.role !== 'admin' || r.user.status !== 'approved') return res.status(403).json({ ok: false, error: 'هذه العملية للمسؤول فقط.' });
    req.user = r.user; next();
  }
  const reqView = r => r && ({ id: r.id, plan: r.plan, amount: Number(r.amount), currency: r.currency, status: r.status, adminNote: r.admin_note || '', createdAt: r.created_at, reviewedAt: r.reviewed_at });

  /* ---------- pending / unlicensed login (runs BEFORE the original /api/auth/login) ---------- */
  const loginParser = express.json({ limit: '32kb' });
  app.post('/api/auth/login', loginParser, async (req, res, next) => {
    try {
      const email = cleanEmail(req.body && req.body.email), password = String((req.body && req.body.password) || '');
      if (!email || !password) return next();
      const q = await pool.query('SELECT id,name,email,role,status,password_hash,created_at FROM users WHERE email=$1', [email]);
      const u = q.rows[0];
      if (!u || u.role !== 'user') return next();
      if (u.status === 'approved') { if (await activeLicense(u.id)) return next(); }   // fully licensed → original handler
      else if (u.status !== 'pending') return next();                                // suspended / rejected → original handler
      if (!(await bcrypt.compare(password, u.password_hash))) return next();         // wrong password → original handler answers 401
      const token = jwt.sign({ sub: u.id, role: u.role, deviceId: null }, process.env.JWT_SECRET, { expiresIn: '12h', issuer: ISSUER, audience: AUDIENCE });
      await pool.query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [u.id]);
      await audit(u.id, 'auth.login.payment_stage', 'user', u.id, { status: u.status }, req.ip);
      return res.json({ ok: true, token, needsPayment: true, user: safeUser(u), license: null });
    } catch (e) { console.error('[pending-login]', e.message); return next(); }
  });

  /* ---------- user side ---------- */
  app.get('/api/account/plans', async (_req, res) => {
    const number = await paymentNumber();
    res.json({ ok: true, plans: publicPlans(), payment: { method: 'vodafone_cash', number, configured: !!number }, facebook: FACEBOOK_URL });
  });

  app.get('/api/account/status', accountAuth, async (req, res) => {
    await ensureSchema();
    const u = req.user;
    const lic = await activeLicense(u.id);
    const last = await pool.query("SELECT id,plan,amount,currency,status,admin_note,created_at,reviewed_at FROM payment_requests WHERE user_id=$1 AND status<>'replaced' ORDER BY created_at DESC LIMIT 1", [u.id]);
    const stage = (u.status === 'approved' && lic) ? 'active' : 'payment';
    const number = await paymentNumber();
    res.json({
      ok: true, stage, authenticated: stage === 'active',
      user: { name: u.name, email: u.email, status: u.status },
      license: lic ? { kind: lic.kind, expiresAt: lic.expires_at } : null,
      request: reqView(last.rows[0]),
      plans: publicPlans(), payment: { method: 'vodafone_cash', number, configured: !!number }, facebook: FACEBOOK_URL
    });
  });

  const paymentLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 12, keyGenerator: req => String(req.user && req.user.id), standardHeaders: 'draft-7', legacyHeaders: false, message: { ok: false, error: 'محاولات كتير. جرّب بعد شوية.' } });
  const bigJson = express.json({ limit: '4mb' });
  const smallJson = express.json({ limit: '32kb' }); // these routes are mounted before server.js's global parser
  function parseProof(dataUrl) {
    const s = String(dataUrl || ''); const comma = s.indexOf(',');
    if (comma < 0 || comma > 64) return null;
    const m = /^data:(image\/(?:png|jpeg|webp));base64$/i.exec(s.slice(0, comma));
    if (!m) return null;
    const buf = Buffer.from(s.slice(comma + 1), 'base64');
    if (!buf.length || buf.length > MAX_PROOF_BYTES) return { tooBig: buf.length > MAX_PROOF_BYTES };
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
    if (!(isPng || isJpg || isWebp)) return null;
    return { mime: isPng ? 'image/png' : isJpg ? 'image/jpeg' : 'image/webp', buf };
  }
  app.post('/api/account/payment', accountAuth, paymentLimiter, bigJson, async (req, res) => {
    await ensureSchema();
    const plan = PLANS[String((req.body && req.body.plan) || '')];
    if (!plan) return res.status(400).json({ ok: false, error: 'اختار باقة صحيحة.' });
    const proof = parseProof(req.body && req.body.proof);
    if (!proof) return res.status(400).json({ ok: false, error: 'ارفع صورة سكرين التحويل بصيغة PNG أو JPG أو WEBP.' });
    if (proof.tooBig) return res.status(413).json({ ok: false, error: 'الصورة كبيرة قوي. اختار صورة أصغر من 3 ميجا.' });
    const phone = String((req.body && req.body.senderPhone) || '').replace(/[^\d+]/g, '').slice(0, 20) || null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE payment_requests SET status='replaced' WHERE user_id=$1 AND status='pending'", [req.user.id]);
      const ins = await client.query("INSERT INTO payment_requests(user_id,plan,amount,currency,method,sender_phone,proof_mime,proof_data) VALUES($1,$2,$3,$4,'vodafone_cash',$5,$6,$7) RETURNING id,plan,amount,currency,status,admin_note,created_at,reviewed_at", [req.user.id, plan.id, plan.price, plan.currency, phone, proof.mime, proof.buf]);
      await client.query('COMMIT');
      await audit(req.user.id, 'payment_request.created', 'payment_request', ins.rows[0].id, { plan: plan.id, amount: plan.price }, req.ip);
      res.status(201).json({ ok: true, message: 'تم استلام إيصال الدفع. هنراجعه ونفعّل حسابك في أقرب وقت.', request: reqView(ins.rows[0]) });
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
    finally { client.release(); }
  });

  /* ---------- admin side ---------- */
  app.get('/api/admin/payment-requests', adminOnly, async (_req, res) => {
    await ensureSchema();
    const q = await pool.query(`SELECT r.id,r.plan,r.amount,r.currency,r.status,r.sender_phone,r.admin_note,r.created_at,r.reviewed_at,
        u.id AS user_id,u.name,u.email,u.status AS user_status
      FROM payment_requests r JOIN users u ON u.id=r.user_id
      WHERE r.status<>'replaced'
      ORDER BY (r.status='pending') DESC, r.created_at DESC LIMIT 300`);
    res.json({ ok: true, requests: q.rows.map(r => ({ id: r.id, plan: r.plan, planLabel: (PLANS[r.plan] || {}).label || r.plan, amount: Number(r.amount), currency: r.currency, status: r.status, senderPhone: r.sender_phone || '', adminNote: r.admin_note || '', createdAt: r.created_at, reviewedAt: r.reviewed_at, userId: r.user_id, name: r.name, email: r.email, userStatus: r.user_status })) });
  });

  app.get('/api/admin/payment-requests/:id', adminOnly, async (req, res) => {
    await ensureSchema();
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ ok: false, error: 'معرّف غير صالح.' });
    const q = await pool.query('SELECT proof_mime,proof_data FROM payment_requests WHERE id=$1', [req.params.id]);
    if (!q.rowCount) return res.status(404).json({ ok: false, error: 'الطلب غير موجود.' });
    res.json({ ok: true, proof: `data:${q.rows[0].proof_mime};base64,${q.rows[0].proof_data.toString('base64')}` });
  });

  app.post('/api/admin/payment-requests/:id/approve', adminOnly, async (req, res) => {
    await ensureSchema();
    const id = req.params.id; if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, error: 'معرّف غير صالح.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const rq = await client.query('SELECT r.*,u.role AS user_role FROM payment_requests r JOIN users u ON u.id=r.user_id WHERE r.id=$1 FOR UPDATE OF r', [id]);
      if (!rq.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, error: 'الطلب غير موجود.' }); }
      const r = rq.rows[0];
      if (r.status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ ok: false, error: 'الطلب ده اتراجع قبل كده.' }); }
      if (r.user_role !== 'user') { await client.query('ROLLBACK'); return res.status(400).json({ ok: false, error: 'الحساب ليس حساب مستخدم.' }); }
      const plan = PLANS[r.plan];
      await client.query("UPDATE users SET status='approved',updated_at=NOW() WHERE id=$1", [r.user_id]);
      await client.query("UPDATE licenses SET status='revoked' WHERE user_id=$1 AND status='active'", [r.user_id]);
      const lic = await client.query("INSERT INTO licenses(user_id,kind,status,starts_at,expires_at,max_devices,created_by) VALUES($1,$2::varchar,'active',NOW(),CASE WHEN $2::varchar='lifetime' THEN NULL ELSE NOW()+($3::text || ' months')::interval END,1,$4) RETURNING id,kind,expires_at", [r.user_id, plan.kind, String(plan.months || 1), req.user.id]);
      await client.query("INSERT INTO payments(user_id,amount,currency,method,reference,status,reviewed_by,reviewed_at) VALUES($1,$2,$3,'vodafone_cash',$4,'confirmed',$5,NOW())", [r.user_id, r.amount, r.currency, 'request:' + id, req.user.id]);
      await client.query("UPDATE payment_requests SET status='approved',reviewed_by=$2,reviewed_at=NOW(),admin_note=NULL WHERE id=$1", [id, req.user.id]);
      await client.query('COMMIT');
      await audit(req.user.id, 'payment_request.approved', 'payment_request', id, { userId: r.user_id, plan: r.plan, licenseId: lic.rows[0].id }, req.ip);
      res.json({ ok: true, message: 'تم قبول الدفع وتفعيل الحساب والترخيص.', license: lic.rows[0] });
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
    finally { client.release(); }
  });

  app.post('/api/admin/payment-requests/:id/reject', adminOnly, smallJson, async (req, res) => {
    await ensureSchema();
    const id = req.params.id; if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, error: 'معرّف غير صالح.' });
    const note = String((req.body && req.body.note) || '').trim().slice(0, 300) || null;
    const q = await pool.query("UPDATE payment_requests SET status='rejected',reviewed_by=$2,reviewed_at=NOW(),admin_note=$3 WHERE id=$1 AND status='pending' RETURNING id,user_id", [id, req.user.id, note]);
    if (!q.rowCount) return res.status(409).json({ ok: false, error: 'الطلب غير موجود أو اتراجع قبل كده.' });
    await audit(req.user.id, 'payment_request.rejected', 'payment_request', id, { userId: q.rows[0].user_id, note }, req.ip);
    res.json({ ok: true });
  });

  app.get('/api/admin/settings', adminOnly, async (_req, res) => {
    res.json({ ok: true, settings: { vodafoneNumber: await paymentNumber() }, plans: publicPlans() });
  });
  app.post('/api/admin/settings', adminOnly, smallJson, async (req, res) => {
    await ensureSchema();
    const number = String((req.body && req.body.vodafoneNumber) || '').trim();
    if (!/^[0-9+ ]{8,20}$/.test(number)) return res.status(400).json({ ok: false, error: 'اكتب رقم فودافون كاش صحيح (أرقام فقط).' });
    await pool.query("INSERT INTO app_settings(key,value,updated_at) VALUES('vodafone_number',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()", [number]);
    await audit(req.user.id, 'settings.vodafone_number', 'setting', 'vodafone_number', {}, req.ip);
    res.json({ ok: true, settings: { vodafoneNumber: number } });
  });

  ensureSchema().catch(e => console.error('[nasaq-payments] schema setup failed (will retry on first request):', e.message));
};
module.exports.PLANS = PLANS;
