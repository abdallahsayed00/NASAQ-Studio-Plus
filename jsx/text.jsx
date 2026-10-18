// ---- Text Studio: applies ONLY what the designer enabled (every key in P.cfg is opt-in) ----
function textWork() {
  var doc = app.activeDocument;
  var W = numv(doc.width), H = numv(doc.height);
  var cfg = P.cfg, layer, ti, b;
  var res = { ok: true, count: 0, warnings: WARN };

  if (P.mode === 'new') {
    layer = makeText(doc, P.text, { x: Math.round(W / 2), y: Math.round(H / 2) });
  } else {
    layer = doc.activeLayer;
    if (layer.kind !== LayerKind.TEXT) { return { ok: false, error: 'NOT_TEXT' }; }
  }
  doc.activeLayer = layer;
  ti = layer.textItem;

  if (cfg.font) { try { ti.font = cfg.font; } catch (e1) { WARN.push('الخط'); } }
  if (cfg.size) { try { ti.size = cfg.size; } catch (e2) { WARN.push('الحجم'); } }
  if (cfg.color) { try { ti.color = solid(cfg.color); } catch (e3) { WARN.push('اللون'); } }
  if (cfg.tracking !== undefined) { try { ti.tracking = cfg.tracking; } catch (e4) { WARN.push('المسافة'); } }
  if (cfg.align) {
    try {
      ti.justification = (cfg.align === 'left') ? Justification.LEFT : ((cfg.align === 'right') ? Justification.RIGHT : Justification.CENTER);
    } catch (e5) { WARN.push('المحاذاة'); }
  }
  if (cfg.stroke || cfg.shadow || cfg.glow) {
    try { setLayerEffects(cfg); } catch (e6) { WARN.push('التأثيرات'); }
  }
  if (cfg.place) {
    try {
      b = bnds(layer);
      layer.translate(pxv(W / 2 - (b.l + b.r) / 2), pxv(cfg.place === 'both' ? (H / 2 - (b.t + b.b) / 2) : 0));
    } catch (e7) { WARN.push('التوسيط'); }
  }
  res.count = 1;
  return res;
}
