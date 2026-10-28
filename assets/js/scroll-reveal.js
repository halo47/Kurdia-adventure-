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
 *          fallback and registers cleanup handlers with KURDIA_MOTION_CONFIG.
 * ============================================================================
 */
(function (window, document) {
  'use strict';

  const cfg = () =>
    window.KURDIA_MOTION_CONFIG || {
      durations: { fast: 0.24, base: 0.42, medium: 0.62, slow: 0.85 },
      easings: { outQuart: 'power3.out', outExpo: 'expo.out' },
      stagger: { tight: 0.045, base: 0.075 },
      distances: { sm: 16, md: 26 },
      limits: { heroParallaxMaxPx: 36 },
      prefersReducedMotion: () => false,
      isMobileViewport: () => window.innerWidth < 768,
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
          y: distance || c.distances.md || 24,
          scale: 0.975
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: duration || c.durations.medium || 0.62,
          delay: delay || 0,
          ease: c.easings.outQuart || 'power3.out',
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
      { threshold: 0.08, rootMargin: '0px 0px -28px 0px' }
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
    if (!element || element.__kaRevealBound) return;
    element.__kaRevealBound = true;

    const c = cfg();
    if (c.prefersReducedMotion()) {
      element.classList.remove('scroll-hidden', 'ka-reveal-armed');
      element.classList.add('scroll-visible', 'ka-revealed');
      return;
    }

    const opts = Object.assign(
      { distance: c.distances.md || 24, duration: c.durations.medium || 0.62, delay: 0 },
      options || {}
    );

    const rect = element.getBoundingClientRect();
    // If element is inside an inactive page tab (0x0 dimensions), leave it clean until that page activates
    if (rect.width === 0 && rect.height === 0) {
      element.__kaRevealBound = false;
      element.classList.remove('scroll-hidden', 'ka-reveal-armed');
      element.classList.add('scroll-visible', 'ka-revealed');
      return;
    }

    element.classList.add('kurdia-scroll-item');
    element.__kaRevealDuration = opts.duration;
    element.__kaRevealDistance = opts.distance;
    element.__kaRevealDelay = opts.delay;

    const inInitialViewport = rect.top < window.innerHeight * 0.88 && rect.bottom > 0;
    if (inInitialViewport) {
      // Animate visible above-the-fold cards smoothly right away
      animateElementIn(element, opts.duration, opts.distance * 0.75, opts.delay);
      return;
    }

    // Arm below-the-fold element for scroll-triggered entrance
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

    // Always bind IntersectionObserver as a reliable co-trigger
    const obs = ensureIntersectionObserver();
    if (obs) {
      obs.observe(element);
    } else if (!window.ScrollTrigger) {
      animateElementIn(element, opts.duration, opts.distance, opts.delay);
    }

    // Fail-safe: ensure no content remains permanently hidden if layout shifts prevent trigger
    setTimeout(() => {
      if (element.classList.contains('scroll-hidden')) {
        element.classList.remove('scroll-hidden', 'ka-reveal-armed');
        element.classList.add('scroll-visible', 'ka-revealed');
        element.style.opacity = '';
        element.style.transform = '';
      }
    }, 6500);
  }

  /**
   * Primitive 2: StaggerReveal (Group of Cards, Badges, or Grid Items)
   */
  function StaggerReveal(elements, options) {
    if (!elements) return;
    const list = Array.from(elements).filter(Boolean);
    if (!list.length) return;

    const c = cfg();
    if (c.prefersReducedMotion() || !window.gsap) {
      list.forEach((el) => {
        el.classList.remove('scroll-hidden', 'ka-reveal-armed');
        el.classList.add('scroll-visible', 'ka-revealed');
        el.style.opacity = '';
        el.style.transform = '';
      });
      return;
    }

    const opts = Object.assign(
      {
        y: c.distances.md || 22,
        duration: c.durations.medium || 0.56,
        stagger: c.stagger.base || 0.075,
        ease: c.easings.outQuart || 'power3.out'
      },
      options || {}
    );

    // Separate items currently visible in viewport from items further down the page
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
          el.__kaRevealedDone = true;
          el.classList.remove('scroll-hidden', 'ka-reveal-armed');
          el.classList.add('scroll-visible', 'ka-revealed');
        });
        window.gsap.fromTo(
          visibleNow,
          { opacity: 0, y: opts.y, scale: 0.975 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: opts.duration,
            stagger: opts.stagger,
            ease: opts.ease,
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
      el.__kaRevealBound = false;
      el.__kaRevealedDone = false;
      Reveal(el, {
        distance: opts.y,
        duration: opts.duration,
        delay: Math.min(0.28, (idx % 4) * 0.065)
      });
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
      media.__kaImageRevealed = true;
      try {
        window.gsap.fromTo(
          media,
          { scale: 1.07, filter: 'brightness(0.84)' },
          {
            scale: 1,
            filter: 'brightness(1)',
            duration: c.durations.slow || 0.88,
            ease: c.easings.outExpo || 'expo.out',
            clearProps: 'transform,filter'
          }
        );
      } catch (_) {}
    });
  }

  /**
   * Primitive 4: ParallaxImage (Restrained Atmospheric Depth on Scroll)
   */
  function ParallaxImage() {
    if (parallaxBound) return;
    const c = cfg();
    if (c.prefersReducedMotion()) return;
    parallaxBound = true;
    let ticking = false;

    function onScrollParallax() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const sy = window.scrollY || 0;
        const hero = document.querySelector('#home.page.active .hero');
        if (hero && sy < 720) {
          const shift = Math.min(c.limits.heroParallaxMaxPx || 36, sy * 0.085);
          hero.style.setProperty('--hero-parallax-y', `${shift.toFixed(1)}px`);
        }
        const bgOrbs = document.querySelectorAll('#kurdiaLivingBg .klbg-orb');
        if (bgOrbs.length >= 2) {
          bgOrbs[0].style.marginTop = (sy * -0.05).toFixed(1) + 'px';
          bgOrbs[1].style.marginTop = (sy * 0.04).toFixed(1) + 'px';
        }
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScrollParallax, { passive: true });
    c.registerCleanup(() => {
      window.removeEventListener('scroll', onScrollParallax);
      parallaxBound = false;
    });
  }

  /**
   * Primitive 5: ScrollProgress (Top Reading Progress & Sticky Header State)
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
    Reveal(sectionHeadEl, { distance: 20, duration: 0.56 });
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
        '.footer'
      ].join(', ')
    );

    revealTargets.forEach((el, idx) => {
      Reveal(el, {
        delay: Math.min(0.24, (idx % 4) * 0.055)
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
