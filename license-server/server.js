'use strict';
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');

const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) if (!process.env[key]) { console.error(`Missing required environment variable: ${key}`); process.exit(1); }
if (String(process.env.JWT_SECRET).length < 48) { console.error('JWT_SECRET must be at least 48 characters.'); process.exit(1); }
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: process.env.PGSSL_VERIFY !== 'false' } });
app.disable('x-powered-by'); app.set('trust proxy', Number(process.env.TRUST_PROXY || 0));
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"] } }}));
require('./nasaq-payments')(app, pool); // NASAQ: payment page + pending-account login (additive, see nasaq-payments.js)
app.use(express.json({ limit: '32kb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
const emailRE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanEmail = v => String(v || '').trim().toLowerCase().slice(0, 254);
const safeUser = r => ({ id: r.id, name: r.name, email: r.email, role: r.role, status: r.status, createdAt: r.created_at });
function signToken(user, deviceId=null) { return jwt.sign({ sub: user.id, role: user.role, deviceId: user.role==='admin' ? null : deviceId }, process.env.JWT_SECRET, { expiresIn: '12h', issuer: 'nasaq-studio-license', audience: 'nasaq-studio-client' }); }
async function auth(req, res, next) {
  const value = String(req.headers.authorization || ''); const token = value.startsWith('Bearer ') ? value.slice(7) : '';
  if (!token) return res.status(401).json({ ok: false, error: 'سجّل الدخول للمتابعة.' });
  try { const claims = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'nasaq-studio-license', audience: 'nasaq-studio-client' }); const q = await pool.query('SELECT id,name,email,role,status FROM users WHERE id=$1', [claims.sub]); if (!q.rowCount || q.rows[0].status !== 'approved') return res.status(403).json({ok:false,error:'الحساب غير مفعل أو تم إيقافه.'}); req.user=q.rows[0]; req.claims=claims; next(); }
  catch (_) { return res.status(401).json({ok:false,error:'انتهت الجلسة أو لم تعد صالحة. سجّل الدخول مجددًا.'}); }
}
function admin(req,res,next){ if(req.user?.role!=='admin') return res.status(403).json({ok:false,error:'هذه العملية للمسؤول فقط.'}); next(); }
async function audit(userId, action, targetType, targetId, metadata={}, ip='') { await pool.query('INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address) VALUES($1,$2,$3,$4,$5,$6)',[userId||null,action,targetType||null,targetId||null,JSON.stringify(metadata),String(ip||'').slice(0,64)||null]); }
async function currentLicense(userId) { const q=await pool.query("SELECT l.id,l.kind,l.status,l.starts_at,l.expires_at,l.max_devices FROM licenses l WHERE l.user_id=$1 AND l.status='active' AND l.starts_at<=NOW() AND (l.expires_at IS NULL OR l.expires_at>NOW()) ORDER BY l.created_at DESC LIMIT 1",[userId]); return q.rows[0]||null; }
async function activateDevice(userId, deviceId) {
  if (!/^[a-f0-9-]{36}$/i.test(String(deviceId||''))) throw Object.assign(new Error('معرّف الجهاز غير صالح.'),{status:400});
  const license=await currentLicense(userId); if(!license) throw Object.assign(new Error('الحساب مقبول، لكن لا يوجد ترخيص نشط. تواصل مع الإدارة.'),{status:403});
  const existing=await pool.query('SELECT id,device_id FROM devices WHERE user_id=$1 AND revoked_at IS NULL',[userId]);
  if(existing.rows.some(d=>d.device_id===deviceId)){ await pool.query('UPDATE devices SET last_seen_at=NOW(),revoked_at=NULL WHERE user_id=$1 AND device_id=$2',[userId,deviceId]); return license; }
  const revokedSame=await pool.query('SELECT id FROM devices WHERE user_id=$1 AND device_id=$2 AND revoked_at IS NOT NULL',[userId,deviceId]);
  if(revokedSame.rowCount){ await pool.query('UPDATE devices SET last_seen_at=NOW(),revoked_at=NULL WHERE user_id=$1 AND device_id=$2',[userId,deviceId]); return license; }
  if(existing.rowCount>=Number(license.max_devices||1)) throw Object.assign(new Error('وصل الحساب إلى حد الأجهزة المسموح به. اطلب من الإدارة إلغاء الجهاز القديم.'),{status:403});
  await pool.query('INSERT INTO devices(user_id,device_id,label,last_seen_at) VALUES($1,$2,$3,NOW())',[userId,deviceId,'NASAQ Studio desktop']); return license;
}
app.get('/api/health', async (_req,res)=>{ try{await pool.query('SELECT 1');res.json({ok:true,service:'nasaq-license-api',database:'connected'});}catch(_){res.status(503).json({ok:false,error:'database unavailable'});} });
app.post('/api/auth/register', async(req,res)=>{
  const name=String(req.body?.name||'').trim().replace(/\s+/g,' ').slice(0,100), email=cleanEmail(req.body?.email), password=String(req.body?.password||'');
  if(name.length<2||!emailRE.test(email)||password.length<10||password.length>128) return res.status(400).json({ok:false,error:'أدخل اسمًا صحيحًا وبريدًا صالحًا وكلمة مرور من 10 أحرف على الأقل.'});
  try { const hash=await bcrypt.hash(password,12); const q=await pool.query("INSERT INTO users(name,email,password_hash,role,status) VALUES($1,$2,$3,'user','pending') RETURNING id,name,email,status,created_at",[name,email,hash]); await audit(q.rows[0].id,'account.registered','user',q.rows[0].id,{},req.ip); res.status(201).json({ok:true,message:'تم استلام طلب التسجيل. سيظهر الحساب للإدارة للمراجعة، ولا يمكن استخدام البلاجن قبل الموافقة وتفعيل الترخيص.',user:safeUser(q.rows[0])}); }
  catch(e){ if(e.code==='23505') return res.status(409).json({ok:false,error:'هذا البريد مسجل بالفعل.'}); console.error(e); res.status(500).json({ok:false,error:'تعذر إنشاء الحساب.'}); }
});
app.post('/api/auth/login', async(req,res)=>{
  const email=cleanEmail(req.body?.email), password=String(req.body?.password||''), deviceId=String(req.body?.deviceId||'');
  try { const q=await pool.query('SELECT * FROM users WHERE email=$1',[email]); const u=q.rows[0]; if(!u||!(await bcrypt.compare(password,u.password_hash))) return res.status(401).json({ok:false,error:'البريد الإلكتروني أو كلمة المرور غير صحيحة.'});
    if(u.status==='pending') return res.status(403).json({ok:false,error:'طلبك قيد المراجعة. انتظر موافقة الإدارة.'}); if(u.status!=='approved') return res.status(403).json({ok:false,error:'الحساب موقوف. تواصل مع الإدارة.'});
    if(u.role!=='admin'){ await activateDevice(u.id,deviceId); }
    const token=signToken(u,u.role==='admin'?null:deviceId); await pool.query('UPDATE users SET last_login_at=NOW() WHERE id=$1',[u.id]); await audit(u.id,'auth.login','user',u.id,{},req.ip); res.json({ok:true,token,user:safeUser(u),license:u.role==='admin'?null:await currentLicense(u.id)});
  } catch(e){ if(e.status) return res.status(e.status).json({ok:false,error:e.message}); console.error(e); res.status(500).json({ok:false,error:'تعذر تسجيل الدخول.'}); }
});
app.get('/api/plugin/me',auth,async(req,res)=>{ if(req.user.role==='admin') return res.json({ok:true,authenticated:true,user:safeUser(req.user),license:null}); try { const bound=await pool.query('SELECT id FROM devices WHERE user_id=$1 AND device_id=$2 AND revoked_at IS NULL',[req.user.id,req.claims.deviceId||'']); if(!bound.rowCount) return res.status(403).json({ok:false,error:'تم إلغاء تفعيل هذا الجهاز. سجّل الدخول مجددًا بعد موافقة الإدارة.'}); const lic=await currentLicense(req.user.id); if(!lic) return res.status(403).json({ok:false,error:'لا يوجد ترخيص نشط للحساب.'}); const q=await pool.query('SELECT device_id FROM devices WHERE user_id=$1 AND revoked_at IS NULL',[req.user.id]); res.json({ok:true,authenticated:true,user:safeUser(req.user),license:{kind:lic.kind,expiresAt:lic.expires_at,maxDevices:lic.max_devices},devicesInUse:q.rowCount}); } catch(e){console.error(e);res.status(500).json({ok:false,error:'تعذر التحقق من الترخيص.'});} });
app.post('/api/auth/logout',auth,async(req,res)=>{ await audit(req.user.id,'auth.logout','user',req.user.id,{},req.ip);res.json({ok:true}); });
// Admin dashboard APIs
app.get('/api/admin/summary',auth,admin,async(req,res)=>{const q=await pool.query("SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM users WHERE status='pending') pending,(SELECT COUNT(*) FROM users WHERE status='approved') approved,(SELECT COUNT(*) FROM licenses WHERE status='active' AND starts_at<=NOW() AND (expires_at IS NULL OR expires_at>NOW())) active_licenses,(SELECT COUNT(*) FROM payments WHERE status='confirmed') confirmed_payments");res.json({ok:true,summary:q.rows[0]});});
app.get('/api/admin/users',auth,admin,async(req,res)=>{const q=await pool.query("SELECT u.id,u.name,u.email,u.role,u.status,u.created_at,u.last_login_at,(SELECT COUNT(*) FROM payments p WHERE p.user_id=u.id AND p.status='confirmed') confirmed_payments,(SELECT json_build_object('id',l.id,'kind',l.kind,'status',l.status,'expires_at',l.expires_at) FROM licenses l WHERE l.user_id=u.id ORDER BY l.created_at DESC LIMIT 1) license FROM users u ORDER BY CASE WHEN u.status='pending' THEN 0 ELSE 1 END,u.created_at DESC LIMIT 500");res.json({ok:true,users:q.rows});});
app.post('/api/admin/users/:id/approve',auth,admin,async(req,res)=>{const q=await pool.query("UPDATE users SET status='approved',updated_at=NOW() WHERE id=$1 AND role='user' RETURNING id,name,email,status",[req.params.id]);if(!q.rowCount)return res.status(404).json({ok:false,error:'الحساب غير موجود.'});await audit(req.user.id,'user.approved','user',q.rows[0].id,{},req.ip);res.json({ok:true,user:q.rows[0],message:'تم قبول الحساب. فعّل ترخيصًا قبل السماح باستخدام البلاجن.'});});
app.post('/api/admin/users/:id/suspend',auth,admin,async(req,res)=>{const q=await pool.query("UPDATE users SET status='suspended',updated_at=NOW() WHERE id=$1 AND role='user' RETURNING id,email,status",[req.params.id]);if(!q.rowCount)return res.status(404).json({ok:false,error:'الحساب غير موجود.'});await pool.query('UPDATE licenses SET status=\'revoked\' WHERE user_id=$1 AND status=\'active\'',[req.params.id]);await pool.query('UPDATE devices SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL',[req.params.id]);await audit(req.user.id,'user.suspended','user',req.params.id,{},req.ip);res.json({ok:true});});
app.post('/api/admin/users/:id/license',auth,admin,async(req,res)=>{const userId=String(req.params.id),kind=req.body?.kind==='lifetime'?'lifetime':'subscription',months=Math.min(36,Math.max(1,Number(req.body?.months||1))),maxDevices=1;const user=await pool.query("SELECT id FROM users WHERE id=$1 AND role='user' AND status='approved'",[userId]);if(!user.rowCount)return res.status(400).json({ok:false,error:'اقبل الحساب أولًا قبل إنشاء الترخيص.'});const client=await pool.connect();try{await client.query('BEGIN');await client.query("UPDATE licenses SET status='revoked' WHERE user_id=$1 AND status='active'",[userId]);const q=await client.query("INSERT INTO licenses(user_id,kind,status,starts_at,expires_at,max_devices,created_by) VALUES($1,$2::varchar,'active',NOW(),CASE WHEN $2::varchar='lifetime' THEN NULL ELSE NOW()+($3 || ' months')::interval END,$4,$5) RETURNING *",[userId,kind,String(months),maxDevices,req.user.id]);await client.query('COMMIT');await audit(req.user.id,'license.created','license',q.rows[0].id,{userId,kind,months,maxDevices},req.ip);res.json({ok:true,license:q.rows[0]});}catch(e){await client.query('ROLLBACK');console.error(e);res.status(500).json({ok:false,error:'تعذر إنشاء الترخيص.'});}finally{client.release();}});
app.post('/api/admin/payments',auth,admin,async(req,res)=>{const userId=String(req.body?.userId||''),amount=Number(req.body?.amount),currency=String(req.body?.currency||'EGP').toUpperCase(),method=String(req.body?.method||'manual').slice(0,40),reference=String(req.body?.reference||'').slice(0,160),status= req.body?.status==='confirmed'?'confirmed':'pending';if(!Number.isFinite(amount)||amount<=0||amount>100000000||!['EGP','USD','EUR','SAR','AED'].includes(currency))return res.status(400).json({ok:false,error:'قيمة أو عملة غير صالحة.'});const q=await pool.query('INSERT INTO payments(user_id,amount,currency,method,reference,status,reviewed_by,reviewed_at) VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $6=\'confirmed\' THEN NOW() ELSE NULL END) RETURNING *',[userId,amount,currency,method,reference,status,status==='confirmed'?req.user.id:null]);await audit(req.user.id,'payment.recorded','payment',q.rows[0].id,{userId,amount,currency,status},req.ip);res.status(201).json({ok:true,payment:q.rows[0]});});
app.get('/api/admin/payments',auth,admin,async(req,res)=>{const q=await pool.query('SELECT p.*,u.name,u.email FROM payments p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 500');res.json({ok:true,payments:q.rows});});
app.get('/api/admin/audit',auth,admin,async(req,res)=>{const q=await pool.query('SELECT a.*,u.email AS actor_email FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 300');res.json({ok:true,logs:q.rows});});
app.post('/api/admin/devices/:id/revoke',auth,admin,async(req,res)=>{const q=await pool.query('UPDATE devices SET revoked_at=NOW() WHERE id=$1 AND revoked_at IS NULL RETURNING id,user_id',[req.params.id]);if(!q.rowCount)return res.status(404).json({ok:false,error:'الجهاز غير موجود أو تم إلغاؤه بالفعل.'});await audit(req.user.id,'device.revoked','device',q.rows[0].id,{},req.ip);res.json({ok:true});});
app.get('/api/admin/devices',auth,admin,async(req,res)=>{const q=await pool.query('SELECT d.*,u.name,u.email FROM devices d JOIN users u ON u.id=d.user_id ORDER BY d.last_seen_at DESC LIMIT 500');res.json({ok:true,devices:q.rows});});
app.get('/api/admin/plans',auth,admin,async(req,res)=>{const q=await pool.query('SELECT * FROM plans ORDER BY sort_order,id');res.json({ok:true,plans:q.rows});});
app.get('*', (req,res)=>{ if(req.path.startsWith('/api/')) return res.status(404).json({ok:false,error:'API route not found'});res.sendFile(path.join(__dirname,'public','index.html')); });
const port=Number(process.env.PORT||8787);app.listen(port,'0.0.0.0',()=>console.log(`NASAQ License API listening on ${port}`));
