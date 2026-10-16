// ---- NASAQ Studio · shared helpers (ExtendScript / ES3: no JSON, no forEach/map/filter) ----
var BS = String.fromCharCode(92);
var WARN = [];

function sTID(s) { return stringIDToTypeID(s); }
function cTID(s) { return charIDToTypeID(s); }
function pxv(n) { return new UnitValue(n, 'px'); }
function numv(u) { return (typeof u === 'number') ? u : Number(u.as('px')); }
function bnds(layer) {
  var b = layer.bounds;
  return { l: numv(b[0]), t: numv(b[1]), r: numv(b[2]), b: numv(b[3]) };
}

function jsonEsc(s) {
  var out = '', i, code, h;
  s = String(s);
  for (i = 0; i < s.length; i++) {
    code = s.charCodeAt(i);
    if (code === 34) { out += BS + '"'; }
    else if (code === 92) { out += BS + BS; }
    else if (code < 32 || code > 126) {
      h = code.toString(16);
      while (h.length < 4) { h = '0' + h; }
      out += BS + 'u' + h;
    } else { out += s.charAt(i); }
  }
  return '"' + out + '"';
}
function toJSON(v) {
  var t = typeof v, i, out, k;
  if (v === null || v === undefined) { return 'null'; }
  if (t === 'string') { return jsonEsc(v); }
  if (t === 'number') { return isFinite(v) ? String(v) : 'null'; }
  if (t === 'boolean') { return v ? 'true' : 'false'; }
  if (v instanceof Array) {
    out = [];
    for (i = 0; i < v.length; i++) { out.push(toJSON(v[i])); }
    return '[' + out.join(',') + ']';
  }
  out = [];
  for (k in v) { if (v.hasOwnProperty(k)) { out.push(jsonEsc(k) + ':' + toJSON(v[k])); } }
  return '{' + out.join(',') + '}';
}

function placeFile(f) {
  var d = new ActionDescriptor();
  d.putPath(cTID('null'), f);
  d.putEnumerated(cTID('FTcs'), cTID('QCSt'), cTID('Qcsa'));
  var off = new ActionDescriptor();
  off.putUnitDouble(cTID('Hrzn'), cTID('#Pxl'), 0);
  off.putUnitDouble(cTID('Vrtc'), cTID('#Pxl'), 0);
  d.putObject(cTID('Ofst'), cTID('Ofst'), off);
  executeAction(cTID('Plc '), d, DialogModes.NO);
  return app.activeDocument.activeLayer;
}

function solid(c) {
  var s = new SolidColor();
  s.rgb.red = c.r; s.rgb.green = c.g; s.rgb.blue = c.b;
  return s;
}

function makeText(doc, text, o) {
  var layer = doc.artLayers.add();
  layer.kind = LayerKind.TEXT;
  var ti = layer.textItem;
  ti.contents = text;
  if (o.size) { try { ti.size = o.size; } catch (e1) { WARN.push('size'); } }
  if (o.font) { try { ti.font = o.font; } catch (e2) { WARN.push('font'); } }
  if (o.color) { try { ti.color = solid(o.color); } catch (e3) { WARN.push('color'); } }
  ti.position = [pxv(o.x), pxv(o.y)];
  return layer;
}

function guideExists(doc, vertical, pos) {
  var i, g, isV;
  for (i = 0; i < doc.guides.length; i++) {
    g = doc.guides[i];
    isV = (g.direction === Direction.VERTICAL);
    if (isV === vertical && Math.abs(numv(g.coordinate) - pos) < 0.5) { return true; }
  }
  return false;
}

function rgbDesc(c) {
  var d = new ActionDescriptor();
  d.putDouble(sTID('red'), c.r);
  d.putDouble(sTID('grain'), c.g);
  d.putDouble(sTID('blue'), c.b);
  return d;
}
function linearCurve() {
  var t = new ActionDescriptor();
  t.putString(sTID('name'), 'Linear');
  return t;
}
function pct(d, key, v) { d.putUnitDouble(sTID(key), sTID('percentUnit'), v); }
function pix(d, key, v) { d.putUnitDouble(sTID(key), sTID('pixelsUnit'), v); }

// Only the effects that are present in cfg are written; nothing else is touched.
function setLayerEffects(cfg) {
  var d = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putProperty(sTID('property'), sTID('layerEffects'));
  ref.putEnumerated(sTID('layer'), sTID('ordinal'), sTID('targetEnum'));
  d.putReference(sTID('null'), ref);

  var fx = new ActionDescriptor();
  pct(fx, 'scale', 100);

  if (cfg.stroke) {
    var fr = new ActionDescriptor();
    fr.putBoolean(sTID('enabled'), true);
    fr.putEnumerated(sTID('style'), sTID('frameStyle'), sTID('outsetFrame'));
    fr.putEnumerated(sTID('paintType'), sTID('frameFill'), sTID('solidColor'));
    fr.putEnumerated(sTID('mode'), sTID('blendMode'), sTID('normal'));
    pct(fr, 'opacity', 100);
    pix(fr, 'size', cfg.stroke.size);
    fr.putObject(sTID('color'), sTID('RGBColor'), rgbDesc(cfg.stroke.color));
    fr.putBoolean(sTID('overprint'), false);
    fx.putObject(sTID('frameFX'), sTID('frameFX'), fr);
  }
  if (cfg.shadow) {
    var ds = new ActionDescriptor();
    ds.putBoolean(sTID('enabled'), true);
    ds.putEnumerated(sTID('mode'), sTID('blendMode'), sTID('multiply'));
    ds.putObject(sTID('color'), sTID('RGBColor'), rgbDesc(cfg.shadow.color));
    pct(ds, 'opacity', cfg.shadow.opacity);
    ds.putBoolean(sTID('useGlobalAngle'), false);
    ds.putUnitDouble(sTID('localLightingAngle'), sTID('angleUnit'), cfg.shadow.angle);
    pix(ds, 'distance', cfg.shadow.dist);
    pix(ds, 'chokeMatte', 0);
    pix(ds, 'blur', cfg.shadow.size);
    pct(ds, 'noise', 0);
    ds.putBoolean(sTID('antiAlias'), false);
    ds.putObject(sTID('transferSpec'), sTID('shapeCurveType'), linearCurve());
    fx.putObject(sTID('dropShadow'), sTID('dropShadow'), ds);
  }
  if (cfg.glow) {
    var og = new ActionDescriptor();
    og.putBoolean(sTID('enabled'), true);
    og.putEnumerated(sTID('mode'), sTID('blendMode'), sTID('screen'));
    og.putObject(sTID('color'), sTID('RGBColor'), rgbDesc(cfg.glow.color));
    pct(og, 'opacity', cfg.glow.opacity);
    og.putEnumerated(sTID('glowTechnique'), sTID('matteTechnique'), sTID('softMatte'));
    pix(og, 'chokeMatte', 0);
    pix(og, 'blur', cfg.glow.size);
    pct(og, 'noise', 0);
    og.putBoolean(sTID('antiAlias'), false);
    og.putObject(sTID('transferSpec'), sTID('shapeCurveType'), linearCurve());
    fx.putObject(sTID('outerGlow'), sTID('outerGlow'), og);
  }
  d.putObject(sTID('to'), sTID('layerEffects'), fx);
  executeAction(sTID('set'), d, DialogModes.NO);
}
