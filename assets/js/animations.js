/**
 * ============================================================================
 * KURDIA ADVENTURE — MASTER CINEMATIC MOTION & INTERACTION ORCHESTRATOR
 * File: /assets/js/animations.js
 * Purpose: Coordinates:
 *          1. Living Aurora Background Mesh
 *          2. Header Brand Logo Entrance
 *          3. Cinematic Hero Choreography, Background Settle & Scroll Cue
 *          4. Desktop Card Radial Spotlight & Restrained 3D Tilt (Touch-Safe)
 *          5. Desktop Magnetic Primary CTA Pull (Touch-Safe)
 *          6. Kinetic Stat Counters (20K+, 200+, 4.9)
 *          7. Micro-Interactions (Tactile Press, Ripple, Modal/Sheet/Toast/Wizard)
 *          8. Weather Station Section Choreography
 *          9. Dynamic CMS / Trip Card MutationObserver & Page Navigation Hooks
 *          10. Viewport-Gated Three.js Hero Starfield (Zero Continuous Background GPU Waste)
 * ============================================================================
 */
(function (window, document) {
  'use strict';

  const cfg = () =>
    window.KURDIA_MOTION_CONFIG || {
      durations: { fast: 0.24, base: 0.42, medium: 0.58, slow: 0.78, cinematic: 1.05 },
      easings: { outQuart: 'power3.out', outExpo: 'expo.out', gentleSpring: 'power3.out' },
      stagger: { tight: 0.045, base: 0.075, relaxed: 0.11 },
      distances: { sm: 14, md: 20, lg: 28 },
      limits: { heroParallaxMaxPx: 34, cardTiltMaxDeg: 3.2, cardTiltPerspectivePx: 980 },
      prefersReducedMotion: () => false,
      isTouchDevice: () => true,
      isMobileViewport: () => window.innerWidth < 768,
      isPageHidden: () => Boolean(document.hidden),
      onVisibilityChange: () => {},
      registerCleanup: () => {}
    };

  let heroEntranceTimeline = null;
  let threeRunning = false;
  let threeRafId = null;
  let threeCheckVisibility = null;

  /* ==========================================================================
     1. LIVING AURORA BACKGROUND MESH
     ========================================================================== */
  function initLivingAuroraBg() {
    if (document.getElementById('kurdiaLivingBg')) return;
    const bg = document.createElement('div');
    bg.id = 'kurdiaLivingBg';
    bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML = [
      '<div class="klbg-orb klbg-orb-1"></div>',
      '<div class="klbg-orb klbg-orb-2"></div>',
      '<div class="klbg-orb klbg-orb-3"></div>',
      '<div class="klbg-grid"></div>'
    ].join('');
    document.body.prepend(bg);
  }

  /* ==========================================================================
     2. HEADER BRAND LOGO ENTRANCE
     ========================================================================== */
  function initBrandLogoEntrance() {
    const brand = document.querySelector('.top .brand');
    if (!brand || brand.__kaBrandAnimated) return;
    brand.__kaBrandAnimated = true;

    const c = cfg();
    if (c.prefersReducedMotion() || !window.gsap) return;

    const logoImg = brand.querySelector('.brand-logo-img');
    const textWrap = brand.querySelector('.brand-text-wrap');

    try {
      const tl = window.gsap.timeline({ defaults: { ease: c.easings.outExpo } });
      if (logoImg) {
        tl.fromTo(
          logoImg,
          { opacity: 0, scale: 0.86, rotate: -6 },
          { opacity: 1, scale: 1, rotate: 0, duration: 0.68, clearProps: 'transform,opacity' }
        );
      }
      if (textWrap) {
        tl.fromTo(
          textWrap,
          { opacity: 0, x: 10 },
          { opacity: 1, x: 0, duration: 0.56, clearProps: 'transform,opacity' },
          '-=0.46'
        );
      }
    } catch (_) {}
  }

  /* ==========================================================================
     3. CINEMATIC HERO CHOREOGRAPHY (Smooth, Natural GSAP Staggered Entrance)
     ========================================================================== */
  function initCinematicHero(options) {
    const opts = options || {};
    const hero = document.querySelector('#home .hero');
    if (!hero) return;

    const container = hero.querySelector('.container');
    if (!container) return;

    // Inject subtle scroll cue pill once
    if (!container.querySelector('.ka-hero-scroll-cue')) {
      const cue = document.createElement('button');
      cue.type = 'button';
      cue.className = 'ka-hero-scroll-cue';
      cue.style.border = '1px solid rgba(255,255,255,0.12)';
      cue.onclick = function () {
        const up = document.getElementById('upcomingTripsSection');
        if (up) up.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      cue.innerHTML =
        '<span class="ka-hero-scroll-dot"></span>' +
        '<span>خوارەوە ببینە · گەشتەکانی داهاتوو ↓</span>';
      container.appendChild(cue);
    }

    if (hero.__kaHeroAnimated && !opts.force) return;
    hero.__kaHeroAnimated = true;

    const eyebrow = container.querySelector('.eyebrow');
    const title = container.querySelector('#heroTitle, h1');
    const text = container.querySelector('#heroText, p');
    const btns = Array.from(container.querySelectorAll('.actions .btn'));
    const cue = container.querySelector('.ka-hero-scroll-cue');
    const allTargets = [eyebrow, title, text, ...btns, cue].filter(Boolean);

    const c = cfg();
    if (c.prefersReducedMotion() || !window.gsap) {
      allTargets.forEach((el) => {
        el.style.opacity = '';
        el.style.visibility = '';
        el.style.transform = '';
        el.style.filter = '';
      });
      return;
    }

    const introEl = document.getElementById('kurdia-intro');
    const hasActiveIntro =
      !opts.force &&
      Boolean(introEl && !introEl.classList.contains('intro-out') && introEl.offsetParent !== null);
    const baseDelay = opts.delay !== undefined ? opts.delay : hasActiveIntro ? 0.32 : 0.06;

    try {
      if (heroEntranceTimeline) {
        heroEntranceTimeline.kill();
      }
      window.gsap.killTweensOf(allTargets);

      // Gentle, natural background scale settle (--hero-kenburns-scale)
      const scaleProxy = { s: 1.075 };
      hero.style.setProperty('--hero-kenburns-scale', '1.075');
      window.gsap.to(scaleProxy, {
        s: 1.045,
        duration: 1.85,
        delay: baseDelay,
        ease: 'power2.out',
        onUpdate: () => {
          hero.style.setProperty('--hero-kenburns-scale', scaleProxy.s.toFixed(4));
        }
      });

      const tl = window.gsap.timeline({
        delay: baseDelay,
        defaults: {
          ease: c.easings.outExpo || 'expo.out',
          overwrite: 'auto'
        }
      });
      heroEntranceTimeline = tl;

      // 1. Staggered reveal for Hero Titles (Eyebrow -> Main Heading -> Subtitle)
      const titleGroup = [eyebrow, title, text].filter(Boolean);
      if (titleGroup.length) {
        tl.fromTo(
          titleGroup,
          {
            autoAlpha: 0,
            y: 22,
            scale: 0.985,
            filter: 'blur(4px)'
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            filter: 'blur(0px)',
            duration: 0.88,
            stagger: 0.12,
            ease: 'expo.out',
            clearProps: 'transform,opacity,visibility,filter'
          },
          0
        );
      }

      // 2. Smooth, natural staggered entrance for Hero Action Buttons (no exaggerated bounce)
      if (btns.length) {
        tl.fromTo(
          btns,
          {
            autoAlpha: 0,
            y: 16,
            scale: 0.96
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.68,
            stagger: 0.09,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility'
          },
          titleGroup.length ? '-=0.52' : 0.15
        );
      }

      // 3. Scroll Cue pill entrance
      if (cue) {
        tl.fromTo(
          cue,
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.56,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility'
          },
          '-=0.38'
        );
      }
    } catch (_) {
      allTargets.forEach((el) => {
        el.style.opacity = '';
        el.style.visibility = '';
        el.style.transform = '';
        el.style.filter = '';
      });
    }
  }

  // Expose globally so Intro overlay dismissal or manual replay can trigger the hero entrance smoothly
  window.playHeroEntranceAnimation = initCinematicHero;

  /* ==========================================================================
     4. DESKTOP CARD RADIAL SPOTLIGHT & RESTRAINED 3D TILT (Touch-Safe)
     ========================================================================== */
  function initSpotlightAnd3DTilt() {
    const c = cfg();
    const cardSelector = [
      '.featured',
      '.trip-showcase-card',
      '.place-card',
      '.booking-trip-pick-card',
      '.private-vip-showcase',
      '.private-preset-card',
      '.private-trip-card',
      '.weather-hero-card',
      '.public-review',
      '.experiences .tile',
      '.experience-card',
      '.more-card'
    ].join(', ');

    const cards = document.querySelectorAll(cardSelector);
    cards.forEach((card) => {
      if (card.__kaSpotlightBound) return;
      card.__kaSpotlightBound = true;

      const onCardMove = (e) => {
        // Strictly disable on touch pointers, touch devices, reduced motion, or hidden tab
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (c.isTouchDevice() || c.prefersReducedMotion() || c.isPageHidden()) return;

        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Update CSS custom properties for radial cursor light-follow
        card.style.setProperty('--mouse-x', `${x.toFixed(1)}px`);
        card.style.setProperty('--mouse-y', `${y.toFixed(1)}px`);

        // Restrained 3D tilt only on explicit .tilt-3d-card elements
        if (card.classList.contains('tilt-3d-card')) {
          const maxDeg = c.limits.cardTiltMaxDeg || 3.2;
          const persp = c.limits.cardTiltPerspectivePx || 980;
          const pctX = x / rect.width - 0.5;
          const pctY = y / rect.height - 0.5;
          const rotY = (pctX * maxDeg * 1.4).toFixed(2);
          const rotX = (-pctY * maxDeg * 1.4).toFixed(2);
          card.style.transform = `perspective(${persp}px) translateY(-5px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        }
      };

      const onCardLeave = () => {
        if (card.classList.contains('tilt-3d-card')) {
          card.style.transform = '';
        }
      };

      card.addEventListener('pointermove', onCardMove, { passive: true });
      card.addEventListener('pointerleave', onCardLeave, { passive: true });
    });
  }

  /* ==========================================================================
     5. DESKTOP MAGNETIC PRIMARY CTA PULL (Touch-Safe)
     ========================================================================== */
  function initMagneticButtons() {
    const c = cfg();
    if (c.isTouchDevice() || c.prefersReducedMotion()) return;

    const magTargets = document.querySelectorAll(
      '#home .hero .actions .btn, .private-vip-actions .btn.red, .trip-join-btn'
    );

    magTargets.forEach((btn) => {
      if (btn.__kaMagneticBound) return;
      btn.__kaMagneticBound = true;

      const onMove = (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (c.isTouchDevice() || c.prefersReducedMotion() || btn.disabled) return;
        const r = btn.getBoundingClientRect();
        const dx = Math.max(-5, Math.min(5, (e.clientX - (r.left + r.width / 2)) * 0.14));
        const dy = Math.max(-4, Math.min(4, (e.clientY - (r.top + r.height / 2)) * 0.14));
        btn.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
      };

      const onLeave = () => {
        btn.style.transform = '';
      };

      btn.addEventListener('pointermove', onMove, { passive: true });
      btn.addEventListener('pointerleave', onLeave, { passive: true });
    });
  }

  /* ==========================================================================
     6. KINETIC STAT COUNTERS (About Page Stats: 20K+, 200+, 4.9)
     ========================================================================== */
  function initKineticStatCounters() {
    const c = cfg();
    const statEls = document.querySelectorAll('#aboutStatsPublic .stat b');
    if (!statEls.length) return;

    statEls.forEach((bEl) => {
      if (bEl.__kaStatAnimated) return;
      const raw = (bEl.textContent || '').trim();
      const match = raw.match(/^(\d+(?:\.\d+)?)(.*)$/);
      if (!match) return;

      const targetNum = parseFloat(match[1]);
      const suffix = match[2] || '';
      const isDecimal = match[1].includes('.');
      if (Number.isNaN(targetNum)) return;

      const runCounter = () => {
        if (bEl.__kaStatAnimated) return;
        bEl.__kaStatAnimated = true;
        if (c.prefersReducedMotion() || !window.gsap) {
          bEl.textContent = raw;
          return;
        }
        const proxy = { val: 0 };
        window.gsap.to(proxy, {
          val: targetNum,
          duration: 1.25,
          ease: 'power3.out',
          onUpdate() {
            bEl.textContent = (isDecimal ? proxy.val.toFixed(1) : Math.round(proxy.val)) + suffix;
          },
          onComplete() {
            bEl.textContent = raw;
          }
        });
      };

      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                runCounter();
                io.disconnect();
              }
            });
          },
          { threshold: 0.25 }
        );
        io.observe(bEl);
      } else {
        runCounter();
      }
    });
  }

  /* ==========================================================================
     7. MICRO-INTERACTIONS (Tactile Press, Ripple, Modal/Toast/Wizard Transitions)
     ========================================================================== */
  function initMicroInteractions() {
    if (document.body.__kaMicroBound) return;
    document.body.__kaMicroBound = true;

    const c = cfg();

    // 7A. Tactile Press Feedback
    const pressSelector =
      '.btn, .navitem, .pf-chip, .weather-chip, .pay-method-btn, .private-preset-card, .stepper-btn, .iconbtn, .ka-menu-item';

    document.addEventListener(
      'pointerdown',
      (e) => {
        const target = e.target && e.target.closest ? e.target.closest(pressSelector) : null;
        if (!target || target.disabled) return;
        target.classList.add('kurdia-btn-pressed');
      },
      { passive: true }
    );

    const clearPressed = () => {
      document
        .querySelectorAll('.kurdia-btn-pressed')
        .forEach((el) => el.classList.remove('kurdia-btn-pressed'));
    };
    document.addEventListener('pointerup', clearPressed, { passive: true });
    document.addEventListener('pointercancel', clearPressed, { passive: true });

    // 7B. Click Ripple on Primary & Ghost Buttons
    document.addEventListener(
      'click',
      (e) => {
        if (c.prefersReducedMotion()) return;
        const btn =
          e.target && e.target.closest
            ? e.target.closest('.btn, .navjoin, .pay-method-btn, .fib-quick-pill')
            : null;
        if (!btn || btn.disabled) return;

        const rect = btn.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const ripple = document.createElement('span');
        ripple.className = 'kurdia-click-ripple';
        const size = Math.max(rect.width, rect.height) * 0.9;
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        const cx = e.clientX ? e.clientX - rect.left : rect.width / 2;
        const cy = e.clientY ? e.clientY - rect.top : rect.height / 2;
        ripple.style.left = `${cx}px`;
        ripple.style.top = `${cy}px`;
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 620);
      },
      { passive: true }
    );

    // 7C. Modal & Sheet Entrance Choreography
    const modals = document.querySelectorAll('.modal, .story-modal');
    modals.forEach((modal) => {
      if (modal.__kaModalObserved) return;
      modal.__kaModalObserved = true;
      const mo = new MutationObserver(() => {
        const isShown = modal.classList.contains('show');
        const sheet = modal.querySelector('.sheet, .story-sheet');
        if (isShown && sheet && window.gsap && !c.prefersReducedMotion()) {
          window.gsap.killTweensOf(sheet);
          window.gsap.fromTo(
            sheet,
            { opacity: 0, y: 24, scale: 0.975 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.36,
              ease: c.easings.outQuart || 'power3.out',
              clearProps: 'transform,opacity'
            }
          );
        }
      });
      mo.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });

    // 7D. Booking & Private Wizard Step Panel Entrance
    const wizardSteps = document.querySelectorAll('.booking-step-panel, .private-wizard-panel');
    wizardSteps.forEach((panel) => {
      if (panel.__kaWizardObserved) return;
      panel.__kaWizardObserved = true;
      const mo = new MutationObserver(() => {
        if (!panel.hidden && window.gsap && !c.prefersReducedMotion()) {
          window.gsap.killTweensOf(panel);
          window.gsap.fromTo(
            panel,
            { opacity: 0, y: 12 },
            {
              opacity: 1,
              y: 0,
              duration: 0.32,
              ease: 'power3.out',
              clearProps: 'transform,opacity'
            }
          );
        }
      });
      mo.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  /* ==========================================================================
     8. WEATHER STATION SECTION CHOREOGRAPHY
     ========================================================================== */
  function animateWeatherStationSection() {
    const c = cfg();
    if (c.prefersReducedMotion() || !window.gsap) return;

    const weatherPage = document.getElementById('weather');
    if (!weatherPage || !weatherPage.classList.contains('active')) return;

    const chips = weatherPage.querySelectorAll('#weatherQuickChips .weather-chip');
    const heroCard = weatherPage.querySelector('#weatherHeroCard');
    const metrics = weatherPage.querySelectorAll('#weatherMetricsGrid .metric-box');
    const hourly = weatherPage.querySelectorAll('#hourlyTimeline .hourly-card');
    const days = weatherPage.querySelectorAll('#daysForecast .day-row-card');

    if (chips.length && !weatherPage.__kaChipsAnimated) {
      weatherPage.__kaChipsAnimated = true;
      window.gsap.fromTo(
        chips,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.36,
          stagger: 0.03,
          ease: 'power3.out',
          clearProps: 'transform,opacity'
        }
      );
    }

    if (heroCard && !heroCard.__kaWeatherHeroAnimated) {
      heroCard.__kaWeatherHeroAnimated = true;
      window.gsap.fromTo(
        heroCard,
        { opacity: 0, y: 18, scale: 0.985 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.52,
          ease: 'power3.out',
          clearProps: 'transform,opacity'
        }
      );
    }

    if (metrics.length && !weatherPage.__kaMetricsAnimated) {
      weatherPage.__kaMetricsAnimated = true;
      window.gsap.fromTo(
        metrics,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.035,
          ease: 'power3.out',
          clearProps: 'transform,opacity'
        }
      );
    }

    if (hourly.length && !weatherPage.__kaHourlyAnimated) {
      weatherPage.__kaHourlyAnimated = true;
      window.gsap.fromTo(
        Array.from(hourly).slice(0, 10),
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.36,
          stagger: 0.025,
          ease: 'power3.out',
          clearProps: 'transform,opacity'
        }
      );
    }

    if (days.length && !weatherPage.__kaDaysAnimated) {
      weatherPage.__kaDaysAnimated = true;
      window.gsap.fromTo(
        days,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.38,
          stagger: 0.04,
          ease: 'power3.out',
          clearProps: 'transform,opacity'
        }
      );
    }
  }

  /* ==========================================================================
     9. PAGE NAVIGATION & DYNAMIC CONTENT REFRESH HOOKS (Duplicate-Safe)
     ========================================================================== */
  window.kurdiaAnimatePageCards = function (pageId) {
    const activePage = document.querySelector('.page.active');
    const targetId = pageId || (activePage ? activePage.id : 'home');
    const page = document.getElementById(targetId);
    if (!page) return;

    if (typeof threeCheckVisibility === 'function') {
      threeCheckVisibility();
    }

    if (targetId === 'weather') {
      animateWeatherStationSection();
    }

    if (window.KurdiaMotionPrimitives) {
      window.KurdiaMotionPrimitives.AnimatedSection(page);

      const items = page.querySelectorAll(
        [
          '.featured',
          '.trip-showcase-card',
          '.place-card',
          '.booking-hero-banner',
          '.booking-trip-pick-card',
          '.booking-form-card',
          '.private-page-hero',
          '.private-preset-card',
          '.private-trip-card',
          '.experience-card',
          '.public-review',
          '.review-write',
          '.about img',
          '.about .glass',
          '#contact .article',
          '.more-card',
          '#storyGrid .tile'
        ].join(', ')
      );
      window.KurdiaMotionPrimitives.StaggerReveal(items, {
        y: 18,
        duration: 0.52,
        stagger: 0.06
      });
      window.KurdiaMotionPrimitives.ImageReveal(page);
    }

    initSpotlightAnd3DTilt();
    initMagneticButtons();
    initKineticStatCounters();
  };

  window.kurdiaRefreshMotion = function () {
    initSpotlightAnd3DTilt();
    initMagneticButtons();
    initKineticStatCounters();
    const activePage = document.querySelector('.page.active');
    if (window.KurdiaMotionPrimitives) {
      window.KurdiaMotionPrimitives.AnimatedSection(activePage || document);
    }
    if (window.ScrollTrigger) {
      try {
        window.ScrollTrigger.refresh();
      } catch (_) {}
    }
  };

  /* ==========================================================================
     9B. DYNAMIC CMS & TRIP CONTENT MUTATION OBSERVER
     Automatically binds scroll reveals & light-follow to newly rendered cards
     ========================================================================== */
  function initDynamicContentObserver() {
    if (document.body.__kaDynamicObserverBound || !('MutationObserver' in window)) return;
    document.body.__kaDynamicObserverBound = true;

    let refreshTimer = null;
    const dynamicSelectors = [
      '#homeTripsList',
      '#homeDests',
      '#destList',
      '#tripList',
      '#reviewsList',
      '#homeReviewsPreview',
      '#aboutStatsPublic'
    ];

    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (typeof window.kurdiaRefreshMotion === 'function') {
          window.kurdiaRefreshMotion();
        }
      }, 60);
    };

    dynamicSelectors.forEach((sel) => {
      const container = document.querySelector(sel);
      if (!container || container.__kaContainerObserved) return;
      container.__kaContainerObserved = true;
      const mo = new MutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i++) {
          if (mutations[i].addedNodes && mutations[i].addedNodes.length > 0) {
            scheduleRefresh();
            break;
          }
        }
      });
      mo.observe(container, { childList: true });
    });
  }

  /* ==========================================================================
     10. VIEWPORT-GATED THREE.JS STARFIELD (Zero Continuous Background GPU Waste)
     Only renders when #home hero is visible on desktop; stops RAF otherwise.
     ========================================================================== */
  function initThreeAtmosphere() {
    const c = cfg();
    if (c.prefersReducedMotion() || c.isMobileViewport() || !window.THREE) return;
    if (document.getElementById('kurdiaThreeAmbientCanvas')) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.id = 'kurdiaThreeAmbientCanvas';
      canvas.style.cssText =
        'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:0;opacity:0.42;';
      document.body.prepend(canvas);

      const renderer = new window.THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'low-power'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(window.innerWidth, window.innerHeight);

      const scene = new window.THREE.Scene();
      const camera = new window.THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.z = 50;

      const count = 48;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 120;
        positions[i + 1] = (Math.random() - 0.5) * 80;
        positions[i + 2] = (Math.random() - 0.5) * 50;
      }

      const geo = new window.THREE.BufferGeometry();
      geo.setAttribute('position', new window.THREE.BufferAttribute(positions, 3));

      const mat = new window.THREE.PointsMaterial({
        color: 0xff6b86,
        size: 1.05,
        transparent: true,
        opacity: 0.48
      });

      const points = new window.THREE.Points(geo, mat);
      scene.add(points);

      function shouldRenderThree() {
        if (document.hidden || c.prefersReducedMotion()) return false;
        const homePage = document.getElementById('home');
        if (!homePage || !homePage.classList.contains('active')) return false;
        if ((window.scrollY || 0) > 740) return false;
        return true;
      }

      function animateThree() {
        if (!shouldRenderThree()) {
          threeRunning = false;
          threeRafId = null;
          return;
        }
        threeRunning = true;
        points.rotation.y += 0.00032;
        points.rotation.x += 0.00012;
        renderer.render(scene, camera);
        threeRafId = window.requestAnimationFrame(animateThree);
      }

      threeCheckVisibility = function () {
        const active = shouldRenderThree();
        canvas.style.visibility = active ? 'visible' : 'hidden';
        if (active && !threeRunning) {
          threeRunning = true;
          threeRafId = window.requestAnimationFrame(animateThree);
        } else if (!active && threeRunning && threeRafId) {
          window.cancelAnimationFrame(threeRafId);
          threeRunning = false;
          threeRafId = null;
        }
      };

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (threeCheckVisibility) threeCheckVisibility();
      };

      window.addEventListener('resize', onResize, { passive: true });
      window.addEventListener('scroll', threeCheckVisibility, { passive: true });
      c.onVisibilityChange(threeCheckVisibility);

      // Render one initial frame and start only if hero is in view
      renderer.render(scene, camera);
      threeCheckVisibility();

      c.registerCleanup(() => {
        if (threeRafId) window.cancelAnimationFrame(threeRafId);
        threeRunning = false;
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', threeCheckVisibility);
        geo.dispose();
        mat.dispose();
        renderer.dispose();
      });
    } catch (_) {}
  }

  /* ==========================================================================
     MASTER BOOTSTRAPPER
     ========================================================================== */
  function bootKurdiaMotionSystem() {
    initLivingAuroraBg();
    initBrandLogoEntrance();
    initCinematicHero();

    if (window.KurdiaMotionPrimitives) {
      window.KurdiaMotionPrimitives.ScrollProgress();
      window.KurdiaMotionPrimitives.ParallaxImage();
      const activePage = document.querySelector('.page.active');
      window.KurdiaMotionPrimitives.AnimatedSection(activePage || document);
    }

    initSpotlightAnd3DTilt();
    initMagneticButtons();
    initKineticStatCounters();
    initMicroInteractions();
    initDynamicContentObserver();
    initThreeAtmosphere();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootKurdiaMotionSystem, { once: true });
  } else {
    bootKurdiaMotionSystem();
  }
})(window, document);
