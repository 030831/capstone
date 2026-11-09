import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--disable-gpu'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
await page.goto('http://127.0.0.1:4173/#/bridge');
await page.getByRole('button', { name: /두 묶음 합치기/ }).click();
await page.getByRole('button', { name: /그림으로 보기/ }).click();
await page.locator('input[type="radio"][value="8"]').check();
await page.getByRole('button', { name: '답 확인하기', exact: true }).click();
await page.getByRole('button', { name: '새 문제로 확인하기' }).click();
await page.locator('input[type="radio"][value="9"]').check();
await page.getByRole('button', { name: '답 확인하기', exact: true }).click();
await page.getByRole('button', { name: '오늘 기록 보기' }).click();
await page.getByRole('link', { name: '학습 기록', exact: true }).click();
await page.locator('.history-row').click();
const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
const violations = result.violations.map((v) => ({
  id: v.id,
  nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
}));
console.log(JSON.stringify(violations));
fs.writeFileSync(
  'research/2026-11-03/records-accessibility-results.json',
  JSON.stringify(violations, null, 2),
);
await page.screenshot({
  path: 'research/2026-11-03/screenshots/records-with-real-session.png',
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: 'research/2026-11-03/screenshots/records-mobile.png',
  fullPage: true,
});
await browser.close();
