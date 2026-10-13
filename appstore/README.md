# صفحة App Store

نصوص صفحة عتيق في App Store بكل لغة، ملفّ لكل حقل، والحدود كما يفرضها المتجر: العنوان الفرعي ثلاثون حرفًا، والكلمات المفتاحية مئة، والنص الترويجي مئة وسبعون، والوصف وما الجديد أربعة آلاف.

- `listings/ar-SA/` و`listings/en-US/`: `subtitle.txt` و`keywords.txt` و`promotional_text.txt` و`description.txt` و`whats_new.txt`
- الاسم «عتيق - Ateeq» ثابت في App Store Connect ولا يتغيّر من هنا، والصور ترفعها `tools/store/compose.mjs`

يرفعها `tools/ios/asc-listing.py` بمفتاح App Store Connect API، فيضع العنوان الفرعي، ثم يُنشئ الإصدار المطلوب أو يجده ويملأ نصوصه، ويربط به الحزمة التي رُفعت من `ios-release`، ويرسله للمراجعة:

```sh
ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_KEY_FILE=AuthKey.p8 \
python3 tools/ios/asc-listing.py --version 1.1.0 --build 7 --submit
```

الكلمات المفتاحية لا تكرّر ما في الاسم والعنوان الفرعي لأن المتجر يفهرسهما وحدهما، وصفحة Google Play في `play/` تحمل الوصف نفسه لأن بحث Play يقرأ الوصف كله.
