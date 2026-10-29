---
name: gsap-skills
source: https://github.com/greensock/gsap-skills
description: Official GreenSock (GSAP) AI skill modules covering gsap-core, gsap-timeline, gsap-scrolltrigger, plugins, responsive matchMedia, and 60fps performance rules.
---

# Official GSAP Skills (`greensock/gsap-skills`)

## Modules
1. **`01-gsap-core`:**
   - Prefer `gsap.to()`, `gsap.from()`, and `gsap.fromTo()` with explicit `overwrite: 'auto'`.
   - Use expressive eases (`power3.out`, `power4.out`, `expo.out`, `back.out(1.4)`).
   - Use `gsap.matchMedia()` for responsive desktop vs mobile animation rules and `prefers-reduced-motion` safety.
2. **`02-gsap-timeline`:**
   - Sequence complex entrances (Hero badge -> Title -> Subtitle -> CTAs -> Stats) with `gsap.timeline({ defaults: { ease: 'power3.out' } })` and relative position parameters (`'-=0.45'`).
3. **`03-gsap-scrolltrigger`:**
   - Always register plugin first: `gsap.registerPlugin(ScrollTrigger)`.
   - Use `once: true` for content reveal animations so elements stay visible after scrolling past.
   - Call `ScrollTrigger.refresh()` after dynamic DOM renders (`render()`, tab switches, async CMS loads).
4. **`04-gsap-performance`:**
   - Animate only compositor-friendly properties (`x`, `y`, `scale`, `rotation`, `opacity`, `autoAlpha`).
   - Avoid animating layout properties (`top`, `left`, `width`, `height`, `margin`) or heavy CSS `filter: blur()` on large containers during scroll.
   - Clean up triggers before re-initializing on dynamic DOM lists to prevent duplicate instances.
