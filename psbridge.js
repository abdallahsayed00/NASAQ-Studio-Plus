'use strict';
/**
 * Photoshop bridge (Windows / COM).
 * Builds an ExtendScript (.jsx) for an operation, runs it inside the already-open Photoshop
 * through PowerShell's COM automation (Photoshop.Application.DoJavaScriptFile) and returns the parsed JSON result.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const JSX_DIR = path.join(__dirname, 'jsx');
const read = (name) => fs.readFileSync(path.join(JSX_DIR, name), 'utf8');

// JSON that is pure ASCII, so the .jsx never depends on file encoding (Arabic text becomes \uXXXX).
function asciiJson(obj) {
  return JSON.stringify(obj === undefined ? {} : obj).replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

const OPS = {
  social: { file: 'social.jsx', entry: 'socialWork', history: 'NASAQ Social Icons' },
  text: { file: 'text.jsx', entry: 'textWork', history: 'NASAQ Text Studio' },
  templateUpdate: { file: 'templates.jsx', entry: 'templateUpdateWork', history: 'NASAQ Template Text Update' },
  layers: { file: 'templates.jsx', entry: 'templateLayersWork', history: 'NASAQ Template Layer Scan' }
};

function buildJsx(op, params) {
  const head = 'var P = ' + asciiJson(params) + ';\n';
  const prelude = read('prelude.jsx');
  if (op === 'ping') return head + prelude + '\n' + read('ping.jsx');
  if (op === 'fonts') return head + prelude + `\nvar __res={ok:true,fonts:[]};try{var __fs=app.fonts;var __len=Number(__fs.length);if(!isFinite(__len)||__len<0)__len=0;for(var __i=0;__i<__len;__i++){try{var __f=null;try{__f=__fs.item(__i);}catch(__e1){}if(!__f){try{__f=__fs[__i];}catch(__e2){}}if(!__f)continue;var __ps='',__fam='',__name='',__style='';try{__ps=String(__f.postScriptName||'');}catch(__e3){}try{__fam=String(__f.family||'');}catch(__e4){}try{__name=String(__f.name||'');}catch(__e5){}try{__style=String(__f.style||'');}catch(__e6){}if(!__ps)__ps=__name||__fam;if(!__fam)__fam=__name||__ps;if(!__name)__name=__fam;__res.fonts.push({name:__name,family:__fam,postScriptName:__ps,style:__style});}catch(__fe){}}}catch(__e){__res={ok:false,error:String(__e)};}__res.fonts.sort(function(a,b){var aa=(a.family||'').toLowerCase(),bb=(b.family||'').toLowerCase();return aa<bb?-1:(aa>bb?1:0);});toJSON(__res);`;
  if (op === 'openTemplate') return head + prelude + `\nvar __res;try{var __f=new File(P.path);if(!__f.exists)throw new Error('TEMPLATE_NOT_FOUND');app.open(__f);__res={ok:true,name:app.activeDocument.name};}catch(__e){__res={ok:false,error:String(__e)};}toJSON(__res);`;
  const def = OPS[op];
  if (!def) throw new Error('Unknown operation: ' + op);
  const runner = read('runner.jsx').replace('__HISTORY__', def.history).replace('__ENTRY__', def.entry);
  return head + prelude + '\n' + read(def.file) + '\n' + runner;
}

function psScript(jsxPath) {
  const p = jsxPath.replace(/\\/g, '/').replace(/'/g, "''");
  return [
    "$ErrorActionPreference = 'Stop'",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "if (-not (Get-Process -Name Photoshop -ErrorAction SilentlyContinue)) { Write-Output 'NASAQRESULT:{\"ok\":false,\"error\":\"NOT_RUNNING\"}'; exit 0 }",
    'try {',
    '  try { $ps = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Photoshop.Application") }',
    '  catch { $ps = New-Object -ComObject Photoshop.Application }',
    "  $r = $ps.DoJavaScriptFile('" + p + "', [System.Reflection.Missing]::Value, 1)",
    "  Write-Output ('NASAQRESULT:' + $r)",
    '} catch {',
    "  Write-Output ('NASAQERROR:' + $_.Exception.Message)",
    '}'
  ].join('\r\n');
}

function parseOutput(stdout) {
  const lines = String(stdout).split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].indexOf('NASAQRESULT:') === 0) {
      const raw = lines[i].slice('NASAQRESULT:'.length).trim();
      try { return JSON.parse(raw); } catch (e) { return { ok: false, error: 'BAD_RESULT: ' + raw.slice(0, 120) }; }
    }
    if (lines[i].indexOf('NASAQERROR:') === 0) {
      const msg = lines[i].slice('NASAQERROR:'.length).trim();
      return { ok: false, error: /class not registered|Invalid class string|RPC|0x800/i.test(msg) ? 'COM_FAIL' : msg };
    }
  }
  return { ok: false, error: 'COM_FAIL' };
}

function run(op, params, timeoutMs) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve({ ok: false, error: 'WIN_ONLY' });
    let jsx;
    try { jsx = buildJsx(op, params); } catch (e) { return resolve({ ok: false, error: String(e.message || e) }); }
    const id = Date.now() + '_' + Math.floor(Math.random() * 1e6);
    const jsxPath = path.join(os.tmpdir(), 'nasaq_' + id + '.jsx');
    const ps1Path = path.join(os.tmpdir(), 'nasaq_' + id + '.ps1');
    fs.writeFileSync(jsxPath, jsx, 'utf8');
    fs.writeFileSync(ps1Path, '\ufeff' + psScript(jsxPath), 'utf8');   // BOM so PowerShell reads it as UTF-8

    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1Path], { windowsHide: true });
    let out = '', done = false;
    const finish = (r) => {
      if (done) return; done = true; clearTimeout(timer);
      try { fs.unlinkSync(jsxPath); } catch (e) {}
      try { fs.unlinkSync(ps1Path); } catch (e) {}
      resolve(r);
    };
    const timer = setTimeout(() => { try { child.kill(); } catch (e) {} finish({ ok: false, error: 'TIMEOUT' }); }, timeoutMs || (op === 'ping' ? 15000 : 120000));
    child.stdout.on('data', (d) => { out += d.toString('utf8'); });
    child.on('error', () => finish({ ok: false, error: 'COM_FAIL' }));
    child.on('close', () => finish(parseOutput(out)));
  });
}

module.exports = { run, buildJsx, asciiJson, parseOutput, psScript };
