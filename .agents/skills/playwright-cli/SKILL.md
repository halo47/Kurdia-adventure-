---
name: playwright-cli
source: https://github.com/microsoft/playwright-cli
description: Token-efficient browser automation, DOM/ARIA snapshot inspection, mobile/desktop viewport verification, and E2E testing patterns for AI agents.
---

# Microsoft Playwright CLI Skill (`microsoft/playwright-cli`)

## Verification & Testing Workflow
1. **Viewport & RTL Layout Verification:**
   - Test both Mobile (`390x844`, iPhone/Android Chrome) and Desktop (`1440x900`) viewports.
   - Verify `document.documentElement.scrollWidth <= window.innerWidth` so RTL Kurdish Sorani layouts never overflow horizontally.
2. **Interactive Flow Assertions:**
   - Verify sticky header overlap on form inputs (`scrollIntoView({ block: 'center' })`).
   - Verify modal open/close transitions, bottom navigation tab switching, review submission (`#reviewForm`), and CMS synchronization between `/admin.html` and `/index.html`.
3. **Console & Network Hygiene:**
   - Assert zero uncaught `pageerror` exceptions and verify API payloads (`/api/reviews`, `/api/cms-overrides`) return `200 OK`.
