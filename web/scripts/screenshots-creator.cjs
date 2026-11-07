// 학습지 제작 도구 브라우저 검증 (지시서 §13·§17).
//  ① 첫 화면·편집 화면·학습지 화면의 고정 UI 문구에서 금지어 검사(사용자 입력 제외)
//  ② 실제 편집 동작 확인: 문제 생성 → 개수 변경 → 질문 수정 → 응답 방식 변경
//  ③ 학생용 학습지에 교사 정보(정답·IEP·메모·편집 UI)가 없는지 DOM 검사
//  ④ 인쇄 미디어 에뮬레이션으로 A4 시트 확인
//  ⑤ 1280/768/390 세 폭에서 페이지 전체 가로 스크롤·콘솔 오류 검사
// playwright 는 전역 설치를 사용한다(devDependency 로 추가하지 않음).
const { chromium } = require('playwright');
const path = require('path');

// 기본 화면에서 쓰면 안 되는 표현(지시서 §13: 검사기 개념·진도·판정 표시).
// 사용자가 직접 입력하는 값은 [data-user-content] 로 구분해 제외한다.
const BANNED = [
  '선수관계', '선수 개념', '개념 확정', '그래프', '노드', 'DAG', 'hard', 'soft',
  'COLLISION', 'ALIGNED', 'TOO_EASY', 'NEEDS_REVIEW', '숙달', '현행수준',
  '진도율', '완료율', '점수', '랭킹', '레벨', '다음 단계', '1순위', '추천 순서',
  '인지적 정렬', '판정', '검사 결과',
];

// 학생용 학습지(sheet)에는 절대 나오면 안 되는 교사 정보.
const SHEET_BANNED = ['정답', 'IEP', '메모', '교사용', '실행 취소', '설정', 'prob_', '저장'];

(async () => {
  const browser = await chromium.launch();
  const url = 'file://' + path.resolve(__dirname, '../dist/index.html');
  const problems = [];
  const forbidden = [];

  const newPage = async (w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
    await page.goto(url);
    await page.waitForSelector('.creator-root');
    return page;
  };

  const scanBanned = async (page, name, scopeSel, list) => {
    const text = await page.evaluate((sel) => {
      const root = document.querySelector(sel) ?? document.body;
      const clone = root.cloneNode(true);
      clone.querySelectorAll('[data-user-content]').forEach((el) => el.remove());
      return (clone.textContent || '').trim();
    }, scopeSel);
    for (const b of list) {
      if (text.includes(b)) {
        const idx = text.indexOf(b);
        forbidden.push(`[${name}] ${b}: ...${text.slice(Math.max(0, idx - 25), idx + 25).replace(/\n/g, ' ')}...`);
      }
    }
  };

  const checkNoPageOverflow = async (page, name) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 2) problems.push(`[${name}] 페이지 전체 가로 스크롤 ${overflow}px`);
  };

  const shot = (page, n) => page.screenshot({ path: path.resolve(__dirname, `../screenshots/${n}.png`) });

  // ── 1. 첫 화면(빈 상태) ──
  const page = await newPage(1280, 800);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.works-screen');
  await scanBanned(page, '첫 화면', '.works-screen', BANNED);
  await checkNoPageOverflow(page, '첫 화면');
  await shot(page, 'creator-1-works');
  // 하단 검사기 링크는 '미니어' 링크여야 한다 — 주요 동작 자리에 있으면 안 됨.
  const heroButtons = await page.$$eval('.hero-actions .btn', (els) => els.map((e) => e.textContent.trim()));
  if (!heroButtons.includes('새 문제 만들기')) problems.push('첫 화면 주요 버튼이 새 문제 만들기가 아님');

  // ── 2. 새 작업 → 그림 수 세기 시작 예시 ──
  await page.click('.hero-actions .btn-primary'); // 새 문제 만들기
  await page.waitForSelector('.ed');
  await page.click('.kind-card >> nth=0'); // 그림 수 세기
  await page.waitForSelector('.problem-card');
  const svg0 = await page.$$eval('.ed-center .pic-group svg', (els) => els.length);
  if (svg0 !== 4) problems.push(`시작 예시 그림 개수가 4가 아님: ${svg0}`);

  // 요소 선택 → 그림 개수 7
  await page.click('[data-element="pictures"]');
  await page.fill('input[aria-label="그림 개수"]', '7');
  await page.waitForTimeout(150);
  const svg1 = await page.$$eval('.ed-center .pic-group svg', (els) => els.length);
  if (svg1 !== 7) problems.push(`그림 개수 변경 후 7이 아님: ${svg1}`);

  // 질문 문장 직접 편집
  await page.fill('textarea[aria-label="질문 문장"]', '사과는 모두 몇 개인가요?');

  // 응답 방식 → 선택지
  await page.click('[data-element="response"]');
  await page.click('.seg [role="radio"]:has-text("골라 보기")');
  await page.waitForSelector('.ed-center .choices');
  const choiceTexts = await page.$$eval('.ed-center .choices .choice-text', (els) => els.map((e) => e.textContent.trim()));
  if (!choiceTexts.includes('7')) problems.push(`선택지 기본값에 정답 7이 없음: ${choiceTexts.join(',')}`);

  await scanBanned(page, '편집 화면', '.ed', BANNED);
  await checkNoPageOverflow(page, '편집 화면 1280');
  await shot(page, 'creator-2-edit-count');

  // ── 3. 나머지 형태 추가 ──
  for (const idx of [1, 2, 3]) {
    await page.click('.ed-top .btn-primary'); // + 문제 추가
    await page.waitForSelector('.modal-shell');
    await page.click(`.modal-shell .kind-card >> nth=${idx}`);
    await page.waitForTimeout(120);
  }
  await shot(page, 'creator-3-edit-many');
  const rows = await page.$$eval('.prob-list .prob-row', (els) => els.length);
  if (rows !== 4) problems.push(`문제 목록이 4개가 아님: ${rows}`);

  // ── 4. 학생 추가 → 학생별 버전 → 독립 편집 ──
  await page.click('button:has-text("+ 학생 추가")');
  await page.waitForSelector('.modal-shell');
  await page.fill('input[aria-label="익명 표시 이름"]', '학생 A');
  await page.fill('textarea[aria-label="IEP 목표"]', '10까지 수 세기 참여');
  await page.click('.modal-shell .btn-confirm'); // 추가
  await page.waitForTimeout(120);
  await page.click('.ed-actions .btn:has-text("학생별 버전 만들기")');
  await page.waitForSelector('.modal-shell');
  await page.click('.modal-shell .btn:has-text("버전 만들기")');
  await page.waitForTimeout(150);
  // 학생 버전에서 첫 문제 개수를 5로 바꾼다
  await page.click('.prob-list .prob-open >> nth=0');
  await page.click('[data-element="pictures"]');
  await page.fill('input[aria-label="그림 개수"]', '5');
  await page.waitForTimeout(150);
  const studentSvg = await page.$$eval('.ed-center .pic-group svg', (els) => els.length);
  if (studentSvg !== 5) problems.push(`학생 버전 편집이 반영 안 됨: ${studentSvg}`);
  // 공통으로 전환 — 여전히 7
  await page.click('.version-list .version-btn >> nth=0'); // 공통 문제
  await page.waitForTimeout(150);
  await page.click('.prob-list .prob-open >> nth=0');
  await page.waitForTimeout(150);
  const commonSvg = await page.$$eval('.ed-center .pic-group svg', (els) => els.length);
  if (commonSvg !== 7) problems.push(`공통 버전이 학생 편집에 영향받음: ${commonSvg}`);
  await shot(page, 'creator-4-version');

  // ── 5. 학습지 미리 보기(학생용) ──
  // 공통 상태에서 학습지 보기 — 학생 A 버전으로 전환해 확인
  await page.click('.ed-actions .btn:has-text("학습지 보기")');
  await page.waitForSelector('.ws');
  const sheetVersionBtns = await page.$$eval('.version-switch .version-btn', (els) => els.map((e) => e.textContent.trim()));
  const aBtn = sheetVersionBtns.findIndex((t) => t.includes('학생 A'));
  if (aBtn < 0) problems.push('학습지 버전 선택에 학생 A 가 없음');
  else await page.click(`.version-switch .version-btn >> nth=${aBtn}`);
  await page.waitForTimeout(150);
  await scanBanned(page, '학생용 학습지', '.sheet', SHEET_BANNED);
  const hasTextarea = await page.$('.sheet textarea');
  if (hasTextarea) problems.push('학생용 학습지에 편집 textarea 가 있음');
  const nameLine = await page.textContent('.sheet-name-line');
  if (!nameLine.includes('학생 A')) problems.push(`학습지 이름줄에 학생 표시가 없음: ${nameLine}`);
  await shot(page, 'creator-5-worksheet-student');
  await checkNoPageOverflow(page, '학습지 화면');

  // 교사용 정답 보기
  await page.click('label:has-text("교사용 정답 보기")');
  await page.waitForTimeout(120);
  const answerCount = await page.$$eval('.sheet .teacher-answer', (els) => els.length);
  if (answerCount !== 4) problems.push(`교사용 정답 표시가 문제 수만큼 없음: ${answerCount}`);
  await shot(page, 'creator-6-worksheet-teacher');

  // ── 6. 인쇄 미디어 에뮬레이션 (A4 시트만 보이는지) ──
  await page.emulateMedia({ media: 'print' });
  await shot(page, 'creator-7-print');
  await page.emulateMedia({ media: 'screen' });

  // ── 7. 모달 포커스 트랩 ──
  await page.click('.ws-top .btn-quiet'); // ← 편집으로
  await page.waitForSelector('.ed');
  await page.click('.ed-top .btn-primary'); // + 문제 추가 (모달)
  await page.waitForSelector('.modal-shell');
  const trapOk = await page.evaluate(() => {
    const shell = document.querySelector('.modal-shell');
    if (!shell) return false;
    const focusables = Array.from(shell.querySelectorAll('button')).filter((b) => !b.disabled);
    if (focusables.length === 0) return false;
    focusables[0].focus();
    return document.activeElement === focusables[0];
  });
  if (!trapOk) problems.push('모달 열릴 때 포커스가 모달 안으로 이동하지 않음');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  const modalGone = await page.$('.modal-shell');
  if (modalGone) problems.push('Esc 로 모달이 닫히지 않음');

  // ── 8. 반응형 390/768 ──
  for (const [w, h] of [[768, 900], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(200);
    await checkNoPageOverflow(page, `편집 화면 ${w}`);
    if (w === 390) await shot(page, 'creator-8-w390');
  }
  await page.setViewportSize({ width: 1280, height: 800 });

  // ── 9. 새로고침 복원 (지시서 §12: 저장·복원) ──
  await page.reload();
  await page.waitForSelector('.creator-root');
  await page.click('.work-row .work-open'); // 저장한 작업 다시 열기
  await page.waitForSelector('.ed');
  const restored = await page.$$eval('.prob-list .prob-row', (els) => els.length);
  if (restored !== 4) problems.push(`새로고침 후 문제 4개가 복원되지 않음: ${restored}`);

  await browser.close();

  if (forbidden.length > 0) {
    console.error('금지어 발견:');
    for (const f of forbidden) console.error('  ' + f);
  }
  if (problems.length > 0) {
    console.error('문제 발견:');
    for (const p of problems) console.error('  ' + p);
  }
  console.log(`금지어 ${forbidden.length}건 (첫 화면·편집·학생용 학습지 기준, 사용자 입력 제외)`);
  console.log(`콘솔 에러/경고·레이아웃·동작 문제 ${problems.length}건`);
  process.exit(forbidden.length > 0 || problems.length > 0 ? 1 : 0);
})();
