'use strict';
// Runs the generated ExtendScript against a small fake Photoshop object model.
// The VM strips ES5+ built-ins so anything ExtendScript (ES3) can't run fails here too.
const vm = require('vm');
const assert = require('assert');
const { buildJsx, asciiJson, parseOutput } = require('../psbridge');

class UnitValue { constructor(v, u) { this.value = Number(v); this.type = u; } as() { return this.value; } }
const num = (u) => (typeof u === 'number' ? u : u.value);

function makeEnv(opts) {
  opts = opts || {};
  const log = { effects: null, guides: [], removed: [], prefs: [] };
  const ctx = vm.createContext({});
  const doc = { name: 'design.psd', width: new UnitValue(opts.W || 1350), height: new UnitValue(opts.H || 1080), layers: [], guides: [], activeLayer: null };
  doc.guides.add = function (dir, pos) { this.push({ direction: dir, coordinate: pos }); log.guides.push([dir, pos.value]); };
  const mkLayer = (name, b) => {
    const L = { name, kind: 'NORMAL', _b: b, parent: null, remove() { const i = doc.layers.indexOf(L); if (i >= 0) doc.layers.splice(i, 1); log.removed.push(name); },
      translate(dx, dy) { this._b = { l: this._b.l + num(dx), t: this._b.t + num(dy), r: this._b.r + num(dx), b: this._b.b + num(dy) }; },
      resize(sx, sy) { const w = (this._b.r - this._b.l) * sx / 100, h = (this._b.b - this._b.t) * sy / 100, cx = (this._b.l + this._b.r) / 2, cy = (this._b.t + this._b.b) / 2; this._b = { l: cx - w / 2, t: cy - h / 2, r: cx + w / 2, b: cy + h / 2 }; },
      move(target) { this.parent = target; } };
    Object.defineProperty(L, 'bounds', { get() { const b = L.kind === 'TEXT' ? L._textBounds() : L._b; return [new UnitValue(b.l), new UnitValue(b.t), new UnitValue(b.r), new UnitValue(b.b)]; } });
    return L;
  };
  doc.artLayers = { add() { const L = mkLayer('Layer', { l: 0, t: 0, r: 0, b: 0 }); L._off = { x: 0, y: 0 }; doc.layers.push(L); doc.activeLayer = L;
    const ti = { contents: '', size: 12, position: [new UnitValue(0), new UnitValue(0)] };
    let kind = 'NORMAL';
    Object.defineProperty(L, 'kind', { get() { return kind; }, set(v) { kind = v; } });
    L.textItem = ti;
    L._textBounds = () => { const w = ti.contents.length * ti.size * 0.55, h = ti.size * 1.2; const l = ti.position[0].value + L._b.l, t = ti.position[1].value - ti.size + L._b.t; return { l, t, r: l + w, b: t + h }; };
    L._b = { l: 0, t: 0, r: 0, b: 0 };
    return L; } };
  doc.layerSets = { add() { const S = { name: 'Set' }; doc.layers.push(S); return S; } };
  const app = { version: '25.0', preferences: {}, displayDialogs: 0, documents: opts.noDoc ? [] : [doc] };
  Object.defineProperty(app, 'activeDocument', { get() { return doc; } });
  doc.suspendHistory = (name, code) => { log.history = name; vm.runInContext(code, ctx); };
  class ActionDescriptor { constructor() { this.k = {}; } }
  ['putPath', 'putEnumerated', 'putObject', 'putUnitDouble', 'putBoolean', 'putDouble', 'putString', 'putReference'].forEach((m) => { ActionDescriptor.prototype[m] = function (key, a, b) { this.k[key] = (m === 'putObject') ? b : [a, b]; }; });
  class ActionReference { putProperty() {} putEnumerated() {} }
  const placed = { n: 0 };
  Object.assign(ctx, {
    app, UnitValue, ActionDescriptor, ActionReference,
    Units: { PIXELS: 'px' }, TypeUnits: { PIXELS: 'px' }, DialogModes: { NO: 3 },
    Direction: { VERTICAL: 'V', HORIZONTAL: 'H' }, LayerKind: { TEXT: 'TEXT' },
    AnchorPosition: { MIDDLECENTER: 'MC' }, ElementPlacement: { INSIDE: 'IN' },
    Justification: { LEFT: 'L', CENTER: 'C', RIGHT: 'R' },
    File: class { constructor(p) { this.path = p; this.exists = !(opts.missing && p.indexOf(opts.missing) >= 0); } },
    SolidColor: class { constructor() { this.rgb = {}; } },
    stringIDToTypeID: (s) => s, charIDToTypeID: (s) => s,
    executeAction(id, desc) {
      if (id === 'Plc ') { const L = mkLayer('placed', { l: 500, t: 300, r: 900, b: 700 }); L.src = desc.k.null[0]; doc.layers.push(L); doc.activeLayer = L; placed.n++; }
      if (id === 'set') log.effects = desc.k.to.k;
    }
  });
  // --- ES3 simulation: remove everything ExtendScript does not have ---
  vm.runInContext(`
    delete Array.prototype.forEach; delete Array.prototype.map; delete Array.prototype.filter; delete Array.prototype.some;
    delete Array.prototype.every; delete Array.prototype.reduce; delete Array.prototype.indexOf; delete Array.isArray;
    delete String.prototype.trim; delete String.prototype.padStart; delete Function.prototype.bind;
    Object.keys = undefined; Object.defineProperty = undefined; JSON = undefined;
  `, ctx);
  return { ctx, doc, log };
}
const r1 = (n) => Math.round(n * 10) / 10;
function runOp(op, params, envOpts) {
  const env = makeEnv(envOpts);
  // the fake object model needs Array.indexOf/forEach while it is being *built*, so build first, strip after (done in makeEnv end);
  const out = vm.runInContext(buildJsx(op, params), env.ctx);
  return { res: JSON.parse(out), env };
}

const BASE = { picked: ['facebook', 'tiktok', 'youtube', 'instagram'], color: 'white', size: 72, gap: 3, guides: { top: 60, right: 60, bottom: 60, left: 60 }, vPos: 'bottom', hAlign: 'center', vertical: false, nameText: '', nameLeft: false, textGap: 12, nameSize: 40, rgb: [255, 255, 255], assets: 'C:/App/renderer/assets' };
let passed = 0;
const ok = (name, fn) => { try { fn(); passed++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1; } };

console.log('Social icons');
ok('row / center / bottom: guides + exact positions', () => {
  const { res, env } = runOp('social', BASE);
  assert.strictEqual(res.ok, true); assert.strictEqual(res.placed, 4);
  assert.deepStrictEqual(env.log.guides, [['V', 60], ['V', 1290], ['H', 60], ['H', 1020]]);
  const icons = env.doc.layers.filter((l) => l.name && l.name.indexOf('NASAQ Social - ') === 0);
  assert.deepStrictEqual(icons.map((l) => [l.name.replace('NASAQ Social - ', ''), r1(l._b.l), r1(l._b.t), r1(l._b.r - l._b.l)]),
    [['Facebook', 526.5, 948, 72], ['TikTok', 601.5, 948, 72], ['YouTube', 676.5, 948, 72], ['Instagram', 751.5, 948, 72]]);
  assert.strictEqual(env.log.history, 'NASAQ Social Icons');
  assert.ok(icons[0].src.path.indexOf('social-white-facebook.png') > 0);
});
ok('existing guides are not duplicated', () => {
  const env = makeEnv(); env.doc.guides.push({ direction: 'V', coordinate: new UnitValue(60) });
  vm.runInContext(buildJsx('social', BASE), env.ctx);
  assert.strictEqual(env.log.guides.length, 3);
});
ok('thumbnail guides 80/100/80/100, column on the left, vertically centered', () => {
  const { res, env } = runOp('social', Object.assign({}, BASE, { guides: { top: 80, right: 100, bottom: 80, left: 100 }, vertical: true, hAlign: 'left', vPos: 'middle' }), { W: 1920 });
  assert.strictEqual(res.W, 1920);
  assert.deepStrictEqual(env.log.guides, [['V', 100], ['V', 1820], ['H', 80], ['H', 1000]]);
  const icons = env.doc.layers.filter((l) => l.name && l.name.indexOf('NASAQ Social - ') === 0);
  assert.deepStrictEqual(icons.map((l) => [r1(l._b.l), r1(l._b.t)]), [[100, 391.5], [100, 466.5], [100, 541.5], [100, 616.5]]);
});
ok('row, right, top with Arabic account name after the icons', () => {
  const { res, env } = runOp('social', Object.assign({}, BASE, { picked: ['facebook', 'instagram'], hAlign: 'right', vPos: 'top', nameText: '@نسق' }));
  assert.strictEqual(res.nameAdded, true);
  const name = env.doc.layers.filter((l) => l.name === 'NASAQ Social - Name')[0];
  assert.strictEqual(name.textItem.contents, '@نسق');
  const icons = env.doc.layers.filter((l) => l.name && l.name.indexOf('NASAQ Social - ') === 0 && l.name !== 'NASAQ Social - Name');
  const nb = name._textBounds();
  assert.strictEqual(r1(nb.r), 1290);                       // name's right edge sits on the right guide
  assert.strictEqual(r1(icons[0]._b.t), 60);                // top guide
  assert.ok(icons[1]._b.r < nb.l, 'icons come before the name');
  assert.strictEqual(r1(nb.l - icons[1]._b.r), 12);
});
ok('column + right + name below: name right edge and icon column on the guide', () => {
  const { env } = runOp('social', Object.assign({}, BASE, { vertical: true, hAlign: 'right', vPos: 'middle', nameText: '@nasaq' }));
  const name = env.doc.layers.filter((l) => l.name === 'NASAQ Social - Name')[0]; const nb = name._textBounds();
  const icons = env.doc.layers.filter((l) => l.name && l.name.indexOf('NASAQ Social - ') === 0 && l.name !== 'NASAQ Social - Name');
  assert.strictEqual(r1(nb.r), 1290); assert.strictEqual(r1(icons[0]._b.r), 1290);
  assert.ok(nb.t > icons[3]._b.b, 'name is below the stack');
});
ok('previous run is replaced (no duplicates)', () => {
  const env = makeEnv(); const L = { name: 'NASAQ Social - Facebook', remove() { env.log.removed.push('x'); } }; env.doc.layers.push(L);
  vm.runInContext(buildJsx('social', BASE), env.ctx); assert.strictEqual(env.log.removed.indexOf('x') >= 0, true);
});
ok('missing icon file is reported, others still placed', () => {
  const { res } = runOp('social', BASE, { missing: 'tiktok' });
  assert.strictEqual(res.placed, 3); assert.ok(res.warnings.join(',').indexOf('missing tiktok') >= 0);
});
ok('no document → NO_DOC', () => { assert.strictEqual(runOp('social', BASE, { noDoc: true }).res.error, 'NO_DOC'); });

console.log('Text Studio (opt-in)');
ok('new layer: only enabled properties are applied; effects contain only enabled effects', () => {
  const cfg = { size: 90, color: { hex: 'eadfca', r: 234, g: 223, b: 202 }, stroke: { size: 6, color: { hex: '3a0f1b', r: 58, g: 15, b: 27 } }, place: 'both' };
  const { res, env } = runOp('text', { mode: 'new', text: 'مرحبا', cfg });
  assert.strictEqual(res.ok, true); assert.strictEqual(res.count, 1);
  const L = env.doc.layers.filter((l) => l.kind === 'TEXT')[0];
  assert.strictEqual(L.textItem.size, 90); assert.strictEqual(L.textItem.color.rgb.red, 234);
  assert.strictEqual(L.textItem.font, undefined);            // font was NOT enabled → untouched
  assert.strictEqual(L.textItem.tracking, undefined);        // tracking was NOT enabled → untouched
  assert.deepStrictEqual(Object.keys(env.log.effects).sort(), ['frameFX', 'scale']);   // no shadow, no glow
  const b = L._textBounds(); assert.ok(Math.abs((b.l + b.r) / 2 - 675) < 1 && Math.abs((b.t + b.b) / 2 - 540) < 1);
});
ok('selected mode on a non-text layer → NOT_TEXT, nothing changed', () => {
  const env = makeEnv(); const L = { name: 'bg', kind: 'NORMAL' }; env.doc.activeLayer = L;
  const res = JSON.parse(vm.runInContext(buildJsx('text', { mode: 'selected', text: '', cfg: { size: 50 } }), env.ctx));
  assert.strictEqual(res.error, 'NOT_TEXT'); assert.strictEqual(env.log.effects, null);
});
ok('selected mode: shadow + glow only', () => {
  const env = makeEnv(); const T = env.doc.artLayers.add(); T.kind = 'TEXT'; T.textItem.contents = 'x'; env.doc.activeLayer = T;
  const col = { hex: '000000', r: 0, g: 0, b: 0 };
  const res = JSON.parse(vm.runInContext(buildJsx('text', { mode: 'selected', text: '', cfg: { shadow: { color: col, opacity: 75, angle: 120, dist: 8, size: 12 }, glow: { color: col, opacity: 60, size: 20 } } }), env.ctx));
  assert.strictEqual(res.ok, true); assert.deepStrictEqual(Object.keys(env.log.effects).sort(), ['dropShadow', 'outerGlow', 'scale']);
  assert.strictEqual(T.textItem.size, 12);                    // untouched
});

console.log('Bridge');
ok('ascii-only params (Arabic escaped) and ping script', () => {
  assert.ok(!/[^\x00-\x7f]/.test(asciiJson({ t: 'نسق ✓' })));
  const env = makeEnv(); const out = JSON.parse(vm.runInContext(buildJsx('ping', {}), env.ctx));
  assert.strictEqual(out.ok, true); assert.strictEqual(out.hasDoc, true); assert.strictEqual(out.W, 1350);
});
ok('output parser', () => {
  assert.deepStrictEqual(parseOutput('x\r\nNASAQRESULT:{"ok":true}\r\n'), { ok: true });
  assert.strictEqual(parseOutput('NASAQERROR:Invalid class string').error, 'COM_FAIL');
  assert.strictEqual(parseOutput('garbage').error, 'COM_FAIL');
});
ok('font listing and PSD opening use ExtendScript-safe JSON serialization', () => {
  const fonts = buildJsx('fonts', {}); const open = buildJsx('openTemplate', { path: 'C:/templates/عنوان.psd' });
  assert.ok(fonts.indexOf('app.fonts') >= 0 && fonts.indexOf('toJSON(__res)') >= 0);
  assert.ok(open.indexOf('app.open(__f)') >= 0 && open.indexOf('toJSON(__res)') >= 0);
  assert.ok(!/JSON\.stringify/.test(fonts + open));
});
ok('template text updater changes only the requested text layer IDs', () => {
  const env = makeEnv();
  const a = env.doc.artLayers.add(); a.name = 'Title'; a.kind = 'TEXT'; a.typename = 'ArtLayer'; a.id = 101; a.textItem.contents = 'Old title';
  const b = env.doc.artLayers.add(); b.name = 'Subtitle'; b.kind = 'TEXT'; b.typename = 'ArtLayer'; b.id = 202; b.textItem.contents = 'Keep me';
  const out = JSON.parse(vm.runInContext(buildJsx('templateUpdate', { updates: [{ id: 101, text: 'New title' }] }), env.ctx));
  assert.strictEqual(out.ok, true); assert.strictEqual(out.changed, 1);
  assert.strictEqual(a.textItem.contents, 'New title'); assert.strictEqual(b.textItem.contents, 'Keep me');
});
console.log('\n' + passed + ' checks passed' + (process.exitCode ? ' — WITH FAILURES' : ''));
