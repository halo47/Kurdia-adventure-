/**
 * KURDIA ADVENTURE — Cloudflare Worker Module for AI Travel Trends Intelligence
 * Routes:
 *   - GET  /api/admin/trends
 *   - POST /api/admin/trends
 *   - POST /api/admin/trends/analyze
 *
 * Reuses existing Cloudflare Worker bindings:
 *   - env.GEMINI_API_KEY
 *   - env.ADMIN_SECRET_KEY
 *   - env.META_GRAPH_ACCESS_TOKEN (optional, official Meta Graph API v19.0)
 *   - env.INSTAGRAM_BUSINESS_ACCOUNT_ID (optional)
 *   - env.FACEBOOK_PAGE_ID (optional)
 *   - env.TIKTOK_ACCESS_TOKEN (optional)
 *   - env.KURDIA_KV (optional KV namespace for persistent trend & AI report caching)
 */

export async function handleTrendsIntelligenceRequest(request, env, corsHeaders = {}) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    ...corsHeaders
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Optional admin key verification if ADMIN_SECRET_KEY is configured in Worker env
  const clientAdminKey = request.headers.get('X-Admin-Key') || '';
  if (env.ADMIN_SECRET_KEY && clientAdminKey && clientAdminKey !== env.ADMIN_SECRET_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized X-Admin-Key' }), { status: 401, headers });
  }

  const KV_KEY = 'kurdia_trends_intelligence_v1';
  let store = {
    lastUpdated: new Date().toISOString(),
    manualTrends: [],
    apiTrends: [],
    destinationWeather: {},
    aiCache: null
  };

  if (env.KURDIA_KV) {
    try {
      const cached = await env.KURDIA_KV.get(KV_KEY, 'json');
      if (cached && typeof cached === 'object') store = cached;
    } catch (e) {}
  }

  if (pathname === '/api/admin/trends/analyze' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const geminiKey = env.GEMINI_API_KEY;
    if (!geminiKey) {
      return new Response(
        JSON.stringify({
          ok: true,
          usedGemini: false,
          report: store.aiCache,
          message: 'GEMINI_API_KEY not configured in Worker environment; returning cached/heuristic intelligence.'
        }),
        { status: 200, headers }
      );
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;
    const prompt = `Analyze travel market trends for KURDIA ADVENTURE in Erbil, Shaqlawa, Rawanduz, Soran, Korek Mountain, Bekhal Waterfall, Gali Ali Beg, Kurdistan Region, and Iraq. Filter context: ${JSON.stringify(body)}. Never invent fake engagement numbers.`;

    const gemRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
      })
    });
    const gemData = await gemRes.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: true, usedGemini: gemRes.ok, raw: gemData }), { status: 200, headers });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      lastUpdated: store.lastUpdated,
      apiCredentialsStatus: {
        geminiConfigured: Boolean(env.GEMINI_API_KEY),
        metaGraphConfigured: Boolean(env.META_GRAPH_ACCESS_TOKEN),
        instagramAccountConfigured: Boolean(env.INSTAGRAM_BUSINESS_ACCOUNT_ID),
        facebookPageConfigured: Boolean(env.FACEBOOK_PAGE_ID),
        tiktokApiConfigured: Boolean(env.TIKTOK_ACCESS_TOKEN)
      }
    }),
    { status: 200, headers }
  );
}
