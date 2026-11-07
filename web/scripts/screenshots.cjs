// 빌드 결과(dist/index.html)를 file:// 로 열어 검사한다.
// v3(2026-11-07):
//  ① 금지어가 발견되면 실패 종료(exit 1) — 스크린샷만 찍고 통과하는 일이 없게 한다.
//  ② 사용자가 입력한 문제 글([data-user-content])은 고정 UI 문구와 구분해 오탐을 막는다.
//     input/textarea 의 값 자체는 innerText 에 포함되지 않으므로 자동으로 제외된다.
//  ③ 1280/768/390 세 폭에서 화면을 확인하고, 좁은 폭에서 페이지 전체 가로 스크롤이
//     생기지 않는지(표 영역 안에서만 스크롤) 검사한다.
//  ④ 모달 키보드 포커스(모달 안 이동·Esc 닫기·버튼 복귀)를 자동 검사한다.
// playwright 는 전역 설치를 사용한다(devDependency 로 추가하지 않음).
const { chromium } = require('playwright');
const path = require('path');

// 제품이 고정으로 제공하는 UI 문구에서 쓰면 안 되는 표현.
// (진도 표시·순위·처방 톤, 그리고 지시서 §7 이 금지한 성공/학습 보장 표현)
const BANNED = [
  '진도율', '완료율', '%', '점수', '랭킹', '레벨', '다음 단계', '1순위', '추천 순서',
  '지금 딱 맞는', '도전시키기', '그대로 쓸 수 있', '반 전체에게 내도', '보장',
  /\d+\s*\/\s*39/,
];

(async () => {
  const browser = await chromium.launch();
  const url = 'file://' + path.resolve(__dirname, '../dist/index.html');
  const problems = [];
  const forbidden = [];

  const newPage = async (w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
    await page.goto(url);
    await page.waitForSelector('.app-header');
    return page;
  };

  /** scope 셀렉터 안의 고정 UI 텍스트에서 금지어를 찾는다(사용자 입력 [data-user-content] 제외). */
  const scanBanned = async (page, name, scopeSel) => {
    const text = await page.evaluate((sel) => {
      const root = document.querySelector(sel) ?? document.body;
      const clone = root.cloneNode(true);
      clone.querySelectorAll('[data-user-content]').forEach((el) => el.remove());
      return (clone.textContent || '').trim();
    }, scopeSel);
    for (const b of BANNED) {
      const hit = typeof b === 'string' ? text.includes(b) : b.test(text);
      if (hit) {
        const idx = typeof b === 'string' ? text.indexOf(b) : text.search(b);
        forbidden.push(`[${name}] ${b}: ...${text.slice(Math.max(0, idx - 30), idx + 30).replace(/\n/g, ' ')}...`);
      }
    }
  };

  /** 페이지 전체 가로 스크롤 검사: 표 등 영역 안 스크롤은 허용. */
  const checkNoPageOverflow = async (page, name) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 2) problems.push(`[${name}] 페이지 전체 가로 스크롤 ${overflow}px (표 영역 안으로 제한되어야 함)`);
  };

  const shot = (page, n) => page.screenshot({ path: path.resolve(__dirname, `../screenshots/${n}.png`) });

  try {
    // ── 1280px: 주 흐름(문제 작성 → 개념 확인 → 검사 → 상세) ──
    const page = await newPage(1280, 800);
    await shot(page, 'tab1');

    await page.getByRole('button', { name: '받아올림 덧셈' }).click();
    await page.getByRole('button', { name: '개념 확인' }).click();
    await page.getByRole('button', { name: /기준으로 검사/ }).click();
    await page.waitForSelector('.result-card');
    await page.locator('.detail-fold > summary').click();
    await page.waitForSelector('.chain-list');
    await shot(page, 'tab2');
    await checkNoPageOverflow(page, '1280 메인');

    // ── 학생 현행수준 모달: IEP 미리 보기 흐름 + 포커스 검사 ──
    const opener = page.getByRole('button', { name: '학생 현행수준' });
    await opener.click();
    await page.waitForSelector('.modal-shell .tbl');
    await page.getByRole('button', { name: '예시 문장 넣기' }).click();
    await page.getByRole('button', { name: '변경 내용 미리 보기' }).click();
    await page.waitForSelector('.iep-preview');
    await shot(page, 'tab3');

    // 모달 키보드 포커스: 열리면 안으로, Tab 은 안에서 순환, Esc 로 닫히고 버튼으로 복귀
    const focusOk = await page.evaluate(() => {
      const shell = document.querySelector('.modal-shell');
      return shell && shell.contains(document.activeElement);
    });
    if (!focusOk) problems.push('[모달 포커스] 열릴 때 포커스가 모달 안으로 이동하지 않음');
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    const stillInside = await page.evaluate(() => {
      const shell = document.querySelector('.modal-shell');
      return shell && shell.contains(document.activeElement);
    });
    if (!stillInside) problems.push('[모달 포커스] Tab 이 모달 밖으로 나감(포커스 트랩 실패)');
    const bgInert = await page.evaluate(() => document.querySelector('.app')?.hasAttribute('inert') === true);
    if (!bgInert) problems.push('[모달 포커스] 모달 뒤 화면이 inert 가 아님');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.modal-shell', { state: 'detached' });
    await page.waitForTimeout(120);
    const restored = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.header-actions button')];
      return btns.some((b) => b === document.activeElement);
    });
    if (!restored) problems.push('[모달 포커스] 닫은 뒤 열었던 버튼으로 포커스가 돌아오지 않음');
    await checkNoPageOverflow(page, '1280 학생 모달');

    // ── 반 일괄 검사 모달(검사한 문제 사용) ──
    await page.locator('.header-actions').getByRole('button', { name: '반 일괄 검사' }).click();
    await page.waitForSelector('.modal-shell .tbl-batch');
    await shot(page, 'tab4');
    await checkNoPageOverflow(page, '1280 반 모달');

    // 금지어 검사: 메인(모달 닫힘) + 모달 두 개. 사용자 입력 영역은 제외.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    await scanBanned(page, '메인', 'body');
    await page.getByRole('button', { name: '학생 현행수준' }).click();
    await page.waitForSelector('.modal-shell');
    await page.waitForTimeout(120);
    await scanBanned(page, '학생 현행수준', '.modal-shell');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    await page.locator('.header-actions').getByRole('button', { name: '반 일괄 검사' }).click();
    await page.waitForSelector('.modal-shell');
    await page.waitForTimeout(120);
    await scanBanned(page, '반 일괄', '.modal-shell');
    await page.keyboard.press('Escape');
    await page.close();

    // ── 768px ──
    const page768 = await newPage(768, 900);
    await page768.getByRole('button', { name: '받아올림 덧셈' }).click();
    await page768.getByRole('button', { name: '개념 확인' }).click();
    await page768.getByRole('button', { name: /기준으로 검사/ }).click();
    await page768.waitForSelector('.result-card');
    await shot(page768, 'w768-main');
    await checkNoPageOverflow(page768, '768 메인');
    await page768.getByRole('button', { name: '학생 현행수준' }).click();
    await page768.waitForSelector('.modal-shell .tbl');
    await shot(page768, 'w768-students');
    await checkNoPageOverflow(page768, '768 학생 모달');
    await page768.close();

    // ── 390px ──
    const page390 = await newPage(390, 844);
    await shot(page390, 'w390-main');
    await checkNoPageOverflow(page390, '390 메인(빈 상태)');
    await page390.getByRole('button', { name: '받아올림 덧셈' }).click();
    await page390.getByRole('button', { name: '개념 확인' }).click();
    await page390.getByRole('button', { name: /기준으로 검사/ }).click();
    await page390.waitForSelector('.result-card');
    await shot(page390, 'w390-result');
    await checkNoPageOverflow(page390, '390 결과');
    await page390.getByRole('button', { name: '학생 현행수준' }).click();
    await page390.waitForSelector('.modal-shell .tbl');
    await shot(page390, 'w390-students');
    await checkNoPageOverflow(page390, '390 학생 모달');
    await page390.close();
  } catch (e) {
    problems.push(`스크립트 오류: ${e.message}`);
  }

  await browser.close();

  if (forbidden.length > 0) {
    console.log('금지어 발견:');
    for (const f of forbidden) console.log('  ' + f);
  } else {
    console.log('금지어 0건 (고정 UI 문구 기준, 사용자 입력 제외)');
  }
  console.log(problems.length === 0 ? '콘솔 에러/경고·레이아웃·포커스 문제 0건' : '문제:\n' + problems.join('\n'));
  const fail = forbidden.length > 0 || problems.length > 0;
  process.exit(fail ? 1 : 0);
})();
