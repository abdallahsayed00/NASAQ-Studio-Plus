// ---- Social icons: guides + icon row/column (+ optional account name) ----
var SOCIAL_LABEL = { facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram' };

function socialWork() {
  var doc = app.activeDocument;
  var W = numv(doc.width), H = numv(doc.height);
  var G = P.guides, i, key, file, layer, b, scale, step, L;
  var res = { ok: true, placed: 0, nameAdded: false, W: W, H: H, warnings: WARN };

  // 1) guides (skip the ones that already exist)
  var wanted = [[true, G.left], [true, W - G.right], [false, G.top], [false, H - G.bottom]];
  for (i = 0; i < wanted.length; i++) {
    if (!guideExists(doc, wanted[i][0], wanted[i][1])) {
      try { doc.guides.add(wanted[i][0] ? Direction.VERTICAL : Direction.HORIZONTAL, pxv(wanted[i][1])); }
      catch (eg) { WARN.push('guide'); }
    }
  }

  // 2) remove icons from a previous run so pressing Add twice never duplicates
  for (i = doc.layers.length - 1; i >= 0; i--) {
    L = doc.layers[i];
    if (L.name === 'NASAQ Social Icons' || L.name.indexOf('NASAQ Social - ') === 0) {
      try { L.remove(); } catch (er) { WARN.push('remove-old'); }
    }
  }

  var n = P.picked.length;
  var total = n * P.size + (n - 1) * P.gap;

  // 3) account name (created first so its size is known)
  var nameLayer = null, tb = null, textW = 0, textH = 0;
  if (P.nameText) {
    try {
      nameLayer = makeText(doc, P.nameText, { size: P.nameSize, font: 'Arial-BoldMT', color: { r: P.rgb[0], g: P.rgb[1], b: P.rgb[2] }, x: 0, y: Math.round(H / 2) });
      tb = bnds(nameLayer); textW = tb.r - tb.l; textH = tb.b - tb.t;
    } catch (en) { WARN.push('name'); nameLayer = null; }
  }
  var hasName = (nameLayer !== null);

  // 4) one block (icons + optional name) aligned to the guides
  var bw, bh;
  if (P.vertical) { bw = Math.max(P.size, textW); bh = total + (hasName ? P.textGap + textH : 0); }
  else { bw = total + (hasName ? P.textGap + textW : 0); bh = P.size; }
  var x0 = (P.hAlign === 'left') ? G.left : ((P.hAlign === 'right') ? (W - G.right - bw) : ((W - bw) / 2));
  var y0 = (P.vPos === 'top') ? G.top : ((P.vPos === 'middle') ? ((H - bh) / 2) : (H - G.bottom - bh));
  function inBlockX(w) { return (P.hAlign === 'left') ? x0 : ((P.hAlign === 'right') ? (x0 + bw - w) : (x0 + (bw - w) / 2)); }
  var sx, sy;
  if (P.vertical) { sx = inBlockX(P.size); sy = y0 + ((hasName && P.nameLeft) ? textH + P.textGap : 0); }
  else { sx = x0 + ((hasName && P.nameLeft) ? textW + P.textGap : 0); sy = y0; }

  var placed = [];
  if (hasName) {
    var tx, ty;
    if (P.vertical) { tx = inBlockX(textW); ty = P.nameLeft ? y0 : (y0 + total + P.textGap); }
    else { tx = P.nameLeft ? x0 : (x0 + total + P.textGap); ty = y0 + P.size / 2 - textH / 2; }
    nameLayer.translate(pxv(tx - tb.l), pxv(ty - tb.t));
    nameLayer.name = 'NASAQ Social - Name';
    res.nameAdded = true;
  }

  // 5) place, scale and position each icon
  for (i = 0; i < n; i++) {
    key = P.picked[i];
    file = new File(P.assets + '/social-' + P.color + '-' + key + '.png');
    if (!file.exists) { WARN.push('missing ' + key); continue; }
    layer = placeFile(file);
    b = bnds(layer);
    scale = P.size / (b.r - b.l) * 100;
    layer.resize(scale, scale, AnchorPosition.MIDDLECENTER);
    b = bnds(layer);
    step = i * (P.size + P.gap);
    layer.translate(pxv((P.vertical ? sx : sx + step) - b.l), pxv((P.vertical ? sy + step : sy) - b.t));
    layer.name = 'NASAQ Social - ' + SOCIAL_LABEL[key];
    placed.push(layer);
    res.placed++;
  }

  // 6) group everything (cosmetic: icons stay valid if grouping fails)
  try {
    var setL = doc.layerSets.add();
    setL.name = 'NASAQ Social Icons';
    for (i = placed.length - 1; i >= 0; i--) { placed[i].move(setL, ElementPlacement.INSIDE); }
    if (hasName) { nameLayer.move(setL, ElementPlacement.INSIDE); }
  } catch (eG) { WARN.push('group'); }
  return res;
}
