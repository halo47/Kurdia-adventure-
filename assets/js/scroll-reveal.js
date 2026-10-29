/**
 * ============================================================================
 * KURDIA ADVENTURE — REUSABLE SCROLL-REVEAL & PARALLAX PRIMITIVES
 * File: /assets/js/scroll-reveal.js
 * Purpose: Provides modular, reusable animation primitives:
 *          - Reveal
 *          - StaggerReveal
 *          - ImageReveal
 *          - ParallaxImage
 *          - ScrollProgress
 *          - AnimatedHeading
 *          - AnimatedSection
 *          Integrates GSAP + ScrollTrigger with an IntersectionObserver
 *          fallback, prevents duplicate initialization across SPA page
 *          transitions, and registers cleanup handlers.
 * ============================================================================
 */
(function (window, document) {
  'use strict';

  const cfg = () =>
    window.KURDIA_MOTION_CONFIG || {
      durations: { fast: 0.24, base: 0.42, medium: 0.58, slow: 0.78 },
      easings: { outQuart: 'power3.out', outExpo: 'expo.out' },
      stagger: { tight: 0.045, base: 0.075 },
      distances: { sm: 14, md: 20 },
      limits: { heroParallaxMaxPx: 34 },
      prefersReducedMotion: () => false,
      isMobileViewport: () => window.innerWidth < 768,
      isPageHidden: () => Boolean(document.hidden),
      registerCleanup: () => {}
    };

  let ioInstance = null;
  let parallaxBound = false;
  let progressBound = false;
  const scrollTriggerInstances = [];

  function registerTrigger(st) {
    if (st) scrollTriggerInstances.push(st);
  }

  function animateElementIn(el, duration, distance, delay) {
    if (!el || el.__kaRevealedDone) return;
    el.__kaRevealedDone = true;
    el.dataset.kaRevealed = '1';
    el.classList.remove('scroll-hidden', 'ka-reveal-armed');
    el.classList.add('scroll-visible', 'ka-revealed');

    const c = cfg();
    if (c.prefersReducedMotion() || !window.gsap) {
      el.style.opacity = '';
      el.style.transform = '';
      return;
    }

    try {
      window.gsap.killTweensOf(el);
      window.gsap.fromTo(
        el,
        {
          opacity: 0,
          y: distance || c.distances.md || 20,
          scale: 0.985
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: duration || c.durations.medium || 0.58,
          delay: delay || 0,
          ease: c.easings.outQuart || 'power3.out',
          overwrite: 'auto',
          clearProps: 'transform,opacity'
        }
      );
    } catch (_) {
      el.style.opacity = '';
      el.style.transform = '';
    }
  }

  function ensureIntersectionObserver() {
    if (ioInstance || !('IntersectionObserver' in window)) return ioInstance;
    ioInstance = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const c = cfg();
            animateElementIn(
              el,
              el.__kaRevealDuration || c.durations.medium,
              el.__kaRevealDistance || c.distances.md,
              el.__kaRevealDelay || 0
            );
            ioInstance.unobserve(el);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
    );

    cfg().registerCleanup(() => {
      if (ioInstance) {
        ioInstance.disconnect();
        ioInstance = null;
      }
    });

    return ioInstance;
  }

  /**
   * Primitive 1: Reveal (Single Element Scroll-Triggered Entrance)
   */
  function Reveal(element, options) {
    if (!element || element.__kaRevealBound || element.__kaRevealedDone) return;

    const c = cfg();
    if (c.prefersReducedMotion()) {
      element.__kaRevealBound = true;
      element.__kaRevealedDone = true;
      element.classList.remove('scroll-hidden', 'ka-reveal-armed');
      element.classList.add('scroll-visible', 'ka-revealed');
      return;
    }

    const rect = element.getBoundingClientRect();
    // If element is inside an inactive page tab (0x0 dimensions), wait until that page is activated
    if (rect.width === 0 && rect.height === 0) {
      element.classList.remove('scroll-hidden', 'ka-reveal-armed');
      element.classList.add('scroll-visible', 'ka-revealed');
      return;
    }

    element.__kaRevealBound = true;

    const opts = Object.assign(
      { distance: c.distances.md || 20, duration: c.durations.medium || 0.58, delay: 0 },
      options || {}
    );

    element.classList.add('kurdia-scroll-item');
    element.__kaRevealDuration = opts.duration;
    element.__kaRevealDistance = opts.distance;
    element.__kaRevealDelay = opts.delay;

    const inInitialViewport = rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
    if (inInitialViewport) {
      animateElementIn(element, opts.duration, opts.distance * 0.75, opts.delay);
      return;
    }

    // Arm below-the-fold element for progressive scroll reveal
    element.classList.add('scroll-hidden');

    if (window.gsap && window.ScrollTrigger && !element.__kaScrollTriggerBound) {
      element.__kaScrollTriggerBound = true;
      const st = window.ScrollTrigger.create({
        trigger: element,
        start: 'top 91%',
        once: true,
        onEnter: () => {
          animateElementIn(element, opts.duration, opts.distance, opts.delay);
        }
      });
      registerTrigger(st);
    }

    const obs = ensureIntersectionObserver();
    if (obs) {
      obs.observe(element);
    } else if (!window.ScrollTrigger) {
      animateElementIn(element, opts.duration, opts.distance, opts.delay);
    }

    // Fail-safe so content never stays hidden if layout changes without scroll
    setTimeout(() => {
      if (element.classList.contains('scroll-hidden')) {
        element.classList.remove('scroll-hidden', 'ka-reveal-armed');
        element.classList.add('scroll-visible', 'ka-revealed');
        element.style.opacity = '';
        element.style.transform = '';
      }
    }, 5500);
  }

  /**
   * Primitive 2: StaggerReveal (Group of Cards, Badges, or Grid Items)
   * Respects already-revealed items to prevent duplicate animation on page navigation.
   */
  function StaggerReveal(elements, options) {
    if (!elements) return;
    const opts = Object.assign(
      {
        y: cfg().distances.md || 20,
        duration: cfg().durations.medium || 0.56,
        stagger: cfg().stagger.base || 0.07,
        ease: cfg().easings.outQuart || 'power3.out',
        force: false
      },
      options || {}
    );

    const list = Array.from(elements).filter((el) => {
      if (!el) return false;
      if (!opts.force && el.__kaRevealedDone) return false;
      return true;
    });
    if (!list.length) return;

    const c = cfg();
    if (c.prefersReducedMotion() || !window.gsap) {
      list.forEach((el) => {
        el.__kaRevealBound = true;
        el.__kaRevealedDone = true;
        el.classList.remove('scroll-hidden', 'ka-reveal-armed');
        el.classList.add('scroll-visible', 'ka-revealed');
        el.style.opacity = '';
        el.style.transform = '';
      });
      return;
    }

    const visibleNow = [];
    const belowFold = [];

    list.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.top <= window.innerHeight * 0.92) {
        visibleNow.push(el);
      } else {
        belowFold.push(el);
      }
    });

    if (visibleNow.length) {
      try {
        window.gsap.killTweensOf(visibleNow);
        visibleNow.forEach((el) => {
          el.__kaRevealBound = true;
          el.__kaRevealedDone = true;
          el.dataset.kaRevealed = '1';
          el.classList.remove('scroll-hidden', 'ka-reveal-armed');
          el.classList.add('scroll-visible', 'ka-revealed');
        });
        window.gsap.fromTo(
          visibleNow,
          { opacity: 0, y: opts.y, scale: 0.985 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: opts.duration,
            stagger: opts.stagger,
            ease: opts.ease,
            overwrite: 'auto',
            clearProps: 'transform,opacity'
          }
        );
      } catch (_) {
        visibleNow.forEach((el) => {
          el.style.opacity = '';
          el.style.transform = '';
        });
      }
    }

    belowFold.forEach((el, idx) => {
      if (!el.__kaRevealBound) {
        Reveal(el, {
          distance: opts.y,
          duration: opts.duration,
          delay: Math.min(0.24, (idx % 4) * 0.06)
        });
      }
    });
  }

  /**
   * Primitive 3: ImageReveal (Smooth Scale & Clarity Entrance for Card Media)
   */
  function ImageReveal(containerRoot) {
    const c = cfg();
    if (c.prefersReducedMotion() || !window.gsap) return;
    const scope = containerRoot || document;
    const mediaEls = scope.querySelectorAll('.featureimg, .place-card-media, .btp-thumb, .about img');
    mediaEls.forEach((media) => {
      if (media.__kaImageRevealed) return;
      const r = media.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.top > window.innerHeight * 1.05) return;
      media.__kaImageRevealed = true;
      try {
        window.gsap.fromTo(
          media,
          { scale: 1.05, filter: 'brightness(0.88)' },
          {
            scale: 1,
            filter: 'brightness(1)',
            duration: c.durations.slow || 0.78,
            ease: c.easings.outExpo || 'expo.out',
            overwrite: 'auto',
            clearProps: 'transform,filter'
          }
        );
      } catch (_) {}
    });
  }

  /**
   * Primitive 4: ParallaxImage (Subtle Hero Background Parallax & Atmospheric Depth)
   */
  function ParallaxImage() {
    if (parallaxBound) return;
    const c = cfg();
    if (c.prefersReducedMotion()) return;
    parallaxBound = true;
    let ticking = false;

    function onScrollParallax() {
      if (ticking || c.isPageHidden()) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const sy = window.scrollY || 0;
        const hero = document.querySelector('#home.page.active .hero');
        if (hero && sy < 760) {
          const maxShift = c.limits.heroParallaxMaxPx || 34;
          const shift = Math.min(maxShift, sy * 0.09);
          hero.style.setProperty('--hero-parallax-y', `${shift.toFixed(1)}px`);
        }
        const bgOrbs = document.querySelectorAll('#kurdiaLivingBg .klbg-orb');
        if (bgOrbs.length >= 2 && sy < 1600) {
          bgOrbs[0].style.marginTop = (sy * -0.04).toFixed(1) + 'px';
          bgOrbs[1].style.marginTop = (sy * 0.032).toFixed(1) + 'px';
        }
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScrollParallax, { passive: true });
    onScrollParallax();

    c.registerCleanup(() => {
      window.removeEventListener('scroll', onScrollParallax);
      parallaxBound = false;
    });
  }

  /**
   * Primitive 5: ScrollProgress (Top Reading Progress & Sticky Header Glass State)
   */
  function ScrollProgress() {
    if (progressBound) return;
    progressBound = true;
    let scrollBar = document.querySelector('.kurdia-scroll-progress');
    if (!scrollBar) {
      scrollBar = document.createElement('div');
      scrollBar.className = 'kurdia-scroll-progress';
      document.body.appendChild(scrollBar);
    }

    function updateProgress() {
      if (cfg().isPageHidden()) return;
      const sy = window.scrollY || 0;
      const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const pct = Math.min(100, Math.max(0, (sy / total) * 100));
      if (scrollBar) scrollBar.style.width = pct.toFixed(2) + '%';

      const topNav = document.querySelector('.top');
      if (topNav) {
        topNav.classList.toggle('scrolled', sy > 24);
      }
    }

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

    cfg().registerCleanup(() => {
      window.removeEventListener('scroll', updateProgress);
      progressBound = false;
    });
  }

  /**
   * Primitive 6: AnimatedHeading (Section Eyebrow + Title + Subtitle Reveal)
   */
  function AnimatedHeading(sectionHeadEl) {
    if (!sectionHeadEl) return;
    Reveal(sectionHeadEl, { distance: 16, duration: 0.52 });
  }

  /**
   * Primitive 7: AnimatedSection (Binds Headings, Cards, Stories, Experiences & Media)
   */
  function AnimatedSection(rootScope) {
    const scope = rootScope || document;
    const headings = scope.querySelectorAll('.sectionhead');
    headings.forEach((h) => AnimatedHeading(h));

    const revealTargets = scope.querySelectorAll(
      [
        '.featured',
        '.trip-showcase-card',
        '.place-card',
        '#homeStories .story',
        '#storyGrid .tile',
        '.experiences .tile',
        '.experience-card',
        '.private-vip-showcase',
        '.private-page-hero',
        '.private-preset-card',
        '.private-trip-card',
        '.about img',
        '.about .glass',
        '#aboutStatsPublic .stat',
        '.booking-hero-banner',
        '.booking-trip-pick-card',
        '.booking-form-card',
        '.booking-subcard',
        '.weather-hero-card',
        '.weather-map-box',
        '.weather-metrics-grid .metric-box',
        '#hourlyTimeline .hourly-card',
        '#daysForecast .day-row-card',
        '.review-write',
        '.public-review',
        '#contact .article',
        '.more-card',
        '.footer'
      ].join(', ')
    );

    revealTargets.forEach((el, idx) => {
      Reveal(el, {
        delay: Math.min(0.22, (idx % 4) * 0.05)
      });
    });

    ImageReveal(scope);
  }

  // Register cleanup for all ScrollTrigger instances created by this module
  cfg().registerCleanup(() => {
    while (scrollTriggerInstances.length) {
      const st = scrollTriggerInstances.pop();
      try {
        st.kill();
      } catch (_) {}
    }
  });

  // Expose Reusable Primitives Globally
  window.KurdiaMotionPrimitives = {
    Reveal,
    StaggerReveal,
    ImageReveal,
    ParallaxImage,
    ScrollProgress,
    AnimatedHeading,
    AnimatedSection
  };

  // Backwards-compatible global helper used by index.html
  window.kurdiaBindScrollReveals = function (rootEl) {
    AnimatedSection(rootEl || document);
  };
})(window, document);
