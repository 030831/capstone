# 인지적 정렬 검사기 (프로토타입 v0) — 웹

팀 내부 검토·중간 발표 데모용. 백엔드·로그인·LLM 없이 브라우저에서만 동작한다.
개념 그래프(`../graph/graph_v0.yaml`, 39노드/72엣지) 위에서 "이 문제가 이 학생에게 준비된 문제인가"를 판정한다(COLLISION / ALIGNED / TOO_EASY).

## 실행

```bash
cd web
npm install
npm run graph:json   # ../graph/graph_v0.yaml -> src/data/graph_v0.json (YAML 은 수정·복사하지 않음)
npm test             # 엔진 테스트 (vitest)
npm run build        # tsc 타입 검사 + dist/ 생성
npm run dev          # 개발 서버
```

`dist/index.html` 은 `file://` 로 그대로 열어도 동작한다. Chrome 이 file:// 에서 `type="module"` 스크립트를 막기 때문에
`vite.config.ts` 의 작은 플러그인이 번들을 IIFE 단일 파일로 내고 HTML 의 `type="module"`/`crossorigin` 을 제거한다.
스크린샷 재생성: `NODE_PATH=$(npm root -g) node scripts/screenshots.cjs` (playwright 는 전역 설치 사용, 콘솔 에러 검사·금지어 검사 포함).

## 화면

1. **개념 그래프** — React Flow + dagre(왼쪽→오른쪽). 실선=필수(hard), 점선=권장(soft). 노드는 상태를 색과 텍스트(숙달/형성 중/미시작)로 표시, 왼쪽 띠 색은 6개 그룹. "지금 도전 가능한 개념 강조"는 순서 없는 후보 집합만 테두리로 표시한다. 노드 클릭 시 우측 패널(설명·교육과정 위치·근거·선수/후속·현재 학생 상태 편집).
2. **학생 현행수준** — 그룹별 표에서 3택 편집. 프리셋 A/B/C, 학생 추가/삭제, 프리셋 초기화, localStorage 저장(try/catch). 진도율·개수 집계 없음.
3. **문제 검사** — 문제 텍스트, 요구 개념(검색 가능한 그룹별 체크박스), 표면 속성 4개(저장만), 샘플 3개. 결과: 판정 배지, 설명 문장, 갭(필수/권장, 근거 성취기준 코드 1개), 충돌 시에만 "먼저 다룰 수 있는 개념"(순위 없는 칩), "그래프에서 보기".
4. **학급 일괄 검사** — 같은 문제를 모든 학생에게 적용. 행 순서는 학생 목록 순서(판정 정렬 없음). 행 클릭 시 해당 학생으로 전환해 탭 3 결과 표시.

탭 이동·하이라이트 전달은 `src/state.ts` 의 useReducer 하나로 처리한다.

## 엔진 포팅 시 주의점 (`src/engine/`)

- Python `checker/engine.py`, `explain.py` 와 같은 의미. 설명 문장 템플릿과 조사(josa) 로직도 동일하며 테스트로 고정했다.
- `explain(graph, result)` 시그니처를 맞추기 위해 `CheckResult` 에 `unmasteredRequires` 필드를 추가했다(Python 에서는 `check()` 안에서 계산해 explain 에 넘기던 값).
- `outerFringe` 는 스펙대로 ID 정렬(Python 은 정의 순서; 이 그래프에서는 동일). 순서에 의미 없음.
- `suggestedNext` 정렬: (R 까지 hard 최단거리, ID). R 자신이 다른 R 의 조상인 경우 거리 0.
- emerging 은 gap 에 포함(mastered 가 아님).
- 테스트 9번은 Python 테스트 docstring 과 같이 "문제 노드가 M ∪ fringe 이면 COLLISION 0건, 아니면 항상 COLLISION" 로 검증(스펙 원문의 '0건'은 도달 불가 노드에서 성립하지 않음). 합성 학생은 TS 로 재구현(난수열은 Python 과 다름).
- 단위 테스트의 그래프 fixture 는 `../tests/fixtures/*.yaml`, 학생 A/문제는 `../examples/real/*.yaml` 을 직접 읽어 `src/data` 와 일치하는지 검사한다.

## 하지 않은 것

LLM 호출, 로그인, 서버, DB, 변이 검사, 진척 지표(진도율·점수·랭킹·레벨), 학생 실명 입력, 라우터, 애니메이션 라이브러리, 다크모드, 모바일 대응. 요구 개념은 교사가 직접 선택하며 AI 제안은 안내문 자리만 있다.

## 스크린샷 (1280×800)

- [탭 1 개념 그래프](screenshots/tab1.png)
- [탭 2 학생 현행수준](screenshots/tab2.png)
- [탭 3 문제 검사](screenshots/tab3.png)
- [탭 4 학급 일괄 검사](screenshots/tab4.png)
