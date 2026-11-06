// 빌드 결과(dist/index.html)를 file:// 로 열어 스크린샷 4장을 찍고 콘솔 에러와 금지어를 검사한다.
// v2: 힌트 칩(룰 기반 초안)·자세히 보기 접기·IEP 문장 붙여넣기 초안 반영.
// playwright 는 전역 설치를 사용한다(devDependency 로 추가하지 않음).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

  const url = 'file://' + path.resolve(__dirname, '../dist/index.html');
  await page.goto(url);
  await page.waitForSelector('.app-header');

  const shot = (n) => page.screenshot({ path: path.resolve(__dirname, `../screenshots/tab${n}.png`) });

  // 1: 메인(초기 빈 상태 — 힌트 안내 문구 상태)
  await shot(1);

  // 2: 메인(샘플 2 받아올림 덧셈 → 검사 → 결과, 자세히 보기 펼침)
  await page.getByRole('button', { name: '받아올림 덧셈' }).click();
  await page.getByRole('button', { name: /기준으로 검사/ }).click();
  await page.waitForSelector('.result-card');
  await page.locator('.detail-fold > summary').click();
  await page.waitForSelector('.chain-list');
  await shot(2);

  // 3: 학생 현행수준 모달 + IEP 문장 붙여넣기 초안 적용
  await page.getByRole('button', { name: '학생 현행수준', exact: true }).click();
  await page.waitForSelector('.modal-shell .tbl');
  await page.getByRole('button', { name: '예시 문장 넣기' }).click();
  await page.getByRole('button', { name: '초안 채우기' }).click();
  await page.waitForSelector('.modal-shell .ok-note');
  await shot(3);

  // 4: 반 일괄 검사 모달
  await page.locator('.modal-close').click();
  await page.getByRole('button', { name: '반 일괄 검사', exact: true }).click();
  await page.waitForSelector('.modal-shell .tbl-batch');
  await shot(4);

  // UI 전체 텍스트에서 금지어 검사 (메인 + 모달 두 개)
  const banned = ['진도율', '완료율', '%', '점수', '랭킹', '레벨', '다음 단계', '1순위', '추천 순서', /\d+\s*\/\s*39/];
  const texts = {};

  // 메인(모달 닫힌 상태)
  await page.locator('.modal-close').click();
  await page.waitForTimeout(120);
  texts['메인'] = await page.locator('body').innerText();

  // 학생 현행수준 모달
  await page.getByRole('button', { name: '학생 현행수준', exact: true }).click();
  await page.waitForSelector('.modal-shell');
  await page.waitForTimeout(120);
  texts['학생 현행수준'] = await page.locator('.modal-shell').innerText();
  await page.locator('.modal-close').click();

  // 반 일괄 검사 모달
  await page.getByRole('button', { name: '반 일괄 검사', exact: true }).click();
  await page.waitForSelector('.modal-shell');
  await page.waitForTimeout(120);
  texts['반 일괄'] = await page.locator('.modal-shell').innerText();

  for (const [name, t] of Object.entries(texts)) {
    for (const b of banned) {
      const hit = typeof b === 'string' ? t.includes(b) : b.test(t);
      if (hit) {
        const idx = typeof b === 'string' ? t.indexOf(b) : t.search(b);
        console.log(`금지어 발견 [${name}] ${b}: ...${t.slice(Math.max(0, idx - 30), idx + 30).replace(/\n/g, ' ')}...`);
      }
    }
  }

  console.log(problems.length === 0 ? '콘솔 에러/경고 0건' : '문제:\n' + problems.join('\n'));
  await browser.close();
  process.exit(problems.length === 0 ? 0 : 1);
})();
