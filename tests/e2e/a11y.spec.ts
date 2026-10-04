import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = [
  '/',
  '/events/first-deportation-to-babylon/',
  '/map/',
  '/people/',
  '/sources/cyrus-cylinder/',
  '/about/',
  '/book/',
  // German: a translated entry, and one that falls back to English.
  '/de/',
  '/de/events/first-deportation-to-babylon/',
  '/de/events/edict-of-cyrus/',
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    for (const path of PAGES) {
      test(path, async ({ page }) => {
        await page.goto(path);
        // Let the map and fonts settle so that contrast is measured on the final page.
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(
          results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(' ')}`),
        ).toEqual([]);
      });
    }
  });
}
