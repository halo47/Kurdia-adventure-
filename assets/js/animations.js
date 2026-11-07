/**
 * ============================================================================
 * KURDIA ADVENTURE — MASTER CINEMATIC MOTION & INTERACTION ORCHESTRATOR (60FPS)
 * File: /assets/js/animations.js
 * Purpose: Coordinates smooth, lightweight GPU-accelerated animations:
 *          1. Living Aurora Background Mesh (Desktop-only, zero mobile GPU drag)
 *          2. Header Brand Logo Entrance
 *          3. Cinematic Hero Choreography (Pure GPU transform/opacity)
 *          4. Trip Cards Subtle GSAP Entrance (Slide in from bottom)
 *          5. Desktop Card Radial Spotlight & Restrained 3D Tilt (Touch-Safe)
 *          6. Desktop Magnetic Primary CTA Pull (Touch-Safe)
 *          7. Kinetic Stat Counters (20K+, 200+, 4.9)
 *          8. Micro-Interactions (Tactile Press, Modal/Sheet/Wizard Transitions)
 *          9. Weather Station Section Choreography
 *          10. Dynamic CMS / Trip Card MutationObserver & Page Navigation Hooks
 * ============================================================================
 */
(function (window, document) {
  'use strict';

  const cfg = () =>
    window.KURDIA_MOTION_CONFIG || {
      durations: { fast: 0.22, base: 0.38, medium: 0.48, slow: 0.64, cinematic: 0.85 },
      easings: { outQuart: 'power3.out', outExpo: 'expo.out', gentleSpring: 'power3.out' },
      stagger: { tight: 0.04, base: 0.065, relaxed: 0.09 },
      distances: { sm: 12, md: 16, lg: 22 },
      limits: { heroParallaxMaxPx: 26, cardTiltMaxDeg: 2.8, cardTiltPerspectivePx: 980 },
      prefersReducedMotion: () => false,
      isTouchDevice: () => true,
      isMobileViewport: () => window.innerWidth < 768,
      isPageHidden: () => Boolean(document.hidden),
      onVisibilityChange: () => {},
      registerCleanup: () => {}
    };

  let heroEntranceTimeline = null;

  /* ==========================================================================
     1. LIVING AURORA BACKGROUND MESH (Desktop Only — Zero Mobile Overdraw)
     ========================================================================== */
  function initLivingAuroraBg() {
    const c = cfg();
    if (c.isMobileViewport() || c.prefersReducedMotion()) return;
    if (document.getElementById('kurdiaLivingBg')) return;
    const bg = document.createElement('div');
    bg.id = 'kurdiaLivingBg';
    bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML = [
      '<div class="klbg-orb orb-1"></div>',
      '<div class="klbg-orb orb-2"></div>'
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
      const tl = window.gsap.timeline({ defaults: { ease: c.easings.outQuart || 'power3.out' } });
      if (logoImg) {
        tl.fromTo(
          logoImg,
          { opacity: 0, scale: 0.88 },
          { opacity: 1, scale: 1, duration: 0.5, force3D: true, clearProps: 'transform,opacity' }
        );
      }
      if (textWrap) {
        tl.fromTo(
          textWrap,
          { opacity: 0, x: 8 },
          { opacity: 1, x: 0, duration: 0.44, force3D: true, clearProps: 'transform,opacity' },
          '-=0.36'
        );
      }
    } catch (_) {}
  }

  /* ==========================================================================
     3. CINEMATIC HERO CHOREOGRAPHY (Smooth, GPU-Only GSAP Staggered Entrance)
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
      cue.style.border = '1px solid rgba(255,255,255,0.14)';
      cue.onclick = function () {
        const up = document.getElementById('upcomingTripsSection');
        if (up) up.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      cue.innerHTML =
        '<span class="ka-hero-scroll-dot"></span>' +
        '<span>خوارەوە ببینە · گەشتەکانی داهاتوو</span>';
      container.appendChild(cue);
    }

    if (hero.__kaHeroAnimated && !opts.force) return;
    hero.__kaHeroAnimated = true;

    const logoCapsule = container.querySelector('.ios26-hero-logo-capsule');
    const eyebrow = container.querySelector('.eyebrow');
    const title = container.querySelector('#heroTitle, h1');
    const text = container.querySelector('#heroText, p');
    const btns = Array.from(container.querySelectorAll('.actions .btn'));
    const cue = container.querySelector('.ka-hero-scroll-cue');
    const allTargets = [logoCapsule, eyebrow, title, text, ...btns, cue].filter(Boolean);

    const c = cfg();
    if (c.prefersReducedMotion() || !window.gsap) {
      allTargets.forEach((el) => {
        el.style.opacity = '';
        el.style.visibility = '';
        el.style.transform = '';
      });
      return;
    }

    const introEl = document.getElementById('kurdia-intro');
    const hasActiveIntro =
      !opts.force &&
      Boolean(introEl && !introEl.classList.contains('intro-out') && introEl.offsetParent !== null);
    const baseDelay = opts.delay !== undefined ? opts.delay : hasActiveIntro ? 0.24 : 0.04;

    try {
      if (heroEntranceTimeline) {
        heroEntranceTimeline.kill();
      }
      window.gsap.killTweensOf(allTargets);

      const tl = window.gsap.timeline({
        delay: baseDelay,
        defaults: {
          ease: c.easings.outQuart || 'power3.out',
          force3D: true,
          overwrite: 'auto'
        }
      });
      heroEntranceTimeline = tl;

      // 1. Staggered GPU-only reveal for Hero Brand Capsule & Titles
      const titleGroup = [logoCapsule, eyebrow, title, text].filter(Boolean);
      if (titleGroup.length) {
        tl.fromTo(
          titleGroup,
          {
            autoAlpha: 0,
            y: 18
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.62,
            stagger: 0.08,
            clearProps: 'transform,opacity,visibility,willChange'
          },
          0
        );
      }

      // 2. Smooth staggered entrance for Hero Action Buttons
      if (btns.length) {
        tl.fromTo(
          btns,
          {
            autoAlpha: 0,
            y: 14,
            scale: 0.97
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.5,
            stagger: 0.07,
            clearProps: 'transform,opacity,visibility,willChange'
          },
          titleGroup.length ? '-=0.38' : 0.1
        );
      }

      // 3. Scroll Cue pill entrance
      if (cue) {
        tl.fromTo(
          cue,
          { autoAlpha: 0, y: 10 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.44,
            clearProps: 'transform,opacity,visibility,willChange'
          },
          '-=0.3'
        );
      }
    } catch (_) {
      allTargets.forEach((el) => {
        el.style.opacity = '';
        el.style.visibility = '';
        el.style.transform = '';
      });
    }
  }

  window.playHeroEntranceAnimation = initCinematicHero;

  /* ==========================================================================
     4. TRIP CARDS SUBTLE GSAP ENTRANCE ANIMATION (Slide in from bottom on load)
     ========================================================================== */
  function animateTripCardsEntrance(options) {
    const opts = options || {};
    const c = cfg();
    const cards = Array.from(
      document.querySelectorAll('#homeTripsList .trip-showcase-card, #tripList .booking-trip-pick-card')
    ).filter((card) => {
      if (!card) return false;
      const page = card.closest('.page');
      if (page && !page.classList.contains('active')) return false;
      if (!opts.force && card.__kaTripEntranceAnimated) return false;
      return true;
    });

    if (!cards.length) return;

    cards.forEach((card) => {
      card.__kaTripEntranceAnimated = true;
      card.__kaRevealBound = true;
      card.__kaRevealedDone = true;
      card.dataset.kaRevealed = '1';
      card.classList.remove('scroll-hidden', 'ka-reveal-armed');
      card.classList.add('scroll-visible', 'ka-revealed');
    });

    if (c.prefersReducedMotion() || !window.gsap) {
      cards.forEach((card) => {
        card.style.opacity = '';
        card.style.transform = '';
      });
      return;
    }

    try {
      window.gsap.killTweensOf(cards);
      window.gsap.fromTo(
        cards,
        {
          opacity: 0,
          y: 22
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.54,
          stagger: 0.08,
          delay: opts.delay !== undefined ? opts.delay : 0.05,
          ease: c.easings.outQuart || 'power3.out',
          force3D: true,
          overwrite: 'auto',
          clearProps: 'transform,opacity,willChange'
        }
      );
    } catch (_) {
      cards.forEach((card) => {
        card.style.opacity = '';
        card.style.transform = '';
      });
    }
  }

  window.animateTripCardsEntrance = animateTripCardsEntrance;

  /* ==========================================================================
     5. DESKTOP CARD RADIAL SPOTLIGHT & RESTRAINED 3D TILT (Strictly Mouse-Only)
     ========================================================================== */
  function initSpotlightAnd3DTilt() {
    const c = cfg();
    if (c.isTouchDevice() || c.isMobileViewport() || c.prefersReducedMotion()) return;

    const cardSelector = [
      '.featured',
      '.trip-showcase-card',
      '.place-card',
      '.booking-trip-pick-card',
      '.private-vip-showcase',
      '.private-preset-card',
      '.private-trip-card',
      '.weather-hero-card',
      '.public-review'
    ].join(', ');

    const cards = document.querySelectorAll(cardSelector);
    cards.forEach((card) => {
      if (card.__kaSpotlightBound) return;
      card.__kaSpotlightBound = true;

      let rafPending = false;
      const onCardMove = (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (rafPending || c.isTouchDevice() || c.prefersReducedMotion() || c.isPageHidden()) return;
        rafPending = true;
        const clientX = e.clientX;
        const clientY = e.clientY;
        window.requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          if (rect.width && rect.height) {
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x.toFixed(0)}px`);
            card.style.setProperty('--mouse-y', `${y.toFixed(0)}px`);
          }
          rafPending = false;
        });
      };

      card.addEventListener('pointermove', onCardMove, { passive: true });
    });
  }

  /* ==========================================================================
     6. DESKTOP MAGNETIC PRIMARY CTA PULL (Strictly Mouse-Only)
     ========================================================================== */
  function initMagneticButtons() {
    const c = cfg();
    if (c.isTouchDevice() || c.isMobileViewport() || c.prefersReducedMotion()) return;

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
        const dx = Math.max(-4, Math.min(4, (e.clientX - (r.left + r.width / 2)) * 0.12));
        const dy = Math.max(-3, Math.min(3, (e.clientY - (r.top + r.height / 2)) * 0.12));
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
     7. KINETIC STAT COUNTERS (About Page Stats: 20.1K+, 200+, 4.9)
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
          duration: 1.0,
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
     8. MICRO-INTERACTIONS (Tactile Press, Modal/Sheet/Wizard Transitions)
     ========================================================================== */
  function initMicroInteractions() {
    if (document.body.__kaMicroBound) return;
    document.body.__kaMicroBound = true;

    const c = cfg();

    // 8A. Tactile Press Feedback
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

    // 8B. Modal & Sheet Entrance Choreography
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
            { opacity: 0, y: 18, scale: 0.98 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.3,
              ease: c.easings.outQuart || 'power3.out',
              force3D: true,
              clearProps: 'transform,opacity'
            }
          );
        }
      });
      mo.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });

    // 8C. Booking & Private Wizard Step Panel Entrance
    const wizardSteps = document.querySelectorAll('.booking-step-panel, .private-wizard-panel');
    wizardSteps.forEach((panel) => {
      if (panel.__kaWizardObserved) return;
      panel.__kaWizardObserved = true;
      const mo = new MutationObserver(() => {
        if (!panel.hidden && window.gsap && !c.prefersReducedMotion()) {
          window.gsap.killTweensOf(panel);
          window.gsap.fromTo(
            panel,
            { opacity: 0, y: 10 },
            {
              opacity: 1,
              y: 0,
              duration: 0.28,
              ease: 'power3.out',
              force3D: true,
              clearProps: 'transform,opacity'
            }
          );
        }
      });
      mo.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  /* ==========================================================================
     9. WEATHER STATION SECTION CHOREOGRAPHY
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
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.32,
          stagger: 0.025,
          ease: 'power3.out',
          force3D: true,
          clearProps: 'transform,opacity'
        }
      );
    }

    if (heroCard && !heroCard.__kaWeatherHeroAnimated) {
      heroCard.__kaWeatherHeroAnimated = true;
      window.gsap.fromTo(
        heroCard,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.44,
          ease: 'power3.out',
          force3D: true,
          clearProps: 'transform,opacity'
        }
      );
    }

    if (metrics.length && !weatherPage.__kaMetricsAnimated) {
      weatherPage.__kaMetricsAnimated = true;
      window.gsap.fromTo(
        metrics,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.36,
          stagger: 0.03,
          ease: 'power3.out',
          force3D: true,
          clearProps: 'transform,opacity'
        }
      );
    }

    if (hourly.length && !weatherPage.__kaHourlyAnimated) {
      weatherPage.__kaHourlyAnimated = true;
      window.gsap.fromTo(
        Array.from(hourly).slice(0, 8),
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.32,
          stagger: 0.02,
          ease: 'power3.out',
          force3D: true,
          clearProps: 'transform,opacity'
        }
      );
    }

    if (days.length && !weatherPage.__kaDaysAnimated) {
      weatherPage.__kaDaysAnimated = true;
      window.gsap.fromTo(
        days,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.34,
          stagger: 0.03,
          ease: 'power3.out',
          force3D: true,
          clearProps: 'transform,opacity'
        }
      );
    }
  }

  /* ==========================================================================
     10. PAGE NAVIGATION & DYNAMIC CONTENT REFRESH HOOKS (Duplicate-Safe)
     ========================================================================== */
  window.kurdiaAnimatePageCards = function (pageId) {
    const activePage = document.querySelector('.page.active');
    const targetId = pageId || (activePage ? activePage.id : 'home');
    const page = document.getElementById(targetId);
    if (!page) return;

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
        y: 16,
        duration: 0.44,
        stagger: 0.05
      });
      window.KurdiaMotionPrimitives.ImageReveal(page);
    }

    animateTripCardsEntrance();
    initSpotlightAnd3DTilt();
    initMagneticButtons();
    initKineticStatCounters();
  };

  window.kurdiaRefreshMotion = function () {
    animateTripCardsEntrance();
    initSpotlightAnd3DTilt();
    initMagneticButtons();
    initKineticStatCounters();
    const activePage = document.querySelector('.page.active');
    if (window.KurdiaMotionPrimitives) {
      window.KurdiaMotionPrimitives.AnimatedSection(activePage || document);
    }
  };

  /* ==========================================================================
     10B. DYNAMIC CMS & TRIP CONTENT MUTATION OBSERVER
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
      }, 80);
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
     MASTER BOOTSTRAPPER
     ========================================================================== */
  function bootKurdiaMotionSystem() {
    initLivingAuroraBg();
    initBrandLogoEntrance();
    initCinematicHero();
    animateTripCardsEntrance({ delay: 0.1 });

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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootKurdiaMotionSystem, { once: true });
  } else {
    bootKurdiaMotionSystem();
  }
})(window, document);
