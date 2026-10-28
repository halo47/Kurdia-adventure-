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
      durations: { fast: 0.24, base: 0.42, medium: 0.58, slow: 0.78 },
      easings: { outQuart: 'power3.out', outExpo: 'expo.out' },
      stagger: { tight: 0.045, base: 0.075 },
      distances: { sm: 14, md: 22 },
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

  function ensureIntersectionObserver() {
    if (ioInstance || !('IntersectionObserver' in window)) return ioInstance;
    ioInstance = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            el.classList.remove('scroll-hidden', 'ka-reveal-armed');
            el.classList.add('scroll-visible', 'ka-revealed');
            if (window.gsap && el.__kaNeedGsapReveal) {
              el.__kaNeedGsapReveal = false;
              const c = cfg();
              window.gsap.fromTo(
                el,
                { opacity: 0, y: c.distances.sm },
                {
                  opacity: 1,
                  y: 0,
                  duration: c.durations.base,
                  ease: c.easings.outQuart,
                  clearProps: 'transform,opacity'
                }
              );
            }
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
    if (!element) return;
    const c = cfg();
    if (c.prefersReducedMotion()) {
      element.classList.remove('scroll-hidden', 'ka-reveal-armed');
      element.classList.add('scroll-visible', 'ka-revealed');
      return;
    }

    const opts = Object.assign(
      { distance: c.distances.md, duration: c.durations.medium, delay: 0 },
      options || {}
    );

    const rect = element.getBoundingClientRect();
    // If element has zero dimensions (e.g. inside an inactive tab), keep it visible until tab activates
    if (rect.width === 0 && rect.height === 0) {
      element.classList.remove('scroll-hidden', 'ka-reveal-armed');
      element.classList.add('scroll-visible', 'ka-revealed');
      return;
    }

    const alreadyInViewport = rect.top <= window.innerHeight * 0.92;
    if (alreadyInViewport) {
      element.classList.remove('scroll-hidden', 'ka-reveal-armed');
      element.classList.add('scroll-visible', 'ka-revealed');
      return;
    }

    // Use GSAP ScrollTrigger when available, with IntersectionObserver backup
    if (window.gsap && window.ScrollTrigger && !element.__kaScrollTriggerBound) {
      element.__kaScrollTriggerBound = true;
      element.classList.add('kurdia-scroll-item', 'scroll-hidden');
      const st = window.ScrollTrigger.create({
        trigger: element,
        start: 'top 92%',
        once: true,
        onEnter: () => {
          element.classList.remove('scroll-hidden', 'ka-reveal-armed');
          element.classList.add('scroll-visible', 'ka-revealed');
          window.gsap.fromTo(
            element,
            { opacity: 0, y: c.distances.sm },
            {
              opacity: 1,
              y: 0,
              duration: opts.duration,
              ease: c.easings.outQuart,
              clearProps: 'transform,opacity'
            }
          );
        }
      });
      registerTrigger(st);
    } else {
      const obs = ensureIntersectionObserver();
      if (obs) {
        element.classList.add('kurdia-scroll-item', 'scroll-hidden');
        element.__kaNeedGsapReveal = Boolean(window.gsap);
        obs.observe(element);
      } else {
        element.classList.add('scroll-visible', 'ka-revealed');
      }
    }

    // Fail-safe timer so no element ever stays invisible if scroll events don't fire
    setTimeout(() => {
      if (element.classList.contains('scroll-hidden')) {
        element.classList.remove('scroll-hidden', 'ka-reveal-armed');
        element.classList.add('scroll-visible', 'ka-revealed');
      }
    }, 3200 + (opts.delay || 0) * 1000);
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
        y: c.distances.sm,
        duration: c.durations.base,
        stagger: c.stagger.tight,
        ease: c.easings.outQuart
      },
      options || {}
    );

    try {
      window.gsap.killTweensOf(list);
      window.gsap.fromTo(
        list,
        { opacity: 0, y: opts.y },
        {
          opacity: 1,
          y: 0,
          duration: opts.duration,
          stagger: opts.stagger,
          ease: opts.ease,
          clearProps: 'transform,opacity',
          onComplete() {
            list.forEach((el) => {
              el.classList.remove('scroll-hidden', 'ka-reveal-armed');
              el.classList.add('scroll-visible', 'ka-revealed');
            });
          }
        }
      );
    } catch (_) {
      list.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    }
  }

  /**
   * Primitive 3: ImageReveal (Smooth Scale & Clarity Entrance for Card Media)
   */
  function ImageReveal(containerRoot) {
    const c = cfg();
    if (c.prefersReducedMotion() || !window.gsap) return;
    const scope = containerRoot || document;
    const mediaEls = scope.querySelectorAll('.featureimg, .place-card-media, .btp-thumb');
    mediaEls.forEach((media) => {
      if (media.__kaImageRevealed) return;
      media.__kaImageRevealed = true;
      try {
        window.gsap.fromTo(
          media,
          { scale: 1.04 },
          {
            scale: 1,
            duration: c.durations.slow,
            ease: c.easings.outExpo,
            clearProps: 'transform'
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
        if (hero && sy < 650) {
          const shift = Math.min(c.limits.heroParallaxMaxPx, sy * 0.08);
          hero.style.backgroundPositionY = `calc(50% + ${shift.toFixed(1)}px)`;
        }
        const bgOrbs = document.querySelectorAll('#kurdiaLivingBg .klbg-orb');
        if (bgOrbs.length >= 2) {
          bgOrbs[0].style.marginTop = (sy * -0.045).toFixed(1) + 'px';
          bgOrbs[1].style.marginTop = (sy * 0.035).toFixed(1) + 'px';
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
        topNav.classList.toggle('scrolled', sy > 32);
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
    if (!sectionHeadEl || sectionHeadEl.__kaHeadingBound) return;
    sectionHeadEl.__kaHeadingBound = true;
    Reveal(sectionHeadEl);
  }

  /**
   * Primitive 7: AnimatedSection (Binds Headings, Cards, and Media Inside a Scope)
   */
  function AnimatedSection(rootScope) {
    const scope = rootScope || document;
    const headings = scope.querySelectorAll('.sectionhead');
    headings.forEach((h) => AnimatedHeading(h));

    const revealTargets = scope.querySelectorAll(
      '.featured, .place-card, .booking-hero-banner, .booking-trip-pick-card, .booking-form-card, .private-page-hero, .private-trip-card, .private-vip-showcase, .weather-hero-card, .weather-map-box, .public-review, .article, .glass'
    );
    revealTargets.forEach((el) => {
      if (!el.classList.contains('kurdia-scroll-item')) {
        Reveal(el);
      }
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
