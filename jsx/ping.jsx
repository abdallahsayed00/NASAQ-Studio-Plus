var __res = {};
try {
  __res.ok = true;
  __res.version = String(app.version);
  __res.hasDoc = (app.documents.length > 0);
  if (__res.hasDoc) {
    var __d = app.activeDocument;
    __res.name = String(__d.name);
    __res.W = Number(__d.width.as('px'));
    __res.H = Number(__d.height.as('px'));
  }
} catch (e) { __res = { ok: false, error: 'JSX:' + String(e) }; }
toJSON(__res);
