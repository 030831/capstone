# 인지적 정렬 검사기 (프로토타입 v1) — 웹

팀 내부 검토·중간 발표 데모용. 백엔드·로그인·LLM 없이 브라우저에서만 동작한다.
개념 그래프(`../graph/graph_v0.yaml`, 39노드/72엣지) 위에서 "이 문제가 이 학생에게 준비된 문제인가"를 판정한다(COLLISION / ALIGNED / TOO_EASY).

## v0 → v1 변경 (ComfyUI 오해 수정)

v0는 상단 탭 4개 구조였고 첫 화면이 React Flow + dagre 노드 그래프(ComfyUI 형태)였다. 교사가 수업 사이 1~2분 보는 도구가 노드 에디터가 돼버린 문제. v1은:

- **탭 제거, 단일 메인 페이지**(문제 검사 위저드) + 헤더 버튼 2개로 여는 모달(학생 현행수준·반 일괄 검사).
- **`@xyflow/react`·`@dagrejs/dagre` 의존성 제거**, `GraphTab.tsx`·`NodePanel.tsx` 삭제.
- **"그래프에서 보기" 버튼 제거**, 검사 결과 내 인라인 텍스트 트리(학습 계보)로 선수관계 표시.

배경은 `docs/SPEC_web_prototype.md` §0와 `CLAUDE.md` "웹 UI 재설계 v1" 절 참조.

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

1. **메인(초기)** — 문제 입력 카드(왼쪽) + 빈 검사 결과 카드(오른쪽). 샘플 버튼 3개, 문제 textarea, 그룹별 개념 피커.
2. **메인(검사 후)** — 검사 버튼을 누르면 결과 카드에 판정 배지·의미 문장·설명·갭 카드·"지금 바로 다룰 수 있는 선수 개념" 칩·"학습 계보 보기" 토글이 나온다. 계보를 펼치면 요구 개념의 hard 조상을 번호순 세로 리스트로 보여주고, 각 항목에 상태(숙달/형성 중/미시작)·갭·요구 태그·근거 코드를 단다.
3. **학생 현행수준 모달** — 헤더 "학생 현행수준" 버튼으로 열기. 현재 학생의 39개 개념 상태를 그룹별 표로 3단계 세그먼트로 편집. 학생 추가/삭제/예시 초기화. localStorage 저장(try/catch). 진도율·개수 집계 없음.
4. **반 일괄 검사 모달** — 헤더 "반 일괄 검사" 버튼으로 열기. 같은 문제를 반 전체에 적용한 표. 행 순서는 학생 목록 순서(판정 정렬 없음). 행 클릭 시 해당 학생으로 전환해 메인에서 자세한 결과(모달 자동 닫힘).

탭→모달 전환·결과 하이라이트는 필요 없어졌고(useReducer 하나로 `modal: 'none' | 'students' | 'batch'` 상태만 관리), 결과 내용은 `CheckTab` 안에서 `submitted`와 `student.states`로 바로 계산한다.

## 엔진 포팅 시 주의점 (`src/engine/`)

- Python `checker/engine.py`, `explain.py` 와 같은 의미. 설명 문장 템플릿과 조사(josa) 로직도 동일하며 테스트로 고정했다. **v0에서 변경 없음.**
- `explain(graph, result)` 시그니처를 맞추기 위해 `CheckResult` 에 `unmasteredRequires` 필드를 추가했다(Python 에서는 `check()` 안에서 계산해 explain 에 넘기던 값).
- `outerFringe` 는 스펙대로 ID 정렬(Python 은 정의 순서; 이 그래프에서는 동일). 순서에 의미 없음.
- `suggestedNext` 정렬: (R 까지 hard 최단거리, ID). R 자신이 다른 R 의 조상인 경우 거리 0.
- emerging 은 gap 에 포함(mastered 가 아님).
- 테스트 9번은 Python 테스트 docstring 과 같이 "문제 노드가 M ∪ fringe 이면 COLLISION 0건, 아니면 항상 COLLISION" 로 검증. 합성 학생은 TS 로 재구현(난수열은 Python 과 다름).
- 단위 테스트의 그래프 fixture 는 `../tests/fixtures/*.yaml`, 학생 A/문제는 `../examples/real/*.yaml` 을 직접 읽어 `src/data` 와 일치하는지 검사한다.

## 하지 않은 것

LLM 호출, 로그인, 서버, DB, 변이 검사, 진척 지표(진도율·점수·랭킹·레벨), 학생 실명 입력, 라우터, 애니메이션 라이브러리, 다크모드, 모바일 대응, **그래프 시각화 라이브러리(react-flow·cytoscape·d3 등)**. 요구 개념은 교사가 직접 선택하며 AI 제안은 안내문 자리만 있다.

## 스크린샷 (1280×800)

- [1 메인(초기 빈 상태)](screenshots/tab1.png)
- [2 메인(검사 결과 + 학습 계보 펼침)](screenshots/tab2.png)
- [3 학생 현행수준 모달](screenshots/tab3.png)
- [4 반 일괄 검사 모달](screenshots/tab4.png)
