const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const VISITOR_FILE = path.join(ROOT, 'visitors.json');

function loadVisitors() {
  try {
    if (fs.existsSync(VISITOR_FILE)) {
      return JSON.parse(fs.readFileSync(VISITOR_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    totalVisits: 148,
    uniqueIds: ['seed-1', 'seed-2', 'seed-3'],
    uniqueCount: 94,
    daily: {},
    mobileCount: 118,
    desktopCount: 30,
    recent: []
  };
}

function saveVisitors(v) {
  try {
    fs.writeFileSync(VISITOR_FILE, JSON.stringify(v, null, 2), 'utf8');
  } catch (e) {}
}

const REGISTRATIONS_META_FILE = path.join(ROOT, 'registrations-meta.json');
const TRANSLATIONS_CACHE_FILE = path.join(ROOT, 'translations-cache.json');
const CMS_OVERRIDES_FILE = path.join(ROOT, 'cms-overrides.json');

function loadCmsOverrides() {
  try {
    if (fs.existsSync(CMS_OVERRIDES_FILE)) {
      return JSON.parse(fs.readFileSync(CMS_OVERRIDES_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveCmsOverrides(data) {
  try {
    fs.writeFileSync(CMS_OVERRIDES_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

let GoogleGenAI = null;
try {
  ({ GoogleGenAI } = require('@google/genai'));
} catch (_) {}

function getGeminiClient() {
  if (!GoogleGenAI || !process.env.GEMINI_API_KEY) return null;
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function loadTranslationCache() {
  try {
    if (fs.existsSync(TRANSLATIONS_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(TRANSLATIONS_CACHE_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveTranslationCache(cache) {
  try {
    fs.writeFileSync(TRANSLATIONS_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {}
}

function loadRegMeta() {
  try {
    if (fs.existsSync(REGISTRATIONS_META_FILE)) {
      return JSON.parse(fs.readFileSync(REGISTRATIONS_META_FILE, 'utf8'));
    }
  } catch (e) {}
  return { items: [] };
}

function saveRegMeta(m) {
  try {
    fs.writeFileSync(REGISTRATIONS_META_FILE, JSON.stringify(m, null, 2), 'utf8');
  } catch (e) {}
}

function buildSmartLocalAIResponse(prompt, lang, siteState) {
  const q = String(prompt || '').toLowerCase().trim();
  const trips = Array.isArray(siteState?.upcomingTrips) && siteState.upcomingTrips.length
    ? siteState.upcomingTrips
    : (siteState?.currentTrip ? [siteState.currentTrip] : []);
  const mainTrip = trips[0] || { title: 'گەشتی لووتکەی چیای هەڵگورد', location: 'باڵەکایەتی · چیای هەڵگورد', date: '2026-10-24', price: '35,000 دینار', time: '05:00 بەیانی' };
  const dests = Array.isArray(siteState?.destinations) ? siteState.destinations : [];

  // 0. Strict Guardrail: Never discuss or recommend other hiking/tourism groups
  const asksOtherGroups = (
    q.includes('گرووپی تر') || q.includes('گروپی تر') || q.includes('کۆمپانیای تر') ||
    q.includes('گرووپەکانی تر') || q.includes('گروپەکانی تر') || q.includes('کێی تر') ||
    q.includes('other group') || q.includes('other company') || q.includes('competitor') ||
    q.includes('شركات اخرى') || q.includes('مجموعات اخرى') || q.includes('كروب اخر') || q.includes('قروب اخر')
  );
  if (asksOtherGroups) {
    if (lang === 'en') {
      return {
        text: `🏔️ I am your dedicated travel companion and official AI concierge for **KURDIA ADVENTURE**.\n\nI focus exclusively on **KURDIA ADVENTURE** expeditions, Kurdistan's breathtaking mountain trails, hiking preparation, and outdoor life — I don't discuss or represent any other groups.\n\nWith **KURDIA ADVENTURE**, every journey is crafted with VIP transport, seasoned mountain guides, and unforgettable camaraderie!`,
        actions: [{ label: '🎟️ KURDIA Trips', action: 'booking' }, { label: '👑 VIP Private Trip', action: 'private' }]
      };
    }
    if (lang === 'ar') {
      return {
        text: `🏔️ أنا رفيق سفرك والمساعد الذكي الرسمي والحصري لـ **KURDIA ADVENTURE**.\n\nأتحدث فقط عن رحلات **KURDIA ADVENTURE**، طبيعة كوردستان الساحرة، مسارات الجبال، الطقس، ونصائح المغامرات — ولا أتحدث عن أي مجموعات أو شركات أخرى.\n\nمع **KURDIA ADVENTURE** نضمن لك دائماً أعلى معايير التنظيم، نقل VIP، مرشدين محترفين وتصوير سينمائي!`,
        actions: [{ label: '🎟️ رحلات KURDIA', action: 'booking' }, { label: '👑 رحلة خاصة VIP', action: 'private' }]
      };
    }
    return {
      text: `🏔️ من هاوڕێی گەشت و یاریدەدەری زیرەکی فەرمی **KURDIA ADVENTURE (کوردیا ئەدڤێنچەر)** ـم.\n\nباسی هیچ گرووپ و لایەنێکی تر ناکەم؛ تەنها لەسەر گەشت و خزمەتگوزارییە ناوازەکانی **KURDIA ADVENTURE**، سروشتی کوردستان، شاخەوانی، کەشوهەوا و ئەزموونی ناو سروشت گفتوگۆ دەکەم.\n\nلەگەڵ **KURDIA** هەموو گەشتێک بە بەرزترین ستاندارد، پاسی VIP، ڕێبەری شارەزا و وێنەگرتنی سینەمایی ڕێکدەخرێت! 🌿`,
      actions: [{ label: '🎟️ گەشتەکانی KURDIA', action: 'booking' }, { label: '👑 گەشتی تایبەت', action: 'private' }]
    };
  }

  if (lang === 'en') {
    if (/^(hi|hello|hey|good morning|good evening|how are you|what's up|who are you|سڵاو)/i.test(q) || q.includes('how are you') || q.includes('who are you')) {
      return {
        text: `Hello and welcome, fellow explorer! 🌿 I'm doing wonderfully — always inspired by Kurdistan's mountains and ready to help you plan your next outdoor escape.\n\nI am **KURDIA AI**, your warm, knowledgeable travel companion for **KURDIA ADVENTURE**. Whether you want to chat casually about **mountain hiking, camping under the stars, trail fitness, and nature**, or get curated details on our next expedition to **${mainTrip.title}** (${mainTrip.price || '35,000 IQD'}), I'm right here with you.\n\nWhere would you like our conversation to go today?`,
        actions: [{ label: '🎟️ Next Trip', action: 'booking' }, { label: '🗺️ Places', action: 'destinations' }, { label: '⛅ Weather', action: 'weather' }]
      };
    }
    if (q.includes('gear') || q.includes('wear') || q.includes('bring') || q.includes('shoe') || q.includes('clothes') || q.includes('pack') || q.includes('جل') || q.includes('پێڵاو')) {
      return {
        text: `🎒 **Trail Companion Packing & Layering Guide:**\n\nWhen heading into Kurdistan's mountains, smart layering makes all the difference:\n• **Footwear:** Ankle-supporting hiking boots or trail runners with deep lugs for rocky Zagros paths.\n• **3-Layer Clothing:** A moisture-wicking base layer, a warm fleece mid-layer, and a breathable wind/rain shell for high ridges.\n• **Trail Essentials:** 1.5L–2L water, electrolytes/nuts, UV sunglasses, SPF 50 sunscreen, and a powerbank.\n• **KURDIA Hospitality:** On every **KURDIA ADVENTURE** trip, we take care of VIP transport, expert trail guidance, charcoal-brewed mountain tea, and professional photography!`,
        actions: [{ label: '🎟️ Join Next Trip', action: 'booking' }, { label: '⛅ Check Weather', action: 'weather' }]
      };
    }
    if (q.includes('camp') || q.includes('tent') || q.includes('night') || q.includes('star') || q.includes('nature') || q.includes('safety') || q.includes('fitness') || q.includes('breathe') || q.includes('altitude')) {
      return {
        text: `🏕️ **Nature & Mountain Wisdom from KURDIA ADVENTURE:**\n\nSpending time in high alpine nature — from **Felaw Lake** to the slopes of **Mount Halgurd** — is one of the best ways to recharge your spirit:\n• **Pacing & Breathing:** On steep ascents, use the "rest step" and steady nasal breathing to conserve energy.\n• **Leave No Trace:** We deeply respect Kurdistan's pristine valleys, springs, and wildlife.\n• **Evening Camp Vibes:** Cool mountain air, firelight, and stargazing at 1,800m+ elevation create lifelong memories.\n\nWould you like me to recommend an upcoming **KURDIA** hike that matches your pace?`,
        actions: [{ label: '🗺️ Explore Trails', action: 'destinations' }, { label: '🎟️ Upcoming Trips', action: 'booking' }]
      };
    }
    if (q.includes('trip') || q.includes('next') || q.includes('week') || q.includes('schedule') || q.includes('گەشت')) {
      const listTxt = trips.map((t, idx) => `• **${idx + 1}. ${t.title || 'KURDIA Expedition'}** — 📍 ${t.location || 'Kurdistan'} | 📅 ${t.date || 'Upcoming'} | 💰 ${t.price || '35,000 IQD'}`).join('\n');
      return {
        text: `🌿 **Curated Upcoming KURDIA ADVENTURE Expeditions:**\n\n${listTxt}\n\nEvery expedition includes VIP transport, seasoned mountain guides, and professional photography. Would you like to reserve your seat now?`,
        actions: [{ label: '🎟️ Book a Seat', action: 'booking' }, { label: '📍 Explore Places', action: 'destinations' }]
      };
    }
    if (q.includes('book') || q.includes('register') || q.includes('pay') || q.includes('fib') || q.includes('price') || q.includes('بەشداری')) {
      return {
        text: `🎟️ **How to Reserve Your Spot with KURDIA in 3 Simple Steps:**\n\n• **Step 1:** Select your preferred expedition in the Booking section, enter your full name, and choose the number of participants.\n• **Step 2:** Enter your active WhatsApp phone number.\n• **Step 3:** Transfer the participation fee (${mainTrip.price || '35,000 IQD'} per person) to our official **FIB Account: 0750 313 0360** (or FastPay) and upload your receipt screenshot.`,
        actions: [{ label: '🎟️ Go to Booking Form', action: 'booking' }, { label: '💬 Ask on WhatsApp', action: 'whatsapp' }]
      };
    }
    if (q.includes('hik') || q.includes('mountain') || q.includes('place') || q.includes('dest') || q.includes('شوێن') || q.includes('پیادە')) {
      const hikingPlaces = dests.filter(d => d.hasHiking !== false).slice(0, 5);
      const pTxt = hikingPlaces.map(d => `• **${d.name}** (${d.region || 'Kurdistan'}) — 🥾 ${d.hikingDuration || '2-3 hrs hiking'}`).join('\n');
      return {
        text: `🏔️ **Signature KURDIA Hiking & Nature Destinations:**\n\n${pTxt || '• Mount Halgurd (Choman)\n• Rawanduz Canyon & Gali Ali Beg\n• Hawraman & Tawela\n• Felaw Alpine Lake'}\n\nYou can explore full elevation profiles, seasonal highlights, and trail difficulty in our Destinations section.`,
        actions: [{ label: '🗺️ View All Destinations', action: 'destinations' }, { label: '👑 Request Private Trip', action: 'private' }]
      };
    }
    if (q.includes('private') || q.includes('vip') || q.includes('family') || q.includes('group') || q.includes('تایبەت')) {
      return {
        text: `👑 **Bespoke KURDIA VIP & Private Expeditions:**\n\nWant a tailor-made adventure exclusively for your family, friends, or team? Choose your destination, date, group size, and custom services (VIP bus or 4x4 transport, alpine camp/cabin stay, private guide & photographer).`,
        actions: [{ label: '👑 Plan Private Trip', action: 'private' }, { label: '💬 WhatsApp Concierge', action: 'whatsapp' }]
      };
    }
    if (q.includes('weather') || q.includes('rain') || q.includes('wind') || q.includes('temp') || q.includes('کەش')) {
      return {
        text: `⛅ **KURDIA Mountain Meteorological Station:**\n\nOur live Weather Station provides high-resolution ECMWF & Open-Meteo forecasts, interactive topographic/satellite maps, wind stream animations, UV index, and 7-day mountain advisories across Kurdistan.`,
        actions: [{ label: '⛅ Open Weather Station', action: 'weather' }]
      };
    }
    return {
      text: `🌿 **Always a pleasure chatting with you at KURDIA ADVENTURE!**\n\nAs your travel companion, I can help you with trail advice, mountain gear, nature stories, or our curated expeditions:\n• **Next Expedition:** ${mainTrip.title} (${mainTrip.date || 'Soon'} · ${mainTrip.price || '35,000 IQD'})\n• **FIB Payment Account:** \`0750 313 0360\`\n• **WhatsApp Direct:** \`+964 750 313 0360\`\n\nTell me what kind of nature experience or hike you're dreaming of!`,
      actions: [{ label: '🎟️ Book Trip', action: 'booking' }, { label: '🗺️ Destinations', action: 'destinations' }, { label: '👑 Private Trip', action: 'private' }]
    };
  }

  if (lang === 'ar') {
    if (q.includes('مرحبا') || q.includes('اهلا') || q.includes('أهلا') || q.includes('شلونك') || q.includes('كيف حالك') || q.includes('من انت') || q.includes('سلام')) {
      return {
        text: `أهلاً وسهلاً بك يا صديقي العزيز! 🌿 يسعدني جداً التحدث معك، وأنا مستعد دائماً لمرافقتك في عالم الطبيعة والجبال!\n\nأنا **رفيق سفرك والمساعد الذكي لـ KURDIA ADVENTURE**، يمكننا الدردشة بحرية وود حول:\n• **الطبيعة والمشي الجبلي (Hiking):** نصائح المسارات، التخييم، الملابس المناسبة، وأجمل فصول السنة في كوردستان\n• **رحلات KURDIA المنظمة:** رحلتنا القادمة هي **${mainTrip.title}** (${mainTrip.price || '35,000 دينار'})\n\nعمّ تود أن نتحدث اليوم؟ 😊`,
        actions: [{ label: '🎟️ حجز رحلة', action: 'booking' }, { label: '🗺️ الأماكن السياحية', action: 'destinations' }]
      };
    }
    if (q.includes('ملابس') || q.includes('حذاء') || q.includes('معدات') || q.includes('تجهيز') || q.includes('ماذا احضر') || q.includes('شنطة')) {
      return {
        text: `🎒 **دليل رفيق السفر لتجهيز حقيبة الجبال مع KURDIA ADVENTURE:**\n\n• **الحذاء المناسب:** حذاء جبلي (Hiking) مريح ومانع للانزلاق لحماية الكاحل في المسارات الصخرية.\n• **نظام الطبقات في الملابس:** قميص مريح قابل للتنفس مع سترة خفيفة مقاومة للرياح في القمم.\n• **المستلزمات الشخصية:** مطارة ماء، نظارة شمسية، واقي شمس، وشاحن متنقل (Powerbank).\n• **ضيافة KURDIA:** نحن نتكفل بالنقل السياحي VIP، الشاي الجبلي على الفحم، الإرشاد الاحترافي والتصوير السينمائي!`,
        actions: [{ label: '🎟️ سجل في الرحلة القادمة', action: 'booking' }, { label: '⛅ حالة الطقس', action: 'weather' }]
      };
    }
    if (q.includes('رحل') || q.includes('قادم') || q.includes('اسبوع') || q.includes('أسبوع') || q.includes('گەشت')) {
      const listTxt = trips.map((t, idx) => `• **${idx + 1}. ${t.title || 'رحلة KURDIA'}** — 📍 ${t.location || 'كوردستان'} | 📅 ${t.date || 'قريباً'} | 💰 ${t.price || '35,000 دينار'}`).join('\n');
      return {
        text: `🌿 **الرحلات القادمة المختارة مع KURDIA ADVENTURE:**\n\n${listTxt}\n\nتشمل النقل السياحي VIP، مرشدين جبليين محترفين، والتصوير الفوتوغرافي. هل ترغب في حجز مقعدك الآن؟`,
        actions: [{ label: '🎟️ حجز مقعد الآن', action: 'booking' }, { label: '📍 استكشاف الأماكن', action: 'destinations' }]
      };
    }
    if (q.includes('حجز') || q.includes('تسجيل') || q.includes('دفع') || q.includes('سعر') || q.includes('fib') || q.includes('بەشداری')) {
      return {
        text: `🎟️ **طريقة التسجيل والحجز مع KURDIA بـ ٣ خطوات سهلة:**\n\n• **الخطوة ١:** اختر الرحلة من قسم الحجز، اكتب اسمك الكامل وحدد عدد المشاركين (مع كتابة أسماء المرافقين).\n• **الخطوة ٢:** أدخل رقم واتساب الخاص بك للتواصل.\n• **الخطوة ٣:** حوّل مبلغ الاشتراك (${mainTrip.price || '35,000 دينار'} للشخص) إلى حساب **FIB الرسمي: 0750 313 0360** وارفع صورة وصل الدفع.`,
        actions: [{ label: '🎟️ الانتقال لصفحة الحجز', action: 'booking' }, { label: '💬 استفسار عبر واتساب', action: 'whatsapp' }]
      };
    }
    if (q.includes('مشي') || q.includes('هايكنج') || q.includes('جبل') || q.includes('اماكن') || q.includes('أماكن') || q.includes('طبيع') || q.includes('تخييم') || q.includes('شوێن') || q.includes('پیادە')) {
      const hikingPlaces = dests.filter(d => d.hasHiking !== false).slice(0, 5);
      const pTxt = hikingPlaces.map(d => `• **${d.name}** (${d.region || 'كوردستان'}) — 🥾 ${d.hikingDuration || '٢-٣ ساعات مشي'}`).join('\n');
      return {
        text: `🏔️ **أجمل وجهات الطبيعة والمشي الجبلي مع KURDIA:**\n\n${pTxt || '• جبل هلكورد (جومان)\n• وادي رواندز وكلي علي بك\n• هورامان وتويلة\n• بحيرة فيلاو الجبلية'}\n\nيمكنك تصفح كافة التفاصيل ومستوى الصعوبة والارتفاع في قسم الأماكن السياحية.`,
        actions: [{ label: '🗺️ عرض جميع الأماكن', action: 'destinations' }, { label: '👑 طلب رحلة خاصة', action: 'private' }]
      };
    }
    if (q.includes('خاص') || q.includes('عائل') || q.includes('مجموع') || q.includes('vip') || q.includes('تایبەت')) {
      return {
        text: `👑 **الرحلات الخاصة مع KURDIA (VIP والعوائل والمجموعات):**\n\nيمكنك تصميم رحلتك الخاصة بالكامل! حدد الوجهة المفضلة، التاريخ، عدد الأشخاص، والخدمات المطلوبة (نقل خاص، إقامة مخيم/كابينة، مرشد جبلي ومصور محترف).`,
        actions: [{ label: '👑 تنظيم رحلة خاصة', action: 'private' }, { label: '💬 تواصل عبر واتساب', action: 'whatsapp' }]
      };
    }
    if (q.includes('طقس') || q.includes('مطر') || q.includes('رياح') || q.includes('حرار') || q.includes('کەش')) {
      return {
        text: `⛅ **محطة الطقس والخرائط الجبلية لـ KURDIA:**\n\nيوفر قسم الطقس توقعات دقيقة لمدة ٢٤ ساعة و٧ أيام مع خريطة تفاعلية للرياح الحية والأقمار الصناعية لجميع جبال ومدن كوردستان.`,
        actions: [{ label: '⛅ فتح صفحة الطقس', action: 'weather' }]
      };
    }
    return {
      text: `🌿 **يسعدني دائماً مرافقتك والحديث معك في KURDIA ADVENTURE!**\n\nسواء كنت تبحث عن نصائح للمشي الجبلي والتخييم أو تفاصيل رحلاتنا:\n• **الرحلة القادمة:** ${mainTrip.title} (${mainTrip.date || 'قريباً'} · ${mainTrip.price || '35,000 دينار'})\n• **حساب الدفع FIB:** \`0750 313 0360\`\n• **واتساب الفريق:** \`+964 750 313 0360\`\n\nاسألني عن الطبيعة، مسارات الجبال، الطقس، أو أي موضوع آخر!`,
      actions: [{ label: '🎟️ حجز رحلة', action: 'booking' }, { label: '🗺️ الأماكن السياحية', action: 'destinations' }, { label: '👑 رحلة خاصة', action: 'private' }]
    };
  }

  // Default Kurdish Sorani ('ku') — Warm, Professional & Knowledgeable Travel Companion
  if (
    q === 'سڵاو' || q === 'سلاو' || q.includes('چۆنیت') || q.includes('چۆنی') ||
    q.includes('باشیت') || q.includes('چ خەبەر') || q.includes('کێیت') ||
    q.includes('ناوت چییە') || q.includes('تۆ کێیت') || q.includes('قوربان')
  ) {
    return {
      text: `سڵاو و ڕێز هاوڕێی ئازیز! 🌿 زۆر سوپاس، من زۆر باشم و دڵخۆشم کە پێکەوە لە باسی سروشت و گەشتداین!\n\nمن **هاوڕێی گەشت و ڕاوێژکاری زیرەکی KURDIA ADVENTURE** ـم. دەتوانین زۆر بە گەرمی و ئاسوودەیی قسە بکەین لەسەر:\n• **سروشت، شاخەوانی و کەمپینگ:** چۆنیەتی خۆئامادەکردن، هەڵبژاردنی ڕێڕەوی شاخەوانی، کەشوهەوا و نهێنییە جوانەکانی چیاکانی کوردستان\n• **زانیاری وردی گەشتەکانی KURDIA:** گەشتی داهاتوومان بۆ **${mainTrip.title}** ـە (${mainTrip.price || '35,000 دینار'})\n• **ڕێکخستنی گەشتی تایبەت (VIP)** بۆ خێزان و هاوڕێکانت\n\nحەز دەکەیت ئەمڕۆ باسی کام لایەنەی سروشت یان کام گەشتە بکەین؟ 😊`,
      actions: [{ label: '🎟️ گەشتی داهاتوو', action: 'booking' }, { label: '🗺️ شوێنەکان', action: 'destinations' }, { label: '⛅ کەشوهەوا', action: 'weather' }]
    };
  }

  if (q.includes('سوپاس') || q.includes('دەستخۆش') || q.includes('سەرکەوتوو') || q.includes('بژی') || q.includes('جوانە')) {
    return {
      text: `زۆر سوپاس بۆ وشە جوان و پڕ میهرەبانەکانت هاوڕێی ئازیز! ❤️ جێگەی شانازییە بۆ تیمی **KURDIA ADVENTURE** کە هاوڕێی گەشت و کاتە خۆشەکانتانین لەناو سروشتی کوردستاندا.\n\nهەر کاتێک پرسیارت هەبوو لەسەر شاخەوانی، کەشوهەوا، یان گەشتەکانمان، من هەمیشە لێرەم و مێژووی گفتوگۆکانمان پارێزراوە! 🌿`,
      actions: [{ label: '🎟️ بەشداری گەشت', action: 'booking' }, { label: '👑 گەشتی تایبەت', action: 'private' }]
    };
  }

  if (q.includes('جل') || q.includes('پێڵاو') || q.includes('جانتا') || q.includes('ئامادە') || q.includes('چی بهێنم') || q.includes('پێداویستی')) {
    return {
      text: `🎒 **ڕێنمایی هاوڕێی گەشت (KURDIA ADVENTURE) بۆ ئامادەکاری شاخەوانی:**\n\nبۆ ئەوەی چێژێکی تەواو لە پیادەڕەوی و هەوای کوێستانەکان وەربگریت، ئەم خاڵانە زۆر گرنگن:\n• **پێڵاوی گونجاو:** پێڵاوی شاخەوانی (Hiking Boots) کە پاژنە و قولەپێ بگرێت و بنی دژەخلیسک بێت.\n• **سیستەمی چەند چینە لە جلوبەرگدا:** تیشێرتێکی نەرم کە ئارەق هەڵبمژێت، لەگەڵ چاکەتێکی سووکی دژەبا (Windbreaker) بۆ سەر لووتکە و فێنکی ئێواران.\n• **پێداویستی ناو جانتا:** ١.٥ لیتر ئاو، چەرەزات یان خورما بۆ وزە، چاوێلکەی هەتاوی، دژەخۆر و پاوەربانک.\n• **خزمەتگوزارییەکانی KURDIA:** پاسی گەشتیاری VIP، ڕێبەری پڕئەزموونی شاخەوانی، چای سەر خەڵووز و وێنەگرتنی سینەمایی لەسەر تیمی خۆمانە!`,
      actions: [{ label: '🎟️ ناو تۆمارکردن لە گەشت', action: 'booking' }, { label: '⛅ بینینی کەشوهەوا', action: 'weather' }]
    };
  }

  if (q.includes('کەمپ') || q.includes('شەو') || q.includes('ئەستێرە') || q.includes('ئاگر') || q.includes('خێمە') || q.includes('ماندو') || q.includes('هەناسە') || q.includes('تەندروست') || q.includes('چێژ')) {
    return {
      text: `🏕️ **ئەزموونی ناو سروشت و شاخەوانی لەگەڵ KURDIA ADVENTURE:**\n\nشاخەوانی و مانەوە لەناو سروشتی کوردستان (وەک کەناری **گۆماوی فێڵاو** یان بناری **هەڵگورد** و **دەریاچەی دووکان**) تەنها وەرزش نییە، بەڵکو ئارامییەکی دەروونی بێهاوتایە:\n• **تەکنیکی ڕۆیشتن لە شاخ:** هەنگاوی هێواش و جێگیر لەگەڵ هەناسەدانی قووڵ وادەکات بێ ماندووبوون بگەیتە لووتکە.\n• **کەشی کەمپینگ:** دانیشتن لە دەوری ئاگر، دەنگی سروشت و بینینی ئاسمانی پڕ ئەستێرە لەگەڵ هاوڕێیانی KURDIA یادەوەرییەکە هەرگیز لەبیر ناچێتەوە.\n\nدەتەوێت پێشنیازی گەشتێکت بۆ بکەم کە لەگەڵ حەز و توانای تۆ بگونجێت؟ 🌿`,
      actions: [{ label: '🗺️ بینینی شوێنەکان', action: 'destinations' }, { label: '🎟️ گەشتەکانی داهاتوو', action: 'booking' }]
    };
  }

  if (q.includes('گەشت') && (q.includes('هەفتە') || q.includes('داهاتوو') || q.includes('چییە') || q.includes('کەی') || q.includes('بەردەست') || q.includes('نرخ'))) {
    const listTxt = trips.map((t, idx) => `• **${idx + 1}. ${t.title || 'گەشتی KURDIA'}** — 📍 ${t.location || 'کوردستان'} | 📅 ${t.date || 'بەم زووانە'} | 💰 ${t.price || '35,000 دینار'} | ⏰ ${t.time || '06:00 بەیانی'}`).join('\n');
    return {
      text: `🌿 **خشتەی گەشتە بەردەستەکانی KURDIA ADVENTURE:**\n\n${listTxt}\n\nهەموو گەشتەکانمان بە سەرپەرشتی ڕێبەری شارەزای شاخەوانی، پاسی گەشتیاری VIP و فۆتۆگرافەری پڕۆفیشناڵ بەڕێوەدەچن. حەز دەکەیت وردەکاری کام گەشتەیانت بۆ باس بکەم یان جێگەت بۆ حیجز بکەم؟`,
      actions: [{ label: '🎟️ بەشداری لە گەشت بکە', action: 'booking' }, { label: '📍 بینینی شوێنەکان', action: 'destinations' }]
    };
  }
  if (q.includes('بەشداری') || q.includes('ناو') || q.includes('تۆمار') || q.includes('چۆن') || q.includes('پارە') || q.includes('fib') || q.includes('پسوڵە') || q.includes('نرخ')) {
    return {
      text: `🎟️ **چۆنیەتی ناو تۆمارکردن لە KURDIA ADVENTURE بە ٣ هەنگاوی ئاسان:**\n\n• **هەنگاوی ١:** لە بەشی «بەشداری» گەشتی دڵخوازت هەڵبژێرە، ناوی سیانی خۆت و ژمارەی کەسەکان دیاری بکە (دەتوانیت ناوی هەموو هاوڕێکانیشت زیاد بکەیت).\n• **هەنگاوی ٢:** ژمارەی مۆبایلی چالاکی WhatsApp بنووسە.\n• **هەنگاوی ٣:** بڕی بەشداری (${mainTrip.price || '35,000 دینار'} بۆ هەر کەسێک) لە ڕێگەی **FIB: 0750 313 0360** یان FastPay بنێرە و وێنەی پسوڵەکە باربکە.`,
      actions: [{ label: '🎟️ چوون بۆ فۆڕمی تۆمارکردن', action: 'booking' }, { label: '💬 پرسیار لە وەتسئەپ', action: 'whatsapp' }]
    };
  }
  if (q.includes('پیادە') || q.includes('شاخ') || q.includes('شوێن') || q.includes('کوێ') || q.includes('سروشت') || q.includes('هەڵگورد') || q.includes('دووکان') || q.includes('ڕەواندز') || q.includes('هەورامان') || q.includes('فێڵاو')) {
    const hikingPlaces = dests.filter(d => d.hasHiking !== false).slice(0, 6);
    const pTxt = hikingPlaces.map(d => `• **${d.name}** (${d.region || 'کوردستان'}) — 🥾 ${d.hikingDuration || '٢ تا ٣ کاتژمێر پیادەڕەوی'}`).join('\n');
    return {
      text: `🏔️ **نایابترین شوێنە شاخەوانی و گەشتیارییەکانی KURDIA ADVENTURE:**\n\n${pTxt || '• چیای هەڵگورد و دۆڵی باڵەکایەتی\n• دەریاچەی دووکان و قەشقۆڵی\n• خەرەندی ڕەواندز و گەلی عەلی بەگ\n• هەورامان و تەوێڵە\n• گۆماوی فێڵاو'}\n\nلە بەشی «شوێنەکان» دەتوانیت بەرزی لە ئاستی دەریا، ئاستی قورسی ڕێگاکە و باشترین وەرزی سەردانکردن ببینیت.`,
      actions: [{ label: '🗺️ بینینی هەموو شوێنەکان', action: 'destinations' }, { label: '👑 داواکاری گەشتی تایبەت', action: 'private' }]
    };
  }
  if (q.includes('تایبەت') || q.includes('خێزان') || q.includes('گروپ') || q.includes('vip')) {
    return {
      text: `👑 **ڕێکخستنی گەشتی تایبەت لەگەڵ KURDIA (VIP & گروپ و خێزانی):**\n\nئەگەر دەتەوێت لەگەڵ خێزانەکەت، هاوڕێکانت یان ستافی کۆمپانیاکەت گەشتێکی تایبەت بکەیت، لە بەشی «گەشتی تایبەت» شوێن، بەروار، ژمارەی کەس و خزمەتگوزارییەکان (پاسی تایبەت یان 4x4، کەپر/کەمپ، ڕێبەر و فۆتۆگرافەر) هەڵبژێرە و تیمی KURDIA هەموو پلانەکەت بۆ جێبەجێ دەکات.`,
      actions: [{ label: '👑 داواکاری گەشتی تایبەت', action: 'private' }, { label: '💬 ڕاوێژکاری لە وەتسئەپ', action: 'whatsapp' }]
    };
  }
  if (q.includes('کەش') || q.includes('باران') || q.includes('بەفر') || q.includes('با') || q.includes('پلە')) {
    return {
      text: `⛅ **وێستگەی کەشوهەوا و نەخشەی شاخەوانی KURDIA:**\n\nلە بەشی «کەشوهەوا» دەتوانیت پێشبینی وردی ٢٤ کاتژمێر و ٧ ڕۆژی داهاتوو، خێرایی و ئاراستەی با بە زیندوویی لەسەر نەخشە، و ڕێنمایی شاخەوانی بۆ هەموو لووتکە و شارەکانی کوردستان ببینیت.`,
      actions: [{ label: '⛅ کردنەوەی بەشی کەشوهەوا', action: 'weather' }]
    };
  }

  return {
    text: `🌿 **خۆشحاڵم کە پێکەوە قسە دەکەین لە KURDIA ADVENTURE!**\n\nمن وەک هاوڕێی گەشت و ڕاوێژکاری شاخەوانی دەتوانم لەسەر هەموو بابەتێکی سروشت، شاخەوانی، کەشوهەوا یان وردەکاری گەشتەکانی کوردیا یارمەتیت بدەم:\n• **گەشتی داهاتوو:** ${mainTrip.title || 'گەشتی کوردستان'} (${mainTrip.date || 'بەم زووانە'} · ${mainTrip.price || '35,000 دینار'})\n• **ڕێنمایی شاخەوانی، کەمپینگ و پێداویستی گەشت**\n• **ناو تۆمارکردن و هەژماری فەرمی FIB:** \`0750 313 0360\`\n• **گەشتی تایبەت (VIP)** و کەشوهەوای چیاکانی کوردستان\n\nهەر پرسیارێکت هەیە یان حەز دەکەیت باسی هەر شوێنێکی سروشتی بکەین، بە خۆشحاڵییەوە بۆم بنووسە!`,
    actions: [{ label: '🎟️ بەشداری گەشت', action: 'booking' }, { label: '🗺️ شوێنەکان', action: 'destinations' }, { label: '👑 گەشتی تایبەت', action: 'private' }, { label: '⛅ کەشوهەوا', action: 'weather' }]
  };
}

const server = http.createServer((req, res) => {
  try {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key, x-admin-key'
      });
      res.end();
      return;
    }

    if (pathname === '/api/admin/media' && req.method === 'POST') {
      const adminKey = req.headers['x-admin-key'] || req.headers['X-Admin-Key'];
      if (adminKey !== '2026') {
        res.writeHead(401, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ ok: false, error: 'Unauthorized: Missing or invalid X-Admin-Key header' }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          let name = String(payload.name || ('kurdia-' + Date.now() + '.jpg')).trim();
          name = name.replace(/[^a-zA-Z0-9._-]/g, '_');
          if (!path.extname(name)) name += '.jpg';

          const base64Data = String(payload.base64 || '').replace(/^data:image\/[a-z0-9+.-]+;base64,/, '');
          if (!base64Data) {
            res.writeHead(400, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ ok: false, error: 'No base64 data provided' }));
            return;
          }

          const mediaDir = path.join(ROOT, 'media');
          if (!fs.existsSync(mediaDir)) {
            fs.mkdirSync(mediaDir, { recursive: true });
          }

          const targetPath = path.join(mediaDir, name);
          fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'));

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({
            ok: true,
            url: `/media/${name}`
          }));
        } catch (err) {
          res.writeHead(500, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ ok: false, error: err.message || 'Failed to save media file' }));
        }
      });
      return;
    }

    if (pathname === '/api/ai' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        let payload = {};
        try { payload = JSON.parse(body || '{}'); } catch (_) {}
        const prompt = String(payload.prompt || '').trim();
        const lang = ['ku', 'ar', 'en'].includes(payload.lang) ? payload.lang : 'ku';
        const siteState = payload.siteState || {};
        const history = Array.isArray(payload.history) ? payload.history.slice(-14) : [];

        const fallbackResult = buildSmartLocalAIResponse(prompt, lang, siteState);

        // If explicitly triggered as a saved quick-chip message, return the curated saved response immediately
        if (payload.savedChip === true && fallbackResult && fallbackResult.text) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            ok: true,
            text: fallbackResult.text,
            actions: fallbackResult.actions || [],
            source: 'kurdia-saved-chip'
          }));
          return;
        }

        const langName = lang === 'en' ? 'English' : (lang === 'ar' ? 'Arabic (العربية)' : 'Kurdish Sorani (کوردیی سۆرانی)');
        const sysInstruction = [
          `You are KURDIA AI, a warm, professional, and deeply knowledgeable Travel Companion & Mountain Concierge for KURDIA ADVENTURE (kurdiaadventure.com), the premier outdoor, hiking, camping, and adventure platform in the Kurdistan Region.`,
          `PERSONA & TONE: Speak like a trusted, experienced, and welcoming mountain guide and travel companion. Be warm, encouraging, articulate, and insightful.`,
          `DYNAMIC CONTEXT SWITCHING:`,
          `1. General Nature, Hiking & Outdoor Conversation: When the user chats about nature, mountain peaks, hiking techniques, trail fitness, camping under the stars, packing lists, layering clothes, weather patterns, photography, or casual friendly topics, engage naturally with deep outdoor expertise and genuine warmth—without forcing a sales pitch.`,
          `2. Curated KURDIA Trip & Booking Details: When the user asks about trips, schedules, prices, destinations, registration, or VIP private tours, provide accurate, curated KURDIA ADVENTURE details from the live website context below (including upcoming trip titles, locations, dates, prices, departure times, 3-step registration, official FIB payment account 0750 313 0360, FastPay, and WhatsApp +964 750 313 0360). You can also gently weave relevant KURDIA destinations into nature discussions when helpful.`,
          `STRICT EXCLUSIVITY RULE: You represent ONLY KURDIA ADVENTURE. NEVER mention, name, promote, or compare any other hiking, travel, or tourism groups/companies/agencies under any circumstances. If asked about other groups, politely state that you are exclusively the official travel companion of KURDIA ADVENTURE.`,
          `Always reply fluently in ${langName} unless the user explicitly writes in another language.`,
          `Format responses cleanly for mobile readability (use concise paragraphs, bullet points •, and **bold** highlights where appropriate).`,
          `Live KURDIA ADVENTURE Website Context: ${JSON.stringify(siteState)}`
        ].join('\n');

        // Smart Model Selection:
        // - Fast tasks (short greetings / quick acknowledgements): gemini-3.1-flash-lite
        // - Complex tasks (detailed itinerary planning, multi-part gear/elevation analysis): gemini-4-argon -> fallback to gemini-3.8-flash
        // - General conversational & travel companion tasks: gemini-3.8-flash
        const isFastTask = prompt.length <= 18 && /^(سڵاو|سلاو|چۆنیت|چۆنی|باشیت|سوپاس|hi|hello|hey|thanks|مرحبا|اهلا|شكرا)/i.test(prompt);
        const isComplexTask = prompt.length >= 130 || /پلان|خشتە|بەراورد|وردەکاری|ئامادەکاری تەواو|itinerary|compare|detailed|analysis|خطة مفصلة/i.test(prompt);
        const candidateModels = isFastTask
          ? ['gemini-3.1-flash-lite', 'gemini-3.8-flash']
          : (isComplexTask
            ? ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite']
            : ['gemini-3.8-flash', 'gemini-3.1-flash-lite']);

        // 1. Primary: Official @google/genai multi-turn chat
        try {
          const ai = getGeminiClient();
          if (ai && prompt) {
            const formattedHistory = history
              .filter(m => m && m.text)
              .map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: String(m.text) }]
              }));

            for (const modelName of candidateModels) {
              try {
                const chat = ai.chats.create({
                  model: modelName,
                  history: formattedHistory,
                  config: {
                    systemInstruction: sysInstruction,
                    temperature: 0.7
                  }
                });
                const response = await chat.sendMessage({ message: prompt });
                const aiText = (response && response.text) ? String(response.text).trim() : '';
                if (aiText) {
                  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                  res.end(JSON.stringify({
                    ok: true,
                    text: aiText,
                    actions: fallbackResult.actions || [],
                    source: modelName
                  }));
                  return;
                }
              } catch (innerModelErr) {
                console.warn(`Gemini model ${modelName} attempt skipped:`, innerModelErr?.message || innerModelErr);
              }
            }
          }
        } catch (aiErr) {
          console.warn('Gemini /api/ai fallback:', aiErr?.message || aiErr);
        }

        // 2. Secondary: Live Conversational LLM API (works even when GEMINI_API_KEY is not set)
        if (prompt) {
          try {
            const chatMessages = [
              { role: 'system', content: sysInstruction },
              ...history.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: String(m.text || '')
              })),
              { role: 'user', content: prompt }
            ];
            const llmRes = await fetch('https://text.pollinations.ai/openai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'openai',
                messages: chatMessages,
                temperature: 0.7
              })
            });
            if (llmRes.ok) {
              const llmJson = await llmRes.json().catch(() => ({}));
              const llmText = String(llmJson?.choices?.[0]?.message?.content || '').trim();
              if (llmText) {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({
                  ok: true,
                  text: llmText,
                  actions: fallbackResult.actions || [],
                  source: 'live-conversational-ai'
                }));
                return;
              }
            }
          } catch (llmErr) {
            console.warn('Secondary conversational AI error:', llmErr?.message || llmErr);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          ok: true,
          text: fallbackResult.text,
          actions: fallbackResult.actions,
          source: 'kurdia-smart-concierge'
        }));
      });
      return;
    }

    if (pathname === '/api/translate' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        let payload = {};
        try { payload = JSON.parse(body || '{}'); } catch (_) {}
        const texts = Array.isArray(payload.texts) ? payload.texts.map(t => String(t || '').trim()).filter(Boolean).slice(0, 60) : [];
        const targetLang = ['ar', 'en', 'ku'].includes(payload.targetLang) ? payload.targetLang : 'en';

        if (!texts.length || targetLang === 'ku') {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, translations: {} }));
          return;
        }

        const cache = loadTranslationCache();
        cache[targetLang] = cache[targetLang] || {};
        const result = {};
        const missing = [];

        for (const t of texts) {
          if (cache[targetLang][t]) {
            result[t] = cache[targetLang][t];
          } else {
            missing.push(t);
          }
        }

        if (missing.length > 0) {
          let translatedByGemini = false;
          try {
            const ai = getGeminiClient();
            if (ai) {
              const targetName = targetLang === 'ar' ? 'modern standard Arabic' : 'natural English';
              const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: `Translate the following JSON array of Kurdish/Arabic tourism strings into ${targetName}. Return ONLY a valid JSON array of strings in the exact same order:\n${JSON.stringify(missing)}`,
                config: {
                  responseMimeType: 'application/json',
                  temperature: 0.2
                }
              });
              const parsed = JSON.parse((response.text || '[]').trim());
              if (Array.isArray(parsed) && parsed.length === missing.length) {
                missing.forEach((orig, i) => {
                  const tr = String(parsed[i] || orig).trim();
                  cache[targetLang][orig] = tr;
                  result[orig] = tr;
                });
                translatedByGemini = true;
              }
            }
          } catch (_) {}

          if (!translatedByGemini) {
            await Promise.all(missing.map(async (orig) => {
              for (const sl of ['ckb', 'auto']) {
                try {
                  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(orig)}`;
                  const r = await fetch(url);
                  if (!r.ok) continue;
                  const d = await r.json();
                  if (Array.isArray(d) && Array.isArray(d[0])) {
                    const joined = d[0].map(part => (Array.isArray(part) ? part[0] : '')).join('').trim();
                    if (joined && joined !== orig) {
                      cache[targetLang][orig] = joined;
                      result[orig] = joined;
                      break;
                    }
                  }
                } catch (_) {}
              }
            }));
          }
          saveTranslationCache(cache);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, translations: result }));
      });
      return;
    }

    if (pathname === '/api/registrations-meta') {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          const store = loadRegMeta();
          let payload = {};
          try { payload = JSON.parse(body || '{}'); } catch (_) {}
          if (!Array.isArray(store.items)) store.items = [];

          if (payload.action === 'update_status' && payload.id) {
            store.items = store.items.map(item =>
              String(item.id) === String(payload.id)
                ? { ...item, status: payload.status || 'approved', verified: payload.status === 'approved' }
                : item
            );
            saveRegMeta(store);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true, items: store.items }));
            return;
          }

          if (payload.action === 'delete' && payload.id) {
            store.items = store.items.filter(item => String(item.id) !== String(payload.id));
            saveRegMeta(store);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true, items: store.items }));
            return;
          }

          const newId = String(payload.id || ('reg_' + Date.now()));
          const rec = {
            id: newId,
            primaryName: String(payload.primaryName || '').trim(),
            name: String(payload.name || '').trim(),
            participants: Array.isArray(payload.participants) ? payload.participants : [],
            phone: String(payload.phone || '').trim(),
            people: Number(payload.people || 1),
            trip: String(payload.trip || '').trim(),
            note: String(payload.note || '').trim(),
            receiptUrl: String(payload.receiptUrl || payload.receipt || '').trim(),
            coupon_code: String(payload.coupon_code || '').trim(),
            coupon_discount: String(payload.coupon_discount || '').trim(),
            status: String(payload.status || 'pending'),
            verified: Boolean(payload.verified),
            createdAt: payload.createdAt || new Date().toISOString(),
            time: payload.time || new Date().toISOString()
          };
          store.items = [rec, ...store.items.filter(x => String(x.id) !== newId)].slice(0, 500);
          saveRegMeta(store);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, items: store.items }));
        });
        return;
      } else {
        const store = loadRegMeta();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, items: store.items || [] }));
        return;
      }
    }

    if (pathname === '/api/cms-overrides') {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          const current = loadCmsOverrides();
          let payload = {};
          try { payload = JSON.parse(body || '{}'); } catch (_) {}

          const deletedKeys = new Set([
            ...(Array.isArray(current.deletedReviewKeys) ? current.deletedReviewKeys : []),
            ...(Array.isArray(payload.deletedReviewKeys) ? payload.deletedReviewKeys : [])
          ]);
          const isLegacySeed = (r) => {
            const t = String(r?.text || r?.comment || '').trim();
            return r?.id === 'seed-rev-1' || r?.id === 'seed-rev-2' ||
              t === 'یەکێک لە گەشتە جوانەکانم بوو لەگەڵ تیمی KURDIA.' ||
              t === 'ڕێکخستن و هاوڕێیەتیی تیمەکە زۆر خۆش بوو، بێگومان دووبارە بەشداری دەکەمەوە.';
          };
          const revKey = (r) => `${String(r?.name || '').trim().toLowerCase()}|${String(r?.text || r?.comment || '').trim().toLowerCase()}`;

          // Merge reviews rather than losing user-submitted reviews on partial/admin saves
          let mergedReviews = Array.isArray(current.reviews) ? [...current.reviews] : [];
          if (Array.isArray(payload.reviews)) {
            if (payload.replaceReviews === true) {
              mergedReviews = payload.reviews;
            } else {
              const incoming = payload.reviews;
              const combined = [...incoming];
              mergedReviews.forEach(r => {
                if (r && !combined.some(m => (m.id && r.id && m.id === r.id) || (m.name === r.name && (m.text || m.comment) === (r.text || r.comment)))) {
                  combined.push(r);
                }
              });
              mergedReviews = combined.slice(0, 200);
            }
          }
          mergedReviews = mergedReviews.filter(r => r && !isLegacySeed(r) && !deletedKeys.has(revKey(r)));

          const updated = {
            ...current,
            ...payload,
            reviews: mergedReviews,
            deletedReviewKeys: Array.from(deletedKeys),
            updatedAt: new Date().toISOString()
          };
          delete updated.replaceReviews;
          saveCmsOverrides(updated);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, data: updated }));
        });
        return;
      } else {
        const current = loadCmsOverrides();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, data: current }));
        return;
      }
    }

    if (pathname === '/api/reviews') {
      const WORKER_CMS_URL = 'https://kurdia.alwandssalh.workers.dev/api/admin/cms';
      const DEFAULT_CANONICAL_REVIEWS = [
        { id: 'rev-default-1', name: 'دەرباز سەعید', city: 'هەولێر', rating: 5, text: 'یەکێک لە باشترین گەشتەکانی ژیانم بوو لەگەڵ تیمی کوردیا.', comment: 'یەکێک لە باشترین گەشتەکانی ژیانم بوو لەگەڵ تیمی کوردیا.' },
        { id: 'rev-default-2', name: 'تاریق سەلام', city: 'سلێمانی', rating: 5, text: 'سروشت و ڕێکخستنی گەشتەکە زۆر ناوازە بوو.', comment: 'سروشت و ڕێکخستنی گەشتەکە زۆر ناوازە بوو.' },
        { id: 'rev-default-3', name: 'شیلان عومەر', city: 'دهۆک', rating: 5, text: 'سەلامەتی و ڕێبەرایەتی پرۆفیشناڵ، زۆر سوپاس بۆ KURDIA.', comment: 'سەلامەتی و ڕێبەرایەتی پرۆفیشناڵ، زۆر سوپاس بۆ KURDIA.' },
        { id: 'rev-default-4', name: 'ڕێبین کەریم', city: 'هەولێر', rating: 5, text: 'ئەزموونێکی زۆر تایبەت بوو لە چیاکانی کوردستان، بێگومان دووبارە بەشداری دەکەمەوە.', comment: 'ئەزموونێکی زۆر تایبەت بوو لە چیاکانی کوردستان، بێگومان دووبارە بەشداری دەکەمەوە.' },
        { id: 'rev-default-5', name: 'سارا جەمال', city: 'سلێمانی', rating: 5, text: 'هەموو شتێک لە کاتی خۆیدا و بە پلانێکی زۆر ڕێکوپێک ئەنجام درا.', comment: 'هەموو شتێک لە کاتی خۆیدا و بە پلانێکی زۆر ڕێکوپێک ئەنجام درا.' }
      ];
      const isLegacySeed = (r) => {
        const t = String(r?.text || r?.comment || '').trim();
        return r?.id === 'seed-rev-1' || r?.id === 'seed-rev-2' ||
          t === 'یەکێک لە گەشتە جوانەکانم بوو لەگەڵ تیمی KURDIA.' ||
          t === 'ڕێکخستن و هاوڕێیەتیی تیمەکە زۆر خۆش بوو، بێگومان دووبارە بەشداری دەکەمەوە.';
      };
      const revKey = (r) => `${String(r?.name || '').trim().toLowerCase()}|${String(r?.text || r?.comment || '').trim().toLowerCase()}`;

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
          let payload = {};
          try { payload = JSON.parse(body || '{}'); } catch (_) {}

          const current = loadCmsOverrides();
          const deletedKeys = new Set([
            ...(Array.isArray(current.deletedReviewKeys) ? current.deletedReviewKeys : []),
            ...(Array.isArray(payload.deletedReviewKeys) ? payload.deletedReviewKeys : [])
          ]);

          let incomingReviews = [];
          let newReview = null;
          if (Array.isArray(payload.reviews)) {
            incomingReviews = payload.reviews.map((r, i) => ({
              id: String(r?.id || ('rev_' + Date.now() + '_' + i)),
              name: String(r?.name || 'بەشداربوو').trim(),
              city: String(r?.city || 'کوردستان').trim() || 'کوردستان',
              rating: Math.min(5, Math.max(1, Number(r?.rating || 5))),
              text: String(r?.text || r?.comment || '').trim(),
              comment: String(r?.text || r?.comment || '').trim(),
              createdAt: r?.createdAt || new Date().toISOString()
            })).filter(r => r.name && r.text);
          } else {
            const name = String(payload.name || '').trim();
            const city = String(payload.city || 'کوردستان').trim() || 'کوردستان';
            const text = String(payload.text || payload.comment || '').trim();
            const rating = Math.min(5, Math.max(1, Number(payload.rating || 5)));

            if (!name || !text) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ ok: false, error: 'تکایە ناو و بیروڕاکەت بنووسە' }));
              return;
            }
            newReview = {
              id: String(payload.id || ('rev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6))),
              name,
              city,
              rating,
              text,
              comment: text,
              createdAt: payload.createdAt || new Date().toISOString()
            };
            deletedKeys.delete(revKey(newReview));
            incomingReviews = [newReview];
          }

          const existingReviews = Array.isArray(current.reviews) && current.reviews.length ? current.reviews : DEFAULT_CANONICAL_REVIEWS;
          const seen = new Set();
          const updatedReviews = [];
          [...incomingReviews, ...existingReviews, ...DEFAULT_CANONICAL_REVIEWS].forEach(r => {
            if (!r || isLegacySeed(r)) return;
            const k = revKey(r);
            if (!k || k === '|' || deletedKeys.has(k) || seen.has(k)) return;
            seen.add(k);
            updatedReviews.push({
              id: r.id || ('rev_' + updatedReviews.length),
              name: String(r.name || '').trim(),
              city: String(r.city || 'کوردستان').trim() || 'کوردستان',
              rating: Math.min(5, Math.max(1, Number(r.rating || 5))),
              text: String(r.text || r.comment || '').trim(),
              comment: String(r.text || r.comment || '').trim(),
              createdAt: r.createdAt || new Date().toISOString()
            });
          });

          current.reviews = updatedReviews.slice(0, 200);
          current.deletedReviewKeys = Array.from(deletedKeys);
          current.updatedAt = new Date().toISOString();
          saveCmsOverrides(current);

          // Best-effort sync to Cloudflare Worker CMS
          try {
            const curRes = await fetch(`${WORKER_CMS_URL}?cb=${Date.now()}`, {
              cache: 'no-store',
              headers: { 'X-Admin-Key': '2026' }
            });
            const curJson = await curRes.json().catch(() => ({}));
            const cmsData = curJson.data || {};
            const cloudDeleted = Array.isArray(cmsData.deletedReviewKeys) ? cmsData.deletedReviewKeys : [];
            cloudDeleted.forEach(dk => { if (!incomingReviews.some(ir => revKey(ir) === dk)) deletedKeys.add(dk); });

            const cloudReviews = Array.isArray(cmsData.reviews) ? cmsData.reviews : [];
            const cloudSeen = new Set();
            const mergedCloud = [];
            [...current.reviews, ...cloudReviews, ...DEFAULT_CANONICAL_REVIEWS].forEach(r => {
              if (!r || isLegacySeed(r)) return;
              const k = revKey(r);
              if (!k || k === '|' || deletedKeys.has(k) || cloudSeen.has(k)) return;
              cloudSeen.add(k);
              mergedCloud.push({
                id: r.id || ('rev_' + mergedCloud.length),
                name: String(r.name || '').trim(),
                city: String(r.city || 'کوردستان').trim() || 'کوردستان',
                rating: Math.min(5, Math.max(1, Number(r.rating || 5))),
                text: String(r.text || r.comment || '').trim(),
                comment: String(r.text || r.comment || '').trim(),
                createdAt: r.createdAt || new Date().toISOString()
              });
            });

            cmsData.reviews = mergedCloud.slice(0, 200);
            cmsData.deletedReviewKeys = Array.from(deletedKeys);
            if (cmsData.config && typeof cmsData.config === 'object') {
              cmsData.config.reviews = cmsData.reviews;
              cmsData.config.deletedReviewKeys = cmsData.deletedReviewKeys;
            }
            await fetch(`${WORKER_CMS_URL}?cb=${Date.now()}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Admin-Key': '2026' },
              body: JSON.stringify(cmsData)
            });
          } catch (_) {}

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, review: newReview, reviews: current.reviews, deletedReviewKeys: current.deletedReviewKeys }));
        });
        return;
      } else {
        const current = loadCmsOverrides();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, reviews: Array.isArray(current.reviews) ? current.reviews : DEFAULT_CANONICAL_REVIEWS, deletedReviewKeys: Array.isArray(current.deletedReviewKeys) ? current.deletedReviewKeys : [] }));
        return;
      }
    }

    if (pathname === '/api/visitors') {
      const todayKey = new Date().toISOString().slice(0, 10);
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          const v = loadVisitors();
          let payload = {};
          try { payload = JSON.parse(body || '{}'); } catch (_) {}
          v.totalVisits = (Number(v.totalVisits) || 0) + 1;
          v.daily = v.daily || {};
          v.daily[todayKey] = (Number(v.daily[todayKey]) || 0) + 1;
          const vid = String(payload.visitorId || '').trim();
          if (!Array.isArray(v.uniqueIds)) v.uniqueIds = [];
          if (vid && !v.uniqueIds.includes(vid)) {
            v.uniqueIds.push(vid);
            if (v.uniqueIds.length > 5000) v.uniqueIds.shift();
            v.uniqueCount = (Number(v.uniqueCount) || 0) + 1;
          }
          const isMob = payload.device === 'mobile' || /mobile|android|iphone|ipad/i.test(String(req.headers['user-agent'] || ''));
          if (isMob) v.mobileCount = (Number(v.mobileCount) || 0) + 1;
          else v.desktopCount = (Number(v.desktopCount) || 0) + 1;

          if (!Array.isArray(v.recent)) v.recent = [];
          v.recent.unshift({
            time: new Date().toISOString(),
            page: String(payload.page || 'home'),
            device: isMob ? 'مۆبایل 📱' : 'کۆمپیوتەر 💻',
            lang: String(payload.lang || 'ku')
          });
          v.recent = v.recent.slice(0, 25);
          saveVisitors(v);

          const uniqueVal = v.uniqueCount || v.uniqueIds.length;
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            ok: true,
            totalVisits: v.totalVisits,
            todayVisits: v.daily[todayKey] || 1,
            uniqueCount: uniqueVal,
            uniqueVisitors: uniqueVal,
            mobileCount: v.mobileCount || 0,
            desktopCount: v.desktopCount || 0,
            recent: v.recent
          }));
        });
        return;
      } else {
        const v = loadVisitors();
        const uniqueVal = v.uniqueCount || (Array.isArray(v.uniqueIds) ? v.uniqueIds.length : 0);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          ok: true,
          totalVisits: v.totalVisits || 0,
          todayVisits: (v.daily && v.daily[todayKey]) || 0,
          uniqueCount: uniqueVal,
          uniqueVisitors: uniqueVal,
          mobileCount: v.mobileCount || 0,
          desktopCount: v.desktopCount || 0,
          recent: v.recent || []
        }));
        return;
      }
    }

    const host = String(req.headers.host || '').toLowerCase();
    if (pathname === '/' && host.startsWith('admin.')) {
      pathname = '/admin.html';
    } else if (pathname === '/' || pathname === '/index') {
      pathname = '/index.html';
    } else if (
      pathname === '/admin' ||
      pathname === '/admin/' ||
      pathname === '/control' ||
      pathname === '/kurdia-control-center-admin' ||
      pathname === '/kurdia-control-center-admin.html'
    ) {
      pathname = '/admin.html';
    }

    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(ROOT, safePath);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath) && !path.extname(filePath)) {
      const htmlCandidate = filePath + '.html';
      if (fs.existsSync(htmlCandidate)) {
        filePath = htmlCandidate;
      }
    }

    if (!fs.existsSync(filePath)) {
      // Fallback to index.html for SPA routes
      const fallback = path.join(ROOT, 'index.html');
      if (fs.existsSync(fallback)) {
        const content = fs.readFileSync(fallback);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(content);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`KURDIA ADVENTURE server listening on http://0.0.0.0:${PORT}`);
});
