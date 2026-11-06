# 웹 프로토타입 v0 스펙 — "인지적 정렬 검사기" 교사용 화면

작성 2026-11-06. 목적: 팀 내부 검토·중간 발표 데모. 백엔드 없음, 브라우저에서만 동작.

## 0. 꼭 지켜야 할 제품 원칙 (CLAUDE.md에서 발췌 — 위반하면 반려)

1. 시스템은 "좋은 문제"를 정의하지 않는다. **준비도 판정(COLLISION / ALIGNED / TOO_EASY)**만 한다.
2. **IEP를 진도표로 만들지 않는다.**
   - 학생별 진도율 %, 커버리지, 점수, 랭킹, 레벨 같은 진척 지표 **금지**.
   - outer fringe(지금 배울 수 있는 개념)는 **순서 없는 후보 집합**으로만 표시. "추천 1순위", "다음 단계" 같은 표현 금지. 우선순위는 교사가 고른다.
   - 충돌 판정은 경고이지 처방이 아니다. `suggested_next`는 충돌이 났을 때만, "이 갭을 먼저 메우면 됩니다" 톤으로.
3. AI는 이 프로토타입에 없다. LLM 호출 자리(문제 → 요구 노드 태깅)는 **"교사가 직접 선택"**으로 대체하고, UI에 "향후 AI 제안 + 교사 확인" 자리만 표시.
4. 학생은 익명 ID(학생 A, B…)만. 실명·학교명 입력란 없음.

## 1. 기술 스택

- Vite + React 18 + TypeScript. 상태 관리는 React 내장(useState/useReducer/Context)만.
- 그래프 시각화: `@xyflow/react`(React Flow v12) + `dagre` 또는 `@dagrejs/dagre`로 계층 레이아웃(왼쪽→오른쪽 또는 위→아래, DAG 위상 순).
- YAML 파싱: `js-yaml`. `graph/graph_v0.yaml`을 **빌드 시 JSON으로 변환**(`scripts/graph-to-json.mjs` → `src/data/graph_v0.json`)하고 앱은 JSON만 import. 원본 YAML은 단일 진실 원천(single source of truth)이므로 복사·수정하지 않는다.
- 테스트: `vitest`. 엔진 포팅 테스트 필수.
- 스타일: 단일 CSS 파일 또는 CSS Modules. Tailwind·UI 킷 금지(의존성 최소화). 
- 그 외 의존성 추가 금지. 번들은 `npm run build` 한 번으로 `dist/`에 생성되어야 하고, `dist/index.html`을 그대로 열어도 동작해야 한다(`base: './'`).

## 2. 엔진 포팅 `src/engine/`

Python `checker/engine.py`와 **동일 의미**로 TypeScript 포팅. 함수:

```ts
type State = 'mastered' | 'emerging' | 'not_started';
type Verdict = 'COLLISION' | 'ALIGNED' | 'TOO_EASY';
interface CheckResult { verdict: Verdict; requires: string[]; gapHard: string[]; gapSoft: string[]; suggestedNext: string[]; explanation: string; }

hardAncestors(graph, nodeIds): Set<string>      // R 자신 제외, R의 각 노드의 hard 조상 합집합
softDirectPrereqs(graph, nodeIds): Set<string>
outerFringe(graph, states): string[]            // mastered 아님 && hard 선수 모두 mastered. ID 정렬 (순서 의미 없음)
check(graph, states, requires): CheckResult
explain(graph, result): string                  // Python explain.py 템플릿과 같은 한국어 문장
```

규칙(Python 구현과 동일): emerging은 gap에 포함(mastered 아님). suggestedNext = gapHard ∩ outerFringe, 정렬은 (R까지 hard 최단거리, ID). gapHard/gapSoft는 ID 오름차순.

테스트 `src/engine/engine.test.ts`: Python `tests/test_engine.py`의 1~8번 케이스를 그대로 옮기고, 9번은 **graph_v0.json 전체**로 하향 폐쇄 합성 학생 100명을 만들어 불변식(문제 노드가 M ∪ fringe이면 COLLISION 0건, 아니면 항상 COLLISION) 검사. 추가로 `examples/real/student_A.yaml` × 문제 3개의 기대 결과(COLLISION gap=[N16,N17] suggested=[N16] / ALIGNED / TOO_EASY)를 고정 테스트로 둔다.

## 3. 화면 (탭 4개, 상단 탭 바)

공통 레이아웃: 상단에 앱 이름 "인지적 정렬 검사기 (프로토타입 v0)" + 탭. 좌측 또는 상단에 **현재 학생 선택** 드롭다운(모든 탭에서 공유). 반응형은 데스크톱 우선(최소 1024px), 태블릿에서 깨지지만 않으면 됨.

### 탭 1. 개념 그래프
- React Flow로 39노드 DAG. hard 엣지 실선, soft 엣지 점선. 노드 색: mastered=진한 색 채움, emerging=테두리만/연한 채움, not_started=회색. 범례 표시.
- 노드 클릭 → 우측 패널: label, description, level_hint, sources(교육과정 코드·쪽수·궤적 레벨명 목록), 선수 노드(hard/soft), 후속 노드. 현재 학생의 상태를 패널에서 3단계 토글로 바로 바꿀 수 있음.
- 상단 토글 "지금 도전 가능한 개념 강조": 켜면 outer fringe 노드에 테두리 하이라이트. **순서·번호 없음.**
- 그룹(A 수의 기초 / B 수 세기 / C 합성·분해 / D 덧셈·뺄셈 / E 자릿값 / F 곱셈)은 노드 ID 접두 번호 범위로 구분해 배경 밴드 또는 색상 힌트. (N01~04 / N05~13 / N14~17 / N18~27 / N28~36 / N37~39)

### 탭 2. 학생 현행수준
- 현재 학생의 39노드 상태를 그룹별 표로 보여주고 3단계 라디오/세그먼트로 편집.
- 프리셋 학생 3명 내장(합성 데이터, 파일 `src/data/students.ts`):
  - 학생 A: `examples/real/student_A.yaml` 그대로.
  - 학생 B: 수의 기초~10까지 세기 mastered, 가르기·모으기 5 이하 emerging, 나머지 not_started (기본교육과정 초1~2 수준).
  - 학생 C: N01~N25, N28~N33 mastered, N26·N27 emerging, 나머지 not_started 또는 적절히 (받아올림 직전).
- "학생 추가" 버튼: 새 익명 ID(학생 D…) 생성, 모두 not_started. 삭제 가능.
- 상태는 **localStorage에 저장**(try/catch, 없어도 동작). "프리셋으로 초기화" 버튼.
- 화면 하단에 작은 안내문: "현행수준은 IEP 문서에서 교사가 입력합니다. 향후: IEP 현행수준 문장에서 AI가 초안을 제안하고 교사가 확인."
- **진도율·완료율 표시 금지.** mastered 개수 세어서 "12/39" 같은 것도 금지.

### 탭 3. 문제 검사
- 입력: 문제 텍스트(textarea), 요구 개념(multi-select: 그룹별로 묶인 체크박스 또는 검색 가능한 리스트. 1개 이상), 표면 속성 4개(수 범위/문맥/표현/지원; 선택 입력, 저장만).
- 샘플 문제 3개 버튼(`examples/real/problem_*.yaml` 내용) — 클릭하면 입력 채움.
- "검사" 버튼 → 결과 카드:
  - 큰 판정 배지: COLLISION(경고색) / ALIGNED(긍정색) / TOO_EASY(중립색). 한국어 라벨: "선수 개념 미도달" / "지금 도전하기 적절" / "이미 숙달한 개념".
  - explanation 문장.
  - 갭 목록(hard: 강조, soft: 보조 표시), 각 항목에 label + 근거 성취기준 코드 1개.
  - COLLISION일 때만: "먼저 다룰 수 있는 개념" = suggestedNext (label). 여러 개면 가로 칩으로, 순위 표시 없음.
  - "그래프에서 보기" 버튼 → 탭 1로 이동하면서 요구 노드·갭 노드 하이라이트.
- 안내문: "요구 개념 태깅은 현재 교사가 직접 선택합니다. 향후 AI가 초안을 제안하고 교사가 확인하는 방식."

### 탭 4. 학급 일괄 검사
- 탭 3의 현재 문제(없으면 샘플 1번)를 모든 학생에게 적용한 표: 행=학생, 열=판정 배지 / 갭(hard) 라벨 / 먼저 다룰 수 있는 개념.
- 표 위에 요약 문장 한 줄: "이 문제는 학생 3명 중 1명에게 선수 개념 충돌이 있습니다." (숫자는 세어도 되지만 **학생별 점수·순위는 금지**.)
- 행 클릭 → 그 학생으로 전환하고 탭 3 결과 보기.

## 4. 디자인 톤

- 교사가 수업 사이에 1~2분 보는 도구. 차분하고 밀도 있는 업무용 UI. 장식 없음.
- 색: 중립 회색 바탕 + 판정 3색(경고=주황/적색 계열, 적절=청록/초록, 숙달=회청색). 색만으로 의미 전달 금지 — 항상 텍스트 라벨 동반.
- 한국어 UI. 폰트는 시스템 폰트 스택(`-apple-system, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif`). 웹폰트 로드 금지(오프라인 데모).
- 다크모드 불필요.

## 5. 산출물 위치와 검수 기준

- 위치: `/home/claude/work/project2/web/` (package.json, vite.config.ts, src/, scripts/, README.md)
- `npm install && npm run graph:json && npm test && npm run build` 가 모두 성공해야 한다.
- `npm run graph:json`은 `../graph/graph_v0.yaml` → `src/data/graph_v0.json`. 생성된 JSON은 커밋 대상(앱이 YAML 없이도 빌드되도록).
- README.md: 실행 방법, 화면 설명, 엔진 포팅 주의점, "하지 않은 것".
- 검수자는 Playwright로 4개 탭 스크린샷을 찍어 확인한다. 콘솔 에러 0건이어야 한다.
- 접근성 최소: 모든 버튼에 텍스트, 색 대비 4.5:1, 키보드로 탭 전환 가능.

## 6. 하지 않을 것

LLM 호출, 로그인, 서버, DB, 변이 검사, 진척 지표, 학생 실명, 라우터 라이브러리(탭은 상태로), 애니메이션 라이브러리.
