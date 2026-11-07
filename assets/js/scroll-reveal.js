/**
 * ============================================================================
 * KURDIA ADVENTURE — REUSABLE SCROLL-REVEAL & PARALLAX PRIMITIVES (60FPS GPU)
 * File: /assets/js/scroll-reveal.js
 * Purpose: Lightweight, 60fps GPU-composited animation primitives:
 *          - Reveal (IntersectionObserver + GSAP transform/opacity only)
 *          - StaggerReveal
 *          - ImageReveal (GPU scale + opacity, zero CSS filter thrashing)
 *          - ParallaxImage (Desktop-only rAF transform, zero layout reflow)
 *          - ScrollProgress (rAF-throttled GPU scaleX, zero width layout)
 *          - AnimatedHeading
 *          - AnimatedSection
 * ============================================================================
 */
(function (window, document) {
  'use strict';

  const cfg = () =>
    window.KURDIA_MOTION_CONFIG || {
      durations: { fast: 0.22, base: 0.38, medium: 0.48, slow: 0.64 },
      easings: { outQuart: 'power3.out', outExpo: 'expo.out' },
      stagger: { tight: 0.04, base: 0.065 },
      distances: { sm: 12, md: 16 },
      limits: { heroParallaxMaxPx: 26 },
      prefersReducedMotion: () => false,
      isMobileViewport: () => window.innerWidth < 768,
      isPageHidden: () => Boolean(document.hidden),
      registerCleanup: () => {}
    };

  let ioInstance = null;
  let parallaxBound = false;
  let progressBound = false;

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
      el.style.willChange = 'auto';
      return;
    }

    try {
      window.gsap.killTweensOf(el);
      window.gsap.fromTo(
        el,
        {
          opacity: 0,
          y: distance || c.distances.md || 16
        },
        {
          opacity: 1,
          y: 0,
          duration: duration || c.durations.medium || 0.46,
          delay: delay || 0,
          ease: c.easings.outQuart || 'power3.out',
          force3D: true,
          overwrite: 'auto',
          clearProps: 'transform,opacity,willChange'
        }
      );
    } catch (_) {
      el.style.opacity = '';
      el.style.transform = '';
      el.style.willChange = 'auto';
    }
  }

  function ensureIntersectionObserver() {
    if (ioInstance || !('IntersectionObserver' in window)) return ioInstance;
    ioInstance = new IntersectionObserver(
      (entries) => {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          if (entry.isIntersecting) {
            const el = entry.target;
            const c = cfg();
            animateElementIn(
              el,
              el.__kaRevealDuration || c.durations.medium || 0.46,
              el.__kaRevealDistance || c.distances.md || 16,
              el.__kaRevealDelay || 0
            );
            ioInstance.unobserve(el);
          }
        }
      },
      { threshold: 0.06, rootMargin: '0px 0px 36px 0px' }
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
   * Uses a single shared IntersectionObserver for zero scroll-event overhead.
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

    const page = element.closest('.page');
    if (page && !page.classList.contains('active')) {
      element.classList.remove('scroll-hidden', 'ka-reveal-armed');
      element.classList.add('scroll-visible', 'ka-revealed');
      return;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      element.classList.remove('scroll-hidden', 'ka-reveal-armed');
      element.classList.add('scroll-visible', 'ka-revealed');
      return;
    }

    element.__kaRevealBound = true;

    const opts = Object.assign(
      { distance: c.distances.md || 16, duration: c.durations.medium || 0.46, delay: 0 },
      options || {}
    );

    element.classList.add('kurdia-scroll-item');
    element.__kaRevealDuration = opts.duration;
    element.__kaRevealDistance = opts.distance;
    element.__kaRevealDelay = opts.delay;

    const inInitialViewport = rect.top < window.innerHeight * 0.94 && rect.bottom > 0;
    if (inInitialViewport) {
      animateElementIn(element, opts.duration, opts.distance * 0.7, opts.delay);
      return;
    }

    element.classList.add('scroll-hidden');

    const obs = ensureIntersectionObserver();
    if (obs) {
      obs.observe(element);
    } else {
      animateElementIn(element, opts.duration, opts.distance, opts.delay);
    }

    // Fail-safe so content never stays hidden if layout shifts without scroll
    setTimeout(() => {
      if (element.classList.contains('scroll-hidden')) {
        element.classList.remove('scroll-hidden', 'ka-reveal-armed');
        element.classList.add('scroll-visible', 'ka-revealed');
        element.style.opacity = '';
        element.style.transform = '';
      }
    }, 3500);
  }

  /**
   * Primitive 2: StaggerReveal (Group of Cards, Badges, or Grid Items)
   */
  function StaggerReveal(elements, options) {
    if (!elements) return;
    const opts = Object.assign(
      {
        y: cfg().distances.md || 16,
        duration: cfg().durations.medium || 0.46,
        stagger: cfg().stagger.base || 0.06,
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
      if (r.top <= window.innerHeight * 0.94) {
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
          { opacity: 0, y: opts.y },
          {
            opacity: 1,
            y: 0,
            duration: opts.duration,
            stagger: opts.stagger,
            ease: opts.ease,
            force3D: true,
            overwrite: 'auto',
            clearProps: 'transform,opacity,willChange'
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
          delay: Math.min(0.18, (idx % 3) * 0.05)
        });
      }
    });
  }

  /**
   * Primitive 3: ImageReveal (GPU-Composited Scale Entrance — Zero Filter Repaints)
   */
  function ImageReveal(containerRoot) {
    const c = cfg();
    if (c.prefersReducedMotion() || c.isMobileViewport() || !window.gsap) return;
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
          { scale: 1.03 },
          {
            scale: 1,
            duration: 0.56,
            ease: c.easings.outQuart || 'power3.out',
            force3D: true,
            overwrite: 'auto',
            clearProps: 'transform'
          }
        );
      } catch (_) {}
    });
  }

  /**
   * Primitive 4: ParallaxImage (Desktop-Only GPU Transform — Skipped on Mobile for Native Momentum Scroll)
   */
  function ParallaxImage() {
    if (parallaxBound) return;
    const c = cfg();
    if (c.prefersReducedMotion() || c.isMobileViewport()) return;
    parallaxBound = true;
    let ticking = false;

    function onScrollParallax() {
      if (ticking || c.isPageHidden() || c.isMobileViewport()) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const sy = window.scrollY || 0;
        if (sy < 680) {
          const hero = document.querySelector('#home.page.active .hero');
          if (hero) {
            const maxShift = c.limits.heroParallaxMaxPx || 24;
            const shift = Math.min(maxShift, sy * 0.07);
            hero.style.setProperty('--hero-parallax-y', `${shift.toFixed(1)}px`);
          }
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
   * Primitive 5: ScrollProgress (rAF-Throttled GPU scaleX & Cached Header Class Toggle)
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

    let ticking = false;
    let lastScrolledState = null;

    function updateProgress() {
      if (ticking || cfg().isPageHidden()) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const sy = window.scrollY || 0;
        const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const ratio = Math.min(1, Math.max(0, sy / total));
        if (scrollBar) {
          scrollBar.style.transform = `scaleX(${ratio.toFixed(4)})`;
        }

        const isScrolled = sy > 24;
        if (isScrolled !== lastScrolledState) {
          lastScrolledState = isScrolled;
          const topNav = document.querySelector('.top');
          if (topNav) {
            topNav.classList.toggle('scrolled', isScrolled);
          }
        }
        ticking = false;
      });
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
    Reveal(sectionHeadEl, { distance: 14, duration: 0.42 });
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
        delay: Math.min(0.16, (idx % 3) * 0.045)
      });
    });

    ImageReveal(scope);
  }

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
