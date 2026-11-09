import { test, expect } from '@playwright/test';

test('teacher can design a variant, see a review note, record it, and preview', async ({
  page,
}) => {
  await page.goto('/#/design');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('label.dp-pill', { hasText: '평가' }).click();
  await page.getByRole('button', { name: /다음: 구성 예시/ }).click();
  await page.getByRole('button', { name: '이 구성을 공통 설정으로' }).nth(1).click();
  await page.getByRole('button', { name: /다음: 조절/ }).click();
  await page
    .getByRole('button', { name: /공통 설정에서 변형 만들기/ })
    .last()
    .click();
  await page.locator('label.dp-pill', { hasText: '수 범위 1–10' }).last().click();
  await expect(page.getByText(/공통과 다른 항목: 수 범위/)).toBeVisible();
  await page.getByRole('button', { name: /다음: 검토 안내/ }).click();
  await expect(
    page.getByText(/목표의 내용 범위\(수 범위 1–5\)와 자료의 수 범위\(수 범위 1–10\)/),
  ).toBeVisible();
  await page.getByRole('button', { name: '의도한 변경으로 기록' }).last().click();
  await page.getByLabel('의도한 이유 (선택)').fill('범위 확장 연습');
  await page.getByRole('button', { name: '기록하기' }).click();
  await expect(page.getByText(/의도한 변경: 범위 확장 연습/)).toBeVisible();
  await page.getByRole('button', { name: /다음: 미리보기/ }).click();
  await expect(page.locator('.ws-sheet')).toBeVisible();
  await page.getByRole('button', { name: '학생 ㄷ용' }).click();
  await expect(page.locator('.dp-compare td.differs')).toHaveCount(1);
});
