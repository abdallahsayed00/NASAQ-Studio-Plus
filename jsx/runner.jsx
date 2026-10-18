var __res = null;
var __oR = app.preferences.rulerUnits, __oT = app.preferences.typeUnits, __oD = app.displayDialogs;
try {
  app.preferences.rulerUnits = Units.PIXELS;
  app.preferences.typeUnits = TypeUnits.PIXELS;
  app.displayDialogs = DialogModes.NO;
  if (app.documents.length === 0) { __res = { ok: false, error: 'NO_DOC' }; }
  else { app.activeDocument.suspendHistory('__HISTORY__', '__res = __ENTRY__()'); }
} catch (e) { __res = { ok: false, error: 'JSX:' + String(e) }; }
try { app.preferences.rulerUnits = __oR; app.preferences.typeUnits = __oT; app.displayDialogs = __oD; } catch (e2) {}
toJSON(__res);
