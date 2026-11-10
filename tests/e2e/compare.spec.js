import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const db = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('neulbom:v1:compare-db') || 'null'));

test.beforeEach(async ({ page }) => {
  await page.goto('/#/compare');
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith('neulbom:v1:compare')) localStorage.removeItem(k);
  });
  await page.reload();
});

test('메뉴에서 수량 비교 기록으로 들어간다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '수량 비교 기록' }).click();
  await expect(page.getByRole('heading', { name: '더 많은 쪽 고르기' })).toBeVisible();
  await expect(page.getByRole('link', { name: '수량 비교 기록' })).toHaveClass(/active/);
});

test('학생 ㄱ: 오답 뒤 재시도, 새로고침 후 이어 하기, 완료 기록', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('button', { name: '활동 시작' }).click();
  await expect(page.getByText('문항 1 / 5')).toBeVisible();
  await page.getByRole('button', { name: '나 고르기' }).click(); // 가 4 · 나 2 → 오답
  await expect(page.getByText(/다른 쪽을 골라 보세요/)).toBeVisible();
  await page.getByRole('button', { name: '가 고르기' }).click();
  await expect(page.getByText('맞았어요. 가가 더 많아요.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('문항 2 / 5')).toBeVisible();
  for (const side of ['나', '나', '가', '나']) {
    await page.getByRole('button', { name: `${side} 고르기` }).click();
    await page.getByRole('button', { name: /다음 문항|결과 보기/ }).click();
  }
  await expect(page.getByRole('heading', { name: '활동을 마쳤어요.' })).toBeVisible();
  const saved = await db(page);
  expect(saved.attempts).toHaveLength(6);
  expect(saved.activities[0].status).toBe('done');
  await page.getByRole('link', { name: '교사 화면에서 기록 보기' }).click();
  const card = page.locator('.cmp-student-card', { hasText: '학생 ㄱ' });
  await expect(card.getByText('80%')).toBeVisible();
  await expect(card.getByText('67%')).toBeVisible();
  await expect(card.getByText('100%')).toBeVisible();
  expect(errors).toEqual([]);
});

test('같은 문항을 연달아 눌러도 응답은 한 번만 저장된다', async ({ page }) => {
  await page.getByRole('button', { name: '활동 시작' }).click();
  await page.getByRole('button', { name: '가 고르기' }).dblclick();
  expect((await db(page)).attempts).toHaveLength(1);
});

test('교사 화면: 네 가지 처리 확인, 초안 승인, 문항 수정', async ({ page }) => {
  await page.goto('/#/compare/teacher');
  await page.getByRole('button', { name: '모두 실행' }).click();
  await expect(page.locator('.cmp-check-ok')).toHaveCount(4);
  await page.getByRole('button', { name: 'g1-q6 승인' }).click();
  await page.getByRole('button', { name: 'g1-q1 가·나 바꾸기' }).click();
  const byId = Object.fromEntries((await db(page)).items.map((i) => [i.id, i]));
  expect(byId['g1-q6'].status).toBe('approved');
  expect(byId['g1-q1']).toMatchObject({ left: 2, right: 4, version: 2, status: 'draft' });
});

test('시계를 넘기면 진행 중인 활동이 만료된다', async ({ page }) => {
  await page.getByRole('radio', { name: /평가/ }).check();
  await page.getByRole('button', { name: '활동 시작' }).click();
  await expect(page.getByText('문항 1 / 3')).toBeVisible();
  await page.getByRole('button', { name: '가 고르기' }).click();
  await page.goto('/#/compare/teacher');
  await page.getByRole('button', { name: /시계를 31분 뒤로 넘기기/ }).click();
  await expect(page.locator('.cmp-student-card', { hasText: '학생 ㄱ' })).toContainText('만료 1');
  expect((await db(page)).activities[0].status).toBe('expired');
});

test('접근성 자동 검사: 학생·교사 화면', async ({ page }) => {
  for (const path of ['/#/compare', '/#/compare/teacher']) {
    await page.goto(path);
    await page.locator('h1').first().waitFor();
    const result = await new AxeBuilder({ page }).exclude('.brand').analyze();
    expect(result.violations.map((v) => `${path} ${v.id}`)).toEqual([]);
  }
  await page.goto('/#/compare');
  await page.getByRole('button', { name: '활동 시작' }).click();
  const playing = await new AxeBuilder({ page }).exclude('.brand').analyze();
  expect(playing.violations.map((v) => v.id)).toEqual([]);
});
