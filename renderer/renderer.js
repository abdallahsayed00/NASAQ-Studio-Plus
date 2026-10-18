const $ = (id) => document.getElementById(id);
function status(message) { const el = $('status'); el.textContent = message; if (window.NasaqMotion) window.NasaqMotion.statusPulse(el); }
function value(id, fallback = '[Add details if needed]') { const el = $(id); return el && el.value.trim() ? el.value.trim() : fallback; }
function showView(id) {
  if (window.NasaqMotion) window.NasaqMotion.switchView(id);
  else {
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === id));
    const main = document.querySelector('main'); if (main) main.scrollTop = 0;
  }
  status(id === 'homeView' ? 'الرئيسية — اختار الأداة اللي محتاجها.' : id === 'textView' ? 'فعّل بس الخصائص اللي عايزها — اللي مقفول مش هيتلمس.' : id === 'socialView' ? 'اختار الأيقونات واضغط إضافة — لازم يكون التصميم مفتوح في فوتوشوب.' : 'اكتب التفاصيل المتاحة، وبعدها ولّد البرومبت.');
}
function containsArabic(text) { return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text || ''); }
function selectedOrCustom(selectId, customId, fallback) {
  const custom = $(customId)?.value.trim();
  const select = $(selectId);
  const selected = select?.value.trim();
  if (custom) {
    // Match QAYEM behavior: accept free-form descriptions exactly as entered, including Arabic.
    return custom;
  }
  if (selected && selected !== 'custom') {
    const option = select.options[select.selectedIndex];
    return option?.dataset?.en || selected;
  }
  return fallback;
}
function englishValue(id, fallback = '') {
  const el = $(id);
  const raw = el && el.value.trim() ? el.value.trim() : fallback;
  // Match QAYEM behavior: accept user-provided text as-is. Presets remain English; free-form fields may be Arabic or English.
  return raw;
}
function englishSelectedOrCustom(selectId, customId, fallback) {
  return selectedOrCustom(selectId, customId, fallback);
}
function translatedOptional(id) { return englishValue(id, ''); }
function makeDesignPrompt() {
  status("Building the English prompt from presets and your descriptions…");
  const [reaction, colors, hands, clothes, camera, perspective, idea, subject, reference, background, exactText, extra] = [
    englishSelectedOrCustom('designReaction', 'designReactionCustom', 'A natural, clear facial expression that fits the design without exaggeration or identity distortion.'),
    englishSelectedOrCustom('designColors', 'designColorsCustom', 'A cohesive commercial palette with one clear primary color, one supporting secondary color, and readable contrast.'),
    englishSelectedOrCustom('designHands', 'designHandsCustom', 'A natural hand pose that supports the concept, with anatomically correct fingers and joints.'),
    englishSelectedOrCustom('designClothes', 'designClothesCustom', 'Realistic clothing appropriate to the design topic and consistent with the person.'),
    englishSelectedOrCustom('designCamera', 'designCameraCustom', 'A medium shot at eye level, keeping the face clear and proportionate.'),
    englishSelectedOrCustom('designPerspective', 'designPerspectiveCustom', 'The person is the main subject, large and clear, with natural perspective and balanced space for supporting elements.'),
    englishValue('designIdea', 'Create a polished social media visual around the intended subject.'),
    englishValue('designSubject', 'Use the person in Reference Image 1 as the main subject.'),
    englishValue('designReference', 'Reference Image 1 is the only source of the person’s identity. Do not substitute or reinterpret the face.'),
    englishValue('designBackground', 'Create a clean, intentional background that supports the subject and does not compete with the face.'),
    englishValue('designText', ''),
    englishValue('designExtra', '')
  ];
  return `CREATE ONE PHOTOREALISTIC, PREMIUM SOCIAL MEDIA DESIGN\n\n`+
`CANVAS AND OUTPUT:\nCreate exactly one finished social media design at 1350 × 1080 pixels, horizontal 5:4 aspect ratio. This is the final artwork, not a device mockup, poster mockup, collage, or presentation board.\n\n`+
`DESIGN IDEA / CORE MESSAGE:\n${idea}\n\n`+
`REFERENCE IMAGE 1 — PERSON / IDENTITY ONLY:\n${subject}\n${reference}\nUse Reference Image 1 strictly as the identity source for the person. Preserve the same real individual and do not borrow identity traits from any other reference. Do not invent a replacement person.\n\n`+
`ABSOLUTE IDENTITY LOCK — HIGHEST PRIORITY:\nPreserve the person’s recognizable identity and facial geometry as faithfully as the image system permits. Do not redesign, beautify, idealize, stylize, average, reconstruct, or replace the face. Do not change the shape, size, spacing, proportions, or placement of the eyes, eyelids, eyebrows, nose, nostrils, lips, teeth, cheeks, jaw, chin, ears, forehead, hairline, skull shape, or head shape. Preserve natural asymmetry, skin tone, age, skin texture, hairstyle, facial hair, glasses, and all distinctive details. No face swap, face morphing, identity drift, facial feature substitution, artificial age change, plastic skin, or excessive retouching. Lighting, shadows, color grading, lens perspective, and effects must not reshape the face.\nIf the requested expression differs from the reference expression, change only the expression-related muscle movement required to create the requested reaction. Keep the underlying facial structure and identity unchanged. If any instruction conflicts with identity preservation, identity preservation wins; make the requested expression or pose subtler rather than altering the person’s identity.\n\n`+
`FACIAL EXPRESSION / REACTION:\n${reaction}\nThe expression must look physically plausible for this exact person. Keep the person recognizable; do not enlarge eyes, reshape the mouth, alter the nose, or exaggerate facial proportions to communicate the reaction.\n\n`+
`COLOR PALETTE AND COLOR HIERARCHY:\n${colors}\nApply the specified palette intentionally across the background, props, clothing accents, and lighting. Maintain a clear primary-versus-secondary color hierarchy, controlled saturation, readable contrast, and natural skin tones. Do not introduce unrelated dominant colors unless required by the description.\n\n`+
`HAND POSITION / GESTURE:\n${hands}\nFollow the described hand action as literally and accurately as possible. Keep wrist alignment, finger direction, grip, object contact, foreshortening, and joint positions physically coherent. Each visible hand must have five distinct anatomically plausible fingers. Do not add, remove, duplicate, merge, bend unnaturally, or hide fingers in a way that contradicts the requested gesture. Do not invent an object if the description does not request one.\n\n`+
`CLOTHING AND MATERIALS:\n${clothes}\nFollow the clothing description without adding unrequested accessories, logos, patterns, or costume elements. Render realistic fabric weave, seams, folds, thickness, fit, and material response. Clothing changes must not alter body shape, age, or identity.\n\n`+
`MANDATORY CAMERA VIEWPOINT / SHOT TYPE:\n${camera}\nTreat the camera viewpoint as its own independent instruction. Follow the specified angle, height, distance, lens feeling, and crop without silently changing it to accommodate a different pose. Avoid extreme wide-angle distortion of the face unless explicitly requested.\n\n`+
`BODY ANGLE / SUBJECT PERSPECTIVE / PLACEMENT:\n${perspective}\nTreat body orientation and placement independently from the camera viewpoint. Maintain believable anatomy, body proportions, foreshortening, scale, and contact shadows. Do not infer a different head direction, gaze, expression, or hand action from the body angle; each must follow its own instruction above.\n\n`+
`BACKGROUND AND SCENE ELEMENTS:\n${background}\nCreate a coherent scene with convincing depth, foreground/background separation, consistent perspective, physically plausible shadows, and intentional negative space. Every visible element must support the design idea. Do not add unrelated objects, decorative clutter, or extra people unless explicitly requested.\n\n`+
(exactText ? `EXACT TEXT TO INCLUDE:\n${exactText}\nRender this wording exactly as supplied after translation. Do not paraphrase, add words, alter spelling, or invent extra text. If accurate text rendering is not possible, leave a clean intentional area so the wording can be added manually in Photoshop.\n\n` : `TEXT POLICY:\nDo not add any text, letters, numbers, captions, logos, signatures, or watermarks. Leave intentional negative space if the composition benefits from it.\n\n`)+
`ADDITIONAL USER REQUIREMENTS:\n${extra || 'No additional requirements were provided.'}\nFollow every specific detail in this description. Do not omit, replace, embellish, or reinterpret the user's requested elements. When two requirements conflict, preserve identity first, then follow the user's explicit scene and pose details, then apply general art direction.\n\n`+
`LIGHTING, COMPOSITION AND QUALITY CONTROL:\nCreate a cohesive, high-end commercial social media composition with a clear focal hierarchy, controlled cinematic or studio lighting appropriate to the described scene, realistic materials, clean edges, natural shadows, convincing depth, and deliberate negative space. Keep the person prominent and visually integrated into the scene rather than pasted on as a flat cutout. Ensure the camera, body pose, gaze, facial expression, hands, clothing, props, and environment agree physically while retaining their independently specified directions. Avoid generic stock layouts, inconsistent shadows, distorted anatomy, extra limbs, malformed hands, warped glasses, face distortion, artificial skin, excessive glow, clutter, gibberish text, fake logos, and watermarks.\n\n`+
`FINAL PRIORITY ORDER:\n1. Preserve the exact identity and facial structure of the person in Reference Image 1.\n2. Translate and follow the user's descriptions accurately without changing their intended meaning.\n3. Keep camera viewpoint, body angle, gaze, expression, hand gesture, clothing, and perspective as separate controls.\n4. Follow the requested palette, background, and exact text policy.\n5. Deliver one polished final design at exactly 1350 × 1080 pixels.\n\n`+
`LANGUAGE NOTE: Preset choices are supplied in English. Free-form user descriptions are included exactly as entered and may be Arabic or English. Exact artwork wording may be in any language. Do not render these instructions as visible text in the artwork.`;
}
function makeThumbnailPrompt() {
  status("Building the English thumbnail prompt from your descriptions…");
  const ids = ['thumbTopic','thumbPerson','thumbIdentity','thumbReferences','thumbConcept','thumbEnvironment','thumbElements','thumbBlend','thumbPalette','thumbTypography','thumbLayout','thumbAvoid'];
  const fallbacks = {
    thumbIdentity: 'Use the supplied person reference as the one and only identity source.',
    thumbLayout: 'Horizontal 16:9 frame with the person large on one side and a clean, uncluttered area on the other for the title.'
  };
  const vals = {};
  for (const id of ids) vals[id] = englishValue(id, fallbacks[id] || '');
  const pre = {
    reaction: selectedOrCustom('thumbReaction', 'thumbReactionCustom', 'A natural, readable facial expression that fits the topic, produced only by natural muscle movement of the same face.'),
    hands: selectedOrCustom('thumbHands', 'thumbHandsCustom', 'A natural hand pose that supports the concept, with anatomically correct fingers and joints.'),
    clothes: selectedOrCustom('thumbClothes', 'thumbClothesCustom', 'Realistic clothing appropriate to the topic and consistent with the person.'),
    camera: selectedOrCustom('thumbCamera', 'thumbCameraCustom', 'Medium close-up at eye level, keeping the face clear, proportionate and free of lens distortion.'),
    perspective: selectedOrCustom('thumbPerspective', 'thumbPerspectiveCustom', 'The person is large, prominent and close to the camera as the primary focal point.'),
    colors: selectedOrCustom('thumbColors', 'thumbColorsCustom', 'A bold but controlled cinematic palette with one clear primary color and one supporting secondary color.')
  };
  const S = [];
  S.push('CREATE ONE PHOTOREALISTIC, CINEMATIC, SURREAL YOUTUBE THUMBNAIL — PREMIUM ART-DIRECTED QUALITY');
  S.push('OUTPUT FORMAT:\nOne horizontal 16:9 image, target 1920 × 1080 pixels. One coherent three-dimensional scene — not a collage, not a flat cutout montage, not a mockup, not a split screen.');

  S.push('ABSOLUTE IDENTITY LOCK — HIGHEST PRIORITY, NON-NEGOTIABLE:\nReference Image 1 shows the exact individual who must appear in the thumbnail. ' + vals.thumbIdentity + '\n' +
    'Reproduce this individual with exact likeness, as if the same real person were photographed in the new scene. Keep every one of these identical to the reference: head and face shape, forehead, eyebrows (shape, thickness, spacing), eye shape, eye color and eye spacing, eyelids, nose (bridge, width, tip, nostrils), lips and mouth width, philtrum, cheeks, jawline, chin, ears, neck, skin tone and undertone, skin texture, pores, moles, freckles, scars, wrinkles and age lines, hairline, hair color, hair density, hair length and style, facial hair pattern and density, glasses (frame shape, thickness, color, lens shape), apparent age, body build, and natural facial asymmetry.\n' +
    'Strict prohibitions: do not beautify, slim, smooth, retouch, sharpen into a different look, de-age, age, change gender or ethnicity, change skin tone, change hairstyle or hair color, add or remove facial hair or glasses, enlarge or shrink any feature, or replace the face with a generic, idealized or AI-averaged face. Do not blend this person with anyone else. Do not redraw the face in any other artistic style.\n' +
    'If any other instruction (expression, pose, camera angle, lens, lighting, color grade, surreal concept, clothing, effects, or composition) would require changing the face, the identity lock wins and that instruction must be softened or adapted around the face. Expression and head turn may only be produced by natural movement of the same face, with the same bone structure and proportions.');

  S.push('FITTING THE PERSON TO THE DESIGN — WITHOUT CHANGING THE PERSON:\nThe person must feel physically present inside the scene, not pasted on. Achieve this only by adapting the scene to the person and by adjusting light on the person — never by altering the person\'s features or proportions. Match the key light direction, softness and color temperature of the environment; add subtle rim light and color spill from the scene colors onto hair, skin edges and clothing at low strength, keeping the natural skin tone recognizable; add accurate contact shadows and cast shadows; keep depth of field, grain, sharpness and contrast consistent between subject and background; keep clean, natural edges with fine hair detail and no halo, no cut-out outline, no glow artifacts. Scale the person plausibly against props and background.' + (vals.thumbBlend ? '\nAdditional integration notes: ' + vals.thumbBlend : ''));

  S.push('REFERENCE ROLES:\nReference Image 1 — person and identity only. ' + (vals.thumbReferences ? vals.thumbReferences + '\n' : 'If a second reference image is supplied, use it only for clothing or object details, and never borrow its face, body, age or identity. ') + 'Never mix the identities of different references.');

  S.push('VIDEO / LESSON TOPIC:\n' + (vals.thumbTopic || 'Use the supplied lesson topic as the core visual idea.'));
  S.push('CORE SURREAL CONCEPT:\n' + (vals.thumbConcept || 'Build one striking visual metaphor directly connected to the lesson topic.') + '\nMake the surrealism intentional and instantly understandable at a glance through impossible-but-readable scale, spatial relationships or suspended objects, while keeping all materials photorealistic. One main idea only; no competing focal points.');

  S.push('PERSON, BODY AND PLACEMENT:\n' + (vals.thumbPerson || 'The person is the principal focal point, large and close enough to read clearly.'));
  S.push('FACIAL EXPRESSION / REACTION:\n' + pre.reaction + '\nThe expression must be physically plausible for this exact person and must not reshape any facial feature. Keep the eyes clear, sharp and naturally aligned, with a believable gaze and no distortion of the mouth, teeth or eyelids.');
  S.push('HAND POSITION / GESTURE:\n' + pre.hands + '\nFollow the described action literally. Each visible hand must have five distinct, anatomically plausible fingers with coherent wrist alignment, grip, object contact and joints. Do not add, remove, merge, duplicate or hide fingers in a way that contradicts the gesture.');
  S.push('CLOTHING AND MATERIALS:\n' + pre.clothes + '\nNo unrequested accessories, logos, patterns or costume elements. Render realistic fabric weave, seams, folds, thickness and fit. Clothing must not change body shape, age or identity.');

  S.push('MANDATORY CAMERA VIEWPOINT / SHOT TYPE:\n' + pre.camera + '\nFollow the specified angle, height, distance and crop without silently changing it to suit another instruction. Use a natural portrait-lens look; avoid wide-angle distortion of the face.');
  S.push('BODY ANGLE / SUBJECT PERSPECTIVE:\n' + pre.perspective + '\nTreat body orientation independently from the camera, head direction, gaze, expression and hands; each follows its own instruction.');
  S.push('COMPOSITION AND SMALL-SIZE READABILITY:\n' + vals.thumbLayout + '\nDesign for instant readability at small YouTube preview size: a strong silhouette, high subject-to-background contrast, the face large and sharply visible, one clear focal hierarchy, and deliberate negative space. Keep key content away from the extreme edges and away from the bottom-right corner where the video duration badge appears.');

  S.push('ENVIRONMENT / BACKGROUND:\n' + (vals.thumbEnvironment || 'Create a cinematic environment directly related to the topic, with foreground, subject plane and background depth.') + '\nConvincing depth, consistent perspective, physically plausible shadows. Every visible element must support the idea; no unrelated objects, clutter or extra people.');
  S.push('FLOATING ELEMENTS / VISUAL EFFECTS:\n' + (vals.thumbElements || 'Use only elements that support the core concept; avoid random decoration.') + '\nEvery floating or suspended object needs coherent scale, perspective, lighting and purpose, and must never cover or touch the face.');

  S.push('COLOR PALETTE AND COLOR HIERARCHY:\n' + pre.colors + '\nApply the palette intentionally across background, props, lighting and clothing accents with a clear primary-versus-secondary hierarchy, controlled saturation and readable contrast. Keep natural, recognizable skin tones.');
  S.push('LIGHTING:\n' + (vals.thumbPalette || 'A motivated cinematic key light with controlled rim light and clear subject-background separation.') + '\nLighting may be dramatic but must keep the face clearly lit, detailed and recognizable.');

  S.push('THUMBNAIL TITLE / TYPOGRAPHY:\n' + (vals.thumbTypography || 'Do not generate text unless exact wording is explicitly provided; leave a clean, intentional area for typography to be added later in Photoshop.') + '\nRender any supplied wording exactly, with no extra words, symbols, logos or watermarks. If exact text cannot be rendered reliably, leave a clean area instead.');

  S.push('ELEMENTS TO AVOID:\n' + (vals.thumbAvoid || 'Cartoon rendering, flat cutout collage, plastic or over-smoothed skin, changed or generic face, duplicate limbs, malformed hands, extra fingers, fake logos, watermarks, gibberish text, heavy clutter, lens distortion on the face.') + '\nAlso avoid any change to the person\'s facial features, age, skin tone, hair, facial hair or glasses.');

  S.push('PHOTOREALISTIC EXECUTION:\nHigh-end commercial finish: ultra-detailed, tack-sharp focus on the eyes and face, natural skin texture with visible pores, realistic materials, cinematic depth, clean edges, natural contact shadows, and a premium color grade. The person is large, prominent and the clear principal focal point, never a tiny distant portrait.');

  S.push('FINAL QUALITY CHECK BEFORE OUTPUT:\n1. The face matches Reference Image 1 exactly in every feature, age, skin tone, hair, facial hair and glasses.\n2. Hands have five natural fingers each; anatomy and proportions are correct.\n3. The person is lit and grounded by the scene and does not look pasted on.\n4. Expression, gaze, camera angle, body angle, hands and clothing each follow their own instruction.\n5. The palette, background and title policy are followed, and the image reads clearly at small size.\n6. One cinematic, photorealistic 16:9 YouTube thumbnail is delivered.');

  S.push('PRIORITY ORDER:\n(1) Exact identity of the person in Reference Image 1 — never compromised. (2) Follow the user\'s descriptions accurately. (3) Keep camera, body, head/gaze, expression and hands independent and consistent. (4) Seamless integration into the design through lighting and scene only. (5) Palette, background and typography policy.');
  S.push('LANGUAGE NOTE: Preset choices are supplied in English. Free-form descriptions are included as entered and may be Arabic or English. Exact artwork wording may be in any language. Do not render these instructions as visible text in the thumbnail.');
  return S.join('\n\n');
}
async function copyOutput(id) {
  const field = $(id);
  if (!field || !field.value) { status('ولّد البرومبت أولًا.'); return false; }
  const promptText = field.value;

  try {
    if (window.nasaq && window.nasaq.copy) { await window.nasaq.copy(promptText); status('✅ تم نسخ البرومبت بالكامل.'); return true; }
  } catch (err) { console.warn('Electron clipboard failed:', err); }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(promptText); status('✅ تم نسخ البرومبت بالكامل.'); return true; }
  } catch (err) { console.warn('navigator clipboard failed:', err); }

  // Fallback: make the text field editable/focusable and select all text.
  // Selection is visible only if the panel retains focus; the user can then press Ctrl+C.
  try {
    field.removeAttribute('readonly');
    field.focus();
    field.setSelectionRange(0, promptText.length);
    field.scrollTop = 0;
    status('⚠️ النسخ التلقائي غير متاح. البرومبت ظاهر في الخانة؛ اضغط داخلها ثم Ctrl+A وبعدها Ctrl+C.');
  } catch (err) {
    console.warn('Text selection fallback failed:', err);
    status('البرومبت اتولد. اضغط داخل خانته ثم Ctrl+A وبعدها Ctrl+C.');
  }
  return false;
}

/* =====================================================================
   NASAQ Motion — JS-driven animation (driven from JS so every effect is under our control)
   Only animates opacity, top/left, width/height and colors: all UXP-safe.
   ===================================================================== */
const NasaqMotion = (() => {
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const raf = (cb) => (window.requestAnimationFrame ? window.requestAnimationFrame(cb) : setTimeout(() => cb(nowMs()), 16));
  const wait = (ms) => new Promise(r => setTimeout(r, REDUCED ? 0 : ms));
  const E = {
    outCubic: p => 1 - Math.pow(1 - p, 3),
    outExpo: p => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inOutCubic: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outBack: p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    inQuad: p => p * p
  };
  function tween(duration, ease, update) {
    return new Promise(resolve => {
      if (REDUCED || duration <= 0) { update(1); resolve(); return; }
      const t0 = nowMs();
      (function step() {
        const p = Math.min(1, (nowMs() - t0) / duration);
        update(ease(p));
        if (p < 1) raf(step); else resolve();
      })();
    });
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',') + ')'; };

  // ---- entrance helpers -------------------------------------------------
  function prime(el, offset) {
    if (!el) return;
    el.style.position = 'relative';
    el.style.opacity = '0'; el.style.top = offset + 'px';
  }
  function settle(el) { if (!el) return; el.style.opacity = '1'; el.style.top = '0px'; }
  function reveal(els, opts = {}) {
    const { from = 22, dur = 650, gap = 95, delay = 0, ease = E.outExpo } = opts;
    els = els.filter(Boolean);
    els.forEach(el => prime(el, from));
    return Promise.all(els.map((el, i) => wait(delay + i * gap).then(() =>
      tween(dur, ease, e => { el.style.opacity = String(Math.min(1, e * 1.4)); el.style.top = (from * (1 - e)) + 'px'; })
        .then(() => settle(el))
    )));
  }

  // ---- intro: logo pop -> curtain opens -> home cascade ------------------
  async function intro() {
    const curtain = $('curtain'); if (!curtain) return;
    const logo = curtain.querySelector('.logo'), word = curtain.querySelector('.word'), rule = curtain.querySelector('.rule');
    const top = curtain.querySelector('.top'), bottom = curtain.querySelector('.bottom'), stage = curtain.querySelector('.stage');
    const home = $('homeView');
    const homeItems = [
      home.querySelector('.eyebrow'), home.querySelector('h2'), home.querySelector('.welcome p'),
      ...home.querySelectorAll('.tool-card'), home.querySelector('.home-note')
    ];
    homeItems.forEach(el => prime(el, 26));
    if (REDUCED) { homeItems.forEach(settle); curtain.style.display = 'none'; startAmbient(); return; }
    logo.style.position = 'relative';
    const sweepW = () => ($('sweep') && $('sweep').parentElement.offsetWidth) || 400;

    await Promise.all([
      tween(420, E.outBack, e => { const sz = lerp(56, 84, e); logo.style.width = sz + 'px'; logo.style.height = sz + 'px'; logo.style.fontSize = lerp(34, 50, e) + 'px'; logo.style.opacity = String(Math.min(1, e * 2)); logo.style.top = lerp(18, 0, e) + 'px'; }),
      wait(120).then(() => tween(300, E.outCubic, e => { word.style.opacity = String(e); word.style.letterSpacing = lerp(14, 6, e) + 'px'; })),
      wait(180).then(() => tween(340, E.outExpo, e => { rule.style.width = lerp(0, 150, e) + 'px'; }))
    ]);
    await wait(80);

    const cascade = wait(60).then(() => reveal(homeItems, { from: 20, dur: 380, gap: 50 }));
    await Promise.all([
      tween(140, E.outCubic, e => { stage.style.opacity = String(1 - e); }),
      tween(420, E.inOutCubic, e => { top.style.height = (50 * (1 - e)) + '%'; bottom.style.height = (50 * (1 - e)) + '%'; })
    ]);
    curtain.style.display = 'none';
    startAmbient();
    await cascade;
  }

  // ---- ambient loop: header sweep + pulsing dot ---------------------------
  let ambientOn = false, onHome = true;
  function startAmbient() {
    if (ambientOn || REDUCED) return; ambientOn = true;
    const sweep = $('sweep'); if (!sweep) return;
    let W = sweep.parentElement.offsetWidth || 400;
    window.addEventListener('resize', () => { W = sweep.parentElement.offsetWidth || W; });
    const t0 = nowMs();
    (function loop() {
      if (!document.hidden && onHome) {
        const w = W * 0.3, p = ((nowMs() - t0) % 3600) / 3600;
        const x = lerp(-w, W, E.inOutCubic(p));
        const l = Math.max(0, x), r = Math.min(W, x + w);
        sweep.style.left = l + 'px'; sweep.style.width = Math.max(0, r - l) + 'px';
      }
      setTimeout(() => raf(loop), 50);
    })();
  }

  // ---- view switching -----------------------------------------------------
  async function switchView(id) {
    const views = Array.from(document.querySelectorAll('.view'));
    const next = $(id); if (!next) return;
    const main = document.querySelector('main');
    onHome = (id === 'homeView');
    views.forEach(v => v.classList.toggle('active', v === next));
    if (main) main.scrollTop = 0;
    const items = onHome
      ? [next.querySelector('.eyebrow'), next.querySelector('h2'), next.querySelector('.welcome p'), ...next.querySelectorAll('.tool-card'), next.querySelector('.home-note')]
      : [next.querySelector('.back-button'), next.querySelector('.page-heading')];
    reveal(items, { from: 12, dur: 240, gap: 35 });
  }

  // ---- card hover: beige wash + bar grow + arrow nudge --------------------
  function wireCard(card) {
    const wash = card.querySelector('.wash'), bar = card.querySelector('.bar'), arrow = card.querySelector('.card-arrow');
    let token = 0, level = 0;
    const go = (target) => {
      const my = ++token, from = level;
      tween(160, E.outCubic, e => {
        if (my !== token) return;
        level = lerp(from, target, e);
        wash.style.width = (level * 100) + '%'; wash.style.opacity = String(0.1 * level);
        bar.style.width = (4 + 6 * level) + 'px';
        arrow.style.left = (7 * level) + 'px';
      });
    };
    card.addEventListener('mouseenter', () => go(1));
    card.addEventListener('mouseleave', () => go(0));
  }

  // ---- generate button progress + output reveal ---------------------------
  async function progress(button) {
    const fill = button.querySelector('.fill'), label = button.querySelector('.label');
    if (!fill) return;
    fill.style.opacity = '1'; if (label) label.style.color = '#f6efe2';
    await tween(260, E.inOutCubic, e => { fill.style.width = (e * 100) + '%'; });
    await tween(160, E.outCubic, e => { fill.style.opacity = String(1 - e); if (label) label.style.color = mix('#f6efe2', '#3a0f1b', e); });
    fill.style.width = '0'; if (label) label.style.color = '';
  }
  async function flashOutput(id) {
    const el = $(id); if (!el) return;
    await tween(500, E.outCubic, e => { el.style.borderColor = mix('#f6efe2', '#852640', e); el.style.backgroundColor = mix('#4e1424', '#2a0a12', e); });
    el.style.borderColor = ''; el.style.backgroundColor = '';
  }
  function tap(button) {
    tween(160, E.outCubic, e => { button.style.opacity = String(0.55 + 0.45 * e); });
  }
  function statusPulse(el) {
    tween(180, E.outCubic, e => { el.style.opacity = String(0.4 + 0.6 * e); });
  }

  async function init() {
    try {
      document.querySelectorAll('.tool-card').forEach(wireCard);
      await intro();
    } catch (err) {
      console.warn('Motion init failed, showing UI without animation:', err);
      const c = $('curtain'); if (c) c.style.display = 'none';
      document.querySelectorAll('#homeView *').forEach(el => { el.style.opacity = ''; el.style.top = ''; });
    }
  }
  function fadeIn(el) { tween(180, E.outCubic, e => { el.style.opacity = String(e); }).then(() => { el.style.opacity = ''; }); }
  return { init, switchView, progress, flashOutput, tap, statusPulse, fadeIn };
})();
window.NasaqMotion = NasaqMotion;

/* ---------- Social Icons: guides (60px) + centered row on the guide ---------- */
const SOCIAL_ORDER = ['facebook', 'tiktok', 'youtube', 'instagram'];

/* Friendly messages for bridge errors */
function psErrorMessage(r) {
  const e = (r && r.error) || 'UNKNOWN';
  if (e === 'NOT_RUNNING') return 'فوتوشوب مش شغال — افتحه وافتح التصميم الأول، وبعدها جرّب تاني.';
  if (e === 'NO_DOC') return 'مفيش تصميم مفتوح في فوتوشوب — افتح التصميم الأول.';
  if (e === 'NOT_TEXT') return 'الطبقة النشطة مش طبقة نصية — اختار طبقة نص في فوتوشوب.';
  if (e === 'WIN_ONLY') return 'النسخة دي بتشتغل على ويندوز بس.';
  if (e === 'TIMEOUT') return 'فوتوشوب اتأخر في الرد — اتأكد إن مفيش نافذة مفتوحة جواه، وجرّب تاني.';
  if (e === 'COM_FAIL') return 'مقدرتش أتصل بفوتوشوب. اتأكد إن فوتوشوب والبرنامج شغالين بنفس الصلاحيات (الاتنين عاديين أو الاتنين Administrator).';
  return 'تعذّر التنفيذ: ' + e;
}
async function psCall(op, params) {
  if (!window.nasaq || !window.nasaq.ps) return { ok: false, error: 'البرنامج مش شغال داخل Electron' };
  return window.nasaq.ps(op, params);
}

async function addSocialIcons() {
  const picked = SOCIAL_ORDER.filter(k => { const row = document.querySelector('.social-row[data-social="' + k + '"]'); return row && row.classList.contains('on'); });
  if (!picked.length) { status('اختار أيقونة واحدة على الأقل.'); return false; }

  const color = $('socialColor').value || 'white';
  const size = Math.max(24, Math.min(300, parseInt($('socialSize').value, 10) || 72));
  const mode = ($('socialMode') && $('socialMode').value) === 'thumb' ? 'thumb' : 'social';
  const G = mode === 'thumb' ? { top: 80, right: 100, bottom: 80, left: 100, w: 1920, h: 1080 } : { top: 60, right: 60, bottom: 60, left: 60, w: 1350, h: 1080 };
  const gapRaw = parseInt($('socialGap').value, 10);
  const RGB = { white: [255, 255, 255], beige: [234, 223, 202], burgundy: [107, 28, 49], black: [20, 20, 20] }[color] || [255, 255, 255];
  const params = {
    picked, color, size,
    gap: Math.max(0, Math.min(100, isNaN(gapRaw) ? 3 : gapRaw)),
    guides: { top: G.top, right: G.right, bottom: G.bottom, left: G.left },
    vPos: $('socialPos').value || 'bottom',
    hAlign: $('socialAlign').value || 'center',
    vertical: $('socialOrient').value === 'column',
    nameText: ($('socialName').value || '').trim(),
    nameLeft: $('socialNameSide').value === 'left',
    textGap: 12, nameSize: Math.round(size * 0.55), rgb: RGB,
    assets: await window.nasaq.assetsDir()
  };
  status('بكلّم فوتوشوب…');
  const r = await psCall('social', params);
  if (!r.ok) { status(psErrorMessage(r)); return false; }
  const note = (r.W === G.w && r.H === G.h) ? '' : ' (تنبيه: مقاس التصميم ' + r.W + '×' + r.H + ' مش ' + G.w + '×' + G.h + ')';
  if (params.nameText && !r.nameAdded) status('⚠️ اتضافت الأيقونات لكن الاسم متضافش' + note);
  else status('✅ اتضافت ' + r.placed + ' أيقونات' + (params.nameText ? ' مع الاسم' : '') + ' على الجايد' + note + '.');
  return true;
}

/* ---------- Text Studio: opt-in styling — nothing is applied unless the designer enables it ---------- */
const TXT_KEYS = ['font', 'size', 'color', 'tracking', 'align', 'stroke', 'shadow', 'glow', 'place'];
const TXT_LABEL = { font: 'الخط', size: 'الحجم', color: 'اللون', tracking: 'المسافة بين الحروف', align: 'المحاذاة', stroke: 'ستروك', shadow: 'ظل', glow: 'توهج', place: 'التوسيط' };
const TXT_STORE_KEY = 'nasaqTextStyles';
const txtMem = {};
function txtStoreRead() {
  try { const raw = window.localStorage && window.localStorage.getItem(TXT_STORE_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  return txtMem[TXT_STORE_KEY] ? JSON.parse(txtMem[TXT_STORE_KEY]) : {};
}
function txtStoreWrite(obj) {
  const raw = JSON.stringify(obj);
  txtMem[TXT_STORE_KEY] = raw;
  try { window.localStorage && window.localStorage.setItem(TXT_STORE_KEY, raw); } catch (e) {}
}
const txtOptEl = (k) => document.querySelector('.opt[data-opt="' + k + '"]');
const txtIsOn = (k) => { const e = txtOptEl(k); return !!(e && e.classList.contains('on')); };
function txtSetOn(k, on) {
  const e = txtOptEl(k); if (!e) return;
  e.classList.toggle('on', !!on);
  const tag = e.querySelector('.opt-tag'); if (tag) tag.textContent = on ? 'متفعّل' : 'مقفول';
}
function txtSummary() {
  const on = TXT_KEYS.filter(txtIsOn);
  $('txtSummary').textContent = on.length ? 'هيتطبق بس: ' + on.map(k => TXT_LABEL[k]).join(' · ') + '. أي حاجة تانية مش هتتلمس.' : 'مفيش حاجة متفعّلة — مش هيتغير أي شيء.';
}
function txtSwatches() {
  document.querySelectorAll('.swatch').forEach(sw => {
    const v = ($(sw.dataset.for).value || '').trim();
    if (/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.test(v)) sw.style.backgroundColor = v.charAt(0) === '#' ? v : '#' + v;
  });
}
function txtHex(id) {
  let v = ($(id).value || '').trim().replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(v)) v = v.split('').map(ch => ch + ch).join('');
  if (!/^[0-9a-f]{6}$/i.test(v)) return null;
  return { hex: v.toLowerCase(), r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
}
const txtNum = (id, def, min, max) => { const n = parseFloat($(id).value); return Math.max(min, Math.min(max, isNaN(n) ? def : n)); };
function txtCollect() {   // read only what is enabled
  const cfg = {}; const bad = [];
  if (txtIsOn('font')) { const f = ($('txtFont').value || '').trim(); if (f) cfg.font = f; else bad.push('اسم الخط'); }
  if (txtIsOn('size')) cfg.size = txtNum('txtSize', 72, 4, 1500);
  if (txtIsOn('color')) { const c = txtHex('txtColor'); if (c) cfg.color = c; else bad.push('لون الخط'); }
  if (txtIsOn('tracking')) cfg.tracking = txtNum('txtTracking', 0, -200, 1000);
  if (txtIsOn('align')) cfg.align = $('txtAlign').value;
  if (txtIsOn('stroke')) { const c = txtHex('txtStrokeColor'); if (c) cfg.stroke = { size: txtNum('txtStrokeSize', 6, 1, 250), color: c }; else bad.push('لون الستروك'); }
  if (txtIsOn('shadow')) { const c = txtHex('txtShadowColor'); if (c) cfg.shadow = { color: c, opacity: txtNum('txtShadowOpacity', 75, 0, 100), angle: txtNum('txtShadowAngle', 120, -180, 180), dist: txtNum('txtShadowDist', 8, 0, 250), size: txtNum('txtShadowSize', 12, 0, 250) }; else bad.push('لون الظل'); }
  if (txtIsOn('glow')) { const c = txtHex('txtGlowColor'); if (c) cfg.glow = { color: c, opacity: txtNum('txtGlowOpacity', 75, 0, 100), size: txtNum('txtGlowSize', 20, 0, 250) }; else bad.push('لون التوهج'); }
  if (txtIsOn('place')) cfg.place = $('txtPlace').value;
  return { cfg, bad };
}

async function applyTextStudio() {
  const { cfg, bad } = txtCollect();
  if (bad.length) { status('راجع القيم دي: ' + bad.join('، ') + ' (اللون لازم يكون Hex زي #ffffff).'); return false; }
  const mode = $('txtTarget').value;
  const text = ($('txtContent').value || '').trim();
  if (mode === 'selected' && !Object.keys(cfg).length) { status('فعّل خاصية واحدة على الأقل، عشان مفيش حاجة هتتغير.'); return false; }
  if (mode === 'new' && !text) { status('اكتب النص الأول.'); return false; }
  status('بكلّم فوتوشوب…');
  const r = await psCall('text', { mode, text, cfg });
  if (!r.ok) { status(psErrorMessage(r)); return false; }
  const w = r.warnings || [];
  status(w.length ? '⚠️ اتطبق، لكن تعذّر: ' + w.slice(0, 3).join('، ') : '✅ اتطبق — اللي فعّلته بس.');
  return true;
}

/* saved styles (the designer's own library — empty until they add one) */
function txtSnapshot() {
  const snap = { opts: {}, vals: {} };
  TXT_KEYS.forEach(k => { snap.opts[k] = txtIsOn(k); });
  document.querySelectorAll('#textView .opt-body [id]').forEach(el => { snap.vals[el.id] = el.value; });
  return snap;
}
function txtLoadSnapshot(snap) {
  TXT_KEYS.forEach(k => txtSetOn(k, !!(snap.opts && snap.opts[k])));
  Object.keys(snap.vals || {}).forEach(id => { const el = $(id); if (el) el.value = snap.vals[id]; });
  txtSwatches(); txtSummary();
}
function txtRenderStyles() {
  const box = $('txtStyleList'); const all = txtStoreRead(); const names = Object.keys(all);
  box.textContent = '';
  if (!names.length) { const p = document.createElement('div'); p.className = 'style-empty'; p.textContent = 'لسه مفيش ستايلات محفوظة.'; box.appendChild(p); return; }
  names.forEach(n => {
    const row = document.createElement('div'); row.className = 'style-row';
    const load = document.createElement('button'); load.className = 'load'; load.textContent = n;
    load.addEventListener('click', () => { txtLoadSnapshot(all[n]); status('اتحمّل ستايل "' + n + '" — راجعه واضغط تطبيق.'); });
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '×';
    del.addEventListener('click', () => { const cur = txtStoreRead(); delete cur[n]; txtStoreWrite(cur); txtRenderStyles(); status('اتمسح ستايل "' + n + '".'); });
    row.appendChild(load); row.appendChild(del); box.appendChild(row);
  });
}

function initTextStudio() {
  document.querySelectorAll('.opt-head').forEach(head => head.addEventListener('click', () => {
    const k = head.dataset.toggle; const on = !txtIsOn(k);
    txtSetOn(k, on); txtSummary();
    if (on && window.NasaqMotion) NasaqMotion.fadeIn(txtOptEl(k).querySelector('.opt-body'));
  }));
  document.querySelectorAll('.swatch').forEach(sw => $(sw.dataset.for).addEventListener('input', txtSwatches));
  $('txtTarget').addEventListener('change', () => { $('txtContentWrap').style.display = $('txtTarget').value === 'new' ? 'block' : 'none'; });
  $('txtSaveBtn').addEventListener('click', () => {
    const name = ($('txtStyleName').value || '').trim();
    if (!name) { status('اكتب اسم للستايل الأول.'); return; }
    if (!TXT_KEYS.some(txtIsOn)) { status('فعّل خاصية واحدة على الأقل قبل الحفظ.'); return; }
    const all = txtStoreRead(); all[name] = txtSnapshot(); txtStoreWrite(all); txtRenderStyles(); status('✅ اتحفظ ستايل "' + name + '".');
  });
  $('txtApplyBtn').addEventListener('click', async () => {
    const button = $('txtApplyBtn'); button.disabled = true;
    const bar = NasaqMotion.progress(button);
    try { await applyTextStudio(); }
    catch (err) { console.error('Text Studio failed:', err); status('تعذّر التطبيق: ' + (err.message || err)); }
    finally { await bar; button.disabled = false; }
  });
  txtSwatches(); txtSummary(); txtRenderStyles();
}

// ---------- Font Library: read Photoshop's own font collection and apply PostScript font names ----------
let nasaqFonts = [];
let selectedNasaqFont = null;
function renderFontList() {
  const query = (($('fontSearch') && $('fontSearch').value) || '').trim().toLowerCase();
  const list = $('fontList'); if (!list) return;
  list.textContent = '';
  const filtered = nasaqFonts.filter(f => (f.family + ' ' + f.name + ' ' + f.postScriptName + ' ' + f.style).toLowerCase().includes(query));
  const textFont = $('txtFont');
  if (textFont) {
    const current = textFont.value;
    textFont.textContent = '';
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = nasaqFonts.length ? 'اختار خطًا من القائمة…' : 'اضغط ↻ لتحميل خطوط Photoshop'; textFont.appendChild(placeholder);
    nasaqFonts.forEach(font => { const option = document.createElement('option'); option.value = font.postScriptName || font.name || font.family; option.textContent = `${font.family || font.name}${font.style ? ' — ' + font.style : ''}`; option.style.fontFamily = '"' + String(font.family || '').replace(/"/g, '') + '", sans-serif'; textFont.appendChild(option); });
    if (current && Array.from(textFont.options).some(option => option.value === current)) textFont.value = current;
  }
  $('fontCount').textContent = nasaqFonts.length ? `${filtered.length} من ${nasaqFonts.length} خط` : 'اضغط تحديث لقراءة الخطوط من Photoshop.';
  if (!filtered.length) { const empty = document.createElement('div'); empty.className = 'style-empty'; empty.textContent = nasaqFonts.length ? 'مفيش خطوط مطابقة للبحث.' : 'قائمة الخطوط لم تُحمّل بعد.'; list.appendChild(empty); return; }
  filtered.slice(0, 250).forEach(font => {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'font-row' + (selectedNasaqFont && selectedNasaqFont.postScriptName === font.postScriptName ? ' selected' : '');
    const sample = document.createElement('span'); sample.className = 'font-row-sample'; sample.textContent = ($('fontPreviewText').value || 'Aa نسق').slice(0, 34); sample.style.fontFamily = '"' + String(font.family).replace(/"/g, '') + '", sans-serif';
    const details = document.createElement('span'); details.className = 'font-row-details';
    const family = document.createElement('b'); family.textContent = font.family || font.name;
    const ps = document.createElement('small'); ps.textContent = font.postScriptName || font.name;
    details.append(family, ps); btn.append(sample, details);
    btn.addEventListener('click', () => {
      selectedNasaqFont = font; $('fontPostScript').value = font.postScriptName || font.name;
      const textFont = $('txtFont'); if (textFont) textFont.value = font.postScriptName || font.name;
      $('fontPreview').textContent = $('fontPreviewText').value || 'نسق — NASAQ Studio'; $('fontPreview').style.fontFamily = '"' + String(font.family).replace(/"/g, '') + '", sans-serif';
      renderFontList();
    });
    list.appendChild(btn);
  });
  if (filtered.length > 250) { const note = document.createElement('div'); note.className = 'style-empty'; note.textContent = 'يتم عرض أول 250 نتيجة. استخدم البحث للوصول لخط معين.'; list.appendChild(note); }
}
async function refreshNasaqFonts() {
  const b = $('fontRefreshBtn'); if (b) b.disabled = true;
  try {
    const r = await psCall('fonts', {});
    if (!r || !r.ok) { status('مش قادر أقرأ الخطوط من Photoshop. افتحه وجرب تاني.'); return; }
    nasaqFonts = Array.isArray(r.fonts) ? r.fonts : [];
    renderFontList(); status(`تم تحميل ${nasaqFonts.length} خط من Photoshop.`);
  } catch (e) { status('تعذرت قراءة الخطوط: ' + (e.message || e)); }
  finally { if (b) b.disabled = false; }
}
async function applyNasaqFont() {
  if (!selectedNasaqFont) { status('اختار خط من القائمة الأول.'); return; }
  const b = $('fontApplyBtn'); b.disabled = true;
  try {
    const r = await psCall('text', { mode: 'selected', text: '', cfg: { font: selectedNasaqFont.postScriptName || selectedNasaqFont.name } });
    if (r && r.ok) status('تم تطبيق الخط على طبقة النص المحددة.' + (r.warnings && r.warnings.length ? ' تحذير: ' + r.warnings.join('، ') : ''));
    else status(psErrorMessage(r));
  } catch (e) { status('تعذّر تطبيق الخط: ' + (e.message || e)); }
  finally { b.disabled = false; }
}

// ---------- Template Library: PSD files plus text-only editing in the active Photoshop document ----------
let nasaqTemplateItems = [];
let nasaqTemplateLayers = [];
function renderTemplateList() {
  const box = $('templateList'); if (!box) return; box.textContent = '';
  if (!nasaqTemplateItems.length) { const e = document.createElement('div'); e.className = 'style-empty'; e.textContent = 'لسه مفيش قوالب. استورد ملف PSD للبدء.'; box.appendChild(e); return; }
  nasaqTemplateItems.forEach(item => {
    const row = document.createElement('div'); row.className = 'template-row';
    const open = document.createElement('button'); open.className = 'load'; open.textContent = 'فتح في Photoshop · ' + item.name;
    open.addEventListener('click', async () => {
      open.disabled = true;
      try { const r = await psCall('openTemplate', { path: item.path }); if (r && r.ok) { status('اتفتح القالب في Photoshop.'); $('templateDocument').textContent = 'المستند المفتوح: ' + r.name + ' — اقرأ طبقات النص لتعديلها.'; await readTemplateLayers(); } else status(psErrorMessage(r)); }
      catch (e) { status('تعذر فتح القالب: ' + (e.message || e)); }
      finally { open.disabled = false; }
    });
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '×'; del.title = 'إزالة من المكتبة';
    del.addEventListener('click', async () => { const r = await window.nasaq.removeTemplate(item.name); if (r && r.ok) { await refreshTemplateList(); status('تمت إزالة القالب من المكتبة. ملف PSD الأصلي خارج المكتبة لا يتأثر.'); } });
    row.append(open, del); box.appendChild(row);
  });
}
async function refreshTemplateList() {
  if (!window.nasaq || !window.nasaq.listTemplates) return;
  try { nasaqTemplateItems = await window.nasaq.listTemplates(); renderTemplateList(); }
  catch (e) { status('تعذر قراءة مكتبة القوالب: ' + (e.message || e)); }
}
async function importNasaqTemplates() {
  const b = $('templateImportBtn'); b.disabled = true;
  try { const r = await window.nasaq.importTemplates(); if (r && r.ok && !r.canceled) { await refreshTemplateList(); status('تم استيراد ملفات PSD إلى مكتبة NASAQ.'); } }
  catch (e) { status('تعذر استيراد القوالب: ' + (e.message || e)); }
  finally { b.disabled = false; }
}
function renderTemplateLayers() {
  const box = $('templateLayers'); box.textContent = '';
  if (!nasaqTemplateLayers.length) { const e = document.createElement('div'); e.className = 'style-empty'; e.textContent = 'ملقيناش طبقات نص في المستند المفتوح.'; box.appendChild(e); return; }
  nasaqTemplateLayers.forEach(layer => {
    const wrap = document.createElement('div'); wrap.className = 'template-layer';
    const label = document.createElement('label'); label.textContent = layer.path || layer.name;
    const input = document.createElement('textarea'); input.rows = 2; input.value = layer.text; input.dir = 'auto'; input.dataset.layerId = String(layer.id); input.dataset.original = layer.text;
    wrap.append(label, input); box.appendChild(wrap);
  });
}
async function readTemplateLayers() {
  const r = await psCall('layers', {});
  if (!r || !r.ok) { status(psErrorMessage(r)); return; }
  nasaqTemplateLayers = Array.isArray(r.layers) ? r.layers : [];
  $('templateDocument').textContent = 'المستند المفتوح: ' + r.document + ' · ' + nasaqTemplateLayers.length + ' طبقة نص';
  renderTemplateLayers(); status('تمت قراءة طبقات النص. عدّل الخانات اللي محتاجها فقط.');
}
async function applyTemplateText() {
  const updates = Array.from(document.querySelectorAll('#templateLayers textarea')).filter(el => el.value !== el.dataset.original).map(el => ({ id: Number(el.dataset.layerId), text: el.value }));
  if (!updates.length) { status('مفيش نصوص اتغيرت. عدّل خانة واحدة على الأقل.'); return; }
  const b = $('templateApplyBtn'); b.disabled = true;
  try { const r = await psCall('templateUpdate', { updates }); if (r && r.ok) { status(`تم تحديث ${r.changed} طبقة نص فقط.` + (r.warnings && r.warnings.length ? ' تعذّر تحديث: ' + r.warnings.join('، ') : '')); await readTemplateLayers(); } else status(psErrorMessage(r)); }
  catch (e) { status('تعذر تطبيق النصوص: ' + (e.message || e)); }
  finally { b.disabled = false; }
}


function showStyleLibrary(panel) {
  const allowed = ['saved', 'fonts', 'templates'];
  if (!allowed.includes(panel)) panel = 'saved';
  document.querySelectorAll('[data-style-tab]').forEach(button => {
    const active = button.dataset.styleTab === panel;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('[data-style-panel]').forEach(section => {
    const active = section.dataset.stylePanel === panel;
    section.classList.toggle('active', active);
    section.hidden = !active;
  });
  if (panel === 'fonts' && !nasaqFonts.length) refreshNasaqFonts();
  if (panel === 'templates') refreshTemplateList();
}

/* ---------- Account approval and license gate ---------- */
let nasaqAuthMode = 'login';
let nasaqAuthVerified = false;
function authMessage(message, kind='') { const el=$('authMessage'); if(!el)return; el.textContent=message; el.className='auth-message'+(kind?' '+kind:''); }
function setAuthGate(locked, message) {
  const gate=$('authGate'); if(gate) gate.hidden=!locked; if(message) authMessage(message);
  document.querySelectorAll('[data-open], [data-home], #txtApplyBtn, #socialAddBtn, #designPromptBtn, #thumbPromptBtn').forEach(el=>{
    if(locked){ if(el.dataset.authWasDisabled===undefined) el.dataset.authWasDisabled=el.disabled?'1':'0'; el.disabled=true; }
    else if(el.dataset.authWasDisabled!==undefined){ el.disabled=el.dataset.authWasDisabled==='1'; delete el.dataset.authWasDisabled; }
  });
}
function setAuthMode(mode){ nasaqAuthMode=mode==='register'?'register':'login'; document.querySelectorAll('[data-auth-mode]').forEach(b=>b.classList.toggle('active',b.dataset.authMode===nasaqAuthMode)); $('authNameWrap').hidden=nasaqAuthMode!=='register'; $('authName').required=nasaqAuthMode==='register'; $('authPassword').autocomplete=nasaqAuthMode==='register'?'new-password':'current-password'; $('authSubmit').querySelector('.label').textContent=nasaqAuthMode==='register'?'إرسال طلب إنشاء الحساب':'تسجيل الدخول'; authMessage(nasaqAuthMode==='register'?'بعد التسجيل، الإدارة لازم توافق على الحساب وتفعّل الترخيص.':'سجّل الدخول بحساب فعّله مسؤول NASAQ.'); }
async function refreshAuthGate(){
  if(!nasaqAuthVerified && $('payGate').hidden) setAuthGate(true,'جارٍ التحقق من الحساب والترخيص…');
  if(!window.nasaq?.authStatus){nasaqAuthVerified=false;setAuthGate(true,'نسخة البرنامج لا تحتوي على وحدة التراخيص. حدّث النسخة.');authMessage('نسخة البرنامج لا تحتوي على وحدة التراخيص. حدّث النسخة.','error');return;}
  const r=await window.nasaq.authStatus();
  if(r&&r.ok&&r.authenticated){nasaqAuthVerified=true;$('payGate').hidden=true;setAuthGate(false);const out=$('accountLogoutBtn');if(out)out.hidden=false;return;}
  if(r&&r.stage==='payment'&&r.account){nasaqAuthVerified=false;setAuthGate(true);$('authGate').hidden=true;$('authPassword').value='';showPayGate(r.account);const out=$('accountLogoutBtn');if(out)out.hidden=true;return;}
  $('payGate').hidden=true;
  nasaqAuthVerified=false;setAuthGate(true,r?.error||'سجّل الدخول للمتابعة.');const out=$('accountLogoutBtn');if(out)out.hidden=true;authMessage(r?.error||'سجّل الدخول للمتابعة.');
}
function initAuth(){
  document.querySelectorAll('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>setAuthMode(b.dataset.authMode)));
  $('authForm').addEventListener('submit',async e=>{
    e.preventDefault(); const btn=$('authSubmit');btn.disabled=true;authMessage('جارٍ الاتصال بخادم التراخيص…');
    const payload={name:$('authName').value.trim(),email:$('authEmail').value.trim(),password:$('authPassword').value};
    try{
      const r=nasaqAuthMode==='register'?await window.nasaq.authRegister(payload):await window.nasaq.authLogin(payload);
      if(r?.ok&&nasaqAuthMode==='register'){const success='تم إنشاء حسابك ✓ سجّل الدخول دلوقتي وهتفتحلك صفحة اختيار الباقة والدفع.';setAuthMode('login');authMessage(success,'success');return;}
      if(r?.ok&&r.token){await refreshAuthGate();if(!$('authGate').hidden)$('authPassword').value='';return;}
      authMessage(r?.error||r?.message||'تعذر إتمام الطلب.', 'error');
    }catch(err){authMessage('تعذر الاتصال بخادم التراخيص. تأكد من إعداد عنوان الخادم والإنترنت. '+(err.message||''),'error');}
    finally{btn.disabled=false;}
  });
  setAuthMode('login');
  const logout=$('accountLogoutBtn'); if(logout) logout.addEventListener('click',async()=>{await window.nasaq.authLogout();nasaqAuthVerified=false;setAuthGate(true,'تم تسجيل الخروج. سجّل الدخول للمتابعة.');logout.hidden=true;setAuthMode('login');});
  initPayGate();
  refreshAuthGate();
}

/* ---------- Payment page: pending / unlicensed accounts pick a plan, pay by Vodafone Cash and upload the receipt ---------- */
const payState={plan:'',proof:'',plans:[],number:'',busy:false,editing:false};
const egp=n=>Number(n).toLocaleString('en-US');
const planPrice=p=>p.kind==='lifetime'?egp(p.price)+' ج.م · مرة واحدة':p.months===1?egp(p.price)+' ج.م / شهر':egp(p.price)+' ج.م / سنة';
const planSub=p=>p.kind==='lifetime'?'ادفع مرة واحدة واستخدم البرنامج على طول':p.months===1?'تجديد شهري':'12 شهر من الاستخدام';
function payMsg(text,kind=''){const el=$('payMessage');if(!el)return;el.textContent=text||'';el.className='auth-message'+(kind?' '+kind:'')}
function renderPlans(){
  const list=$('planList');list.innerHTML='';
  const monthly=payState.plans.find(p=>p.id==='monthly'),yearly=payState.plans.find(p=>p.id==='yearly');
  payState.plans.forEach(p=>{
    const b=document.createElement('button');b.type='button';b.className='plan-card'+(payState.plan===p.id?' selected':'');b.dataset.plan=p.id;
    const save=(p.id==='yearly'&&monthly)?monthly.price*12-yearly.price:0;
    const left=document.createElement('span');left.className='plan-copy';
    const title=document.createElement('b');title.textContent='الباقة '+p.label;left.appendChild(title);
    const sub=document.createElement('small');sub.textContent=planSub(p)+(save>0?' · وفّر '+egp(save)+' ج.م مقارنة بالشهري':'');left.appendChild(sub);
    const price=document.createElement('span');price.className='price';price.textContent=planPrice(p);
    b.appendChild(left);b.appendChild(price);
    b.addEventListener('click',()=>{payState.plan=p.id;renderPlans();updatePayHint();});
    list.appendChild(b);
  });
}
function updatePayHint(){
  const p=payState.plans.find(x=>x.id===payState.plan);
  $('payAmountHint').textContent=p?'المبلغ المطلوب: '+egp(p.price)+' ج.م ('+'الباقة '+p.label+')':'اختار باقة عشان يظهر المبلغ المطلوب.';
}
function showPayGate(acc){
  const gate=$('payGate');const first=gate.hidden;gate.hidden=false;
  $('payWho').textContent='أهلًا '+(acc.user?.name||'')+' — '+(acc.user?.email||'');
  payState.number=(acc.payment&&acc.payment.number)||'';
  if(first||JSON.stringify(acc.plans)!==JSON.stringify(payState.plans)){payState.plans=acc.plans||[];renderPlans();updatePayHint();}
  $('payNumber').textContent=payState.number||'لسه متضبطش — كلمنا على فيسبوك';
  $('payCopyBtn').disabled=!payState.number;
  const req=acc.request,box=$('payStatusBox'),flow=$('payFlow');
  box.hidden=true;box.className='pay-status';
  if(req&&req.status==='pending'&&!payState.editing){
    const pl=payState.plans.find(x=>x.id===req.plan);
    box.hidden=false;box.className='pay-status wait';
    box.innerHTML='';const t=document.createElement('b');t.textContent='✓ استلمنا إيصال الدفع';box.appendChild(t);
    const d=document.createElement('span');d.textContent='باقة '+(pl?pl.label:req.plan)+' — '+egp(req.amount)+' ج.م. الطلب قيد المراجعة، وأول ما نتأكد من التحويل بنفعّل حسابك والبرنامج هيفتح لوحده (سيب النافذة مفتوحة أو افتحها بعد شوية).';box.appendChild(d);
    const again=document.createElement('button');again.type='button';again.className='pay-link';again.textContent='رفعت صورة غلط؟ ابعت إيصال جديد';again.addEventListener('click',()=>{payState.editing=true;showPayGate(acc)});box.appendChild(again);
    flow.hidden=true;
  }else{
    flow.hidden=false;
    if(req&&req.status==='rejected'){box.hidden=false;box.className='pay-status bad';box.textContent='الإيصال السابق اترفض'+(req.adminNote?': '+req.adminNote:'')+'. ارفع إيصال جديد من فضلك.';}
    else if(acc.user&&acc.user.status==='pending'){box.hidden=false;box.className='pay-status';box.textContent='حسابك اتسجّل ✓ كمّل الدفع عشان يتفعّل.';}
  }
  $('paySubmit').disabled=payState.busy;
}
function compressImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      try{
        const max=2000,k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
        const w=Math.max(1,Math.round(img.naturalWidth*k)),h=Math.max(1,Math.round(img.naturalHeight*k));
        const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);
        let q=.88,out=c.toDataURL('image/jpeg',q);while(out.length>2.4e6&&q>.4){q-=.1;out=c.toDataURL('image/jpeg',q);}
        URL.revokeObjectURL(url);resolve(out);
      }catch(e){URL.revokeObjectURL(url);reject(e)}
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('تعذر قراءة الصورة. جرّب صورة تانية.'))};
    img.src=url;
  });
}
async function submitPayment(){
  if(payState.busy)return;
  if(!payState.plan)return payMsg('اختار الباقة الأول.','error');
  if(!payState.number)return payMsg('رقم الدفع لسه متضبطش. كلمنا على فيسبوك.','error');
  if(!payState.proof)return payMsg('ارفع صورة سكرين التحويل.','error');
  payState.busy=true;$('paySubmit').disabled=true;payMsg('جارٍ إرسال الإيصال…');
  try{
    const r=await window.nasaq.submitPayment({plan:payState.plan,proof:payState.proof,senderPhone:$('payPhone').value.trim()});
    if(r&&r.ok){payState.proof='';payState.editing=false;$('payPreview').hidden=true;$('payPreview').removeAttribute('src');$('payDropText').textContent='اضغط هنا واختار صورة السكرين';$('payDrop').classList.remove('has-file');payMsg(r.message||'تم الإرسال.','success');payState.busy=false;await refreshAuthGate();return;}
    payMsg((r&&r.error)||'تعذر إرسال الإيصال. حاول تاني.','error');
  }catch(e){payMsg('تعذر الاتصال بالخادم. '+(e.message||''),'error');}
  payState.busy=false;$('paySubmit').disabled=false;
}
function initPayGate(){
  const file=$('payFile');
  file.addEventListener('change',async()=>{
    const f=file.files&&file.files[0];if(!f)return;
    if(!/^image\//.test(f.type)){payMsg('اختار ملف صورة (PNG أو JPG).','error');file.value='';return;}
    try{
      payMsg('جارٍ تجهيز الصورة…');payState.proof=await compressImage(f);
      const pv=$('payPreview');pv.src=payState.proof;pv.hidden=false;$('payDropText').textContent='✓ '+f.name+' — اضغط لتغيير الصورة';$('payDrop').classList.add('has-file');payMsg('');
    }catch(e){payState.proof='';payMsg(e.message||'تعذر قراءة الصورة.','error');}
    file.value='';
  });
  $('paySubmit').addEventListener('click',submitPayment);
  $('payCopyBtn').addEventListener('click',async()=>{if(!payState.number)return;try{await window.nasaq.copy(payState.number);payMsg('تم نسخ الرقم ✓','success');}catch(_){}});
  $('payRefreshBtn').addEventListener('click',async()=>{payMsg('جارٍ التحديث…');await refreshAuthGate();if(!$('payGate').hidden)payMsg('الحالة محدّثة.');});
  $('payLogoutBtn').addEventListener('click',async()=>{await window.nasaq.authLogout();nasaqAuthVerified=false;payState.plan='';payState.proof='';payState.editing=false;$('payGate').hidden=true;setAuthGate(true);setAuthMode('login');authMessage('تم تسجيل الخروج. سجّل الدخول للمتابعة.');});
  document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[data-ext]');if(!a)return;e.preventDefault();if(window.nasaq&&window.nasaq.openExternal)window.nasaq.openExternal(a.href);});
  window.setInterval(()=>{if(!$('payGate').hidden&&!payState.busy)refreshAuthGate();},12000);
}

function init() {
  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => showView(button.dataset.open)));
  document.querySelectorAll('[data-style-tab]').forEach(button => button.addEventListener('click', () => showStyleLibrary(button.dataset.styleTab)));
  showStyleLibrary('saved');
  document.querySelectorAll('[data-home]').forEach(button => button.addEventListener('click', () => showView('homeView')));
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', () => { NasaqMotion.tap(button); copyOutput(button.dataset.copy); }));
  $('designPromptBtn').addEventListener('click', async () => {
    const button = $('designPromptBtn'); button.disabled = true;
    const bar = NasaqMotion.progress(button);
    try { const output = $('designPromptOutput'); output.value = makeDesignPrompt(); await bar; NasaqMotion.flashOutput('designPromptOutput'); await copyOutput('designPromptOutput'); }
    catch (err) { console.error('Prompt generation failed:', err); status(`تعذر توليد البرومبت. التفاصيل: ${err.message || err}`); }
    finally { button.disabled = false; }
  });
  document.querySelectorAll('.social-row').forEach(row => row.addEventListener('click', () => { row.classList.toggle('on'); NasaqMotion.tap(row); }));
  const chip = () => { const t = $('socialMode').value === 'thumb'; $('socialChipLabel').textContent = t ? 'ثامبنيل يوتيوب · الجايد لاين (فوق / يمين / تحت / شمال)' : 'مقاس التصميم · الجايد لاين'; $('socialChipValue').textContent = t ? '1920 × 1080 px · 80 / 100 / 80 / 100' : '1350 × 1080 px · 60 px'; };
  $('socialMode').addEventListener('change', chip);
  $('socialAddBtn').addEventListener('click', async () => {
    const button = $('socialAddBtn'); button.disabled = true;
    const bar = NasaqMotion.progress(button);
    try { await addSocialIcons(); }
    catch (err) { console.error('Social icons failed:', err); status('تعذرت الإضافة: ' + (err.message || err)); }
    finally { await bar; button.disabled = false; }
  });
  $('thumbPromptBtn').addEventListener('click', async () => {
    const button = $('thumbPromptBtn'); button.disabled = true;
    const bar = NasaqMotion.progress(button);
    try { $('thumbPromptOutput').value = makeThumbnailPrompt(); await bar; NasaqMotion.flashOutput('thumbPromptOutput'); await copyOutput('thumbPromptOutput'); }
    catch (err) { console.error('Thumbnail prompt generation failed:', err); status(`تعذر توليد البرومبت. التفاصيل: ${err.message || err}`); }
    finally { button.disabled = false; }
  });
  $('fontRefreshBtn').addEventListener('click', refreshNasaqFonts);
  $('txtFontRefreshBtn').addEventListener('click', refreshNasaqFonts);
  $('openFontLibraryBtn').addEventListener('click', () => { showStyleLibrary('fonts'); $('fontSearch').focus(); });
  $('fontSearch').addEventListener('input', renderFontList);
  $('fontPreviewText').addEventListener('input', () => { $('fontPreview').textContent = $('fontPreviewText').value || 'نسق — NASAQ Studio'; renderFontList(); });
  $('fontApplyBtn').addEventListener('click', applyNasaqFont);
  $('templateImportBtn').addEventListener('click', importNasaqTemplates);
  $('templateRefreshBtn').addEventListener('click', refreshTemplateList);
  $('templateReadBtn').addEventListener('click', readTemplateLayers);
  $('templateApplyBtn').addEventListener('click', applyTemplateText);
  refreshTemplateList();
}
/* ---------- connection to Photoshop + window pin ---------- */
async function checkPhotoshop() {
  const chip = $('psChip'); if (!chip) return;
  chip.textContent = 'بفحص فوتوشوب…'; chip.className = 'ps-chip';
  const r = await psCall('ping', {});
  if (r && r.ok) { chip.className = 'ps-chip ok'; chip.textContent = r.hasDoc ? 'متصل · ' + r.name : 'متصل · مفيش تصميم'; }
  else { chip.className = 'ps-chip off'; chip.textContent = (r && r.error === 'NOT_RUNNING') ? 'فوتوشوب مقفول' : 'غير متصل'; }
}
function initShell() {
  const chip = $('psChip'); if (chip) chip.addEventListener('click', checkPhotoshop);
  const pin = $('pinBtn');
  if (pin) pin.addEventListener('click', async () => {
    const on = !pin.classList.contains('on');
    if (window.nasaq && window.nasaq.setOnTop) await window.nasaq.setOnTop(on);
    pin.classList.toggle('on', on);
    status(on ? 'النافذة ثابتة فوق فوتوشوب.' : 'النافذة رجعت عادية.');
  });
  window.addEventListener('focus', checkPhotoshop);
  checkPhotoshop();
}
window.addEventListener('DOMContentLoaded', () => { init(); initTextStudio(); initShell(); NasaqMotion.init(); initAuth(); window.addEventListener('focus', refreshAuthGate); window.setInterval(refreshAuthGate, 60000); });
