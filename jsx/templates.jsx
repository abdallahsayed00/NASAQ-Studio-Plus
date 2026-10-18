// Template layer discovery and safe text replacement. Existing non-text layers/effects remain untouched.
function templateLayersWork() {
  var out = [], doc = app.activeDocument;
  function walk(layers, prefix) {
    var i, l, path;
    for (i = 0; i < layers.length; i++) {
      l = layers[i]; path = prefix ? prefix + ' / ' + l.name : l.name;
      if (l.typename === 'LayerSet') walk(l.layers, path);
      else if (l.typename === 'ArtLayer' && l.kind === LayerKind.TEXT) {
        try { out.push({ id: Number(l.id), name: String(l.name), path: path, text: String(l.textItem.contents) }); } catch (e) {}
      }
    }
  }
  walk(doc.layers, '');
  return { ok: true, document: doc.name, layers: out };
}
function templateUpdateWork() {
  var changed = 0, missing = [], updates = P.updates || [];
  function walk(layers) {
    var i, j, l;
    for (i = 0; i < layers.length; i++) {
      l = layers[i];
      if (l.typename === 'LayerSet') walk(l.layers);
      else if (l.typename === 'ArtLayer' && l.kind === LayerKind.TEXT) {
        for (j = 0; j < updates.length; j++) {
          if (Number(l.id) === Number(updates[j].id)) {
            try { l.textItem.contents = String(updates[j].text); changed++; }
            catch (e) { missing.push(String(l.name)); }
            break;
          }
        }
      }
    }
  }
  walk(app.activeDocument.layers);
  return { ok: true, changed: changed, warnings: missing };
}
