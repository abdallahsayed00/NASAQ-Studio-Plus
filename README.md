# NASAQ Studio — برنامج خارجي لفوتوشوب (Windows)

برنامج مستقل (Electron) بيشتغل جنب فوتوشوب وبيتحكم فيه، مش بلاجن UXP.
الواجهة هي نفس واجهة البلاجن (برجاندي وبيج)، والأقسام: Social Prompt Lab · Thumbnail Lab · Social Icons · Text Studio.

## التشغيل

1. نزّل Node.js (نسخة LTS) من nodejs.org.
2. دوس مرتين على `تشغيل-البرنامج.bat` (أول مرة بينزّل المكتبات لوحده).
   أو من الـ Terminal داخل الفولدر: `npm install` ثم `npm start`.
3. افتح فوتوشوب وافتح التصميم، وبعدها استخدم البرنامج. الشريط فوق بيوضح الاتصال: **متصل · اسم الملف**.
4. زر 📌 بيثبّت نافذة البرنامج فوق فوتوشوب.

## عمل ملف .exe

- **من GitHub (من غير ما تثبّت حاجة):** ارفع الفولدر على ريبو → تبويب Actions → *Build NASAQ Studio (Windows)* → Run workflow → نزّل الـ artifact من آخر الصفحة (portable + installer).
- **على جهازك (ويندوز):** `npm run dist` والنتيجة في فولدر `dist`.

## إزاي بيكلّم فوتوشوب

كل زرار بيولّد سكربت ExtendScript (فولدر `jsx`) ويشغّله جوه فوتوشوب المفتوح عن طريق PowerShell و COM
(`Photoshop.Application.DoJavaScriptFile`). النتيجة بترجع للبرنامج كـ JSON. كل عملية بتتسجّل في Photoshop كخطوة History واحدة (Ctrl+Z بيلغيها كلها).

## ملاحظات مهمة

- **ويندوز بس** في النسخة دي (الاتصال عن طريق COM).
- فوتوشوب والبرنامج لازم يشتغلوا بنفس الصلاحيات (الاتنين عاديين، أو الاتنين Run as administrator).
- لو فيه نافذة مفتوحة جوه فوتوشوب (حوار، أو تعديل نص)، الأوامر هتتأخر أو تفشل — اقفلها وجرّب تاني.
- البرنامج **نافذة خارجية**، مش لوحة مدمجة جوه واجهة فوتوشوب.
- Text Studio بيشتغل على **الطبقة النصية النشطة** (طبقة واحدة)، أو بينشئ طبقة جديدة. التأثيرات (ستروك/ظل/توهج) بتتكتب لنفسها فقط ومبتلمسش غيرها.
- الاسم النصي بيستخدم Arial Bold، والنص العربي ممكن يحتاج ضبط محرك النص العربي في فوتوشوب.

## الاختبارات

`npm test` بيشغّل سكربتات ExtendScript على نموذج فوتوشوب وهمي بقيود ES3 ويتأكد من الجايدات والمواضع والـ opt-in.
الاختبار ده **مش بيغني عن تجربة حقيقية** على فوتوشوب عندك.

## الهيكل

```
main.js        نافذة Electron + IPC
preload.js     الجسر الآمن للواجهة (window.nasaq)
psbridge.js    بناء السكربتات وتشغيلها عبر PowerShell/COM
jsx/           prelude · social · text · ping · runner (ExtendScript)
renderer/      الواجهة (index.html, styles.css, renderer.js, assets/)
test/          jsx-test.js + ui-test.py
```


## NASAQ Studio+ additions (v1.1.0)

- **Font Library:** reads the font collection exposed by the running Photoshop instance, supports searching and previewing font families, and applies the selected font's PostScript name to the active text layer without intentionally changing its other settings.
- **Template Library:** imports PSD files into the app's user-data template library, opens a chosen PSD in Photoshop, scans text layers (including text layers inside groups), and applies only the text fields that the user changed. Backgrounds, image layers, and non-text artwork are not rewritten by the template text updater.
- Templates are stored in Electron's user-data directory under `templates`; removing a template removes only the library copy.

Photoshop must be running on Windows for the Photoshop bridge features. Test the new font/template workflows with a duplicate PSD before using important production files.
