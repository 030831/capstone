import { test, expect } from '@playwright/test';

const records = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('neulbom:v1:records') || '[]'));

test('hub, settings, keyboard dialog, empty parent view', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /혼자 해내는 순간/ })).toBeVisible();
  await page.getByRole('button', { name: '보기 설정' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('checkbox', { name: /글씨 크게 보기/ }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-large-text', 'true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-large-text', 'true');
  await page.getByRole('link', { name: '학습 기록', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '아직 이곳에 담긴 배움이 없어요.' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('A wrong first response survives hints, pause/reload, and completion', async ({ page }) => {
  await page.goto('/#/focus');
  await page.getByRole('button', { name: '첫 안내 열기' }).click();
  await page.getByRole('button', { name: '지시를 짧게 보기', exact: true }).click();
  await page.getByRole('button', { name: '읽었어요. 골라 볼게요' }).click();
  await page.getByRole('button', { name: /색연필과 공/ }).click();
  await page.getByRole('button', { name: '고른 답 확인하기' }).click();
  await page.getByRole('button', { name: '한 걸음 도움', exact: true }).click();
  await page.getByRole('button', { name: '잠깐 쉬기', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '잠깐 멈춰도 괜찮아요.' })).toBeVisible();
  await page.getByRole('button', { name: '준비됐어요. 다시 살펴볼게요' }).click();
  await page.getByRole('button', { name: '이 한 걸음부터 이어하기' }).click();
  await page.getByRole('button', { name: /색연필과 풀/ }).click();
  await page.getByRole('button', { name: '고른 답 확인하기' }).click();
  await page.getByRole('button', { name: '다음 안내 열기' }).click();
  await page.getByRole('button', { name: '읽었어요. 골라 볼게요' }).click();
  await page.getByRole('button', { name: /책 고르기/ }).click();
  await page.getByRole('button', { name: '고른 답 확인하기' }).click();
  await page.getByRole('button', { name: '다음 안내 열기' }).click();
  await page.getByRole('button', { name: '읽었어요. 골라 볼게요' }).click();
  await page.getByRole('button', { name: /2층 음악실/ }).click();
  await page.getByRole('button', { name: '고른 답 확인하기' }).click();
  await page.getByRole('button', { name: '오늘 활동 돌아보기' }).click();
  await page.getByRole('button', { name: '이대로 기록 남기기' }).click();
  await expect(page.getByRole('heading', { name: '오늘의 기록을 남겼어요.' })).toBeVisible();
  const saved = await records(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].questions[0]).toMatchObject({
    firstCorrect: false,
    correct: true,
    attempts: 2,
    hints: 1,
    accessSupports: ['지시를 짧게 보기'],
  });
  expect(saved[0].resumed).toBe(1);
  await page.reload();
  expect(await records(page)).toHaveLength(1);
  await page.getByRole('link', { name: '학습 기록', exact: true }).click();
  await expect(page.locator('.stat-card').nth(1)).toContainText('2/3');
  await page.locator('.history-row').click();
  await expect(page.locator('table')).toContainText('지시를 짧게 보기');
});

test('A early finish keeps unanswered questions out of accuracy denominator', async ({ page }) => {
  await page.goto('/#/focus');
  await page.getByRole('button', { name: '첫 안내 열기' }).click();
  await page.getByRole('button', { name: '오늘은 여기까지 하고 기록 남기기' }).click();
  await page.getByRole('button', { name: '이대로 기록 남기기' }).click();
  const saved = await records(page);
  expect(saved[0].questions).toHaveLength(3);
  expect(saved[0].questions.every((q) => q.firstCorrect === null)).toBeTruthy();
  await page.getByRole('link', { name: '학습 기록', exact: true }).click();
  await expect(page.locator('.stat-card').nth(3)).toContainText('—');
});

test('B preserves support types and new-item check result', async ({ page }) => {
  await page.goto('/#/bridge');
  await page.getByRole('button', { name: /두 묶음 합치기/ }).click();
  await page.getByRole('button', { name: '문장 나누어 보기' }).click();
  await page.getByRole('button', { name: /그림으로 보기/ }).click();
  await page.locator('input[type="radio"][value="7"]').check();
  await page.getByRole('button', { name: '답 확인하기', exact: true }).click();
  await page.locator('input[type="radio"][value="8"]').check();
  await page.getByRole('button', { name: '답 확인하기', exact: true }).click();
  await page.getByRole('button', { name: '새 문제로 확인하기' }).click();
  await expect(page.getByRole('button', { name: '문장 나누어 보기' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '잠깐 쉬기' }).click();
  await page.reload();
  await page.getByRole('button', { name: '이어서 하기', exact: true }).click();
  await page.locator('input[type="radio"][value="9"]').check();
  await page.getByRole('button', { name: '답 확인하기', exact: true }).click();
  await page.getByRole('button', { name: '오늘 기록 보기' }).click();
  const saved = await records(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].prototype).toBe('bridge');
  expect(saved[0].questions[0]).toMatchObject({
    firstCorrect: false,
    correct: true,
    attempts: 2,
    hints: 1,
  });
  expect(saved[0].questions[1]).toMatchObject({ firstCorrect: true, correct: true, hints: 0 });
  expect(saved[0].questions[1].accessSupports).toContain('문장 나누어 보기');
  await page.reload();
  expect(await records(page)).toHaveLength(1);
});

test('B skipped check is not counted as incorrect or independent success', async ({ page }) => {
  await page.goto('/#/bridge');
  await page.getByRole('button', { name: /두 묶음 합치기/ }).click();
  await page.getByRole('button', { name: '이 문제는 다음에 할래요' }).click();
  await page.getByRole('button', { name: '이 문제는 다음에 할래요' }).click();
  const saved = await records(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].questions.every((q) => q.firstCorrect === null && !q.correct)).toBeTruthy();
});

test('mobile pages fit viewport and shared large-text settings', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of ['', 'focus', 'bridge', 'life', 'records', 'about']) {
    await page.goto('/#/' + route);
    await expect(page.locator('h1').first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBeTruthy();
  }
  await page.getByRole('button', { name: '보기 설정' }).click();
  await page.getByRole('checkbox', { name: /글씨 크게 보기/ }).check();
  await page.getByRole('button', { name: '이렇게 볼게요' }).click();
  for (const route of ['focus', 'bridge', 'life']) {
    await page.goto('/#/' + route);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBeTruthy();
  }
});

test('skip link focuses content without resetting hash route', async ({ page }) => {
  await page.goto('/#/bridge');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '본문으로 바로가기' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/bridge$/);
  await expect(page.locator('#main')).toBeFocused();
});

test('C two real shopping missions preserve attempts and generate only actual records', async ({
  page,
}) => {
  await page.goto('/#/life');
  await page.getByRole('button', { name: /첫 번째 장면 미술 시간 준비하기/ }).click();
  for (const name of ['연필', '연필', '지우개', '공책'])
    await page.getByRole('button', { name: `${name} 한 개 담기`, exact: true }).click();
  await page.getByRole('button', { name: '장바구니 확인하기' }).click();
  await page.getByRole('button', { name: '공책 한 개 빼기' }).click();
  await page.getByRole('button', { name: '장바구니 확인하기' }).click();
  await page.getByRole('button', { name: '다음 단계로', exact: true }).click();
  await page.getByLabel('물건값 합계').fill('900');
  await page.getByRole('button', { name: '잠깐 쉬기' }).click();
  await page.reload();
  await page.getByRole('button', { name: '이어서 하기', exact: true }).click();
  await expect(page.getByLabel('물건값 합계')).toHaveValue('900');
  await page.getByRole('button', { name: '내 답 확인하기' }).click();
  await page.getByLabel('물건값 합계').fill('1900');
  await page.getByRole('button', { name: '내 답 확인하기' }).click();
  await page.getByRole('button', { name: '다음 단계로', exact: true }).click();
  await page.getByRole('button', { name: /살 수 있어요 예산 안에서/ }).click();
  await page.getByRole('button', { name: '내 답 확인하기' }).click();
  await page.getByRole('button', { name: '다음 단계로', exact: true }).click();
  await page.getByRole('button', { name: '작은 힌트 보기' }).click();
  await page.getByRole('button', { name: '조금 더 알려주세요' }).click();
  await page.getByRole('button', { name: '함께 확인하기', exact: true }).click();
  await page.getByLabel('거스름돈', { exact: true }).fill('1100');
  await page.getByRole('button', { name: '내 답 확인하기' }).click();
  await page.getByRole('button', { name: '기록 남기고 마치기' }).click();
  let saved = await records(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].questions[0]).toMatchObject({ firstCorrect: false, attempts: 2 });
  expect(saved[0].questions[1].firstCorrect).toBe(false);
  expect(saved[0].questions[3].hints).toBe(3);
  expect(saved[0].resumed).toBe(1);
  await page.getByRole('button', { name: '다른 준비물로 해보기' }).click();
  for (const name of ['공책', '자', '자'])
    await page.getByRole('button', { name: `${name} 한 개 담기`, exact: true }).click();
  await page.getByRole('button', { name: '장바구니 확인하기' }).click();
  await page.getByRole('button', { name: '다음 단계로', exact: true }).click();
  await page.getByLabel('물건값 합계').fill('2800');
  await page.getByRole('button', { name: '내 답 확인하기' }).click();
  await page.getByRole('button', { name: '다음 단계로', exact: true }).click();
  await page.getByRole('button', { name: /살 수 있어요 예산 안에서/ }).click();
  await page.getByRole('button', { name: '내 답 확인하기' }).click();
  await page.getByRole('button', { name: '다음 단계로', exact: true }).click();
  await page.getByLabel('거스름돈', { exact: true }).fill('2200');
  await page.getByRole('button', { name: '내 답 확인하기' }).click();
  await page.getByRole('button', { name: '기록 남기고 마치기' }).click();
  await page.reload();
  saved = await records(page);
  expect(saved).toHaveLength(2);
  expect(saved[0].questions.every((q) => q.firstCorrect && q.hints === 0)).toBeTruthy();
  await page.getByRole('link', { name: '학습 기록', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(2);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '기록 내려받기' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('늘봄-체험기록.json');
  await page.getByRole('button', { name: '완료 기록 비우기' }).click();
  await page.getByRole('button', { name: '기록 지우기', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '아직 이곳에 담긴 배움이 없어요.' }),
  ).toBeVisible();
});

test('late storage failure is disclosed instead of claiming record saved', async ({ page }) => {
  await page.goto('/#/bridge');
  await page.getByRole('button', { name: /두 묶음 합치기/ }).click();
  await page.getByRole('button', { name: '이 문제는 다음에 할래요' }).click();
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: '이 문제는 다음에 할래요' }).click();
  await expect(page.locator('.storage-warning')).toBeVisible();
  await expect(page.locator('.bridge-proto')).toContainText('기록');
  expect(await records(page)).toHaveLength(0);
});
