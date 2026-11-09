import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--disable-gpu'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const results = [];
for (const route of ['', 'design', 'about']) {
  await page.goto('http://127.0.0.1:4173/#/' + route);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const summary = result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
  }));
  results.push({ route: route || 'home', violations: summary });
  console.log(route || 'home', JSON.stringify(summary));
}
await browser.close();
if (results.some((r) => r.violations.length)) process.exit(1);
