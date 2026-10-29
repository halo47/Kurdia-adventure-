---
name: transitions-dev
source: https://github.com/Jakubantalik/transitions.dev
description: Production-ready CSS UI transitions and micro-interactions using semantic custom properties, namespaced t-* classes, and strict prefers-reduced-motion guards.
---

# Transitions.dev — UI Motion & CSS Transitions Skill

## Core Architecture
1. **Semantic Motion Tokens (`:root`):**
   - `--t-ease-out: cubic-bezier(0.22, 1, 0.36, 1);`
   - `--t-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);`
   - `--t-duration-fast: 180ms;`
   - `--t-duration-base: 320ms;`
   - `--t-duration-slow: 520ms;`
2. **Component Transition Patterns:**
   - **Modal & Sheet Reveal:** Backdrop fade paired with spring scale/translate entrance (`translateY(16px) scale(0.97)` -> `translateY(0) scale(1)`).
   - **Dropdown & Popover:** Origin-aware scale (`transform-origin: top center`) with opacity interpolation.
   - **Button & Tap Feedback:** Instant active compression (`scale(0.97)`) and hover elevation (`translateY(-2px)`).
   - **Skeleton & Content Swap:** Smooth crossfade from shimmer placeholder to hydrated content.
   - **Validation Shake & Toast Pop-in:** Non-blocking tactile feedback for form validation and status alerts.
3. **Accessibility Mandate:**
   - Every transition block must honor `@media (prefers-reduced-motion: reduce)` by collapsing durations and disabling spatial translations.
