// ============================================================
// KURDIA ADVENTURE — CLOUDFLARE WORKER
// Fixed registration + Telegram + WhatsApp Cloud API
// Preserved v7 WhatsApp implementation; added ECMWF weather + live CMS Kurdish AI.
// ============================================================

const DEFAULT_GRAPH_VERSION = "v22.0";
const DEFAULT_WHATSAPP_TEMPLATE_NAME = "kurdia_notification";
const DEFAULT_WHATSAPP_LANGUAGE = "en_US";
const DEFAULT_WHATSAPP_VERIFY_TOKEN = "kurdia_adventure_verify_2026";

const inMemoryDB = {
  trips: [{
    id: "trip-helgurd-01",
    title: "گەشتی لووتکەی چیای هەڵگورد",
    location: "باڵەکایەتی — چیای هەڵگورد",
    price: "٣٥،٠٠٠ دینار",
    time: "بەیانی ٠٥:٠٠",
    duration: "١ ڕۆژ",
    difficulty: "مامناوەند",
    capacity: 40,
    booked: 29,
    status: "active",
    published: true,
    heroImageUrl: "",
    desc: "گەشتێکی پڕ لە جوش و خڕۆش بە هاوڕێیەتی ڕێبەری شارەزا...",
    createdAt: new Date().toISOString()
  }],
  stories: [],
  reviews: [],
  registrations: [],
  notifications: [],
  analytics: {
    pageViews: 0,
    tripViews: 0,
    storyViews: 0,
    galleryViews: 0,
    bookingSubmissions: 0,
    waClicks: 0,
    shareClicks: 0
  }
};

const WA_SETTINGS = {
  mapsUrl: "https://maps.app.goo.gl/kurdia-adventure-meeting"
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    try {
      const path = url.pathname;

      // Admin event stream — additive only. Logs meaningful POST events without reading request bodies.
      if (request.method === "POST" && !path.startsWith("/api/admin/notifications") && path !== "/api/push/subscribe") {
        ctx.waitUntil(recordAdminEvent(env, path, request));
      }

      // ======================================================
      // ROOT
      // ======================================================

      if (
        request.method === "GET" &&
        (path === "/" || path === "")
      ) {
        return json({
          ok: true,
          status: "ONLINE",
          app: "KURDIA ADVENTURE API"
        });
      }

      // ======================================================
      // TELEGRAM WEBHOOK SETUP
      // ======================================================

      if (
        request.method === "GET" &&
        path === "/api/telegram/set-webhook"
      ) {
        if (!env.TELEGRAM_BOT_TOKEN) {
          return json({
            ok: false,
            error: "Telegram Token missing"
          }, 500);
        }

        const workerUrl = url.origin;

        const tgRes = await fetch(
          `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(
            `${workerUrl}/api/telegram/webhook`
          )}`
        );

        const tgData = await tgRes
          .json()
          .catch(() => ({}));

        return json(
          tgData,
          tgRes.ok ? 200 : 502
        );
      }

      // ======================================================
      // AI
      // ======================================================

      if (
        request.method === "POST" &&
        path === "/api/ai"
      ) {
        return await handleAI(request, env);
      }

      // ======================================================
      // OTP SEND
      // ======================================================

      if (
        request.method === "POST" &&
        path === "/api/otp/send"
      ) {
        const body = await safeJson(request);

        const phone = normalizeIraqPhone(
          body.phone || body.phoneNumber
        );

        if (!isValidIraqPhone(phone)) {
          return json({
            ok: false,
            error: "ژمارەی مۆبایل نادروستە"
          }, 400);
        }

        const code = Math
          .floor(1000 + Math.random() * 9000)
          .toString();

        const otpData = {
          code,
          expires: Date.now() + 5 * 60 * 1000
        };

        if (env.KURDIA_KV) {
          try {
            await env.KURDIA_KV.put(
              `otp_${phone}`,
              JSON.stringify(otpData),
              {
                expirationTtl: 300
              }
            );
          } catch (_) {}
        }

        // Approved WhatsApp template must contain
        // a body placeholder for the OTP.
        const waRes = await sendWhatsAppTemplate(
          env,
          phone,
          [code],
          {
            templateName:
              env.WHATSAPP_OTP_TEMPLATE_NAME ||
              env.WHATSAPP_TEMPLATE_NAME ||
              DEFAULT_WHATSAPP_TEMPLATE_NAME,
            languageCode:
              env.WHATSAPP_OTP_TEMPLATE_LANGUAGE ||
              env.WHATSAPP_TEMPLATE_LANGUAGE ||
              DEFAULT_WHATSAPP_LANGUAGE
          }
        );

        if (!waRes.ok) {
          return json({
            ok: false,
            error: waRes.error
          }, 502);
        }

        return json({
          ok: true,
          message: "کۆد نێردرا",
          phone
        });
      }

      // ======================================================
      // OTP VERIFY
      // ======================================================

      if (
        request.method === "POST" &&
        path === "/api/otp/verify"
      ) {
        const body = await safeJson(request);

        const phone = normalizeIraqPhone(
          body.phone || body.phoneNumber
        );

        const inputCode = String(
          body.code || ""
        ).trim();

        let stored = null;

        if (env.KURDIA_KV) {
          try {
            const raw = await env.KURDIA_KV.get(
              `otp_${phone}`
            );

            if (raw) {
              stored = JSON.parse(raw);
            }
          } catch (_) {}
        }

        if (
          !stored ||
          Date.now() > stored.expires ||
          stored.code !== inputCode
        ) {
          return json({
            ok: false,
            error: "کۆدەکە هەڵەیە یان بەسەرچووە"
          }, 400);
        }

        if (env.KURDIA_KV) {
          try {
            await env.KURDIA_KV.delete(`otp_${phone}`);
            // Keep a short-lived proof that this phone passed OTP.
            await env.KURDIA_KV.put(
              `otp_verified_${phone}`,
              JSON.stringify({ verified: true, at: Date.now() }),
              { expirationTtl: 600 }
            );
          } catch (_) {}
        }

        return json({
          ok: true,
          verified: true
        });
      }

      // ======================================================
      // REGISTRATION
      // ======================================================

      if (
        request.method === "POST" &&
        path === "/api/register"
      ) {
        inMemoryDB.analytics.bookingSubmissions++;

        return await handleRegistration(
          request,
          env,
          ctx
        );
      }

      // ======================================================
      // TELEGRAM WEBHOOK
      // ======================================================

      if (
        request.method === "POST" &&
        path === "/api/telegram/webhook"
      ) {
        return await handleTelegramWebhook(
          request,
          env,
          ctx
        );
      }

      // ======================================================
      // STORIES
      // ======================================================

      if (path === "/api/stories") {

        // GET STORIES
        if (request.method === "GET") {

          let allStories = inMemoryDB.stories;

          if (env.KURDIA_KV) {
            try {
              allStories =
                (await env.KURDIA_KV.get(
                  "kurdia_stories",
                  "json"
                )) || [];
            } catch (_) {}
          }

          if (url.searchParams.get("admin") === "true") {
            if (!isAdminAuthorized(request, env)) return json({ok:false,error:"دەسەڵات پێنەدراوە"},401);
            return json({ok:true,stories:allStories});
          }

          const now = Date.now();

          return json({
            ok: true,
            stories: allStories.filter(
              s =>
                s.status === "approved" &&
                now - s.timestamp <
                  24 * 60 * 60 * 1000
            )
          });
        }

        // POST STORY
        if (request.method === "POST") {

          const body = await safeJson(request);

          if (
            !body.name ||
            !body.text ||
            !body.mediaUrl
          ) {
            return json({
              ok: false,
              error:
                "تکایە ناو، دەق و وێنەی ستۆری دیاری بکە"
            }, 400);
          }

          const newStory = {
            id:
              "st-" +
              Date.now().toString(36),

            name: sanitize(body.name),

            city: sanitize(
              body.city || "هەولێر"
            ),

            tripName: sanitize(
              body.tripName || "KURDIA"
            ),

            text: sanitize(body.text),

            mediaUrl: String(
              body.mediaUrl
            ),

            status: "pending",

            views: 0,

            likes: 0,

            timestamp: Date.now(),

            createdAt:
              new Date().toISOString()
          };

          if (env.KURDIA_KV) {
            try {
              const existing =
                (await env.KURDIA_KV.get(
                  "kurdia_stories",
                  "json"
                )) || [];

              existing.unshift(newStory);

              await env.KURDIA_KV.put(
                "kurdia_stories",
                JSON.stringify(existing)
              );
            } catch (_) {
              inMemoryDB.stories.unshift(
                newStory
              );
            }
          } else {
            inMemoryDB.stories.unshift(
              newStory
            );
          }

          if (
            env.TELEGRAM_BOT_TOKEN &&
            env.TELEGRAM_CHAT_ID
          ) {
            const caption =
              `✨ <b>ستۆرییەکی نوێ نێردرا!</b>\n\n` +
              `👤 <b>ناو:</b> ${escapeHtml(
                newStory.name
              )} (${escapeHtml(
                newStory.city
              )})\n` +
              `🏔️ <b>گەشت:</b> ${escapeHtml(
                newStory.tripName
              )}\n` +
              `💬 <b>دەق:</b> «${escapeHtml(
                newStory.text
              )}»\n\n` +
              `بڕۆ بۆ دەستەی کۆنترۆڵ بۆ پەسەندکردنی.`;

            ctx.waitUntil(
              sendTelegramMessage(
                env,
                caption,
                {
                  parseMode: "HTML"
                }
              )
            );
          }

          return json({
            ok: true,
            message:
              "ستۆرییەکەت بە سەرکەوتوویی نێردرا و پاش پەسەندکردن دەردەکەوێت.",
            story: newStory
          });
        }
      }

      // ======================================================
      // STORY MODERATION
      // ======================================================

      if (
        path.startsWith(
          "/api/stories/moderation/"
        )
      ) {
        if (!isAdminAuthorized(request, env)) return json({ok:false,error:"دەسەڵات پێنەدراوە"},401);
        const parts = path.split("/");

        const storyId = parts[4];

        const action = parts[5];

        let stories = inMemoryDB.stories;

        if (env.KURDIA_KV) {
          try {
            stories =
              (await env.KURDIA_KV.get(
                "kurdia_stories",
                "json"
              )) || [];
          } catch (_) {}
        }

        if (action === "delete") {

          stories =
            stories.filter(
              s => s.id !== storyId
            );

          inMemoryDB.stories =
            inMemoryDB.stories.filter(
              s => s.id !== storyId
            );

        } else {

          const story =
            stories.find(
              s => s.id === storyId
            );

          if (story) {

            if (
              action === "approve"
            ) {
              story.status = "approved";
            }

            if (
              action === "reject"
            ) {
              story.status = "rejected";
            }
          }
        }

        if (env.KURDIA_KV) {
          try {
            await env.KURDIA_KV.put(
              "kurdia_stories",
              JSON.stringify(stories)
            );
          } catch (_) {}
        }

        return json({
          ok: true,
          action,
          storyId
        });
      }

      // ======================================================
      // STORY LIKE
      // ======================================================

      if (
        path.startsWith("/api/stories/") &&
        path.endsWith("/like")
      ) {
        const id =
          path.split("/")[3];

        let stories =
          inMemoryDB.stories;

        if (env.KURDIA_KV) {
          try {
            stories =
              (await env.KURDIA_KV.get(
                "kurdia_stories",
                "json"
              )) || [];
          } catch (_) {}
        }

        const st =
          stories.find(
            s => s.id === id
          );

        if (!st) {
          return json({
            ok: false
          }, 404);
        }

        st.likes =
          (st.likes || 0) + 1;

        if (env.KURDIA_KV) {
          try {
            await env.KURDIA_KV.put(
              "kurdia_stories",
              JSON.stringify(stories)
            );
          } catch (_) {}
        }

        return json({
          ok: true,
          likes: st.likes
        });
      }

      // ======================================================
      // STORY VIEW
      // ======================================================

      if (
        path.startsWith("/api/stories/") &&
        path.endsWith("/view")
      ) {
        const id =
          path.split("/")[3];

        let stories =
          inMemoryDB.stories;

        if (env.KURDIA_KV) {
          try {
            stories =
              (await env.KURDIA_KV.get(
                "kurdia_stories",
                "json"
              )) || [];
          } catch (_) {}
        }

        const st =
          stories.find(
            s => s.id === id
          );

        if (!st) {
          return json({
            ok: false
          }, 404);
        }

        st.views =
          (st.views || 0) + 1;

        inMemoryDB.analytics.storyViews++;

        if (env.KURDIA_KV) {
          try {
            await env.KURDIA_KV.put(
              "kurdia_stories",
              JSON.stringify(stories)
            );
          } catch (_) {}
        }

        return json({
          ok: true,
          views: st.views
        });
      }

      // ======================================================
      // ADMIN VERIFY BOOKING
      // ======================================================

      if (
        request.method === "POST" &&
        path === "/api/admin/verify-booking"
      ) {
        if (!isAdminAuthorized(request, env)) return json({ok:false,error:"دەسەڵات پێنەدراوە"},401);
        const body =
          await safeJson(request);

        const phone =
          normalizeIraqPhone(
            body.phone
          );

        const id =
          String(body.id || "");

        // trip_confirmation in Meta currently has EXACTLY 4 body variables:
        // {{1}} Booking ID, {{2}} customer name, {{3}} people count, {{4}} maps URL.
        // Load the real registration so the Worker sends all 4 parameters.
        const registrations = await kvListGet(env, "kurdia_registrations");
        const registration = registrations.find(x => String(x.id) === id);

        const customerName = String(
          body.name ||
          registration?.name ||
          "KURDIA ADVENTURE"
        );
        const peopleCount = String(
          body.people ??
          registration?.people ??
          "1"
        );
        const mapsUrl = String(
          body.mapsUrl ||
          WA_SETTINGS.mapsUrl
        );

        const waRes =
          await sendWhatsAppTemplate(
            env,
            phone,
            [
              id,
              customerName,
              peopleCount,
              mapsUrl
            ],
            {
              templateName:
                env.WHATSAPP_CONFIRMATION_TEMPLATE_NAME ||
                "trip_confirmation",
              languageCode:
                env.WHATSAPP_CONFIRMATION_TEMPLATE_LANGUAGE ||
                "ar"
            }
          );

        return json(
          {
            ok: waRes.ok,
            error: waRes.ok
              ? undefined
              : waRes.error
          },
          waRes.ok ? 200 : 502
        );
      }

      // ======================================================
      // ADMIN REJECT BOOKING
      // ======================================================

      if (
        request.method === "POST" &&
        path === "/api/admin/reject-booking"
      ) {
        if (!isAdminAuthorized(request, env)) return json({ok:false,error:"دەسەڵات پێنەدراوە"},401);
        const body =
          await safeJson(request);

        const phone =
          normalizeIraqPhone(
            body.phone
          );

        const id =
          String(body.id || "");

        const reason =
          String(
            body.reason ||
              "پسوولەکە ناڕوونە یان بڕی پارەکە تەواو نییە"
          );

        const waRes =
          await sendWhatsAppTemplate(
            env,
            phone,
            [
              id,
              reason
            ],
            {
              templateName:
                env.WHATSAPP_REJECTED_TEMPLATE_NAME ||
                "trip_rejected",
              // Meta template screenshot shows this template as English (en), not en_US.
              languageCode: "en"
            }
          );

        return json(
          {
            ok: waRes.ok,
            error: waRes.ok
              ? undefined
              : waRes.error
          },
          waRes.ok ? 200 : 502
        );
      }


      // ======================================================
      // ADMIN NOTIFICATION CENTER — additive only
      // ======================================================
      if (request.method === "GET" && path === "/api/admin/notifications") {
        if (!isAdminAuthorized(request, env)) return json({ok:false,error:"دەسەڵات پێنەدراوە"},401);
        let items = await kvListGet(env, "kurdia_notifications");
        if (!items.length) items = await kvListGet(env, "kurdia_admin_notifications");
        const sorted = items.slice().sort((a,b) => String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
        return json({ok:true,notifications:sorted.slice(0,200),unread:sorted.filter(x=>!x.read).length});
      }

      if (request.method === "POST" && path === "/api/admin/notifications/read") {
        if (!isAdminAuthorized(request, env)) return json({ok:false,error:"دەسەڵات پێنەدراوە"},401);
        const body = await safeJson(request);
        let items = await kvListGet(env, "kurdia_notifications");
        const usingCanonical = items.length > 0;
        if (!usingCanonical) items = await kvListGet(env, "kurdia_admin_notifications");
        if (body.all === true) {
          for (const item of items) item.read = true;
        } else {
          const ids = new Set(Array.isArray(body.ids) ? body.ids.map(String) : []);
          for (const item of items) if (ids.has(String(item.id))) item.read = true;
        }
        await kvListPut(env, usingCanonical ? "kurdia_notifications" : "kurdia_admin_notifications", items);
        return json({ok:true});
      }

      // ======================================================
      // ONESIGNAL WEB PUSH — additive only
      // ======================================================
      // Public App ID is safe to expose to browsers. The REST API key MUST
      // remain a Cloudflare Worker secret (ONESIGNAL_REST_API_KEY).
      if (request.method === "GET" && path === "/api/push/onesignal-config") {
        const appId = String(env.ONESIGNAL_APP_ID || "").trim();
        return json({ ok: !!appId, appId });
      }

      if (request.method === "POST" && path === "/api/admin/send-push") {
        if (!isAdminAuthorized(request, env)) return json({ok:false,error:"دەسەڵات پێنەدراوە"},401);
        const body = await safeJson(request);
        const appId = String(env.ONESIGNAL_APP_ID || "").trim();
        const apiKey = String(env.ONESIGNAL_REST_API_KEY || "").trim();
        const title = String(body.title || "KURDIA ADVENTURE").trim().slice(0,120);
        const message = String(body.message || body.body || "").trim().slice(0,2000);
        const urlTarget = String(body.url || "/").trim() || "/";
        if (!appId) return json({ok:false,error:"ONESIGNAL_APP_ID لە Cloudflare Variables دانەنراوە"},500);
        if (!apiKey) return json({ok:false,error:"ONESIGNAL_REST_API_KEY لە Cloudflare Secret دانەنراوە"},500);
        if (!message) return json({ok:false,error:"دەقی ئاگاداری بنووسە"},400);

        const payload = {
          app_id: appId,
          target_channel: "push",
          name: `KURDIA Admin ${new Date().toISOString()}`,
          headings: { en: title },
          contents: { en: message },
          included_segments: ["Subscribed Users"],
          url: new URL(urlTarget, url.origin).toString()
        };
        const osRes = await fetch("https://api.onesignal.com/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Key ${apiKey}`
          },
          body: JSON.stringify(payload)
        });
        const raw = await osRes.text();
        let data = {}; try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {raw}; }
        if (!osRes.ok) {
          return json({ok:false,error:data?.errors?.[0] || data?.message || raw || `OneSignal HTTP ${osRes.status}`,status:osRes.status},502);
        }
        return json({ok:true,provider:"onesignal",id:data.id || null,recipients:data.recipients ?? null,onesignal:data});
      }

      // ======================================================
      // PWA PUSH NOTIFICATIONS — additive only
      // ======================================================
      if (request.method === "GET" && path === "/api/push/public-key") {
        const publicKey = String(env.VAPID_PUBLIC_KEY || PUSH_VAPID_PUBLIC_KEY || "").trim();
        return json({ ok: !!publicKey, publicKey });
      }

      if (request.method === "POST" && path === "/api/push/subscribe") {
        const body = await safeJson(request);
        const sub = body.subscription || body;
        if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
          return json({ok:false,error:"Push subscription نادروستە"},400);
        }
        const item = {
          id: await pushSubscriptionId(String(sub.endpoint)),
          endpoint: String(sub.endpoint),
          keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) },
          source: String(body.source || "website"),
          url: String(body.url || "/"),
          updatedAt: new Date().toISOString()
        };
        const items = await kvListGet(env, "kurdia_push_subscriptions");
        const next = [item, ...items.filter(x => x && x.endpoint !== item.endpoint)];
        if (next.length > 5000) next.length = 5000;
        await kvListPut(env, "kurdia_push_subscriptions", next);
        return json({ok:true,subscribed:true});
      }

      if (request.method === "GET" && path === "/api/admin/push/stats") {
        if (!isAdminAuthorized(request, env)) return json({ok:false,error:"دەسەڵات پێنەدراوە"},401);
        const items = await kvListGet(env, "kurdia_push_subscriptions");
        return json({ok:true,count:items.length,updatedAt:new Date().toISOString()});
      }

      if (request.method === "POST" && path === "/api/admin/push/send") {
        if (!isAdminAuthorized(request, env)) return json({ok:false,error:"دەسەڵات پێنەدراوە"},401);
        const body = await safeJson(request);
        const title = String(body.title || "KURDIA ADVENTURE").trim().slice(0,120);
        const message = String(body.body || body.message || "").trim().slice(0,1000);
        const targetUrl = String(body.url || "/").trim() || "/";
        if (!message) return json({ok:false,error:"دەقی ئاگاداری بنووسە"},400);
        const items = await kvListGet(env, "kurdia_push_subscriptions");
        let sent=0, failed=0, removed=0;
        const errors=[];
        const kept=[];
        for (const sub of items) {
          try {
            const result = await sendWebPush(env, sub, {title, body:message, url:targetUrl});
            if (result.ok) { sent++; kept.push(sub); }
            else if (result.status === 404 || result.status === 410) { removed++; }
            else { failed++; kept.push(sub); if(errors.length<20) errors.push({endpoint:sub.endpoint,status:result.status,error:result.error}); }
          } catch (e) { failed++; kept.push(sub); if(errors.length<20) errors.push({endpoint:sub.endpoint,error:e?.message||String(e)}); }
        }
        await kvListPut(env, "kurdia_push_subscriptions", kept);
        return json({ok: failed===0, sent, failed, removed, total:items.length, errors});
      }

      // ======================================================
      // ADMIN BROADCAST
      // ======================================================

      if (
        request.method === "POST" &&
        path === "/api/admin/send-broadcast"
      ) {
        if (!isAdminAuthorized(request, env)) return json({ok:false,error:"دەسەڵات پێنەدراوە"},401);
        const body =
          await safeJson(request);

        const messageText =
          String(
            body.message || ""
          ).trim();

        const phoneList =
          Array.isArray(body.phones)
            ? body.phones
            : [];

        let sentCount = 0;

        const errors = [];

        for (
          const ph of phoneList
        ) {
          const cleanPhone =
            normalizeIraqPhone(ph);

          if (
            !isValidIraqPhone(
              cleanPhone
            )
          ) {
            continue;
          }

          const waRes =
            await sendWhatsAppTemplate(
              env,
              cleanPhone,
              [messageText]
            );

          if (waRes.ok) {
            sentCount++;
          } else {
            errors.push({
              phone: cleanPhone,
              error: waRes.error
            });
          }
        }

        return json({
          ok: errors.length === 0,
          sent: sentCount,
          failed: errors.length,
          errors
        });
      }

      // ======================================================
      // ADMIN SEND TRIP NOTIFICATION
      // Uses the approved Meta template: trip_notification
      // ======================================================

      if (
        request.method === "POST" &&
        path === "/api/admin/send-trip-notification"
      ) {
        if (!isAdminAuthorized(request, env)) return json({ok:false,error:"دەسەڵات پێنەدراوە"},401);
        const body = await safeJson(request);

        const messageText = String(
          body.message ||
          body.text ||
          ""
        ).trim();

        const phoneList = Array.isArray(body.phones)
          ? body.phones
          : body.phone
            ? [body.phone]
            : [];

        if (!messageText) {
          return json({
            ok: false,
            error: "دەقی ئاگادارکردنەوە بنووسە"
          }, 400);
        }

        if (!phoneList.length) {
          return json({
            ok: false,
            error: "هیچ ژمارەیەکی مۆبایل نەدراوە"
          }, 400);
        }

        let sentCount = 0;
        const errors = [];

        for (const ph of phoneList) {
          const cleanPhone = normalizeIraqPhone(ph);

          if (!isValidIraqPhone(cleanPhone)) {
            errors.push({
              phone: String(ph),
              error: "ژمارەی مۆبایل نادروستە"
            });
            continue;
          }

          const waRes = await sendWhatsAppTemplate(
            env,
            cleanPhone,
            [messageText],
            {
              templateName:
                env.WHATSAPP_TRIP_NOTIFICATION_TEMPLATE_NAME ||
                "trip_notification",
              // Meta template screenshot shows this template as English (en), not en_US.
              languageCode: "en"
            }
          );

          if (waRes.ok) {
            sentCount++;
          } else {
            errors.push({
              phone: cleanPhone,
              error: waRes.error
            });
          }
        }

        return json({
          ok: errors.length === 0,
          sent: sentCount,
          failed: errors.length,
          errors
        });
      }

      // ======================================================
      // ADMIN REGISTRATIONS
      // ======================================================

      if (
        request.method === "GET" &&
        path === "/api/admin/registrations"
      ) {
        if (!isAdminAuthorized(request, env)) return json({ok:false,error:"دەسەڵات پێنەدراوە"},401);
        return json({
          ok: true,
          registrations:
            await kvListGet(env, "kurdia_registrations")
        });
      }


      // ======================================================
      // PUBLIC TRIPS
      // ======================================================
      if (request.method === "GET" && path === "/api/trips") {
        const data = await getCMS(env);
        const trips = (data.trips || []).filter(x => x.published !== false);
        return json({ ok: true, trips });
      }

      // ======================================================
      // PUBLIC CMS / SITE DATA
      // ======================================================
      if (request.method === "GET" && path === "/api/site") {
        const data = await getCMS(env);
        return json({ ok: true, data: publicCMS(data) });
      }
      if (request.method === "GET" && path === "/api/site/config") {
        const data = await getCMS(env);
        return json({ ok: true, config: publicCMS(data) });
      }

      // ======================================================
      // WEATHER — COMPLETELY SEPARATE API
      // Uses Open-Meteo geocoding + forecast; no API key required.
      // ======================================================

      if (request.method === "GET" && path === "/api/weather/reverse") {
        const lat = Number(url.searchParams.get("lat"));
        const lon = Number(url.searchParams.get("lon"));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return json({ok:false,error:"Latitude/Longitude نادروستە"},400);
        }
        try {
          const u = new URL("https://nominatim.openstreetmap.org/reverse");
          u.searchParams.set("format","jsonv2");
          u.searchParams.set("lat",String(lat));
          u.searchParams.set("lon",String(lon));
          u.searchParams.set("zoom","18");
          u.searchParams.set("accept-language","ku");
          const r = await fetch(u.toString(), {headers:{"User-Agent":"KURDIA-ADVENTURE/5.0 contact:kurdia-adventure"}});
          if(!r.ok) return json({ok:false,error:"ناوی شوێن نەدۆزرایەوە"},502);
          const d = await r.json();
          return json({ok:true,displayName:d.display_name||"",address:d.address||{},latitude:lat,longitude:lon,source:"OpenStreetMap Nominatim"});
        } catch(e) {
          return json({ok:false,error:"Reverse geocoding بەردەست نییە"},502);
        }
      }

      if (request.method === "GET" && path === "/api/weather/search") {
        const q = String(url.searchParams.get("q") || "").trim();
        const lat = Number(url.searchParams.get("lat"));
        const lon = Number(url.searchParams.get("lon"));
        if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          return await weatherByCoordinates(lat, lon, q || `شوێنی ${lat.toFixed(4)}, ${lon.toFixed(4)}`, env);
        }
        if (!q) return json({ ok: false, error: "ناوی شوێن یان کۆئۆردینات بنووسە" }, 400);
        return await weatherSearch(q, env);
      }

      // ======================================================
      // PUBLIC DESTINATIONS / SAFETY / PREPARATION / REVIEWS
      // ======================================================
      if (request.method === "GET" && path === "/api/destinations") {
        const data = await getCMS(env);
        return json({ ok: true, items: data.destinations || [] });
      }
      if (request.method === "GET" && path === "/api/safety") {
        const data = await getCMS(env);
        return json({ ok: true, items: data.safety || [] });
      }
      if (request.method === "GET" && path === "/api/preparation") {
        const data = await getCMS(env);
        return json({ ok: true, items: data.preparation || [] });
      }
      if (request.method === "GET" && path === "/api/reviews") {
        const data = await getCMS(env);
        return json({ ok: true, items: (data.reviews || []).filter(x => x.status !== "hidden") });
      }

      // ======================================================
      // PUBLIC PRIVATE TRIP REQUEST
      // ======================================================
      if (request.method === "POST" && path === "/api/private-trip") {
        const body = await safeJson(request);
        const item = {
          id: makeId("ptr"),
          name: sanitize(body.name),
          phone: normalizeIraqPhone(body.phone),
          destination: sanitize(body.destination),
          date: sanitize(body.date),
          people: sanitize(body.people),
          tripType: sanitize(body.tripType || body.type),
          transportation: sanitize(body.transportation || body.transport),
          accommodation: sanitize(body.accommodation || body.stay),
          guide: sanitize(body.guide),
          budget: sanitize(body.budget),
          specialRequests: sanitize(body.specialRequests || body.special),
          latitude: Number.isFinite(Number(body.latitude)) ? Number(body.latitude) : null,
          longitude: Number.isFinite(Number(body.longitude)) ? Number(body.longitude) : null,
          status: "new",
          notes: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        if (!item.name || !isValidIraqPhone(item.phone) || !item.destination || !item.date) {
          return json({ ok: false, error: "تکایە زانیارییە سەرەکییەکان پڕ بکەرەوە" }, 400);
        }
        await kvListPush(env, "kurdia_private_requests", item, 5000);
        if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
          ctx.waitUntil(sendTelegramMessage(env,
            `👑 <b>داواکاری گەشتی تایبەت</b>\n\n` +
            `🆔 <code>${escapeHtml(item.id)}</code>\n` +
            `👤 ${escapeHtml(item.name)}\n` +
            `📱 <code>${escapeHtml(item.phone)}</code>\n` +
            `📍 ${escapeHtml(item.destination)}\n` +
            `📅 ${escapeHtml(item.date)}\n` +
            `👥 ${escapeHtml(item.people || "—")}\n` +
            `🏕️ ${escapeHtml(item.tripType || "—")}`,
            { parseMode: "HTML" }
          ));
        }
        return json({ ok: true, item });
      }

      // ======================================================
      // PUBLIC COUPONS
      // Validate a coupon without consuming it, or redeem it.
      // ======================================================
      if (request.method === "POST" && path === "/api/coupons/validate") {
        const body = await safeJson(request);
        const code = normalizeCouponCode(body.code);
        if (!code) return json({ok:false,error:"کۆدی داشکاندن بنووسە"},400);
        const coupons = await kvListGet(env,"kurdia_coupons");
        const coupon = coupons.find(x => normalizeCouponCode(x.code) === code);
        const check = validateCoupon(coupon, body.amount);
        if (!check.ok) return json(check,400);
        return json({ok:true,coupon:publicCoupon(coupon),discount:calculateCouponDiscount(coupon, body.amount),finalAmount:calculateFinalAmount(coupon, body.amount)});
      }

      if (request.method === "POST" && path === "/api/coupons/redeem") {
        const body = await safeJson(request);
        const code = normalizeCouponCode(body.code);
        if (!code) return json({ok:false,error:"کۆدی داشکاندن بنووسە"},400);
        const coupons = await kvListGet(env,"kurdia_coupons");
        const index = coupons.findIndex(x => normalizeCouponCode(x.code) === code);
        if (index < 0) return json({ok:false,error:"کۆدی داشکاندن نەدۆزرایەوە"},404);
        const coupon = coupons[index];
        const check = validateCoupon(coupon, body.amount);
        if (!check.ok) return json(check,400);
        const discount = calculateCouponDiscount(coupon, body.amount);
        const finalAmount = calculateFinalAmount(coupon, body.amount);
        coupon.usedCount = Number(coupon.usedCount || 0) + 1;
        coupon.lastUsedAt = new Date().toISOString();
        coupon.updatedAt = new Date().toISOString();
        coupon.lastRedemption = {
          at: coupon.lastUsedAt,
          bookingId: body.bookingId ? String(body.bookingId).slice(0,120) : undefined,
          phone: body.phone ? String(body.phone).slice(0,40) : undefined
        };
        coupons[index] = coupon;
        await kvListPut(env,"kurdia_coupons",coupons);
        return json({ok:true,message:"کۆدی داشکاندن بە سەرکەوتوویی بەکار هێنرا",coupon:publicCoupon(coupon),discount,finalAmount,usedCount:coupon.usedCount});
      }

      // ======================================================
      // ADMIN AUTH + CMS
      // Mutating admin routes require X-Admin-Key matching env.ADMIN_API_KEY.
      // GET routes may use the key optionally.
      // ======================================================
      if (path.startsWith("/api/admin/")) {
        const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
        if (mutating && !isAdminAuthorized(request, env)) {
          return json({ ok: false, error: "دەسەڵات پێنەدراوە" }, 401);
        }

        // ==================================================
        // COUPON / DISCOUNT CODE MANAGEMENT
        // ==================================================
        if (path === "/api/admin/coupons") {
          const coupons = await kvListGet(env,"kurdia_coupons");
          if (request.method === "GET") return json({ok:true,coupons});
          if (request.method === "POST") {
            const body = await safeJson(request);
            const code = normalizeCouponCode(body.code);
            if (!code) return json({ok:false,error:"کۆدی داشکاندن بنووسە"},400);
            if (coupons.some(x => normalizeCouponCode(x.code) === code)) return json({ok:false,error:"ئەم کۆدە پێشتر هەیە"},409);
            const type = body.type === "fixed" || body.type === "amount" ? "fixed" : "percent";
            const value = Number(body.value ?? body.percent ?? body.amount ?? 0);
            if (!Number.isFinite(value) || value <= 0) return json({ok:false,error:"بڕی داشکاندن نادروستە"},400);
            if (type === "percent" && value > 100) return json({ok:false,error:"ڕێژەی داشکاندن نابێت لە 100% زیاتر بێت"},400);
            const item = normalizeCoupon({
              id: body.id,
              code,
              type,
              value,
              percent: type === "percent" ? value : 0,
              amount: type === "fixed" ? value : 0,
              startsAt: body.startsAt || body.startAt || null,
              expiresAt: body.expiresAt || body.expiry || null,
              maxUses: Number(body.maxUses ?? body.limit ?? 0),
              usedCount: 0,
              active: body.active !== false,
              minAmount: Number(body.minAmount || 0),
              createdAt: new Date().toISOString()
            });
            coupons.unshift(item);
            await kvListPut(env,"kurdia_coupons",coupons);
            return json({ok:true,coupon:item});
          }
          return json({ok:false,error:"Method not allowed"},405);
        }

        const couponMatch = path.match(/^\/api\/admin\/coupons\/([^/]+)$/);
        if (couponMatch) {
          const id = decodeURIComponent(couponMatch[1]);
          const coupons = await kvListGet(env,"kurdia_coupons");
          const index = coupons.findIndex(x => String(x.id) === String(id));
          if (index < 0) return json({ok:false,error:"کۆدەکە نەدۆزرایەوە"},404);
          if (request.method === "GET") return json({ok:true,coupon:coupons[index]});
          if (request.method === "DELETE") {
            const deleted = coupons.splice(index,1)[0];
            await kvListPut(env,"kurdia_coupons",coupons);
            return json({ok:true,deleted});
          }
          if (["PUT","PATCH"].includes(request.method)) {
            const body = await safeJson(request);
            const current = coupons[index];
            const next = normalizeCoupon({...current,...body,id:current.id,code:body.code !== undefined ? normalizeCouponCode(body.code) : current.code});
            if (next.type === "percent" && next.value > 100) return json({ok:false,error:"ڕێژەی داشکاندن نابێت لە 100% زیاتر بێت"},400);
            const duplicate = coupons.some((x,i) => i !== index && normalizeCouponCode(x.code) === normalizeCouponCode(next.code));
            if (duplicate) return json({ok:false,error:"ئەم کۆدە پێشتر هەیە"},409);
            coupons[index] = next;
            await kvListPut(env,"kurdia_coupons",coupons);
            return json({ok:true,coupon:next});
          }
          return json({ok:false,error:"Method not allowed"},405);
        }

        if (request.method === "POST" && path === "/api/admin/coupons/reset-usage") {
          const body = await safeJson(request);
          const coupons = await kvListGet(env,"kurdia_coupons");
          const id = String(body.id || "");
          const index = coupons.findIndex(x => String(x.id) === id);
          if (index < 0) return json({ok:false,error:"کۆدەکە نەدۆزرایەوە"},404);
          coupons[index].usedCount = 0;
          coupons[index].lastUsedAt = null;
          coupons[index].lastRedemption = null;
          coupons[index].updatedAt = new Date().toISOString();
          await kvListPut(env,"kurdia_coupons",coupons);
          return json({ok:true,coupon:coupons[index]});
        }

        if (request.method === "GET" && path === "/api/admin/cms") {
          return json({ ok: true, data: await getCMS(env) });
        }

        if (request.method === "GET" && path === "/api/admin/dashboard") {
          const data = await getCMS(env);
          const requests = await kvListGet(env, "kurdia_private_requests");
          const regs = await kvListGet(env, "kurdia_registrations");
          const stories = await kvListGet(env, "kurdia_stories");
          return json({
            ok: true,
            stats: {
              trips: (data.trips || []).length,
              publishedTrips: (data.trips || []).filter(x => x.published).length,
              destinations: (data.destinations || []).length,
              safetyArticles: (data.safety || []).length,
              preparationLists: (data.preparation || []).length,
              pendingStories: stories.filter(x => x.status === "pending").length,
              privateRequests: requests.filter(x => x.status === "new").length,
              bookings: regs.length,
              coupons: (await kvListGet(env, "kurdia_coupons")).length,
              revenue: calculateRevenue(regs)
            },
            recentBookings: regs.slice(0, 10),
            recentPrivateRequests: requests.slice(0, 10),
            pendingStories: stories.filter(x => x.status === "pending").slice(0, 10)
          });
        }

        // CMS full save. Admin can edit every content area through one document.
        if (["POST", "PUT", "PATCH"].includes(request.method) && path === "/api/admin/cms") {
          const body = await safeJson(request);
          const current = await getCMS(env);
          const next = normalizeCMS({ ...current, ...body });
          await saveCMS(env, next);
          return json({ ok: true, data: next, published: true });
        }

        // Individual collection CRUD: trips, destinations, safety, preparation, reviews.
        const collMatch = path.match(/^\/api\/admin\/(trips|destinations|safety|preparation|reviews)$/);
        if (collMatch) {
          const collection = collMatch[1];
          const data = await getCMS(env);
          if (request.method === "GET") return json({ ok: true, items: data[collection] || [] });
          if (request.method === "POST") {
            const body = await safeJson(request);
            const item = normalizeCollectionItem(collection, body);
            data[collection] = [item, ...(data[collection] || [])];
            await saveCMS(env, data);
            return json({ ok: true, item });
          }
        }

        const itemMatch = path.match(/^\/api\/admin\/(trips|destinations|safety|preparation|reviews)\/([^/]+)$/);
        if (itemMatch) {
          const collection = itemMatch[1];
          const id = decodeURIComponent(itemMatch[2]);
          const data = await getCMS(env);
          const list = data[collection] || [];
          const index = list.findIndex(x => String(x.id) === String(id));
          if (index < 0) return json({ ok: false, error: "بڕگەکە نەدۆزرایەوە" }, 404);
          if (request.method === "GET") return json({ ok: true, item: list[index] });
          if (request.method === "DELETE") {
            list.splice(index, 1);
            data[collection] = list;
            await saveCMS(env, data);
            return json({ ok: true, deleted: id });
          }
          if (["PUT", "PATCH"].includes(request.method)) {
            const body = await safeJson(request);
            list[index] = normalizeCollectionItem(collection, { ...list[index], ...body, id });
            data[collection] = list;
            await saveCMS(env, data);
            return json({ ok: true, item: list[index] });
          }
        }

        // Publish/unpublish a trip or any CMS entity.
        const publishMatch = path.match(/^\/api\/admin\/publish\/(trips|destinations|safety|preparation|reviews)\/([^/]+)$/);
        if (request.method === "POST" && publishMatch) {
          const collection = publishMatch[1];
          const id = decodeURIComponent(publishMatch[2]);
          const body = await safeJson(request);
          const data = await getCMS(env);
          const item = (data[collection] || []).find(x => String(x.id) === String(id));
          if (!item) return json({ ok: false, error: "بڕگەکە نەدۆزرایەوە" }, 404);
          item.published = body.published !== false;
          if (collection === "reviews") item.status = item.published ? "approved" : "hidden";
          await saveCMS(env, data);
          return json({ ok: true, item });
        }

        // Private trip requests.
        if (request.method === "GET" && path === "/api/admin/private-requests") {
          return json({ ok: true, items: await kvListGet(env, "kurdia_private_requests") });
        }
        const prMatch = path.match(/^\/api\/admin\/private-requests\/([^/]+)$/);
        if (prMatch) {
          const id = decodeURIComponent(prMatch[1]);
          const items = await kvListGet(env, "kurdia_private_requests");
          const index = items.findIndex(x => String(x.id) === id);
          if (index < 0) return json({ ok: false, error: "داواکاری نەدۆزرایەوە" }, 404);
          if (request.method === "GET") return json({ ok: true, item: items[index] });
          if (request.method === "DELETE") {
            items.splice(index, 1); await kvListPut(env, "kurdia_private_requests", items); return json({ ok: true });
          }
          if (["PUT", "PATCH"].includes(request.method)) {
            const body = await safeJson(request);
            items[index] = { ...items[index], ...body, id, updatedAt: new Date().toISOString() };
            await kvListPut(env, "kurdia_private_requests", items);
            return json({ ok: true, item: items[index] });
          }
        }

        // Bookings persisted in KV.
        if (request.method === "GET" && path === "/api/admin/bookings") {
          return json({ ok: true, items: await kvListGet(env, "kurdia_registrations") });
        }
        const bookingMatch = path.match(/^\/api\/admin\/bookings\/([^/]+)$/);
        if (bookingMatch) {
          const id = decodeURIComponent(bookingMatch[1]);
          const items = await kvListGet(env, "kurdia_registrations");
          const index = items.findIndex(x => String(x.id) === id);
          if (index < 0) return json({ ok: false, error: "Booking نەدۆزرایەوە" }, 404);
          if (request.method === "GET") return json({ ok: true, item: items[index] });
          if (request.method === "DELETE") { items.splice(index,1); await kvListPut(env,"kurdia_registrations",items); return json({ok:true}); }
          if (["PUT","PATCH"].includes(request.method)) {
            const body = await safeJson(request);
            items[index] = { ...items[index], ...body, id, updatedAt:new Date().toISOString() };
            await kvListPut(env,"kurdia_registrations",items);
            return json({ok:true,item:items[index]});
          }
        }

        // Stories admin persistence with the same moderation model.
        if (request.method === "GET" && path === "/api/admin/stories") {
          return json({ ok: true, items: await kvListGet(env, "kurdia_stories") });
        }
        const adminStoryMatch = path.match(/^\/api\/admin\/stories\/([^/]+)$/);
        if (adminStoryMatch) {
          const id = decodeURIComponent(adminStoryMatch[1]);
          const items = await kvListGet(env, "kurdia_stories");
          const index = items.findIndex(x => String(x.id) === id);
          if (index < 0) return json({ ok:false,error:"ستۆری نەدۆزرایەوە" },404);
          if (request.method === "DELETE") { items.splice(index,1); await kvListPut(env,"kurdia_stories",items); return json({ok:true}); }
          if (["PUT","PATCH"].includes(request.method)) {
            const body = await safeJson(request);
            items[index] = { ...items[index], ...body, id };
            await kvListPut(env,"kurdia_stories",items);
            return json({ok:true,item:items[index]});
          }
          if (request.method === "GET") return json({ok:true,item:items[index]});
        }

        // Media: R2 preferred; KV fallback for small files.
        if (request.method === "POST" && path === "/api/admin/media") {
          const body = await safeJson(request);
          const name = safeFileName(body.name || `media-${Date.now()}.bin`);
          const contentType = String(body.contentType || "application/octet-stream");
          const base64 = String(body.base64 || "");
          if (!base64) return json({ok:false,error:"فایل نەدراوە"},400);
          const bytes = base64ToUint8Array(base64);
          if (env.KURDIA_MEDIA) {
            await env.KURDIA_MEDIA.put(`kurdia/${name}`, bytes, { httpMetadata:{contentType} });
            return json({ok:true,url:`${url.origin}/media/${encodeURIComponent(name)}`,name});
          }
          if (env.KURDIA_KV && bytes.byteLength < 800000) {
            await env.KURDIA_KV.put(`media_${name}`, JSON.stringify({contentType,base64}));
            return json({ok:true,url:`${url.origin}/api/media/${encodeURIComponent(name)}`,name,storage:"KV"});
          }
          return json({ok:false,error:"KURDIA_MEDIA (R2) binding نییە؛ بۆ وێنەی گەورە R2 زیاد بکە."},500);
        }

        if (request.method === "GET" && path === "/api/admin/settings") {
          const data = await getCMS(env);
          return json({ ok:true, settings:data.settings || {} });
        }
        if (["PUT","PATCH","POST"].includes(request.method) && path === "/api/admin/settings") {
          const body = await safeJson(request);
          const data = await getCMS(env);
          data.settings = { ...(data.settings || {}), ...body };
          await saveCMS(env,data);
          return json({ok:true,settings:data.settings});
        }

        if (request.method === "POST" && path === "/api/admin/backup") {
          const data = await getCMS(env);
          const registrations = await kvListGet(env,"kurdia_registrations");
          const privateRequests = await kvListGet(env,"kurdia_private_requests");
          const stories = await kvListGet(env,"kurdia_stories");
          const coupons = await kvListGet(env,"kurdia_coupons");
          const backup = {version:2,createdAt:new Date().toISOString(),cms:data,registrations,privateRequests,stories,coupons};
          return new Response(JSON.stringify(backup,null,2),{status:200,headers:{...corsHeaders(),"Content-Type":"application/json","Content-Disposition":`attachment; filename="kurdia-backup-${Date.now()}.json"`}});
        }

        if (request.method === "POST" && path === "/api/admin/restore") {
          const body = await safeJson(request);
          if (!body || !body.cms) return json({ok:false,error:"Backup ـی دروست نەدراوە"},400);
          await saveCMS(env, normalizeCMS(body.cms));
          if (Array.isArray(body.registrations)) await kvListPut(env,"kurdia_registrations",body.registrations);
          if (Array.isArray(body.privateRequests)) await kvListPut(env,"kurdia_private_requests",body.privateRequests);
          if (Array.isArray(body.stories)) await kvListPut(env,"kurdia_stories",body.stories);
          if (Array.isArray(body.coupons)) await kvListPut(env,"kurdia_coupons",body.coupons.map(normalizeCoupon));
          return json({ok:true,message:"Backup بە سەرکەوتوویی restore کرا."});
        }

        if (request.method === "GET" && path === "/api/admin/diagnostics") {
          return await diagnostics(request,env);
        }
      }

      if (request.method === "GET" && path.startsWith("/media/")) {
        const name = decodeURIComponent(path.slice("/media/".length));
        if (!env.KURDIA_MEDIA) return json({ok:false,error:"Media storage نییە"},404);
        const object = await env.KURDIA_MEDIA.get(`kurdia/${name}`);
        if (!object) return json({ok:false,error:"فایل نەدۆزرایەوە"},404);
        const headers = new Headers(corsHeaders());
        object.writeHttpMetadata(headers);
        headers.set("Cache-Control","public, max-age=31536000, immutable");
        if (object.httpEtag) headers.set("ETag", object.httpEtag);
        return new Response(object.body,{status:200,headers});
      }

      if (request.method === "GET" && path.startsWith("/api/media/")) {
        const name = decodeURIComponent(path.slice("/api/media/".length));
        if (!env.KURDIA_KV) return json({ok:false,error:"Media storage نییە"},404);
        const raw = await env.KURDIA_KV.get(`media_${name}`, "json");
        if (!raw) return json({ok:false,error:"فایل نەدۆزرایەوە"},404);
        const bytes = base64ToUint8Array(raw.base64);
        return new Response(bytes, {status:200,headers:{...corsHeaders(),"Content-Type":raw.contentType || "application/octet-stream","Cache-Control":"public, max-age=31536000, immutable"}});
      }

      return json({
        ok: false,
        error: "Route not found"
      }, 404);

    } catch (error) {

      return json({
        ok: false,
        error:
          error?.message ||
          "Internal Worker Error"
      }, 500);
    }
  }
};

// ============================================================
// REGISTRATION & TELEGRAM
// ============================================================

async function handleRegistration(
  request,
  env,
  ctx
) {

  if (
    !env.TELEGRAM_BOT_TOKEN ||
    !env.TELEGRAM_CHAT_ID
  ) {
    return json({
      ok: false,
      error:
        "Telegram tokens not configured"
    }, 500);
  }

  const formData =
    await request.formData();

  const name =
    sanitize(
      formData.get("name")
    );

  const phone =
    normalizeIraqPhone(
      formData.get("phone")
    );

  const trip =
    sanitize(
      formData.get("trip") ||
        "KURDIA ADVENTURE"
    );

  const people =
    sanitize(
      formData.get("people") ||
        "1"
    );

  const note =
    sanitize(
      formData.get("note") ||
        "نییە"
    );

  const extraNames =
    sanitize(
      formData.get(
        "extra_names"
      ) || ""
    );

  if (!name) {
    return json({
      ok: false,
      error:
        "تکایە ناو بنووسە"
    }, 400);
  }

  if (
    !isValidIraqPhone(phone)
  ) {
    return json({
      ok: false,
      error:
        "ژمارەی مۆبایل نادروستە"
    }, 400);
  }

  // Registration requires a successful OTP verification.
  let otpVerified = false;
  if (env.KURDIA_KV) {
    try {
      const verified = await env.KURDIA_KV.get(`otp_verified_${phone}`, "json");
      otpVerified = verified?.verified === true;
      if (otpVerified) await env.KURDIA_KV.delete(`otp_verified_${phone}`);
    } catch (_) {}
  }
  if (!otpVerified) {
    return json({
      ok: false,
      error: "تکایە سەرەتا ژمارەی WhatsApp ـت بە OTP پشتڕاست بکەرەوە"
    }, 403);
  }

  const receipt = formData.get("receipt");
  if (!receipt || typeof receipt === "string" || typeof receipt.arrayBuffer !== "function") {
    return json({
      ok: false,
      error: "تکایە وێنەی پسوڵە باربکە"
    }, 400);
  }
  if (!String(receipt.type || "").startsWith("image/")) {
    return json({
      ok: false,
      error: "تەنها فایلە وێنەییەکان بۆ پسوڵە ڕێگەپێدراون"
    }, 400);
  }
  if (receipt.size && receipt.size > 5 * 1024 * 1024) {
    return json({
      ok: false,
      error: "قەبارەی پسوڵە نابێت لە 5MB زیاتر بێت"
    }, 400);
  }

  const registrationId =
    `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 5)}`;

  const displayName =
    extraNames
      ? `${name} (+ ${extraNames})`
      : name;

  inMemoryDB.registrations.unshift({
    id: registrationId,
    name: displayName,
    phone,
    trip,
    people,
    note,
    status: "چاوەڕوان",
    time:
      new Date().toISOString()
  });

  await kvListPush(env, "kurdia_registrations", {
    id: registrationId,
    name: displayName,
    phone,
    trip,
    people,
    note,
    receipt: {
      name: sanitize(receipt.name || "receipt"),
      type: String(receipt.type || "image/jpeg"),
      size: Number(receipt.size || 0)
    },
    status: "pending",
    time: new Date().toISOString()
  }, 10000);

  const extraDisplay =
    extraNames
      ? `\n👥 <b>هاوەڵەکان:</b> ${escapeHtml(
          extraNames
        )}`
      : "";

  const caption =
    `🆕 <b>داواکارییەکی نوێی ناونووسین</b>\n\n` +
    `🆔 <b>ID:</b> <code>${escapeHtml(
      registrationId
    )}</code>\n` +
    `👤 <b>سەرپەرشتیار:</b> ${escapeHtml(
      name
    )}\n` +
    `📱 <b>ژمارەی مۆبایل:</b> <code>${escapeHtml(
      phone
    )}</code>\n` +
    `🏔️ <b>گەشت:</b> ${escapeHtml(
      trip
    )}\n` +
    `👥 <b>کۆی کەس:</b> ${escapeHtml(
      people
    )}${extraDisplay}\n` +
    `📝 <b>تێبینی:</b> ${escapeHtml(
      note
    )}`;

  const keyboard =
    generateTelegramRegistrationKeyboard(
      registrationId,
      phone,
      name
    );

  // ========================================================
  // IMPORTANT:
  // `res` is NOT used here.
  // This completely removes the possibility of:
  // Cannot access 'res' before initialization
  // ========================================================

  let telegramResult;

  const file =
    formData.get("receipt");

  if (
    file &&
    typeof file !== "string" &&
    typeof file.arrayBuffer === "function"
  ) {

    const buffer =
      await file.arrayBuffer();

    telegramResult =
      await sendTelegramPhotoFromBuffer(
        env,
        buffer,
        file.type ||
          "image/jpeg",
        caption,
        keyboard
      );

  } else {

    telegramResult =
      await sendTelegramMessage(
        env,
        caption,
        {
          parseMode: "HTML",
          replyMarkup:
            keyboard
        }
      );
  }

  if (
    !telegramResult?.ok
  ) {
    return json({
      ok: false,
      error:
        telegramResult?.error ||
        "تێلیگرام کێشەی هەیە"
    }, 502);
  }

  // ========================================================
  // GOOGLE SHEETS
  // ========================================================

  if (
    env.GOOGLE_SHEETS_URL
  ) {
    ctx.waitUntil(
      syncToGoogleSheets(
        env.GOOGLE_SHEETS_URL,
        {
          id:
            registrationId,
          name:
            displayName,
          phone,
          trip,
          people,
          note
        }
      )
    );
  }

  return json({
    ok: true,
    registrationId,
    phone
  });
}

// ============================================================
// TELEGRAM REGISTRATION KEYBOARD
// ============================================================

function generateTelegramRegistrationKeyboard(
  registrationId,
  phone,
  name
) {

  const cleanPhone =
    normalizeIraqPhone(phone);

  const verifyMsg =
    encodeURIComponent(
      `سڵاو ${name || "بەڕێزم"} 🌿\n` +
      `پیرۆزە! ناونووسینەکەت لەلایەن KURDIA ADVENTURE پەسەندکرا. ✅\n\n` +
      `🆔 کۆد: ${registrationId}\n` +
      `📍 شوێنی کۆبوونەوە:\n` +
      `${WA_SETTINGS.mapsUrl}`
    );

  const rejectMsg =
    encodeURIComponent(
      `سڵاو ${name || "بەڕێزم"} 🌿\n` +
      `داواکاری ناونووسینەکەت پەسەند نەکرا. ❌\n` +
      `🆔 کۆد: ${registrationId}\n` +
      `⚠️ هۆکار: پسوولەکە ڕوون نییە یان بڕی پارەکە تەواو نییە.`
    );

  return {
    inline_keyboard: [

      [
        {
          text:
            "💬 ناردنی پەسەندکردن (WhatsApp دەستی)",
          url:
            `https://wa.me/${cleanPhone}?text=${verifyMsg}`
        }
      ],

      [
        {
          text:
            "⚠️ ناردنی ڕەتکردنەوە (WhatsApp دەستی)",
          url:
            `https://wa.me/${cleanPhone}?text=${rejectMsg}`
        }
      ],

      [
        {
          text:
            "⚡ پەسەندکردنی خۆکار (API)",
          callback_data:
            `v:${registrationId}:${cleanPhone}`
        },

        {
          text:
            "❌ ڕەتکردنەوە (API)",
          callback_data:
            `ask:${registrationId}:${cleanPhone}`
        }
      ]
    ]
  };
}

// ============================================================
// TELEGRAM WEBHOOK
// ============================================================

async function handleTelegramWebhook(
  request,
  env,
  ctx
) {

  const update =
    await request
      .json()
      .catch(() => null);

  if (
    !update ||
    !update.callback_query
  ) {
    return new Response(
      "OK",
      { status: 200 }
    );
  }

  const callback =
    update.callback_query;

  const rawData =
    String(
      callback.data || ""
    );

  const parts =
    rawData.split(":");

  const action =
    parts[0];

  // ========================================================
  // ASK REJECTION REASON
  // ========================================================

  if (action === "ask") {

    const [
      ,
      registrationId,
      phone
    ] = parts;

    await telegramApi(
      env,
      "editMessageReplyMarkup",
      {
        chat_id:
          callback.message?.chat?.id,

        message_id:
          callback.message?.message_id,

        reply_markup: {
          inline_keyboard: [

            [
              {
                text:
                  "📄 پسوولەکە ڕوون نییە",

                callback_data:
                  `rej:unc:${registrationId}:${phone}`
              }
            ],

            [
              {
                text:
                  "💵 بڕی پارەکە تەواو نییە",

                callback_data:
                  `rej:amt:${registrationId}:${phone}`
              }
            ]

          ]
        }
      }
    );

    await answerTelegramCallback(
      env,
      callback.id,
      "هۆکارێک دیاری بکە"
    );

    return new Response(
      "OK",
      { status: 200 }
    );
  }

  // ========================================================
  // VERIFY
  // ========================================================

  if (action === "v") {

    const [
      ,
      registrationId,
      phone
    ] = parts;

    await answerTelegramCallback(
      env,
      callback.id,
      "⏳ نامە دەنێردرێت بۆ واتسئاپ..."
    );

    const waResult =
      await sendWhatsAppTemplate(
        env,
        normalizeIraqPhone(phone),
        [
          registrationId,
          WA_SETTINGS.mapsUrl
        ],
        {
          templateName:
            env.WHATSAPP_CONFIRMATION_TEMPLATE_NAME ||
            "trip_confirmation",
          languageCode:
            env.WHATSAPP_CONFIRMATION_TEMPLATE_LANGUAGE ||
            "ar"
        }
      );

    if (waResult.ok) {

      await removeTelegramButtons(
        env,
        callback.message?.chat?.id,
        callback.message?.message_id
      );

      await answerTelegramCallback(
        env,
        callback.id,
        "✅ بە سەرکەوتوویی نامە نێردرا و دوگمەکان لبران!"
      );

    } else {

      await answerTelegramCallback(
        env,
        callback.id,
        "❌ هەڵە: " +
          waResult.error,
        {
          show_alert: true
        }
      );
    }

    return new Response(
      "OK",
      { status: 200 }
    );
  }

  // ========================================================
  // REJECT
  // ========================================================

  if (action === "rej") {

    const [
      ,
      code,
      registrationId,
      phone
    ] = parts;

    const reasonText =
      code === "unc"
        ? "پسوولەکە ڕوون نییە"
        : "بڕی پارەکە تەواو نییە";

    const waResult =
      await sendWhatsAppTemplate(
        env,
        normalizeIraqPhone(phone),
        [
          registrationId,
          reasonText
        ],
        {
          templateName:
            env.WHATSAPP_REJECTED_TEMPLATE_NAME ||
            "trip_rejected",
          languageCode:
            env.WHATSAPP_REJECTED_TEMPLATE_LANGUAGE ||
            "en_US"
        }
      );

    if (waResult.ok) {

      await removeTelegramButtons(
        env,
        callback.message?.chat?.id,
        callback.message?.message_id
      );

      await answerTelegramCallback(
        env,
        callback.id,
        "✅ ڕەتکرایەوە و نامە نێردرا!"
      );

    } else {

      await answerTelegramCallback(
        env,
        callback.id,
        "❌ هەڵە: " +
          waResult.error,
        {
          show_alert: true
        }
      );
    }

    return new Response(
      "OK",
      { status: 200 }
    );
  }

  return new Response(
    "OK",
    { status: 200 }
  );
}

// ============================================================
// WHATSAPP CLOUD API
// ============================================================

async function sendWhatsAppTemplate(
  env,
  phone,
  bodyParameters = [],
  options = {}
) {

  if (!env.WHATSAPP_ACCESS_TOKEN) {
    return {
      ok: false,
      error: "WHATSAPP_ACCESS_TOKEN is missing"
    };
  }

  if (!env.WHATSAPP_PHONE_NUMBER_ID) {
    return {
      ok: false,
      error: "WHATSAPP_PHONE_NUMBER_ID is missing"
    };
  }

  const to = normalizeIraqPhone(phone);

  if (!isValidIraqPhone(to)) {
    return {
      ok: false,
      error: "ژمارەی واتسئاپ نادروستە"
    };
  }

  const templateName = String(
    options.templateName ||
      env.WHATSAPP_TEMPLATE_NAME ||
      DEFAULT_WHATSAPP_TEMPLATE_NAME
  ).trim();

  const languageCode = String(
    options.languageCode ||
      env.WHATSAPP_TEMPLATE_LANGUAGE ||
      DEFAULT_WHATSAPP_LANGUAGE
  ).trim();

  const graphVersion = String(
    env.WHATSAPP_GRAPH_VERSION ||
      DEFAULT_GRAPH_VERSION
  ).trim();

  const template = {
    name: templateName,
    language: {
      code: languageCode
    }
  };

  if (Array.isArray(bodyParameters) && bodyParameters.length) {
    template.components = [
      {
        type: "body",
        parameters: bodyParameters.map(value => ({
          type: "text",
          text: String(value ?? "")
        }))
      }
    ];
  }

  const endpoint =
    `https://graph.facebook.com/${encodeURIComponent(
      graphVersion
    )}/${encodeURIComponent(
      env.WHATSAPP_PHONE_NUMBER_ID
    )}/messages`;

  let response;
  let data;

  try {
    response = await fetch(
      endpoint,
      {
        method: "POST",
        headers: {
          "Authorization":
            `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "template",
          template
        })
      }
    );

    data = await response
      .json()
      .catch(() => ({}));

  } catch (error) {
    return {
      ok: false,
      error:
        `WhatsApp network error: ${
          error?.message || error
        }`
    };
  }

  if (!response.ok || data?.error) {
    return {
      ok: false,
      status: response.status,
      error: formatMetaError(
        data?.error,
        data
      )
    };
  }

  return {
    ok: true,
    data,
    messageId:
      data?.messages?.[0]?.id || null
  };
}

// ============================================================
// BACKWARDS COMPATIBILITY
// ============================================================

async function sendWhatsAppViaTemplate(
  env,
  phone,
  messageOrParams
) {

  if (
    Array.isArray(
      messageOrParams
    )
  ) {
    return sendWhatsAppTemplate(
      env,
      phone,
      messageOrParams
    );
  }

  return sendWhatsAppTemplate(
    env,
    phone,
    [
      String(
        messageOrParams || ""
      )
    ]
  );
}

// ============================================================
// META ERROR FORMATTER
// ============================================================

function formatMetaError(
  metaError,
  data
) {

  if (metaError) {

    const parts = [
      metaError.message,
      metaError.error_user_title,
      metaError.error_user_msg
    ].filter(Boolean);

    const code =
      metaError.code != null
        ? ` [code ${metaError.code}]`
        : "";

    const sub =
      metaError.error_subcode != null
        ? ` [subcode ${metaError.error_subcode}]`
        : "";

    return (
      parts.join(" — ") ||
      "WhatsApp API error"
    ) +
      code +
      sub;
  }

  try {

    return (
      "WhatsApp API error: " +
      JSON.stringify(data)
    );

  } catch (_) {

    return "WhatsApp API error";
  }
}

// ============================================================
// TELEGRAM API
// ============================================================

async function telegramApi(
  env,
  method,
  payload
) {

  if (
    !env.TELEGRAM_BOT_TOKEN
  ) {
    return {
      ok: false,
      error:
        "Telegram token missing"
    };
  }

  try {

    const r =
      await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(payload)
        }
      );

    const data =
      await r
        .json()
        .catch(() => ({}));

    return data;

  } catch (error) {

    return {
      ok: false,
      error:
        error?.message ||
        String(error)
    };
  }
}

// ============================================================
// TELEGRAM MESSAGE
// ============================================================

async function sendTelegramMessage(
  env,
  text,
  options = {}
) {

  return telegramApi(
    env,
    "sendMessage",
    {
      chat_id:
        env.TELEGRAM_CHAT_ID,

      text,

      parse_mode:
        options.parseMode ||
        undefined,

      reply_markup:
        options.replyMarkup ||
        undefined,

      disable_web_page_preview:
        true
    }
  );
}

// ============================================================
// TELEGRAM PHOTO
// ============================================================

async function sendTelegramPhotoFromBuffer(
  env,
  buffer,
  mimeType,
  caption,
  replyMarkup
) {

  if (
    !env.TELEGRAM_BOT_TOKEN ||
    !env.TELEGRAM_CHAT_ID
  ) {
    return {
      ok: false,
      error:
        "Telegram configuration missing"
    };
  }

  try {

    const blob =
      new Blob(
        [buffer],
        {
          type:
            mimeType ||
            "image/jpeg"
        }
      );

    const form =
      new FormData();

    form.append(
      "chat_id",
      String(
        env.TELEGRAM_CHAT_ID
      )
    );

    form.append(
      "photo",
      blob,
      "receipt.jpg"
    );

    form.append(
      "caption",
      caption
    );

    form.append(
      "parse_mode",
      "HTML"
    );

    form.append(
      "reply_markup",
      JSON.stringify(
        replyMarkup || {}
      )
    );

    const response =
      await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
        {
          method: "POST",
          body: form
        }
      );

    return await response
      .json()
      .catch(
        () => ({
          ok: false,
          error:
            "Invalid Telegram response"
        })
      );

  } catch (error) {

    return {
      ok: false,
      error:
        error?.message ||
        String(error)
    };
  }
}

// ============================================================
// TELEGRAM CALLBACK
// ============================================================

async function answerTelegramCallback(
  env,
  callbackId,
  text,
  extra = {}
) {

  return telegramApi(
    env,
    "answerCallbackQuery",
    {
      callback_query_id:
        callbackId,

      text,

      ...extra
    }
  );
}

// ============================================================
// REMOVE TELEGRAM BUTTONS
// ============================================================

async function removeTelegramButtons(
  env,
  chatId,
  messageId
) {

  return telegramApi(
    env,
    "editMessageReplyMarkup",
    {
      chat_id:
        chatId,

      message_id:
        messageId,

      reply_markup: {
        inline_keyboard: []
      }
    }
  );
}

// ============================================================
// AI
// ============================================================

async function handleAI(request, env) {
  try {
    const body = await safeJson(request);
    const userQuestion = String(body.prompt || '').trim();
    if (!userQuestion) return json({ok:false,error:'تکایە پرسیارەکەت بنووسە'},400);

    // --------------------------------------------------------
    // LIVE KURDIA CMS CONTEXT
    // --------------------------------------------------------
    const clientSite = body.siteState && typeof body.siteState === 'object'
      ? body.siteState
      : {};

    const clean = (v, max=1800) => String(v ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);

    let liveCMS = null;
    try { liveCMS = await getCMS(env); } catch (_) { liveCMS = null; }

    const site = liveCMS && typeof liveCMS === 'object'
      ? liveCMS
      : clientSite;

    const cmsTrips = Array.isArray(site.trips)
      ? site.trips.filter(x => x && x.published !== false && x.status !== 'draft')
      : [];

    const featured = cmsTrips.find(x =>
      x.featured === true || x.isFeatured === true
    );

    const trip = featured || cmsTrips[0] || site.currentTrip || clientSite.currentTrip || {};

    const context = {
      brand: 'KURDIA ADVENTURE',
      language: 'کوردیی سۆرانی',
      identity: 'KURDIA ADVENTURE براندێکی کوردیی گەشت و سەرکێشییە؛ تەنها شاخەوانی نییە و گەشت، سروشت، کەمپینگ، شاخەوانی، شوێنە گەشتیارییەکان و گەشتی تایبەت پێشکەش دەکات.',
      purpose: clean(site.purpose,700) || 'پلاتفۆرمێکی کوردی بۆ گەشت، سروشت، سەرکێشی و چالاکیی جۆراوجۆر.',
      currentTrip: {
        id: clean(trip.id,120),
        title: clean(trip.title,240),
        location: clean(trip.location,240),
        date: clean(trip.date || trip.tripDate || trip.startDate,100),
        price: clean(trip.price,120),
        time: clean(trip.time,120),
        duration: clean(trip.duration,100),
        difficulty: clean(trip.difficulty,100),
        description: clean(trip.description || trip.desc,900),
        capacity: trip.capacity,
        booked: trip.booked,
        tripType: clean(trip.tripType || trip.type,120),
        status: clean(trip.status,80)
      },
      destinations: Array.isArray(site.destinations)
        ? site.destinations.slice(0,40).map(x => ({
            name: clean(x.name,140),
            type: clean(x.type,100),
            description: clean(x.description || x.desc,450)
          }))
        : [],
      safety: Array.isArray(site.safety)
        ? site.safety.slice(0,25).map(x => ({
            title: clean(x.title,120),
            text: clean(x.text || x.description,450)
          }))
        : [],
      preparation: Array.isArray(site.preparation)
        ? site.preparation.slice(0,25).map(x => ({
            type: clean(x.type,100),
            label: clean(x.label || x.title,140),
            text: clean(x.text || x.description,300)
          }))
        : [],
      pages: Array.isArray(site.pages) ? site.pages.slice(0,40) : []
    };

    // --------------------------------------------------------
    // STRONG SORANI INSTRUCTIONS
    // --------------------------------------------------------
    const system = `
تۆ «یاریدەدەری KURDIA» ـیت، هاوڕێ و ڕێنمایەری ماڵپەڕی KURDIA ADVENTURE.

زۆر گرنگ:
- تەنها بە کوردیی سۆرانیی سروشتی و ڕوون وەڵام بدە.
- وەڵامەکانت وەک قسەکردنی هاوڕێیەکی کورد بێت، نەک وەرگێڕانی وشە بە وشەی ئینگلیزی.
- وشەی ئینگلیزی تەنها بۆ ناوی براند، ناوی فنی، یان وشەیەک کە بەکارهێنەر خۆی بە ئینگلیزی نووسیویەتی بەکاربهێنە.
- «KURDIA ADVENTURE» بە هەمان شێوە بنووسە؛ مەیکە بە KurDIA یان ناوی تر.
- وەڵامەکان کورت، ڕوون، خۆش و هاوڕێیانە بن. بێ پێویستی بە سەردێڕ و لیستی زۆر.
- ئەگەر سڵاو کرا، بە گەرمی و کورت وەڵام بدە و بپرسە چ شتێکی سەبارەت بە KURDIA دەوێت.

ناسنامەی KURDIA:
KURDIA ADVENTURE براندێکی کوردیی گەشت و سەرکێشییە. تەنها شاخەوانی نییە؛ گەشتی شاخەوانی، کەمپینگ، سروشت، ئاویشار و شوێنە گەشتیارییەکان، گەشتی خێزانی، گەشتی ڕێگا، گەشتی تایبەت و چالاکیی جۆراوجۆر پێشکەش دەکات.

سەرچاوەی ڕاستی:
ئەم زانیارییەی خوارەوە داتای ڕاستەوخۆی ماڵپەڕەکەیە. لە زانیارییەکانی CMS پەیڕەوی بکە.
هیچ گەشتێک، نرخێک، بەروارێک، شوێنێک، ژمارەی بەشداربووانێک یان زانیارییەکی تر خۆت مەخە.
ئەگەر زانیارییەک لەم context ـەدا نەبوو، بە ڕوونی بڵێ «ئەم زانیارییە لە ماڵپەڕەکەدا بەردەستم نییە» و ڕێنمایی بکە چۆن لە ماڵپەڕەکە بدۆزرێتەوە.

زانیاریی ڕاستەوخۆ:
${JSON.stringify(context)}

یاساکانی گەشت:
1. کاتێک بەکارهێنەر دەڵێت «گەشتی ئەم هەفتەیە»، «گەشتی ئێستا»، «گەشتی نوێ» یان وشەی هاوشێوە، تەنها currentTrip بەکاربهێنە.
2. هەرگیز هەڵگورد مەکە بە گەشتی ئێستا مەگەر currentTrip بە ڕوونی هەڵگورد بێت.
3. ئەگەر currentTrip بەتاڵە، مەڵێت هیچ گەشتێک هەیە؛ بڵێ زانیاریی گەشتی ئێستا لە CMS ـدا بەردەست نییە.
4. کاتێک پرسیار لەسەر ماڵپەڕەکە دەکرێت، بەش و هەنگاوە ڕاستەکان ڕوون بکەوە.
5. کاتێک پرسیار لەسەر KURDIA ADVENTURE دەکرێت، ناسنامەی سەرەوە بەکاربهێنە.
6. ئەگەر پرسیارەکە گشتییە و زانیاریی تایبەتی KURDIA پێویست نییە، ڕێنماییی گشتی بدە، بەڵام زانیاریی KURDIA خۆت مەدروستکە.
7. هیچ وەڵامێک بە شێوەی «من پێموایە...» مەدە کاتێک داتا لە CMS ـدا نییە.
8. لە کۆتایی وەڵامەکاندا پرسیاری زیادە مەکە مەگەر بەڕاستی یارمەتیدەر بێت.
9. وەڵامەکە دەبێت لە ڕووی زمانەوە پاک و سروشتی بێت: «چییە»، «چۆن»، «بۆچی»، «بەڵێ»، «نەخێر»، «دەتوانیت» و وشە کوردییە باوەکان بەکاربهێنە.
10. ئەگەر بەکارهێنەر داوای یارمەتی بۆ کارێکی ماڵپەڕ کرد، هەنگاوەکانی بە سادەیی بڵێ.
`;

    if (!env.AI) {
      return json({ok:false,error:'AI binding ـی Cloudflare دانەنراوە'},500);
    }

    const aiResult = await env.AI.run(
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userQuestion }
        ],
        max_tokens: 420,
        temperature: 0.25,
        top_p: 0.85,
        repetition_penalty: 1.08
      }
    );

    const answer = String(aiResult?.response || '').trim();

    return json({
      ok: true,
      text: answer || 'ببورە هاوڕێ، ئێستا وەڵامێکی گونجاوم بۆ ئەم پرسیارە نییە. تکایە دووبارە بە شێوەیەکی کورتتر بینووسە.'
    });
  } catch (e) {
    return json({
      ok: true,
      text: 'ببورە هاوڕێ، کێشەیەکی کاتی ڕوویدا. تکایە دووبارە هەوڵ بدەوە.'
    });
  }
}

// ============================================================
// GOOGLE SHEETS
// ============================================================

async function syncToGoogleSheets(
  url,
  data
) {

  try {

    const response =
      await fetch(
        url,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(data)
        }
      );

    return {
      ok:
        response.ok
    };

  } catch (error) {

    return {
      ok: false,

      error:
        error?.message ||
        String(error)
    };
  }
}

// ============================================================
// CORS
// ============================================================

function corsHeaders() {

  return {
    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Methods":
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Admin-Key",

    "Access-Control-Max-Age":
      "86400"
  };
}

// ============================================================
// JSON RESPONSE
// ============================================================

function json(
  data,
  status = 200
) {

  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        ...corsHeaders(),

        "Content-Type":
          "application/json; charset=utf-8"
      }
    }
  );
}

// ============================================================
// SAFE JSON
// ============================================================

async function safeJson(
  request
) {

  try {

    return await request.json();

  } catch (_) {

    return {};
  }
}

// ============================================================
// SANITIZE
// ============================================================

function sanitize(
  str
) {

  return String(
    str ?? ""
  )
    .replace(
      /[<>]/g,
      ""
    )
    .trim();
}

// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(
  str
) {

  return String(
    str ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#39;"
    );
}

// ============================================================
// IRAQ PHONE NORMALIZER
// ============================================================

function normalizeIraqPhone(
  input
) {

  let phone =
    String(
      input ?? ""
    )
      .trim()
      .replace(
        /[^\d+]/g,
        ""
      );

  if (
    phone.startsWith("+")
  ) {
    phone =
      phone.slice(1);
  }

  if (
    phone.startsWith("00")
  ) {
    phone =
      phone.slice(2);
  }

  if (
    phone.startsWith("0")
  ) {
    phone =
      "964" +
      phone.slice(1);
  }

  if (
    !phone.startsWith("964") &&
    phone.length === 10
  ) {
    phone =
      "964" +
      phone;
  }

  return phone;
}

// ============================================================
// IRAQ PHONE VALIDATION
// ============================================================

function isValidIraqPhone(
  phone
) {

  return /^9647\d{9}$/.test(
    String(phone || "")
  );
}
// ============================================================
// KURDIA CMS / DATA LAYER
// ============================================================

const CMS_KEY = "kurdia_cms_v2";
const CMS_VERSION = 2;

function makeId(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

function defaultCMS() {
  return {
    version: CMS_VERSION,
    updatedAt: new Date().toISOString(),
    publishedAt: null,
    settings: {
      brandName: "KURDIA ADVENTURE",
      seoTitle: "KURDIA ADVENTURE — گەشت، سروشت و ئەزموون",
      seoDescription: "پلاتفۆرمی کوردی بۆ گەشت، سروشت، سەرکێشی و ئەزموونی جیاواز.",
      primaryColor: "#9d1c32",
      secondaryColor: "#c92b49",
      whatsapp: "",
      mapsUrl: "",
      meetingPoint: "",
      footerPhone: "",
      footerEmail: "",
      weatherSource: "Open-Meteo",
      defaultWeatherLocation: "Erbil"
    },
    home: {
      hero: {
        badge: "KURDIA ADVENTURE",
        title: "گەشتێکی نوێ، ئەزموونێکی نوێ",
        subtitle: "گەشت، سروشت و چالاکییە جیاوازەکان لە کوردستان.",
        imageUrl: "",
        videoUrl: "",
        primaryCta: "گەشتی ئەم هەفتەیە ببینە",
        primaryHref: "#booking",
        secondaryCta: "شوێنەکان ببینە",
        secondaryHref: "#destinations"
      },
      experiences: [
        {id:"exp-mountain",title:"شاخ",icon:"mountain",imageUrl:"",description:"ئەزموونی شاخ و سروشت"},
        {id:"exp-camping",title:"کەمپینگ",icon:"tent-tree",imageUrl:"",description:"شەوێک لە دڵی سروشت"},
        {id:"exp-waterfall",title:"ئاوشار",icon:"waves",imageUrl:"",description:"ئاوشار و شوێنە سەیرەکان"},
        {id:"exp-lake",title:"دەریاچە",icon:"lake",imageUrl:"",description:"ئارامی و جوانی دەریاچەکان"},
        {id:"exp-road",title:"Road Trip",icon:"car-front",imageUrl:"",description:"ڕێگای نوێ و شوێنی نوێ"},
        {id:"exp-history",title:"مێژوویی",icon:"landmark",imageUrl:"",description:"شوێنە مێژووییەکان"}
      ],
      privateTitle: "گەشتەکەت خۆت دیاری بکە",
      privateDescription: "ئێمە بۆت ڕێکی دەخەین.",
      aboutTitle: "KURDIA چییە؟",
      aboutDescription: "KURDIA پلاتفۆرمێکی کوردییە بۆ دۆزینەوەی سروشت، گەشت و ئەزموونی جیاواز.",
      stats: [
        {label:"بەشداربووان",value:"+1,000"},
        {label:"گەشت",value:"+50"},
        {label:"شوێن",value:"+100"}
      ]
    },
    weather: {
      sourceLabel: "Open-Meteo",
      updateLabel: "دوایین نوێکردنەوە",
      defaultLocation: "Erbil",
      alerts: []
    },
    trips: [
      {
        id:"trip-helgurd-01",
        title:"گەشتی لووتکەی چیای هەڵگورد",
        location:"باڵەکایەتی — چیای هەڵگورد",
        price:"٣٥،٠٠٠ دینار",
        time:"بەیانی ٠٥:٠٠",
        duration:"١ ڕۆژ",
        difficulty:"مامناوەند",
        capacity:40,
        booked:29,
        status:"active",
        published:true,
        featured:true,
        heroImageUrl:"",
        desc:"گەشتێکی پڕ لە جوش و خڕۆش بە هاوڕێیەتی ڕێبەری شارەزا.",
        itinerary:[],
        gallery:[],
        createdAt:new Date().toISOString()
      }
    ],
    destinations: [],
    safety: [],
    preparation: [],
    reviews: [],
    navigation: {
      home:"سەرەکی",
      weather:"کەشوهەوا",
      booking:"بەشداری گەشت",
      private:"تایبەت",
      more:"زیاتر"
    },
    footer: {
      description:"گەشت، سروشت و ئەزموونی جیاواز لە کوردستان.",
      links:[]
    }
  };
}

function normalizeCMS(input) {
  const base = defaultCMS();
  const data = input && typeof input === "object" ? input : {};
  return {
    ...base,
    ...data,
    version: CMS_VERSION,
    updatedAt: new Date().toISOString(),
    settings: {...base.settings, ...(data.settings || {})},
    home: {...base.home, ...(data.home || {}), hero:{...base.home.hero,...((data.home||{}).hero||{})}},
    weather: {...base.weather, ...(data.weather || {})},
    navigation: {...base.navigation, ...(data.navigation || {})},
    footer: {...base.footer, ...(data.footer || {})},
    trips: Array.isArray(data.trips) ? data.trips : base.trips,
    destinations: Array.isArray(data.destinations) ? data.destinations : [],
    safety: Array.isArray(data.safety) ? data.safety : [],
    preparation: Array.isArray(data.preparation) ? data.preparation : [],
    reviews: Array.isArray(data.reviews) ? data.reviews : []
  };
}

async function getCMS(env) {
  if (!env.KURDIA_KV) return normalizeCMS(inMemoryCMSFallback);
  try {
    const raw = await env.KURDIA_KV.get(CMS_KEY, "json");
    if (raw) return normalizeCMS(raw);
  } catch (_) {}
  const data = defaultCMS();
  try { await env.KURDIA_KV.put(CMS_KEY, JSON.stringify(data)); } catch (_) {}
  return data;
}

async function saveCMS(env, data) {
  const normalized = normalizeCMS(data);
  normalized.publishedAt = new Date().toISOString();
  if (env.KURDIA_KV) {
    await env.KURDIA_KV.put(CMS_KEY, JSON.stringify(normalized));
  } else {
    inMemoryCMSFallback = normalized;
  }
  return normalized;
}

let inMemoryCMSFallback = defaultCMS();

function publicCMS(data) {
  return {
    ...data,
    settings: {
      ...data.settings,
      // Never expose backend credentials/secrets from CMS.
      adminApiKey: undefined
    }
  };
}

function normalizeCollectionItem(collection, body) {
  const item = {...(body || {})};
  item.id = item.id || makeId(collection.slice(0, 3));
  item.updatedAt = new Date().toISOString();
  if (collection === "trips") {
    item.title = sanitize(item.title);
    item.location = sanitize(item.location);
    item.price = sanitize(item.price);
    item.description = sanitize(item.description || item.desc);
    item.desc = item.description;
    item.capacity = Number(item.capacity || 0);
    item.booked = Number(item.booked || 0);
    item.published = item.published !== false;
    item.status = item.status || "draft";
    item.gallery = Array.isArray(item.gallery) ? item.gallery : [];
    item.itinerary = Array.isArray(item.itinerary) ? item.itinerary : [];
  } else if (collection === "destinations") {
    item.title = sanitize(item.title || item.name);
    item.name = item.title;
    item.region = sanitize(item.region);
    item.description = sanitize(item.description);
    item.experienceTypes = Array.isArray(item.experienceTypes) ? item.experienceTypes : [];
    item.gallery = Array.isArray(item.gallery) ? item.gallery : [];
    item.published = item.published !== false;
  } else if (collection === "safety") {
    item.title = sanitize(item.title);
    item.category = sanitize(item.category);
    item.content = sanitize(item.content);
    item.published = item.published !== false;
  } else if (collection === "preparation") {
    item.title = sanitize(item.title);
    item.tripType = sanitize(item.tripType || item.type);
    item.items = Array.isArray(item.items) ? item.items : [];
    item.published = item.published !== false;
  } else if (collection === "reviews") {
    item.name = sanitize(item.name);
    item.comment = sanitize(item.comment);
    item.rating = Math.min(5, Math.max(1, Number(item.rating || 5)));
    item.status = item.status || "approved";
    item.published = item.published !== false;
  }
  return item;
}

function normalizeCouponCode(code) {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeCoupon(body) {
  const x = {...(body || {})};
  x.id = x.id || makeId("coupon");
  x.code = normalizeCouponCode(x.code);
  x.type = (x.type === "fixed" || x.type === "amount") ? "fixed" : "percent";
  x.value = Number(x.value ?? (x.type === "percent" ? x.percent : x.amount) ?? 0);
  if (!Number.isFinite(x.value) || x.value < 0) x.value = 0;
  x.percent = x.type === "percent" ? x.value : 0;
  x.amount = x.type === "fixed" ? x.value : 0;
  x.startsAt = x.startsAt || null;
  x.expiresAt = x.expiresAt || null;
  x.maxUses = Math.max(0, Number(x.maxUses ?? x.limit ?? 0) || 0);
  x.usedCount = Math.max(0, Number(x.usedCount || 0) || 0);
  x.active = x.active !== false;
  x.minAmount = Math.max(0, Number(x.minAmount || 0) || 0);
  x.createdAt = x.createdAt || new Date().toISOString();
  x.updatedAt = new Date().toISOString();
  return x;
}

function publicCoupon(coupon) {
  if (!coupon) return null;
  const {lastRedemption, ...safe} = coupon;
  return safe;
}

function validateCoupon(coupon, amount) {
  if (!coupon) return {ok:false,error:"کۆدی داشکاندن نەدۆزرایەوە"};
  if (coupon.active === false) return {ok:false,error:"ئەم کۆدە ناچالاکە"};
  const now = Date.now();
  if (coupon.startsAt && !Number.isNaN(Date.parse(coupon.startsAt)) && now < Date.parse(coupon.startsAt)) return {ok:false,error:"ئەم کۆدە هێشتا دەستی پێ نەکردووە"};
  if (coupon.expiresAt && !Number.isNaN(Date.parse(coupon.expiresAt)) && now > Date.parse(coupon.expiresAt)) return {ok:false,error:"کۆدی داشکاندن بەسەرچووە"};
  if (coupon.maxUses > 0 && Number(coupon.usedCount || 0) >= coupon.maxUses) return {ok:false,error:"سنووری بەکارهێنانی ئەم کۆدە تەواو بووە"};
  const n = Number(amount);
  if (coupon.minAmount > 0 && (!Number.isFinite(n) || n < coupon.minAmount)) return {ok:false,error:`کەمترین بڕ بۆ بەکارهێنانی کۆد ${coupon.minAmount} ـە`};
  return {ok:true};
}

function calculateCouponDiscount(coupon, amount) {
  const n = Math.max(0, Number(amount) || 0);
  if (coupon.type === "fixed") return Math.min(n, Math.max(0, Number(coupon.value) || 0));
  return Math.min(n, n * (Math.max(0, Math.min(100, Number(coupon.value) || 0)) / 100));
}

function calculateFinalAmount(coupon, amount) {
  const n = Math.max(0, Number(amount) || 0);
  return Math.max(0, n - calculateCouponDiscount(coupon, n));
}

async function kvListGet(env, key) {
  if (!env.KURDIA_KV) {
    if (key === "kurdia_stories") return inMemoryDB.stories || [];
    if (key === "kurdia_admin_notifications" || key === "kurdia_notifications") return inMemoryDB.notifications || [];
    return [];
  }
  try { return (await env.KURDIA_KV.get(key, "json")) || []; } catch (_) { return []; }
}

async function kvListPut(env, key, items) {
  const safe = Array.isArray(items) ? items : [];
  if (env.KURDIA_KV) await env.KURDIA_KV.put(key, JSON.stringify(safe));
  if (key === "kurdia_stories") inMemoryDB.stories = safe;
  if (key === "kurdia_registrations") inMemoryDB.registrations = safe;
  if (key === "kurdia_admin_notifications" || key === "kurdia_notifications") inMemoryDB.notifications = safe;
  return safe;
}

async function kvListPush(env, key, item, max = 5000) {
  const items = await kvListGet(env, key);
  items.unshift(item);
  if (items.length > max) items.length = max;
  return kvListPut(env, key, items);
}

function adminEventInfo(path) {
  const map = {
    "/api/register": ["Registration", "تۆمارکردنی بەشداربووی نوێ"],
    "/api/private-trip": ["Private Trip", "داواکاری گەشتی تایبەتی نوێ"],
    "/api/stories": ["Story", "ستۆرییەکی نوێ هات"],
    "/api/reviews": ["Review", "هەڵسەنگاندنێکی نوێ هات"],
    "/api/otp/send": ["OTP", "داواکاری OTP هات"],
    "/api/otp/verify": ["OTP", "OTP پشتڕاستکرایەوە"],
    "/api/admin/verify-booking": ["Booking", "Booking پەسەندکرا"],
    "/api/admin/reject-booking": ["Booking", "Booking ڕەتکرایەوە"],
    "/api/admin/push/send": ["Push", "Push ـێک نێردرا"],
    "/api/admin/send-broadcast": ["Broadcast", "Broadcast نێردرا"],
    "/api/admin/send-trip-notification": ["Trip Notification", "ئاگاداریی گەشت نێردرا"],
    "/api/admin/coupons": ["Coupon", "گۆڕانکاری لە Coupon ڕوویدا"],
    "/api/admin/coupons/reset-usage": ["Coupon", "بەکارهێنانی Coupon reset کرا"],
    "/api/admin/cms": ["CMS", "گۆڕانکاری CMS ڕوویدا"],
    "/api/admin/settings": ["Settings", "گۆڕانکاری Settings ڕوویدا"],
    "/api/admin/restore": ["Restore", "Restore ـی داتا ئەنجامدرا"],
    "/api/admin/backup": ["Backup", "Backup ـی سیستەم ئەنجامدرا"]
  };
  return map[path] || ["System Event", `ڕووداوێکی نوێ: ${path}`];
}

async function recordAdminEvent(env, path, request) {
  try {
    const [type, title] = adminEventInfo(path);
    const item = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      type,
      title,
      path,
      method: request.method,
      createdAt: new Date().toISOString(),
      read: false
    };
    // Keep the existing admin log intact.
    await kvListPush(env, "kurdia_admin_notifications", item, 500);
    // New canonical Notifications Log: only customer-facing activity that
    // should wake the admin (booking, private trip, story submission).
    if (["/api/register", "/api/private-trip", "/api/stories"].includes(path)) {
      await kvListPush(env, "kurdia_notifications", {...item}, 500);
    }
  } catch (_) {}
}

function isAdminAuthorized(request, env) {
  const expected = String(env.ADMIN_API_KEY || "2026").trim();
  if (!expected) return false;
  const header = request.headers.get("X-Admin-Key") || "";
  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return header === expected || bearer === expected;
}

function calculateRevenue(items) {
  let total = 0;
  for (const item of items || []) {
    const raw = String(item.amount || item.price || "").replace(/[^0-9.]/g, "");
    const n = Number(raw);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

async function diagnostics(request, env) {
  const started = Date.now();
  const checks = [];
  checks.push({name:"Database / KV",status:env.KURDIA_KV ? "online" : "warning",detail:env.KURDIA_KV ? "KURDIA_KV binding is configured" : "KURDIA_KV binding is missing"});
  checks.push({name:"Media / R2",status:env.KURDIA_MEDIA ? "online" : "warning",detail:env.KURDIA_MEDIA ? "R2 binding is configured" : "KURDIA_MEDIA binding is missing; small media can use KV"});
  checks.push({name:"WhatsApp",status:env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID ? "online" : "warning",detail:env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID ? "credentials configured" : "WhatsApp credentials missing"});
  checks.push({name:"Telegram",status:env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? "online" : "warning",detail:env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? "configured" : "Telegram credentials missing"});
  checks.push({name:"AI",status:env.OPENAI_API_KEY ? "online" : "warning",detail:env.OPENAI_API_KEY ? "AI key configured" : "OPENAI_API_KEY missing"});
  checks.push({name:"Google Sheets",status:env.GOOGLE_SHEETS_URL ? "online" : "warning",detail:env.GOOGLE_SHEETS_URL ? "configured" : "optional integration not configured"});
  checks.push({name:"Admin API Key",status:env.ADMIN_API_KEY ? "online" : "error",detail:env.ADMIN_API_KEY ? "configured" : "ADMIN_API_KEY is required for admin mutations"});
  return json({ok:true,checkedAt:new Date().toISOString(),responseMs:Date.now()-started,checks});
}

function safeFileName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 180);
}

function base64ToUint8Array(input) {
  let b64 = String(input || "");
  const comma = b64.indexOf(",");
  if (comma >= 0) b64 = b64.slice(comma + 1);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}



function weatherLocalHour(timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {timeZone: timezone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false}).formatToParts(new Date());
    const o = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, x.value]));
    const hh = o.hour === "24" ? "00" : o.hour;
    return `${o.year}-${o.month}-${o.day}T${hh}:${o.minute}`;
  } catch (_) { return new Date().toISOString().slice(0,13) + ":00"; }
}

function nearestHourlyIndex(times, timezone) {
  if (!Array.isArray(times) || !times.length) return 0;
  const target = weatherLocalHour(timezone);
  let best = 0, bestDiff = Infinity;
  for (let i=0;i<times.length;i++) {
    const a = Math.abs(String(times[i]).localeCompare(target));
    const t = Date.parse(String(times[i]).replace(" ", "T") + ":00" + (String(times[i]).length <= 13 ? "" : ""));
    const targetMs = Date.parse(target.replace("T", "T") + ":00");
    const diff = Number.isFinite(t) && Number.isFinite(targetMs) ? Math.abs(t-targetMs) : a;
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return best;
}

function normalizeECMWFHourly(w, timezone) {
  const h = w?.hourly || {};
  const times = h.time || [];
  const idx = nearestHourlyIndex(times, timezone || w?.timezone || "UTC");
  const val = (key) => h?.[key]?.[idx] ?? null;
  const current = {
    time: times[idx] || null,
    temperature_2m: val("temperature_2m"),
    relative_humidity_2m: val("relative_humidity_2m"),
    apparent_temperature: val("apparent_temperature"),
    precipitation: val("precipitation"),
    rain: val("rain"),
    showers: val("showers"),
    precipitation_probability: val("precipitation_probability"),
    weather_code: val("weather_code"),
    wind_speed_10m: val("wind_speed_10m"),
    wind_direction_10m: val("wind_direction_10m"),
    wind_gusts_10m: val("wind_gusts_10m"),
    visibility: val("visibility"),
    cloud_cover: val("cloud_cover"),
    lightning_density: val("lightning_density")
  };
  return { current, hourly: h };
}

async function fetchECMWFWeather(lat, lon) {
  const u = new URL("https://api.open-meteo.com/v1/ecmwf");
  u.searchParams.set("latitude", String(lat));
  u.searchParams.set("longitude", String(lon));
  u.searchParams.set("timezone", "auto");
  u.searchParams.set("forecast_days", "7");
  u.searchParams.set("hourly", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover,lightning_density");
  u.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset,weather_code");
  const r = await fetch(u.toString(), {headers:{"Accept":"application/json","User-Agent":"KURDIA-ADVENTURE/Weather"}});
  if (!r.ok) throw new Error("ECMWF weather request failed");
  return await r.json();
}

async function weatherByCoordinates(lat, lon, label, env) {
  try {
    const d = await fetchECMWFWeather(lat, lon);
    const normalized = normalizeECMWFHourly(d, d.timezone || "UTC");
    const h = d.hourly || {};
    return json({ok:true, weather:{
      ...d,
      current: normalized.current,
      hourly: {
        time:(h.time||[]).slice(0,24),
        temperature_2m:(h.temperature_2m||[]).slice(0,24),
        apparent_temperature:(h.apparent_temperature||[]).slice(0,24),
        precipitation_probability:(h.precipitation_probability||[]).slice(0,24),
        precipitation:(h.precipitation||[]).slice(0,24),
        rain:(h.rain||[]).slice(0,24),
        weather_code:(h.weather_code||[]).slice(0,24),
        wind_speed_10m:(h.wind_speed_10m||[]).slice(0,24),
        wind_gusts_10m:(h.wind_gusts_10m||[]).slice(0,24),
        visibility:(h.visibility||[]).slice(0,24)
      },
      location:label, latitude:lat, longitude:lon,
      source:"Open-Meteo · ECMWF IFS HRES 9km",
      model:"ECMWF IFS HRES 9km",
      updatedAt:new Date().toISOString()
    }});
  } catch (e) {
    return json({ok:false,error:"داتای کەشوهەوای ECMWF بەردەست نییە"},502);
  }
}

async function weatherSearch(query, env) {
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl, {headers:{"Accept":"application/json"}});
    const geo = await geoRes.json();
    const place = geo?.results?.[0];
    if (!place) return json({ok:false,error:"شوێنەکە نەدۆزرایەوە"},404);
    const d = await fetchECMWFWeather(place.latitude, place.longitude);
    const normalized = normalizeECMWFHourly(d, d.timezone || "UTC");
    const h = d.hourly || {};
    const data = await getCMS(env);
    const alert = findWeatherAlert(data.weather?.alerts || [], place);
    return json({ok:true, weather:{
      ...d,
      location:`${place.name}${place.country ? " · "+place.country : ""}`,
      latitude:place.latitude, longitude:place.longitude,
      current:normalized.current,
      hourly:{
        time:(h.time||[]).slice(0,24), temperature_2m:(h.temperature_2m||[]).slice(0,24),
        apparent_temperature:(h.apparent_temperature||[]).slice(0,24), precipitation_probability:(h.precipitation_probability||[]).slice(0,24),
        precipitation:(h.precipitation||[]).slice(0,24), rain:(h.rain||[]).slice(0,24), weather_code:(h.weather_code||[]).slice(0,24),
        wind_speed_10m:(h.wind_speed_10m||[]).slice(0,24), wind_gusts_10m:(h.wind_gusts_10m||[]).slice(0,24), visibility:(h.visibility||[]).slice(0,24)
      },
      alerts:alert ? [alert] : [],
      source:"Open-Meteo · ECMWF IFS HRES 9km",
      model:"ECMWF IFS HRES 9km",
      updatedAt:new Date().toISOString()
    }});
  } catch (e) {
    return json({ok:false,error:e?.message || "هەڵەی کەشوهەوا"},502);
  }
}

function findWeatherAlert(alerts, place) {
  if (!Array.isArray(alerts)) return null;
  const hay = `${place.name} ${place.admin1 || ""} ${place.country || ""}`.toLowerCase();
  return alerts.find(a => {
    if (!a || a.active === false) return false;
    if (!a.location) return true;
    return hay.includes(String(a.location).toLowerCase()) || String(a.location).toLowerCase().includes(String(place.name).toLowerCase());
  }) || null;
}

// ============================================================
// R2 MEDIA DELIVERY
// ============================================================

// This block is appended after the main worker so the route above can call it.
// Cloudflare executes the function declarations normally; no special wiring is required.


// ============================================================
// PWA WEB PUSH HELPERS — additive only
// ============================================================
const PUSH_VAPID_PUBLIC_KEY = "BMCcZVZLBBZlyVzr0NCsaVTekgvDD5b3ckgDJR7-ysq91sD_Jxu6Lu0rHDRL7s2ZB4iWGmfDGPxNNH9cejP5teo";

function pushB64u(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = ""; for (let i=0;i<u.length;i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function pushBytes(b64u) {
  const s=String(b64u||"").replace(/-/g,"+").replace(/_/g,"/");
  const padded=s+"===".slice((s.length+3)%4);
  const bin=atob(padded); const out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out;
}
async function pushSha256(data){ return new Uint8Array(await crypto.subtle.digest("SHA-256", data)); }
async function pushHkdfExtract(salt, ikm){ return new Uint8Array(await crypto.subtle.importKey("raw", salt, "HKDF", false, ["deriveBits"]).then(k=>crypto.subtle.deriveBits({name:"HKDF",hash:"SHA-256",salt,info:new Uint8Array()},k,256))); }
async function pushHkdfExpand(prk, info, length){
  const key=await crypto.subtle.importKey("raw",prk,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  let t=new Uint8Array(), out=new Uint8Array(), counter=1;
  while(out.length<length){ const data=new Uint8Array(t.length+info.length+1); data.set(t); data.set(info,t.length); data[data.length-1]=counter++; t=new Uint8Array(await crypto.subtle.sign("HMAC",key,data)); const n=new Uint8Array(out.length+t.length); n.set(out); n.set(t,out.length); out=n; }
  return out.slice(0,length);
}
async function pushHkdfExtractReal(salt, ikm){
  const key=await crypto.subtle.importKey("raw",salt,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC",key,ikm));
}
function pushConcat(...parts){ const n=parts.reduce((a,b)=>a+b.length,0), o=new Uint8Array(n); let p=0; for(const b of parts){o.set(b,p);p+=b.length;} return o; }
function pushUtf8(s){ return new TextEncoder().encode(s); }
function pushOrigin(endpoint){ try{return new URL(endpoint).origin;}catch{return "";} }
async function pushSubscriptionId(endpoint){ return pushB64u(await pushSha256(pushUtf8(endpoint))); }

async function pushVapidJwt(env, audience){
  const privateKeyB64=String(env.VAPID_PRIVATE_KEY||"").trim();
  if(!privateKeyB64) throw new Error("VAPID_PRIVATE_KEY is missing");
  const priv=pushBytes(privateKeyB64), pub=pushBytes(String(env.VAPID_PUBLIC_KEY||PUSH_VAPID_PUBLIC_KEY));
  if(priv.length!==32 || pub.length!==65) throw new Error("VAPID key format is invalid");
  const x=pushB64u(pub.slice(1,33)), y=pushB64u(pub.slice(33,65)), d=pushB64u(priv);
  const jwk={kty:"EC",crv:"P-256",x,y,d};
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  const header=pushB64u(pushUtf8(JSON.stringify({typ:"JWT",alg:"ES256"})));
  const payload=pushB64u(pushUtf8(JSON.stringify({aud:audience,exp:Math.floor(Date.now()/1000)+43200,sub:String(env.VAPID_SUBJECT||"mailto:admin@kurdia.adventure")})));
  const data=pushUtf8(header+"."+payload);
  const sig=new Uint8Array(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,data));
  let raw=sig;
  if(raw.length!==64) throw new Error("ECDSA signature format unsupported");
  return header+"."+payload+"."+pushB64u(raw);
}

async function sendWebPush(env, subscription, payload){
  const endpoint=String(subscription.endpoint||"");
  const userPub=pushBytes(subscription.keys?.p256dh);
  const auth=pushBytes(subscription.keys?.auth);
  if(userPub.length!==65 || auth.length!==16) return {ok:false,status:400,error:"subscription keys invalid"};
  const serverKeys=await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveBits"]);
  const serverPub=new Uint8Array(await crypto.subtle.exportKey("raw",serverKeys.publicKey));
  const userKey=await crypto.subtle.importKey("raw",userPub,{name:"ECDH",namedCurve:"P-256"},false,[]);
  const ecdh=new Uint8Array(await crypto.subtle.deriveBits({name:"ECDH",public:userKey},serverKeys.privateKey,256));
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const prk0=await pushHkdfExtractReal(auth,ecdh);
  const info=pushConcat(pushUtf8("WebPush: info\\0"),userPub,serverPub);
  const ikm=await pushHkdfExpand(prk0,info,32);
  const prk=await pushHkdfExtractReal(salt,ikm);
  const cek=await pushHkdfExpand(prk,pushUtf8("Content-Encoding: aes128gcm\\0"),16);
  const nonce=await pushHkdfExpand(prk,pushUtf8("Content-Encoding: nonce\\0"),12);
  const bodyBytes=pushUtf8(JSON.stringify(payload));
  const padded=pushConcat(bodyBytes,new Uint8Array([2]));
  const aesKey=await crypto.subtle.importKey("raw",cek,{name:"AES-GCM"},false,["encrypt"]);
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:nonce,tagLength:128},aesKey,padded));
  const rs=new Uint8Array(4); new DataView(rs.buffer).setUint32(0,4096);
  const header=pushConcat(salt,rs,new Uint8Array([65]),serverPub);
  const encrypted=pushConcat(header,cipher);
  const jwt=await pushVapidJwt(env,pushOrigin(endpoint));
  const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/octet-stream","Content-Encoding":"aes128gcm","TTL":"86400","Urgency":"normal","Authorization":"vapid t="+jwt+", k="+String(env.VAPID_PUBLIC_KEY||PUSH_VAPID_PUBLIC_KEY)},body:encrypted});
  if(res.ok) return {ok:true,status:res.status};
  const txt=await res.text().catch(()=>"");
  return {ok:false,status:res.status,error:txt.slice(0,500)};
}
