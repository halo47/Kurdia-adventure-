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
        text: `🏔️ I am the official and exclusive AI assistant of **KURDIA ADVENTURE**.\n\nI only speak about **KURDIA ADVENTURE** expeditions, Kurdistan's nature, mountain trails, weather, and general travel advice — I do not discuss or represent any other groups.\n\nWith **KURDIA ADVENTURE**, every trip is organized with VIP transport, expert mountain guides, and professional photography!`,
        actions: [{ label: '🎟️ KURDIA Trips', action: 'booking' }, { label: '👑 VIP Private Trip', action: 'private' }]
      };
    }
    if (lang === 'ar') {
      return {
        text: `🏔️ أنا المساعد الذكي الرسمي والوحيد لـ **KURDIA ADVENTURE**.\n\nأتحدث فقط عن رحلات **KURDIA ADVENTURE**، طبيعة كوردستان، مسارات الجبال، الطقس، والنصائح العامة — ولا أتحدث عن أي مجموعات أو شركات أخرى.\n\nمع **KURDIA ADVENTURE** نضمن لك دائماً أفضل تنظيم، نقل VIP، مرشدين محترفين وتصوير سينمائي!`,
        actions: [{ label: '🎟️ رحلات KURDIA', action: 'booking' }, { label: '👑 رحلة خاصة VIP', action: 'private' }]
      };
    }
    return {
      text: `🏔️ من تەنها یاریدەدەری زیرەکی فەرمی **KURDIA ADVENTURE (کوردیا ئەدڤێنچەر)** ـم.\n\nباسی هیچ گرووپ و لایەنێکی تر ناکەم؛ تەنها لەسەر گەشت و خزمەتگوزارییە ناوازەکانی **KURDIA ADVENTURE**، سروشتی کوردستان، شاخەوانی، کەشوهەوا و زانیاری گشتی گفتوگۆ دەکەم.\n\nلەگەڵ **KURDIA** هەموو گەشتێک بە بەرزترین ستاندارد، پاسی VIP، ڕێبەری شارەزا و وێنەگرتنی سینەمایی ڕێکدەخرێت! 🌿`,
      actions: [{ label: '🎟️ گەشتەکانی KURDIA', action: 'booking' }, { label: '👑 گەشتی تایبەت', action: 'private' }]
    };
  }

  if (lang === 'en') {
    if (/^(hi|hello|hey|good morning|good evening|how are you|what's up|who are you|سڵاو)/i.test(q) || q.includes('how are you') || q.includes('who are you')) {
      return {
        text: `Hello my friend! 🌿 I'm doing great and ready for the mountains!\n\nI am **KURDIA AI**, your personal conversational companion for **KURDIA ADVENTURE**.\n\nWe can chat about:\n• **KURDIA Expeditions:** Next is **${mainTrip.title}** (${mainTrip.price || '35,000 IQD'})\n• **Hiking & Camping Tips:** Gear, trails, safety & photography\n• **Kurdistan Nature & Weather:** Mountains, lakes, waterfalls & forecasts\n\nWhat's on your mind today?`,
        actions: [{ label: '🎟️ Next Trip', action: 'booking' }, { label: '🗺️ Places', action: 'destinations' }, { label: '⛅ Weather', action: 'weather' }]
      };
    }
    if (q.includes('gear') || q.includes('wear') || q.includes('bring') || q.includes('shoe') || q.includes('clothes') || q.includes('pack') || q.includes('جل') || q.includes('پێڵاو')) {
      return {
        text: `🎒 **KURDIA ADVENTURE Hiking & Trip Checklist:**\n\n• **Footwear:** Comfortable hiking boots or non-slip trail shoes.\n• **Clothing:** Layered breathable clothes + a light windbreaker/jacket for mountain peaks.\n• **Essentials:** 1.5L water bottle, sunglasses, sunscreen, hat, and a powerbank for your phone.\n• **Snacks:** Nuts, dates, or energy bars (KURDIA also provides mountain tea & arrangements!).`,
        actions: [{ label: '🎟️ Join Next Trip', action: 'booking' }, { label: '⛅ Check Weather', action: 'weather' }]
      };
    }
    if (q.includes('trip') || q.includes('next') || q.includes('week') || q.includes('schedule') || q.includes('گەشت')) {
      const listTxt = trips.map((t, idx) => `• **${idx + 1}. ${t.title || 'KURDIA Expedition'}** — 📍 ${t.location || 'Kurdistan'} | 📅 ${t.date || 'Upcoming'} | 💰 ${t.price || '35,000 IQD'}`).join('\n');
      return {
        text: `🌿 **Upcoming KURDIA ADVENTURE Expeditions:**\n\n${listTxt}\n\nIncludes VIP transport, mountain guides, and photography. Would you like to reserve your seat now?`,
        actions: [{ label: '🎟️ Book a Seat', action: 'booking' }, { label: '📍 Explore Places', action: 'destinations' }]
      };
    }
    if (q.includes('book') || q.includes('register') || q.includes('pay') || q.includes('fib') || q.includes('price') || q.includes('بەشداری')) {
      return {
        text: `🎟️ **How to Book with KURDIA in 3 Easy Steps:**\n\n• **Step 1:** Choose your trip on the Booking page, enter your full name, and select the number of participants (you can add all friends' names).\n• **Step 2:** Enter your WhatsApp phone number and verify it with the 4-digit OTP code.\n• **Step 3:** Transfer the participation fee (${mainTrip.price || '35,000 IQD'} per person) to our official **FIB Account: 0750 313 0360** and upload the receipt screenshot.`,
        actions: [{ label: '🎟️ Go to Booking Form', action: 'booking' }, { label: '💬 Ask on WhatsApp', action: 'whatsapp' }]
      };
    }
    if (q.includes('hik') || q.includes('mountain') || q.includes('place') || q.includes('dest') || q.includes('شوێن') || q.includes('پیادە')) {
      const hikingPlaces = dests.filter(d => d.hasHiking !== false).slice(0, 5);
      const pTxt = hikingPlaces.map(d => `• **${d.name}** (${d.region || 'Kurdistan'}) — 🥾 ${d.hikingDuration || '2-3 hrs hiking'}`).join('\n');
      return {
        text: `🏔️ **Top KURDIA Hiking & Nature Destinations:**\n\n${pTxt || '• Mount Halgurd (Choman)\n• Rawanduz Canyon & Gali Ali Beg\n• Hawraman & Tawela\n• Felaw Alpine Lake'}\n\nYou can view full specifications, altitude, and hiking difficulty in the Destinations section.`,
        actions: [{ label: '🗺️ View All Destinations', action: 'destinations' }, { label: '👑 Request Private Trip', action: 'private' }]
      };
    }
    if (q.includes('private') || q.includes('vip') || q.includes('family') || q.includes('group') || q.includes('تایبەت')) {
      return {
        text: `👑 **KURDIA VIP & Private Group Expeditions:**\n\nYou can customize your own trip for your family, friends, or company! Choose your destination, preferred date, group size, and optional services (4x4/VIP bus transport, cabin/camp stay, mountain guide & pro photographer).`,
        actions: [{ label: '👑 Plan Private Trip', action: 'private' }, { label: '💬 WhatsApp Concierge', action: 'whatsapp' }]
      };
    }
    if (q.includes('weather') || q.includes('rain') || q.includes('wind') || q.includes('temp') || q.includes('کەش')) {
      return {
        text: `⛅ **KURDIA Mountain Weather Station:**\n\nOur dedicated Weather page provides live ECMWF & Open-Meteo forecasts, interactive topographic/satellite maps, wind stream animations, UV index, and 7-day mountain advisories across Erbil, Halgurd, Sulaymaniyah, Duhok, Soran, and Rawanduz.`,
        actions: [{ label: '⛅ Open Weather Station', action: 'weather' }]
      };
    }
    return {
      text: `🌿 **I'm here to chat with you about KURDIA ADVENTURE & nature!**\n\n• **Next Expedition:** ${mainTrip.title} (${mainTrip.date || 'Soon'} · ${mainTrip.price || '35,000 IQD'})\n• **FIB Payment Account:** \`0750 313 0360\`\n• **WhatsApp Direct:** \`+964 750 313 0360\`\n\nFeel free to ask me about trips, hiking gear, mountain weather, Kurdistan nature, or anything else!`,
      actions: [{ label: '🎟️ Book Trip', action: 'booking' }, { label: '🗺️ Destinations', action: 'destinations' }, { label: '👑 Private Trip', action: 'private' }]
    };
  }

  if (lang === 'ar') {
    if (q.includes('مرحبا') || q.includes('اهلا') || q.includes('أهلا') || q.includes('شلونك') || q.includes('كيف حالك') || q.includes('من انت') || q.includes('سلام')) {
      return {
        text: `أهلاً وسهلاً بك يا صديقي الغالي! 🌿 أنا بخير والحمد لله، ومستعد دائماً لمغامرات الجبال والطبيعة معك!\n\nأنا **المساعد الذكي الرسمي لـ KURDIA ADVENTURE**، يمكنك التحدث معي بحرية عن:\n• **رحلات KURDIA:** رحلتنا القادمة هي **${mainTrip.title}** (${mainTrip.price || '35,000 دينار'})\n• **نصائح المشي الجبلي والتخييم والمعدات**\n• **الطبيعة والطقس في كوردستان** وأي موضوع عام تحب الدردشة عنه!`,
        actions: [{ label: '🎟️ حجز رحلة', action: 'booking' }, { label: '🗺️ الأماكن السياحية', action: 'destinations' }]
      };
    }
    if (q.includes('ملابس') || q.includes('حذاء') || q.includes('معدات') || q.includes('تجهيز') || q.includes('ماذا احضر') || q.includes('شنطة')) {
      return {
        text: `🎒 **نصائح KURDIA ADVENTURE للتجهيز للرحلات الجبلية:**\n\n• **الحذاء:** حذاء رياضي مريح أو حذاء جبلي مانع للانزلاق.\n• **الملابس:** ملابس مريحة متعددة الطبقات مع سترة خفيفة للقمم الجبلية.\n• **الأساسيات:** مطارة ماء، نظارة شمسية، واقي شمس، وشاحن متنقل (Powerbank).\n• **الضيافة:** فريق KURDIA يوفر النقل السياحي VIP، الشاي الجبلي، والإرشاد الكامل طوال الرحلة!`,
        actions: [{ label: '🎟️ سجل في الرحلة القادمة', action: 'booking' }, { label: '⛅ حالة الطقس', action: 'weather' }]
      };
    }
    if (q.includes('رحل') || q.includes('قادم') || q.includes('اسبوع') || q.includes('أسبوع') || q.includes('گەشت')) {
      const listTxt = trips.map((t, idx) => `• **${idx + 1}. ${t.title || 'رحلة KURDIA'}** — 📍 ${t.location || 'كوردستان'} | 📅 ${t.date || 'قريباً'} | 💰 ${t.price || '35,000 دينار'}`).join('\n');
      return {
        text: `🌿 **الرحلات القادمة مع KURDIA ADVENTURE:**\n\n${listTxt}\n\nتشمل النقل السياحي VIP، مرشدين جبليين محترفين، والتصوير الفوتوغرافي. هل ترغب في حجز مقعدك الآن؟`,
        actions: [{ label: '🎟️ حجز مقعد الآن', action: 'booking' }, { label: '📍 استكشاف الأماكن', action: 'destinations' }]
      };
    }
    if (q.includes('حجز') || q.includes('تسجيل') || q.includes('دفع') || q.includes('سعر') || q.includes('fib') || q.includes('بەشداری')) {
      return {
        text: `🎟️ **طريقة التسجيل والحجز مع KURDIA بـ ٣ خطوات بسيطة:**\n\n• **الخطوة ١:** اختر الرحلة من قسم الحجز، اكتب اسمك الكامل وحدد عدد المشاركين (مع كتابة أسماء جميع المرافقين).\n• **الخطوة ٢:** أدخل رقم واتساب الخاص بك وقم بتأكيده عبر رمز التحقق OTP.\n• **الخطوة ٣:** حوّل مبلغ الاشتراك (${mainTrip.price || '35,000 دينار'} للشخص) إلى حساب **FIB الرسمي: 0750 313 0360** وارفع صورة وصل الدفع.`,
        actions: [{ label: '🎟️ الانتقال لصفحة الحجز', action: 'booking' }, { label: '💬 استفسار عبر واتساب', action: 'whatsapp' }]
      };
    }
    if (q.includes('مشي') || q.includes('هايكنج') || q.includes('جبل') || q.includes('اماكن') || q.includes('أماكن') || q.includes('شوێن') || q.includes('پیادە')) {
      const hikingPlaces = dests.filter(d => d.hasHiking !== false).slice(0, 5);
      const pTxt = hikingPlaces.map(d => `• **${d.name}** (${d.region || 'كوردستان'}) — 🥾 ${d.hikingDuration || '٢-٣ ساعات مشي'}`).join('\n');
      return {
        text: `🏔️ **أفضل وجهات التخييم والمشي الجبلي مع KURDIA:**\n\n${pTxt || '• جبل هلكورد (جومان)\n• وادي رواندز وكلي علي بك\n• هورامان وتويلة\n• بحيرة فيلاو الجبلية'}\n\nيمكنك تصفح كافة التفاصيل ومستوى الصعوبة والارتفاع في قسم الأماكن السياحية.`,
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
      text: `🌿 **يسعدني التحدث معك في KURDIA ADVENTURE!**\n\n• **الرحلة القادمة:** ${mainTrip.title} (${mainTrip.date || 'قريباً'} · ${mainTrip.price || '35,000 دينار'})\n• **حساب الدفع FIB:** \`0750 313 0360\`\n• **واتساب الفريق:** \`+964 750 313 0360\`\n\nاسألني عن الرحلات، التخييم، نصائح الجبال، الطقس، أو أي موضوع آخر!`,
      actions: [{ label: '🎟️ حجز رحلة', action: 'booking' }, { label: '🗺️ الأماكن السياحية', action: 'destinations' }, { label: '👑 رحلة خاصة', action: 'private' }]
    };
  }

  // Default Kurdish Sorani ('ku') — Friendly Conversational + KURDIA Exclusive + General Topics
  if (
    q === 'سڵاو' || q === 'سلاو' || q.includes('چۆنیت') || q.includes('چۆنی') ||
    q.includes('باشیت') || q.includes('چ خەبەر') || q.includes('کێیت') ||
    q.includes('ناوت چییە') || q.includes('تۆ کێیت') || q.includes('قوربان')
  ) {
    return {
      text: `سڵاو و ڕێز هاوڕێی ئازیز! 🌿 زۆر سوپاس، من زۆر باشم و هەمیشە ئامادەم بۆ گفتوگۆ لەگەڵ تۆ!\n\nمن **یاریدەدەری زیرەکی فەرمی KURDIA ADVENTURE** ـم. دەتوانین پێکەوە قسە بکەین لەسەر:\n• **گەشتەکانی KURDIA:** گەشتی داهاتوومان بۆ **${mainTrip.title}** ـە (${mainTrip.price || '35,000 دینار'})\n• **زانیاری گشتی و ڕێنمایی شاخەوانی:** جلوبەرگ، کەمپینگ، کەشوهەوا و سروشتی کوردستان\n• **گەشتی تایبەت (VIP)** بۆ خێزان و هاوڕێکانت\n\nحەز دەکەیت لەسەر چی قسە بکەین؟ 😊`,
      actions: [{ label: '🎟️ گەشتی داهاتوو', action: 'booking' }, { label: '🗺️ شوێنەکان', action: 'destinations' }, { label: '⛅ کەشوهەوا', action: 'weather' }]
    };
  }

  if (q.includes('سوپاس') || q.includes('دەستخۆش') || q.includes('سەرکەوتوو') || q.includes('بژی') || q.includes('جوانە')) {
    return {
      text: `زۆر سوپاس بۆ وشە جوانەکانت هاوڕێی ئازیز! ❤️ شانازییە بۆ تیمی **KURDIA ADVENTURE** کە خزمەتی ئێوە دەکەین.\n\nئەگەر هەر پرسیارێکی ترت هەیە لەسەر گەشتەکان، سروشت، یان هەر بابەتێکی تر، من لێرەم و بە خۆشحاڵییەوە وەڵامت دەدەمەوە! 🌿`,
      actions: [{ label: '🎟️ بەشداری گەشت', action: 'booking' }, { label: '👑 گەشتی تایبەت', action: 'private' }]
    };
  }

  if (q.includes('جل') || q.includes('پێڵاو') || q.includes('جانتا') || q.includes('ئامادە') || q.includes('چی بهێنم') || q.includes('پێداویستی')) {
    return {
      text: `🎒 **ڕێنمایی KURDIA ADVENTURE بۆ ئامادەکاری گەشت و شاخەوانی:**\n\n• **پێڵاوی گونجاو:** پێڵاوی شاخەوانی یان وەرزشی نەرم و دژە خلیسک.\n• **جلوبەرگ:** جلی ئاسوودە و چەند چینێک (چاکەتی سووک بۆ لووتکە و ئێواران).\n• **پێداویستی کەسی:** بتڵێک ئاو، چاوێلکەی هەتاوی، دژەخۆر، و پاوەربانک بۆ مۆبایلەکەت.\n• **خزمەتگوزارییەکانی KURDIA:** پاسی گەشتیاری VIP، ڕێبەری شارەزای شاخەوانی، چای سەر خەڵووز و فۆتۆگرافەری پڕۆفیشناڵ لەسەر تیمی خۆمانە!`,
      actions: [{ label: '🎟️ ناو تۆمارکردن لە گەشت', action: 'booking' }, { label: '⛅ بینینی کەشوهەوا', action: 'weather' }]
    };
  }

  if (q.includes('گەشت') && (q.includes('هەفتە') || q.includes('داهاتوو') || q.includes('چییە') || q.includes('کەی') || q.includes('بەردەست'))) {
    const listTxt = trips.map((t, idx) => `• **${idx + 1}. ${t.title || 'گەشتی KURDIA'}** — 📍 ${t.location || 'کوردستان'} | 📅 ${t.date || 'بەم زووانە'} | 💰 ${t.price || '35,000 دینار'} | ⏰ ${t.time || '06:00 بەیانی'}`).join('\n');
    return {
      text: `🌿 **گەشتە بەردەستەکانی KURDIA ADVENTURE:**\n\n${listTxt}\n\nهەموو گەشتەکانمان پاسی گەشتیاری VIP، ڕێبەری شارەزای شاخەوانی و فۆتۆگرافەری پڕۆفیشناڵیان لەگەڵدایە. دەتەوێت ئێستا ناوت تۆمار بکەیت؟`,
      actions: [{ label: '🎟️ بەشداری لە گەشت بکە', action: 'booking' }, { label: '📍 بینینی شوێنەکان', action: 'destinations' }]
    };
  }
  if (q.includes('بەشداری') || q.includes('ناو') || q.includes('تۆمار') || q.includes('چۆن') || q.includes('پارە') || q.includes('fib') || q.includes('پسوڵە') || q.includes('نرخ')) {
    return {
      text: `🎟️ **چۆنیەتی ناو تۆمارکردن لە KURDIA ADVENTURE بە ٣ هەنگاو:**\n\n• **هەنگاوی ١:** لە بەشی «بەشداری» گەشتی دڵخوازت هەڵبژێرە، ناوی سیانی خۆت و ژمارەی کەسەکان دیاری بکە (دەتوانیت ناوی هەموو هاوڕێکانیشت بنووسیت).\n• **هەنگاوی ٢:** ژمارەی مۆبایل (WhatsApp) بنووسە و کۆدی ٤ ژمارەیی OTP پشتڕاست بکەرەوە.\n• **هەنگاوی ٣:** بڕی بەشداری (${mainTrip.price || '35,000 دینار'} بۆ هەر کەسێک) بنێرە بۆ هەژماری فەرمی **FIB: 0750 313 0360** و وێنەی پسوڵەکە باربکە.`,
      actions: [{ label: '🎟️ چوون بۆ فۆڕمی تۆمارکردن', action: 'booking' }, { label: '💬 پرسیار لە وەتسئەپ', action: 'whatsapp' }]
    };
  }
  if (q.includes('پیادە') || q.includes('شاخ') || q.includes('شوێن') || q.includes('کوێ') || q.includes('سروشت') || q.includes('هەڵگورد') || q.includes('دووکان')) {
    const hikingPlaces = dests.filter(d => d.hasHiking !== false).slice(0, 6);
    const pTxt = hikingPlaces.map(d => `• **${d.name}** (${d.region || 'کوردستان'}) — 🥾 ${d.hikingDuration || '٢ تا ٣ کاتژمێر پیادەڕەوی'}`).join('\n');
    return {
      text: `🏔️ **شوێنە شاخەوانی و گەشتیارییەکانی KURDIA ADVENTURE:**\n\n${pTxt || '• چیای هەڵگورد و دۆڵی باڵەکایەتی\n• دەریاچەی دووکان و قەشقۆڵی\n• خەرەندی ڕەواندز و گەلی عەلی بەگ\n• هەورامان و تەوێڵە\n• گۆماوی فێڵاو'}\n\nلە بەشی «شوێنەکان» دەتوانیت تەواوی زانیاری، بەرزی لە ئاستی دەریا و ماوەی پیادەڕەوی هەر شوێنێک ببینیت.`,
      actions: [{ label: '🗺️ بینینی هەموو شوێنەکان', action: 'destinations' }, { label: '👑 داواکاری گەشتی تایبەت', action: 'private' }]
    };
  }
  if (q.includes('تایبەت') || q.includes('خێزان') || q.includes('گروپ') || q.includes('vip')) {
    return {
      text: `👑 **ڕێکخستنی گەشتی تایبەت لەگەڵ KURDIA (VIP & گروپ و خێزانی):**\n\nئەگەر دەتەوێت لەگەڵ خێزانەکەت یان هاوڕێکانت بە جیا گەشت بکەیت، لە بەشی «گەشتی تایبەت» شوێن، بەروار، ژمارەی کەس و خزمەتگوزارییەکان (پاسی تایبەت، کەپر/کەمپ، ڕێبەر و فۆتۆگرافەر) دیاری بکە و تیمی KURDIA هەموو شتێکت بۆ ئامادە دەکات.`,
      actions: [{ label: '👑 داواکاری گەشتی تایبەت', action: 'private' }, { label: '💬 ڕاوێژکاری لە وەتسئەپ', action: 'whatsapp' }]
    };
  }
  if (q.includes('کەش') || q.includes('باران') || q.includes('بەفر') || q.includes('با') || q.includes('پلە')) {
    return {
      text: `⛅ **وێستگەی کەشوهەوا و نەخشەی شاخەوانی KURDIA:**\n\nلە بەشی «کەشوهەوا» دەتوانیت پێشبینی وردی ٢٤ کاتژمێر و ٧ ڕۆژی داهاتوو، خێرایی و ئاراستەی با بە زیندوویی لەسەر نەخشە، و ڕێنمایی شاخەوانی بۆ هەموو چیا و شارەکانی کوردستان ببینیت.`,
      actions: [{ label: '⛅ کردنەوەی بەشی کەشوهەوا', action: 'weather' }]
    };
  }

  return {
    text: `🌿 **خۆشحاڵم بە قسەکردن لەگەڵت لە KURDIA ADVENTURE!**\n\nمن وەک هاوڕێ و ڕێبەری زیرەکی **KURDIA** دەتوانم قسەت لەگەڵ بکەم لەسەر هەموو کارەکانی کوردیا و زانیاری گشتی:\n• **گەشتی داهاتوو:** ${mainTrip.title || 'گەشتی کوردستان'} (${mainTrip.date || 'بەم زووانە'} · ${mainTrip.price || '35,000 دینار'})\n• **شوێنەکان، شاخەوانی و ڕێنمایی کەلوپەلی گەشت**\n• **ناو تۆمارکردن و هەژماری فەرمی FIB:** \`0750 313 0360\`\n• **گەشتی تایبەت (VIP)** و کەشوهەوای چیاکانی کوردستان\n\nهەر پرسیارێکی ترت هەیە بە خۆشحاڵییەوە بۆم بنووسە!`,
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
        const history = Array.isArray(payload.history) ? payload.history.slice(-8) : [];

        const fallbackResult = buildSmartLocalAIResponse(prompt, lang, siteState);

        try {
          const ai = getGeminiClient();
          if (ai && prompt) {
            const langName = lang === 'en' ? 'English' : (lang === 'ar' ? 'Arabic (العربية)' : 'Kurdish Sorani (کوردیی سۆرانی)');
            const sysInstruction = [
              `You are the official smart AI conversational companion and Mountain & Travel Concierge for KURDIA ADVENTURE (kurdiaadventure.com), the premier outdoor, hiking, camping, and adventure platform in the Kurdistan Region.`,
              `STRICT EXCLUSIVITY RULE: You represent ONLY KURDIA ADVENTURE. NEVER mention, name, promote, or compare any other hiking, travel, or tourism groups/companies/agencies under any circumstances. If asked about other groups, politely state that you are exclusively the official assistant of KURDIA ADVENTURE.`,
              `CONVERSATIONAL SCOPE: Speak naturally, warmly, and friendlily with the user! In addition to all KURDIA ADVENTURE trips, booking, FIB payment (0750 313 0360), WhatsApp (+964 750 313 0360), VIP private trips, and destinations, you ARE allowed and encouraged to chat naturally about general helpful topics such as hiking gear/clothing advice, camping tips, Kurdistan geography & history, mountain safety, photography, nature, weather, and friendly daily conversation.`,
              `Always reply fluently in ${langName} unless the user explicitly writes in another language.`,
              `Keep answers concise, engaging, and well-structured for mobile screens (use bullet points • and **bold** key terms).`,
              `Live Website Data Context: ${JSON.stringify(siteState)}`
            ].join('\n');

            const conversationText = history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
            const fullPrompt = conversationText ? `${conversationText}\nUser: ${prompt}` : prompt;

            const response = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: fullPrompt,
              config: {
                systemInstruction: sysInstruction,
                temperature: 0.65
              }
            });

            const aiText = (response && response.text) ? String(response.text).trim() : '';
            if (aiText) {
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({
                ok: true,
                text: aiText,
                actions: fallbackResult.actions || [],
                source: 'gemini-3.8-flash'
              }));
              return;
            }
          }
        } catch (aiErr) {
          console.warn('Gemini /api/ai fallback:', aiErr?.message || aiErr);
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
          const updated = {
            ...current,
            ...payload,
            updatedAt: new Date().toISOString()
          };
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
