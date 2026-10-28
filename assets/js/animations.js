/**
 * ============================================================================
 * KURDIA ADVENTURE — MASTER CINEMATIC ANIMATION ORCHESTRATOR
 * File: /assets/js/animations.js
 * Purpose: Coordinates:
 *          1. Cinematic Hero Entrance & Scroll Cue
 *          2. Brand & Logo Precision Entrance
 *          3. Desktop-Only 3D Card Perspective Tilt (Touch/Mobile Safe)
 *          4. Tactile Button Ripple & Pointer Spotlight
 *          5. Page Transition Choreography & Weather Station Motion
 *          6. Lightweight 3D Zagros Mountain Horizon Atmosphere (with full
 *             WebGL disposal, off-tab pausing, and cleanup registration)
 * ============================================================================
 */
(function (window, document) {
  'use strict';

  const getCfg = () => window.KURDIA_MOTION_CONFIG;
  const getPrimitives = () => window.KurdiaMotionPrimitives;

  /**
   * 1. Living Aurora Background Layer
   */
  function initLivingAuroraBg() {
    if (document.getElementById('kurdiaLivingBg')) return;
    const bgWrap = document.createElement('div');
    bgWrap.id = 'kurdiaLivingBg';
    bgWrap.setAttribute('aria-hidden', 'true');
    bgWrap.innerHTML =
      '<div class="klbg-orb orb-1"></div><div class="klbg-orb orb-2"></div><div class="klbg-orb orb-3"></div>';
    document.body.prepend(bgWrap);
  }

  /**
   * 2. Brand Logo & Header Entrance Motion
   */
  function initBrandLogoEntrance() {
    const cfg = getCfg();
    if (!window.gsap || (cfg && cfg.prefersReducedMotion())) return;
    const brand = document.querySelector('.top .brand');
    const logoImg = document.querySelector('.top .brand-logo-img');
    const topActions = document.querySelectorAll('.top .top-actions > *');
    if (!brand || brand.__kaLogoAnimated) return;
    brand.__kaLogoAnimated = true;

    try {
      window.gsap.fromTo(
        brand,
        { opacity: 0, y: -10, scale: 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          ease: 'power3.out',
          clearProps: 'transform,opacity'
        }
      );
      if (topActions && topActions.length) {
        window.gsap.fromTo(
          topActions,
          { opacity: 0, y: -8 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.06,
            ease: 'power3.out',
            clearProps: 'transform,opacity'
          }
        );
      }
      if (logoImg) {
        window.gsap.fromTo(
          logoImg,
          { boxShadow: '0 0 0px rgba(211,47,78,0)' },
          {
            boxShadow: '0 0 22px rgba(211,47,78,0.48)',
            duration: 0.95,
            yoyo: true,
            repeat: 1,
            ease: 'sine.inOut'
          }
        );
      }
    } catch (_) {}
  }

  /**
   * 3. Cinematic Hero Choreography & Scroll Cue Injection
   */
  function initCinematicHero() {
    const hero = document.querySelector('#home .hero');
    if (!hero) return;
    hero.classList.add('ka-hero-loaded');

    // Inject subtle scroll indicator if not already present
    const heroContainer = hero.querySelector('.container');
    if (heroContainer && !heroContainer.querySelector('.ka-hero-scroll-cue')) {
      const cue = document.createElement('div');
      cue.className = 'ka-hero-scroll-cue';
      cue.setAttribute('role', 'button');
      cue.setAttribute('tabindex', '0');
      cue.setAttribute('aria-label', 'خوارەوە ببینە');
      cue.innerHTML =
        '<span class="ka-hero-scroll-dot"></span><span>خوارەوە ببینە · گەشتەکانی داهاتوو ↓</span>';
      const scrollToUpcoming = () => {
        const target = document.getElementById('upcomingTripsSection');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };
      cue.addEventListener('click', scrollToUpcoming);
      cue.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          scrollToUpcoming();
        }
      });
      heroContainer.appendChild(cue);
    }

    const cfg = getCfg();
    if (!window.gsap || (cfg && cfg.prefersReducedMotion())) return;
    if (hero.__kaHeroAnimated) return;
    hero.__kaHeroAnimated = true;

    const eyebrow = hero.querySelector('.eyebrow');
    const title = hero.querySelector('#heroTitle, h1');
    const text = hero.querySelector('#heroText, p');
    const ctaBtns = Array.from(hero.querySelectorAll('.actions .btn'));
    const cueEl = hero.querySelector('.ka-hero-scroll-cue');
    const sequence = [eyebrow, title, text, ...ctaBtns, cueEl].filter(Boolean);

    if (sequence.length) {
      try {
        window.gsap.killTweensOf(sequence);
        window.gsap.fromTo(
          sequence,
          { opacity: 0, y: 24, scale: 0.98 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.72,
            stagger: 0.095,
            ease: 'power3.out',
            clearProps: 'transform,opacity'
          }
        );
      } catch (_) {}
    }
  }

  /**
   * 4. Desktop-Only 3D Perspective Card Tilt (Disabled on Touch & Mobile)
   */
  function init3DCardPerspectiveTilt(rootScope) {
    const cfg = getCfg();
    if (cfg && (cfg.prefersReducedMotion() || cfg.isTouchDevice() || cfg.isMobileViewport())) {
      return;
    }
    const scope = rootScope || document;
    const cards = scope.querySelectorAll(
      '.featured, .trip-showcase-card, .place-card, .booking-trip-pick-card, .private-preset-card'
    );
    const maxDeg = (cfg && cfg.limits && cfg.limits.cardTiltMaxDeg) || 5.5;
    const perspective = (cfg && cfg.limits && cfg.limits.cardTiltPerspectivePx) || 950;

    cards.forEach((card) => {
      if (card._has3dTilt) return;
      card._has3dTilt = true;
      card.style.transformStyle = 'preserve-3d';

      card.addEventListener(
        'pointermove',
        (e) => {
          if (e.pointerType === 'touch') return;
          const rect = card.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const xRel = (e.clientX - rect.left) / rect.width - 0.5;
          const yRel = (e.clientY - rect.top) / rect.height - 0.5;
          const rx = (-yRel * maxDeg).toFixed(2);
          const ry = (xRel * maxDeg).toFixed(2);
          card.style.transform = `perspective(${perspective}px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px) translateZ(3px)`;
          card.style.setProperty('--mx', (e.clientX - rect.left).toFixed(0) + 'px');
          card.style.setProperty('--my', (e.clientY - rect.top).toFixed(0) + 'px');
        },
        { passive: true }
      );

      card.addEventListener(
        'pointerleave',
        () => {
          card.style.transform = '';
        },
        { passive: true }
      );
    });
  }

  /**
   * 5. Tactile Button Ripple & Micro-Interactions
   */
  function initMicroInteractions() {
    if (window.__kaMicroInteractionsBound) return;
    window.__kaMicroInteractionsBound = true;

    const CLICKABLE_SEL =
      '.btn, .navitem, .pf-chip, .weather-chip, .pay-method-btn, .private-preset-card, .stepper-btn, .iconbtn, .fib-quick-pill, .ka-menu-item, .booking-trip-pick-card';

    document.addEventListener(
      'pointerdown',
      (e) => {
        const target = e.target.closest ? e.target.closest(CLICKABLE_SEL) : null;
        if (!target || target.disabled) return;
        target.classList.add('kurdia-btn-pressed');
        setTimeout(() => target.classList.remove('kurdia-btn-pressed'), 180);

        const cfg = getCfg();
        if (cfg && cfg.prefersReducedMotion()) return;

        try {
          const rect = target.getBoundingClientRect();
          const size = Math.max(rect.width, rect.height, 44);
          const ripple = document.createElement('span');
          ripple.className = 'kurdia-click-ripple';
          ripple.style.width = size + 'px';
          ripple.style.height = size + 'px';
          ripple.style.left = ((e.clientX || rect.left + rect.width / 2) - rect.left) + 'px';
          ripple.style.top = ((e.clientY || rect.top + rect.height / 2) - rect.top) + 'px';
          target.appendChild(ripple);
          setTimeout(() => ripple.remove(), 620);
        } catch (_) {}
      },
      { passive: true }
    );

    ['pointerup', 'pointerleave', 'pointercancel'].forEach((evName) => {
      document.addEventListener(
        evName,
        () => {
          document
            .querySelectorAll('.kurdia-btn-pressed')
            .forEach((el) => el.classList.remove('kurdia-btn-pressed'));
        },
        { passive: true }
      );
    });
  }

  /**
   * 6. Weather Station Card & Metric Choreography (Data-Safe)
   */
  function animateWeatherStationSection(weatherRoot) {
    const cfg = getCfg();
    const prim = getPrimitives();
    if (!weatherRoot || (cfg && cfg.prefersReducedMotion())) return;

    const metrics = weatherRoot.querySelectorAll('.weather-metrics-grid .metric-box');
    if (prim && metrics.length) {
      prim.StaggerReveal(metrics, { y: 16, duration: 0.46, stagger: 0.045 });
    }
    const hourly = weatherRoot.querySelectorAll('#hourlyTimeline .hourly-card');
    if (prim && hourly.length) {
      prim.StaggerReveal(hourly, { y: 14, duration: 0.42, stagger: 0.03 });
    }
    const days = weatherRoot.querySelectorAll('#daysForecast .day-row-card');
    if (prim && days.length) {
      prim.StaggerReveal(days, { y: 16, duration: 0.46, stagger: 0.045 });
    }
  }

  /**
   * 7. Page Transition & Card Stagger Entrance
   */
  window.kurdiaAnimatePageCards = function (pageId) {
    const cfg = getCfg();
    const prim = getPrimitives();
    const resolvedId = pageId || (window.location.hash || '#home').slice(1) || 'home';
    const activePage = document.getElementById(resolvedId);
    if (!activePage || !activePage.classList.contains('active')) return;

    if (resolvedId === 'home') {
      initCinematicHero();
    }

    if (prim) {
      prim.AnimatedSection(activePage);
    }
    init3DCardPerspectiveTilt(activePage);

    if (resolvedId === 'weather') {
      animateWeatherStationSection(activePage);
    }

    if (cfg && cfg.prefersReducedMotion()) return;

    // For non-home subpages, stagger their top-level cards immediately on tab switch
    if (resolvedId !== 'home' && prim) {
      const subpageTargets = activePage.querySelectorAll(
        '.booking-hero-banner, .booking-trip-pick-card, .booking-form-card, .private-page-hero, .private-preset-card, .private-trip-card, .place-card, .experience-card'
      );
      if (subpageTargets.length) {
        prim.StaggerReveal(subpageTargets, { y: 18, duration: 0.48, stagger: 0.055 });
      }
    }

    if (window.anime) {
      try {
        const bars = activePage.querySelectorAll('.btp-seat-bar i');
        bars.forEach((b) => {
          const targetW = b.getAttribute('data-target-w') || b.style.width || '50%';
          b.setAttribute('data-target-w', targetW);
          b.style.width = '0%';
          window.anime({
            targets: b,
            width: targetW,
            duration: 780,
            easing: 'easeOutQuart',
            delay: 120
          });
        });
      } catch (_) {}
    }
  };

  window.kurdiaRefreshMotion = function () {
    const prim = getPrimitives();
    if (prim) {
      prim.AnimatedSection(document);
    }
    init3DCardPerspectiveTilt(document);
    if (window.ScrollTrigger) {
      try {
        window.ScrollTrigger.refresh();
      } catch (_) {}
    }
  };

  /**
   * 8. Lightweight 3D Zagros Mountain Horizon & Ambient Embers (Three.js)
   *    - Pauses automatically when #home is not the active tab or tab is hidden
   *    - Disposes geometries, materials, renderer, and listeners on cleanup
   */
  function initThreeAtmosphere() {
    const cfg = getCfg();
    if (!window.THREE || (cfg && cfg.prefersReducedMotion())) return;
    if (document.getElementById('kurdiaThreeAmbientCanvas')) return;

    try {
      const bgCanvas = document.createElement('canvas');
      bgCanvas.id = 'kurdiaThreeAmbientCanvas';
      bgCanvas.setAttribute('aria-hidden', 'true');
      document.body.prepend(bgCanvas);

      const isMobile = window.innerWidth < 768;
      const renderer = new window.THREE.WebGLRenderer({
        canvas: bgCanvas,
        alpha: true,
        antialias: false,
        powerPreference: 'low-power'
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));

      const scene = new window.THREE.Scene();
      const camera = new window.THREE.PerspectiveCamera(
        55,
        window.innerWidth / window.innerHeight,
        0.1,
        100
      );
      camera.position.set(0, 0, 7);

      const gridX = isMobile ? 12 : 20;
      const gridY = isMobile ? 7 : 11;
      const mountainGeo = new window.THREE.PlaneGeometry(32, 16, gridX, gridY);
      const posAttr = mountainGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const elevation =
          Math.sin(vx * 0.35) * Math.cos(vy * 0.4) * 2.1 +
          Math.sin(vx * 0.75 + 1.2) * 1.05 +
          Math.sin(vx * 1.4) * 0.42;
        posAttr.setZ(i, Math.max(0, elevation));
      }
      mountainGeo.computeVertexNormals();

      const mountainMat = new window.THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: isMobile ? 0.065 : 0.1
      });
      const mountainMesh = new window.THREE.Mesh(mountainGeo, mountainMat);
      mountainMesh.rotation.x = -Math.PI / 2.3;
      mountainMesh.position.set(0, -4.6, -2);
      scene.add(mountainMesh);

      const emberCount = isMobile ? 28 : 64;
      const emberGeo = new window.THREE.BufferGeometry();
      const emberPositions = new Float32Array(emberCount * 3);
      const emberVelocities = new Float32Array(emberCount);
      for (let i = 0; i < emberCount; i++) {
        emberPositions[i * 3] = (Math.random() - 0.5) * 18;
        emberPositions[i * 3 + 1] = (Math.random() - 0.5) * 12;
        emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 8;
        emberVelocities[i] = 0.0025 + Math.random() * 0.006;
      }
      emberGeo.setAttribute('position', new window.THREE.BufferAttribute(emberPositions, 3));
      const emberMat = new window.THREE.PointsMaterial({
        color: 0xff5e7e,
        size: isMobile ? 0.044 : 0.04,
        transparent: true,
        opacity: 0.42
      });
      const emberPoints = new window.THREE.Points(emberGeo, emberMat);
      scene.add(emberPoints);

      let mouseX = 0;
      let mouseY = 0;
      let targetCameraX = 0;
      let targetCameraY = 0;
      let rafId = null;
      let disposed = false;

      const onPointerMove = (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      };

      const onResize = () => {
        if (disposed) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      if (!isMobile) {
        window.addEventListener('pointermove', onPointerMove, { passive: true });
      }
      window.addEventListener('resize', onResize, { passive: true });

      let clock = 0;
      function animateThree() {
        if (disposed) return;
        rafId = window.requestAnimationFrame(animateThree);
        // Pause GPU work when tab is hidden or user is on heavy map/form pages
        const homeEl = document.getElementById('home');
        if (document.hidden || (homeEl && !homeEl.classList.contains('active'))) {
          return;
        }
        clock += 0.007;

        mountainMesh.rotation.z = Math.sin(clock * 0.2) * 0.018;
        mountainMesh.position.y = -4.6 + Math.sin(clock * 0.38) * 0.1;

        const pArr = emberGeo.attributes.position.array;
        for (let i = 0; i < emberCount; i++) {
          pArr[i * 3 + 1] += emberVelocities[i];
          pArr[i * 3] += Math.sin(clock + i) * 0.0018;
          if (pArr[i * 3 + 1] > 6) {
            pArr[i * 3 + 1] = -6;
            pArr[i * 3] = (Math.random() - 0.5) * 18;
          }
        }
        emberGeo.attributes.position.needsUpdate = true;

        targetCameraX += (mouseX * 0.3 - targetCameraX) * 0.04;
        targetCameraY += (-mouseY * 0.22 - targetCameraY) * 0.04;
        camera.position.x = targetCameraX;
        camera.position.y = targetCameraY;
        camera.lookAt(0, -1, 0);

        renderer.render(scene, camera);
      }
      animateThree();

      const cleanupThree = () => {
        if (disposed) return;
        disposed = true;
        if (rafId) window.cancelAnimationFrame(rafId);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('resize', onResize);
        try {
          mountainGeo.dispose();
          mountainMat.dispose();
          emberGeo.dispose();
          emberMat.dispose();
          renderer.dispose();
          if (bgCanvas.parentNode) bgCanvas.parentNode.removeChild(bgCanvas);
        } catch (_) {}
      };

      bgCanvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        cleanupThree();
      });

      if (cfg && typeof cfg.registerCleanup === 'function') {
        cfg.registerCleanup(cleanupThree);
      }
    } catch (_) {}
  }

  /**
   * 9. Bootstrapping & Lifecycle Hook
   */
  function bootKurdiaMotionSystem() {
    initLivingAuroraBg();
    const prim = getPrimitives();
    if (prim) {
      prim.ScrollProgress();
      prim.ParallaxImage();
      prim.AnimatedSection(document);
    }
    initBrandLogoEntrance();
    initCinematicHero();
    initMicroInteractions();
    init3DCardPerspectiveTilt(document);
    initThreeAtmosphere();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootKurdiaMotionSystem, { once: true });
  } else {
    bootKurdiaMotionSystem();
  }
})(window, document);
