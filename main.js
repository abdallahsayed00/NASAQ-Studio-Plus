'use strict';
const { app, BrowserWindow, ipcMain, clipboard, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const bridge = require('./psbridge');
const crypto = require('crypto');
const { safeStorage } = require('electron');

let win = null;
const authDir = () => app.getPath('userData');
const authFile = () => path.join(authDir(), 'nasaq-session.dat');
const deviceFile = () => path.join(authDir(), 'nasaq-device-id');
function apiBase() {
  const env = String(process.env.NASAQ_API_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  const cfg = path.join(authDir(), 'license-config.json');
  try { const value = JSON.parse(fs.readFileSync(cfg, 'utf8')).apiUrl; if (value) return String(value).replace(/\/$/, ''); } catch (_) {}
  return 'http://127.0.0.1:8787';
}
function getDeviceId() {
  try { const existing = fs.readFileSync(deviceFile(), 'utf8').trim(); if (/^[a-f0-9-]{36}$/i.test(existing)) return existing; } catch (_) {}
  const id = crypto.randomUUID(); fs.mkdirSync(authDir(), {recursive:true}); fs.writeFileSync(deviceFile(), id, {mode:0o600}); return id;
}
function readSession() {
  try { if (!safeStorage.isEncryptionAvailable()) return null; return safeStorage.decryptString(fs.readFileSync(authFile())); } catch (_) { return null; }
}
function saveSession(token) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('التخزين الآمن غير متاح على هذا الجهاز؛ لم يتم حفظ جلسة الدخول.');
  fs.writeFileSync(authFile(), safeStorage.encryptString(String(token)), {mode:0o600});
}
function clearSession() { try { fs.unlinkSync(authFile()); } catch (_) {} }
async function apiRequest(route, body, token) {
  const base = apiBase();
  const parsed = new URL(base);
  if (parsed.protocol !== 'https:' && !['localhost','127.0.0.1','::1'].includes(parsed.hostname)) throw new Error('خادم التراخيص العام يجب أن يستخدم HTTPS.');
  const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type':'application/json', ...(token ? {authorization:'Bearer '+token} : {}) }, ...(body === undefined ? {} : {body:JSON.stringify(body)}), signal: AbortSignal.timeout(12000) });
  let payload = {}; try { payload = await response.json(); } catch (_) {}
  if (!response.ok) { const err = new Error(payload.error || payload.message || `HTTP ${response.status}`); err.code = response.status; throw err; }
  return payload;
}

function createWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  win = new BrowserWindow({
    width: 460, height: 860, minWidth: 320, minHeight: 460,
    backgroundColor: '#2a0a12',
    title: 'NASAQ Studio+',
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('closed', () => { win = null; });
  if (process.env.NASAQ_SMOKE) {   // used by the automated smoke test only
    win.webContents.on('did-finish-load', async () => {
      const probe = "(async () => ({ api: typeof window.nasaq.ps, ping: await window.nasaq.ps('ping', {}), assets: await window.nasaq.assetsDir(), views: document.querySelectorAll('.view').length, cards: document.querySelectorAll('.tool-card').length }))()";
      try { console.log('SMOKE ' + JSON.stringify(await win.webContents.executeJavaScript(probe))); } catch (e) { console.log('SMOKE_ERR ' + e); }
      app.quit();
    });
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    ipcMain.handle('ps', (_e, op, params) => bridge.run(op, params));
    ipcMain.handle('auth:register', async (_e, payload) => {
      try { return await apiRequest('/api/auth/register', {name:String(payload.name||'').trim(),email:String(payload.email||'').trim(),password:String(payload.password||''),deviceId:getDeviceId()}); }
      catch (e) { return {ok:false,error:e.message,code:e.code||0}; }
    });
    ipcMain.handle('auth:login', async (_e, payload) => {
      try {
        const result = await apiRequest('/api/auth/login', {email:String(payload.email||'').trim(),password:String(payload.password||''),deviceId:getDeviceId()});
        if (result.token) saveSession(result.token);
        return result;
      } catch (e) { return {ok:false,error:e.message,code:e.code||0}; }
    });
    ipcMain.handle('auth:status', async () => {
      const token = readSession(); if (!token) return {ok:false,authenticated:false,error:'سجّل الدخول للمتابعة.'};
      try { const result = await apiRequest('/api/plugin/me', undefined, token); return {...result,authenticated:true}; }
      catch (e) { if (e.code === 401 || e.code === 403) clearSession(); return {ok:false,authenticated:false,error:e.message}; }
    });
    ipcMain.handle('auth:logout', () => { clearSession(); return {ok:true}; });
    ipcMain.handle('copy', (_e, text) => { clipboard.writeText(String(text)); return true; });
    ipcMain.handle('ontop', (_e, on) => { if (win) win.setAlwaysOnTop(!!on, 'floating'); return !!on; });
    ipcMain.handle('assetsDir', () => path.join(__dirname, 'renderer', 'assets').replace(/\\/g, '/'));
    ipcMain.handle('templates:list', () => {
      const dir = path.join(app.getPath('userData'), 'templates');
      fs.mkdirSync(dir, { recursive: true });
      return fs.readdirSync(dir).filter(n => /\.psd$/i.test(n)).map(name => ({ name, path: path.join(dir, name) }));
    });
    ipcMain.handle('templates:import', async () => {
      const picked = await dialog.showOpenDialog(win, { title: 'اختيار قالب Photoshop', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Photoshop PSD', extensions: ['psd'] }] });
      if (picked.canceled || !picked.filePaths.length) return { ok: true, canceled: true };
      const dir = path.join(app.getPath('userData'), 'templates'); fs.mkdirSync(dir, { recursive: true });
      const added = [];
      for (const src of picked.filePaths) {
        let dest = path.join(dir, path.basename(src));
        if (path.resolve(src) !== path.resolve(dest)) {
          if (fs.existsSync(dest)) dest = path.join(dir, path.basename(src, path.extname(src)) + '-' + Date.now() + '.psd');
          fs.copyFileSync(src, dest);
        }
        added.push({ name: path.basename(dest), path: dest });
      }
      return { ok: true, added };
    });
    ipcMain.handle('templates:remove', (_e, name) => {
      const base = path.basename(String(name || ''));
      if (!/\.psd$/i.test(base)) return { ok: false };
      const target = path.join(app.getPath('userData'), 'templates', base);
      if (fs.existsSync(target)) fs.unlinkSync(target);
      return { ok: true };
    });
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
