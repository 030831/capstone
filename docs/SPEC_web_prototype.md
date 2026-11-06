# 웹 프로토타입 v1 스펙 — "인지적 정렬 검사기" 교사용 화면

작성 2026-11-06 (v0로부터 동일일 재설계). 목적: 팀 내부 검토·중간 발표 데모. 백엔드 없음, 브라우저에서만 동작.

## 0. v0 → v1 변경 사유 (ComfyUI 오해)

v0는 상단 탭 4개(개념 그래프 / 학생 현행수준 / 문제 검사 / 학급 일괄 검사) 구조였고, **들어오자마자 React Flow + dagre 노드 그래프가 첫 화면**이었다. 사용자가 이전 AI에게 "ComfyUI를 예시로" 언급한 것이 "ComfyUI 형태 노드 그래프를 메인으로 만들라"로 해석된 결과다. 교사가 수업 사이 1~2분에 보는 도구가 노드 에디터가 돼버려 본질을 잃었다.

v1은:
- **상단 탭 제거.** 단일 메인 페이지(문제 검사 위저드)만 남긴다.
- **그래프 뷰 완전 제거.** `@xyflow/react`·`@dagrejs/dagre` 의존성 삭제, `GraphTab.tsx`·`NodePanel.tsx` 삭제.
- **선수관계는 검사 결과 내 인라인 텍스트 트리로.** "그래프에서 보기" 버튼(탭 1 이동) 대신, 결과 카드 안에서 요구 개념 R의 hard 조상을 노드 번호순으로 나열해 보여준다.
- **학생 현행수준·학급 일괄 검사는 헤더 버튼으로 여는 모달.** 메인 흐름을 방해하지 않으면서 필요할 때만 꺼내 본다.

## 1. 꼭 지켜야 할 제품 원칙 (CLAUDE.md에서 발췌 — 위반하면 반려)

1. 시스템은 "좋은 문제"를 정의하지 않는다. **준비도 판정(COLLISION / ALIGNED / TOO_EASY)**만 한다.
2. **IEP를 진도표로 만들지 않는다.**
   - 학생별 진도율 %, 커버리지, 점수, 랭킹, 레벨 같은 진척 지표 **금지**.
   - outer fringe(지금 배울 수 있는 개념)는 **순서 없는 후보 집합**으로만 표시. "추천 1순위", "다음 단계" 같은 표현 금지. 우선순위는 교사가 고른다.
   - 충돌 판정은 경고이지 처방이 아니다. `suggested_next`는 충돌이 났을 때만, "이 갭을 먼저 메우면 됩니다" 톤으로.
3. AI는 이 프로토타입에 없다. LLM 호출 자리(문제 → 요구 노드 태깅)는 **"교사가 직접 선택"**으로 대체하고, UI에 "향후 AI 제안 + 교사 확인" 자리만 표시.
4. 학생은 익명 ID(학생 A, B…)만. 실명·학교명 입력란 없음.

## 2. 기술 스택

- Vite + React 18 + TypeScript. 상태 관리는 React 내장(useReducer)만.
- **그래프 시각화 라이브러리 없음.** v0의 `@xyflow/react`·`@dagrejs/dagre`는 v1에서 제거됨. 선수관계는 텍스트 트리로 표시.
- YAML 파싱: `js-yaml`. `graph/graph_v0.yaml`을 **빌드 시 JSON으로 변환**(`scripts/graph-to-json.mjs` → `src/data/graph_v0.json`)하고 앱은 JSON만 import. 원본 YAML은 단일 진실 원천.
- 테스트: `vitest`. 엔진 포팅 테스트 필수.
- 스타일: 단일 CSS 파일. Tailwind·UI 킷 금지(의존성 최소화).
- 그 외 의존성 추가 금지. 번들은 `npm run build` 한 번으로 `dist/`에 생성되어야 하고, `dist/index.html`을 그대로 열어도 동작해야 한다(`base: './'`).

## 3. 엔진 포팅 `src/engine/`

Python `checker/engine.py`와 **동일 의미**로 TypeScript 포팅. v0와 동일. 함수:

```ts
type State = 'mastered' | 'emerging' | 'not_started';
type Verdict = 'COLLISION' | 'ALIGNED' | 'TOO_EASY';
interface CheckResult { verdict: Verdict; requires: string[]; gapHard: string[]; gapSoft: string[]; suggestedNext: string[]; explanation: string; }

hardAncestors(graph, nodeIds): Set<string>
softDirectPrereqs(graph, nodeIds): Set<string>
outerFringe(graph, states): string[]
check(graph, states, requires): CheckResult
explain(graph, result): string
```

규칙(Python 구현과 동일): emerging은 gap에 포함(mastered 아님). suggestedNext = gapHard ∩ outerFringe, 정렬은 (R까지 hard 최단거리, ID). gapHard/gapSoft는 ID 오름차순.

테스트 `src/engine/engine.test.ts`: v0와 동일 (Python 1~8 + 9번 합성 학생 불변식 + 학생 A × 문제 3개 고정 결과).

## 4. 화면 (단일 메인 + 2 모달)

### 공통 레이아웃

상단 헤더: 앱 이름("인지적 정렬 검사기" + 한 줄 부제) · 보는 학생 선택(pill 6개 이하, 그 이상은 셀렉트) · 헤더 보조 버튼 2개("학생 현행수준", "반 일괄 검사"). 메인 영역은 항상 문제 검사 위저드. 모달은 헤더 버튼으로 열고 Esc 또는 "닫기 ✕"으로 닫음.

### 메인: 문제 검사 위저드 (좌우 2단 카드)

**왼쪽 카드 — 문제 입력:**
- 예시로 채우기 버튼 3개(샘플 1: 5 이내 덧셈 / 샘플 2: 받아올림 덧셈 / 샘플 3: 10 가르기).
- 문제 textarea.
- "이 문제를 풀려면 필요한 개념" fieldset: 선택한 개념 칩(× 제거), 개념 검색 input, 그룹별 체크박스 피커(A~F, 39개). 안내문 "지금은 교사가 직접 고릅니다. 앞으로는 문제 글을 읽고 초안을 제안하되, 확정은 교사가 합니다."
- 표면 속성 details(수 범위/문맥/표현/지원; 저장만, 판정에 안 씀).
- "{학생 이름} 기준으로 검사" 주 버튼. 입력 바뀌면 "다시 검사하세요" 안내.

**오른쪽 카드 — 검사 결과:**
- 결과 헤더: "검사 결과" 제목 + 결과 내에서 학생 전환 셀렉트.
- 빈 상태: "문제와 필요한 개념을 넣고 검사를 누르면…" 안내문.
- 결과 카드(verdict별 테두리·배경색):
  - 큰 판정 배지 + 한국어 라벨 + 영문 코드.
  - 의미 문장 1줄(verdict별).
  - 문제 글(회색 박스).
  - 필요한 개념 칩들.
  - explanation 문장.
  - **"학습 계보 보기/숨기기" 토글** — 펼치면 인라인 텍스트 트리(아래 §5).
  - 아직 숙달 못 한 필수 선수 개념(gapHard) — 칩 대신 **갭 카드** 목록(라벨·상태·직전 선수 요약·근거 코드).
  - 권장 선수 미도달(gapSoft) — 칩.
  - COLLISION일 때만: "지금 바로 다룰 수 있는 선수 개념" = suggestedNext 칩(순서 없는 후보 안내문 포함).
  - "반 전체에 적용해 보기" 버튼 → 반 일괄 모달 열기.

### 모달 1: 학생 현행수준

헤더 버튼 "학생 현행수준"으로 열기. 모달 헤드에 "{학생 이름}의 현행수준" 제목 + 학생 추가/삭제/예시 초기화 버튼. 본문은 v0와 같은 그룹별 표(A~F, 39개). 상태 3택 세그먼트(숙달/형성 중/미시작). "선수까지 숙달" 빠른 입력 버튼. 불일치 경고(숙달 표시했는데 선수가 미숙달). localStorage 저장(try/catch). 진도율·개수 집계 없음.

### 모달 2: 반 일괄 검사

헤더 버튼 "반 일괄 검사"로 열기. 메인에 입력한 문제(없으면 샘플 2번)를 모든 학생에게 적용한 표: 행=학생, 열=판정 배지 / gapHard 라벨 / suggestedNext 라벨. 행 클릭 → 그 학생으로 전환 + 메인에서 자세한 결과(모달 자동 닫힘). 표 위 요약 한 줄("학생 N명 중 M명에게 선수 개념 충돌이 있습니다" — 학생 간 비교·순위 아님).

### 상태 관리 (`src/state.ts`)

```ts
type ModalKey = 'none' | 'students' | 'batch';
interface AppState {
  students: Student[];
  currentId: string;
  draft: Draft;
  submitted: { text: string; requires: string[] } | null;
  modal: ModalKey;
}
```

v0에서 제거됨: `tab`, `highlight`, `selectedNode`, `focusRequest`, `showFringe`. 액션도 `setTab`·`focusNode`·`showInGraph`·`clearHighlight`·`toggleFringe`·`selectNode` 제거, `openModal`·`closeModal` 추가.

## 5. 인라인 학습 계보 (ComfyUI 그래프 뷰를 대체하는 텍스트 트리)

검사 결과 카드 안의 "학습 계보 보기" 토글로 펼침. 요구 개념 R(들)의 hard 조상 합집합 + R 자신을 **노드 번호순으로 정렬**해 세로 리스트로 보여준다.

각 항목:
- 마커(◆=요구 / ✓=숙달 / △=형성 중 / ✗=미시작)
- 개념 라벨
- 상태 텍스트(숙달/형성 중/미시작)
- 태그(요청=파랑 / 갭=주황) — verdict가 COLLISION일 때만 갭 태그 표시
- 근거 성취기준 코드 1개

줄 배경: mastered=흰색, emerging=연노랑, not_started+갭=연주황. 요구 개념 줄은 파란 배경+왼쪽 파란 띠.

**왜 이게 그래프보다 나은가:** 교사는 "이 문제가 요구하는 개념까지 가는 길에 뭐가 있고, 그중 뭐가 빠졌는지"를 1차원으로 보고 싶어 한다. DAG를 2차원 캔버스에 펼치면 39개 노드와 72개 엣지가 시각 잡음이 되고, 교사가 찾는 "내 학생의 상태"는 노드 색으로만 인코딩돼 시각적 탐색 비용이 크다. 번호순 세로 리스트는 (a) 익숙한 서술 형식, (b) 상태를 색+마커+텍스트 3중으로 인코딩, (c) 인쇄 가능, (d) 스크린 리더 호환, (e) 의존성 0.

## 6. 디자인 톤

- 교사가 수업 사이에 1~2분 보는 도구. 차분하고 밀도 있는 업무용 UI. 장식 없음.
- 색: 중립 회색 바탕 + 판정 3색(경고=주황/적색 계열, 적절=청록/초록, 숙달=회청색). 색만으로 의미 전달 금지 — 항상 텍스트 라벨 동반.
- 한국어 UI. 폰트는 시스템 폰트 스택(`-apple-system, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif`). 웹폰트 로드 금지(오프라인 데모).
- 다크모드 불필요.

## 7. 산출물 위치와 검수 기준

- 위치: `web/` (package.json, vite.config.ts, src/, scripts/, README.md)
- `npm install && npm run graph:json && npm test && npm run build` 가 모두 성공해야 한다.
- `npm run graph:json`은 `../graph/graph_v0.yaml` → `src/data/graph_v0.json`. 생성된 JSON은 커밋 대상.
- README.md: 실행 방법, 화면 설명, 엔진 포팅 주의점, "하지 않은 것", ComfyUI 오해 사유.
- 검수자는 Playwright로 4장 스크린샷을 찍어 확인한다(`scripts/screenshots.cjs`). 콘솔 에러 0건, 금지어 0건이어야 한다.
- 접근성 최소: 모든 버튼에 텍스트, 색 대비 4.5:1, 키보드로 모달 닫기(Esc), 포커스 트랩은 최소(차기 작업).

## 8. 하지 않을 것

LLM 호출, 로그인, 서버, DB, 변이 검사, 진척 지표, 학생 실명, 라우터 라이브러리(모달은 상태로), 애니메이션 라이브러리, **그래프 시각화 라이브러리(react-flow·cytoscape·d3 등)**.
