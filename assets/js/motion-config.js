/**
 * ============================================================================
 * KURDIA ADVENTURE — CENTRALIZED MOTION CONFIGURATION & CAPABILITY DETECTOR
 * File: /assets/js/motion-config.js
 * Purpose: Defines shared timing tokens, easing curves, stagger intervals,
 *          device/touch capability flags, and cleanup registries.
 * ============================================================================
 */
(function (window) {
  'use strict';

  const mediaReduced = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  const mediaHover = window.matchMedia
    ? window.matchMedia('(hover: hover) and (pointer: fine)')
    : { matches: false };

  function checkReducedMotion() {
    return Boolean(mediaReduced && mediaReduced.matches);
  }

  function checkTouchDevice() {
    return (
      !mediaHover.matches ||
      'ontouchstart' in window ||
      (navigator && Number(navigator.maxTouchPoints) > 0) ||
      window.innerWidth < 768
    );
  }

  function checkMobileViewport() {
    return window.innerWidth < 768;
  }

  const cleanupRegistry = new Set();

  const KURDIA_MOTION_CONFIG = {
    version: '4.0.0',

    // Durations in seconds (for GSAP) and milliseconds (for CSS/JS timers)
    durations: {
      instant: 0.12,
      fast: 0.24,
      base: 0.42,
      medium: 0.58,
      slow: 0.78,
      cinematic: 1.15
    },

    // GSAP & CSS Easing Tokens
    easings: {
      outQuart: 'power3.out',
      outExpo: 'expo.out',
      outQuint: 'power4.out',
      inOutCubic: 'power2.inOut',
      gentleSpring: 'back.out(1.35)',
      cssOutQuint: 'cubic-bezier(0.22, 1, 0.36, 1)'
    },

    // Stagger intervals in seconds
    stagger: {
      tight: 0.045,
      base: 0.075,
      relaxed: 0.11
    },

    // Reveal distances in pixels
    distances: {
      sm: 14,
      md: 22,
      lg: 32
    },

    // Parallax & 3D Tilt Restraint Limits
    limits: {
      heroParallaxMaxPx: 36,
      cardTiltMaxDeg: 5.5,
      cardTiltPerspectivePx: 950
    },

    // Live Capability Queries
    prefersReducedMotion: checkReducedMotion,
    isTouchDevice: checkTouchDevice,
    isMobileViewport: checkMobileViewport,

    // Register & Run Cleanup Callbacks (Prevents duplicate listeners / memory leaks)
    registerCleanup(fn) {
      if (typeof fn === 'function') {
        cleanupRegistry.add(fn);
      }
    },

    cleanupAll() {
      cleanupRegistry.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
      cleanupRegistry.clear();
    }
  };

  // Register GSAP ScrollTrigger safely if available
  if (window.gsap && window.ScrollTrigger) {
    try {
      window.gsap.registerPlugin(window.ScrollTrigger);
      window.ScrollTrigger.config({
        ignoreMobileResize: true,
        autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load'
      });
    } catch (_) {}
  }

  window.KURDIA_MOTION_CONFIG = KURDIA_MOTION_CONFIG;
})(window);
