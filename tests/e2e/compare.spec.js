import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const db = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('neulbom:v1:compare-db') || 'null'));

test('메인화면에서 설정을 바꾸고 수량 비교로 들어간다', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /더 많은 쪽을 고르고/ })).toBeVisible();
  await page.getByRole('button', { name: '보기 설정' }).click();
  await page.getByRole('checkbox', { name: /글씨 크게 보기/ }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-large-text', 'true');
  await page.getByRole('button', { name: '학생 화면에서 풀어 보기' }).click();
  await expect(page.getByRole('heading', { name: '더 많은 쪽 고르기' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('학생 ㄱ: 오답 뒤 재시도, 새로고침 후 이어 하기, 완료 기록', async ({ page }) => {
  await page.goto('/#/compare');
  await page.getByRole('button', { name: '활동 시작' }).click();
  await expect(page.getByText('문항 1 / 5')).toBeVisible();

  // 1번 문항: 가 4 · 나 2. 일부러 틀린 뒤 다시 고른다.
  await page.getByRole('button', { name: '나 고르기' }).click();
  await expect(page.getByText(/다른 쪽을 골라 보세요/)).toBeVisible();
  await page.getByRole('button', { name: '가 고르기' }).click();
  await expect(page.getByText('맞았어요. 가가 더 많아요.')).toBeVisible();

  // 새로고침해도 진행 중인 활동과 기록이 남아 있다.
  await page.reload();
  await expect(page.getByText('문항 2 / 5')).toBeVisible();

  const answers = ['나', '나', '가', '나']; // 3·5, 2·3, 5·3(지원), 1·4(지원)
  for (const side of answers) {
    await page.getByRole('button', { name: `${side} 고르기` }).click();
    await page.getByRole('button', { name: /다음 문항|결과 보기/ }).click();
  }
  await expect(page.getByRole('heading', { name: '활동을 마쳤어요.' })).toBeVisible();

  const saved = await db(page);
  expect(saved.attempts).toHaveLength(6);
  expect(saved.activities[0].status).toBe('done');
  expect(saved.attempts.filter((a) => a.attemptNo === 1 && a.correct)).toHaveLength(4);

  await page.getByRole('link', { name: '교사 화면에서 기록 보기' }).click();
  const card = page.locator('.student-card', { hasText: '학생 ㄱ' });
  await expect(card.getByText('80%')).toBeVisible(); // 첫 시도 4/5
  await expect(card.getByText('67%')).toBeVisible(); // 지원 없음 2/3
  await expect(card.getByText('100%')).toBeVisible(); // 일대일 대응 배열 2/2
});

test('같은 문항을 연달아 눌러도 응답은 한 번만 저장된다', async ({ page }) => {
  await page.goto('/#/compare');
  await page.getByRole('button', { name: '활동 시작' }).click();
  await page.getByRole('button', { name: '가 고르기' }).dblclick();
  const saved = await db(page);
  expect(saved.attempts).toHaveLength(1);
});

test('교사 화면: 네 가지 처리 확인, 초안 승인, 문항 수정', async ({ page }) => {
  await page.goto('/#/compare/teacher');
  await page.getByRole('button', { name: '모두 실행' }).click();
  await expect(page.locator('.check-ok')).toHaveCount(4);
  await expect(page.locator('.check-bad')).toHaveCount(0);

  await page.getByRole('button', { name: 'g1-q6 승인' }).click();
  await page.getByRole('button', { name: 'g1-q1 가·나 바꾸기' }).click();
  const saved = await db(page);
  const byId = Object.fromEntries(saved.items.map((i) => [i.id, i]));
  expect(byId['g1-q6'].status).toBe('approved');
  expect(byId['g1-q1']).toMatchObject({ left: 2, right: 4, version: 2, status: 'draft' });
});

test('시계를 넘기면 진행 중인 활동이 만료된다', async ({ page }) => {
  await page.goto('/#/compare');
  await page.getByRole('radio', { name: /평가/ }).check();
  await page.getByRole('button', { name: '활동 시작' }).click();
  await expect(page.getByText('문항 1 / 3')).toBeVisible();
  await page.getByRole('button', { name: '가 고르기' }).click();
  await page.goto('/#/compare/teacher');
  await page.getByRole('button', { name: /시계를 31분 뒤로 넘기기/ }).click();
  await expect(page.locator('.student-card', { hasText: '학생 ㄱ' })).toContainText('만료 1');
  const saved = await db(page);
  expect(saved.activities[0].status).toBe('expired');
  expect(saved.attempts).toHaveLength(1);
});

test('접근성 자동 검사: 메인, 학생, 교사 화면', async ({ page }) => {
  for (const path of ['/', '/#/compare', '/#/compare/teacher']) {
    await page.goto(path);
    await page.locator('h1').first().waitFor();
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.map((v) => `${path} ${v.id}`)).toEqual([]);
  }
  await page.goto('/#/compare');
  await page.getByRole('button', { name: '활동 시작' }).click();
  const playing = await new AxeBuilder({ page }).analyze();
  expect(playing.violations.map((v) => v.id)).toEqual([]);
});
