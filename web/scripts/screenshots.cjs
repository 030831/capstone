// 빌드 결과(dist/index.html)를 file:// 로 열어 4개 탭 스크린샷을 찍고 콘솔 에러를 검사한다.
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
  await page.waitForSelector('.react-flow__node');
  const nodeCount = await page.locator('.react-flow__node').count();
  const edgeCount = await page.locator('.react-flow__edge').count();
  console.log(`React Flow 노드 ${nodeCount}, 엣지 ${edgeCount}`);

  const shot = (n) => page.screenshot({ path: path.resolve(__dirname, `../screenshots/tab${n}.png`) });

  // 탭 1: 검색으로 노드 선택(화면 이동 포함)
  await page.getByLabel('개념 찾기').fill('받아올림');
  await page.getByRole('option', { name: /받아올림 있는 \(몇\)/ }).click();
  await page.waitForTimeout(600);
  await shot(1);

  // 탭 2
  await page.getByRole('tab', { name: '학생 현행수준' }).click();
  await page.waitForSelector('.tbl');
  await shot(2);

  // 탭 3: 샘플 2 로 채우고 검사
  await page.getByRole('tab', { name: '문제 검사' }).click();
  await page.getByRole('button', { name: '받아올림 덧셈' }).click();
  await page.getByRole('button', { name: /기준으로 검사/ }).click();
  await page.waitForSelector('.result-card');
  await shot(3);

  // 탭 4
  await page.getByRole('tab', { name: '학급 일괄 검사' }).click();
  await page.waitForSelector('.tbl-batch');
  await shot(4);

  // 추가 검증: 탭 3 -> 그래프에서 보기 -> 강조 노드 존재
  await page.getByRole('tab', { name: '문제 검사' }).click();
  await page.getByRole('button', { name: '그래프에서 보기', exact: true }).click();
  await page.waitForSelector('.cnode-gapHard');
  console.log('그래프 강조 노드: 요구 ' + await page.locator('.cnode-req').count() + ', 선수 미도달 ' + await page.locator('.cnode-gapHard').count());

  // UI 전체 텍스트에서 금지어 검사(탭별)
  const banned = ['진도율', '완료율', '%', '점수', '랭킹', '레벨', '다음 단계', '1순위', '추천 순서', /\d+\s*\/\s*39/];
  const texts = {};
  for (const [name, tab] of [['그래프', '개념 그래프'], ['학생', '학생 현행수준'], ['검사', '문제 검사'], ['일괄', '학급 일괄 검사']]) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(150);
    texts[name] = await page.locator('body').innerText();
  }
  // 노드 선택 패널(근거 원문 포함)도 별도 수집 — 검색으로 하나씩 선택(화면 이동과 무관)
  await page.getByRole('tab', { name: '개념 그래프' }).click();
  const ids = await page.evaluate(() => Array.from(document.querySelectorAll('.react-flow__node')).map((n) => n.getAttribute('data-id')));
  let panelText = '';
  for (const id of ids) {
    await page.getByLabel('개념 찾기').fill(id);
    await page.getByRole('option').first().click();
    await page.waitForTimeout(30);
    panelText += '\n' + await page.locator('.panel').innerText();
  }
  texts['패널(39노드)'] = panelText;
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
