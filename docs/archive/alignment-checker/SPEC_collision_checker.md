# 인지적 정렬 검사기(Collision Checker) v0 스펙

작성 2026-11-06. **2026-11-07 개정**: 상태 4종(unknown 추가)·판정 4종(NEEDS_REVIEW 추가).
구현 담당은 이 문서만 보고 구현할 수 있어야 한다.

## 1. 목적

교사가 만든 문제 하나가 특정 학생에게 **지금 풀 준비가 된 문제인지**를 개념 그래프 위에서 판정한다.
시스템은 "좋은 문제"를 정의하지 않는다. 좋은 문제의 **필요조건 두 가지**만 기계적으로 검사한다.

1. **준비도(readiness)** — 문제가 요구하는 개념의 선수 개념을 학생이 모두 도달했는가 (KST의 outer fringe 개념).
2. **변이(variation)** — 같은 심층 개념을 공유하는 문제 세트가 표면 차원에서 충분히 다른가 (변화 이론). *v0에서는 인터페이스만 두고 구현은 v1.*

## 2. 데이터 모델

### 2.1 그래프 `graph.yaml`

```yaml
version: "0.1"
domain: "초등 수학 · 수와 연산"
nodes:
  - id: N01_count_to_10        # 영문 snake, 접두 Nxx
    label: "10까지 수 세기"
    description: "1~10 범위 구체물을 하나씩 세어 마지막 수를 전체 개수로 말한다"
    level_hint: "기본 1-2"       # 참고용. 판정에 쓰지 않음
    sources:                     # 필수. 비어 있으면 로더가 에러
      - type: curriculum
        ref: "[2기본수01-01]"
        url: "..."
      - type: trajectory
        ref: "Clements & Sarama, Counting: Counter (Small Numbers)"
        url: "..."
edges:
  - from: N01_count_to_10      # 선수 개념
    to:   N02_count_to_20      # 후속 개념
    kind: hard                 # hard | soft
    sources:                   # 필수
      - type: trajectory
        ref: "..."
```

- `kind: hard` — 필수 선수. 미확보(not_started/emerging)면 **충돌**.
- `kind: soft` — 권장 선수. 미확보는 **참고**만.
- 그래프는 DAG여야 한다. 로더가 사이클을 검출하면 에러.

### 2.2 학생 상태 `student.yaml` (2026-11-07 개정)

```yaml
student_id: "S001"             # 익명 ID. 실명·학교 금지
version: 2                     # 저장 형식 버전. 1 = 과거 형식(기본값), 2 = 현재 형식
updated: "2026-11-06"
states:
  N01_count_to_10: mastered    # mastered | emerging | not_started (명시 기록만 둔다)
  N02_count_to_20: emerging
  # 명시하지 않은 노드는 unknown(기록 없음)으로 해석한다
```

상태 4종의 의미:

| 상태 | 뜻 |
|---|---|
| `unknown` | 아직 확인한 기록이 없음. **명시하지 않은 노드의 해석값.** |
| `not_started` | 교사가 아직 다루지 않았다고 확인함 |
| `emerging` | 수행이 형성 중이거나 불안정함 |
| `mastered` | 교사가 숙달로 확인함 |

마이그레이션 규칙:

- 과거 형식(version 없음 = 1) 파일도 그대로 읽는다. 과거 형식에서 빠진 항목이
  미시작이었는지 미확인이었는지는 복원할 수 없으므로 **미확인(unknown)으로 이전**한다.
- 명시적 `not_started`는 저장·로드에서 지우지 않는다(미시작 ≠ 미확인).
- 학생 데이터를 초기화하지 않는다.
- 확률 모델(BKT 등)은 v0 범위 밖.

### 2.3 문제 `problem.yaml`

```yaml
problem_id: "P001"
text: "사과 7개와 5개를 합하면 몇 개?"
requires:                      # 교사 또는 LLM 태깅 후 교사 확인. 1개 이상 필수
  - N08_add_within_20_carry
surface:                       # v1 변이 검사용. v0는 저장만
  number_range: "20이내"
  context: "과일"
  representation: "그림+숫자"
  support: "없음"
```

`requires`가 빈 검사는 로더 스키마에서도, **엔진(`check`)에서도** 명확히 거부한다.

## 3. 판정 알고리즘 (2026-11-07 개정)

```
R  = problem.requires
M  = {n | state[n] == mastered}          # 명시 기록만. 없는 노드는 unknown

P_hard(R) = R의 모든 hard 엣지 조상(이행적 폐포). R 자신은 제외(다른 R의 조상인 R 노드 포함은 유지)
P_soft(R) = R의 soft 엣지 직접 선수 (1단계만)

gap_hard         = P_hard(R) 중 명시적 not_started/emerging      # 명시적 미확보만
gap_soft         = P_soft(R) 중 명시적 not_started/emerging
unknown_hard     = P_hard(R) 중 unknown (R 안 노드 제외)           # 기록 없음
unknown_required = R 중 unknown                                    # 기록 없음(요구 개념)

판정 순서(고정):
1. gap_hard ≠ ∅                          → COLLISION   (선수에 명시적 미확보)
2. unknown_hard ≠ ∅ 또는 unknown_required ≠ ∅ → NEEDS_REVIEW (기록 없음 — 미확인)
3. R ⊆ M                                 → TOO_EASY
4. 나머지                                 → ALIGNED     (선수 확인, 요구 개념 미숙달)

추가 규칙:
- COLLISION 과 미확인이 함께 있으면 판정은 COLLISION 이되 unknown 목록도 함께 반환한다.
- soft 선수의 unknown 만으로는 판정을 NEEDS_REVIEW 로 바꾸지 않는다(soft는 참고).
- unknown 은 gap_hard/gap_soft 목록과 분리해서 반환한다(미확인 ≠ 미시작).
- suggested_next = gap_hard 중 "자신의 hard 선수가 모두 실제로 mastered"인 노드
  (선수에 unknown 이 하나라도 있으면 제외). COLLISION 일 때만 반환.
  정렬: (R까지 hard 최단거리, ID) — 표시할 때 순서 의미 없음.
```

### 3.2 출력 (JSON)

```json
{
  "problem_id": "P001",
  "student_id": "S001",
  "verdict": "COLLISION",
  "requires": ["N08_add_within_20_carry"],
  "gap_hard": ["N05_make_ten"],
  "gap_soft": [],
  "unknown_hard": ["N06_place_value_tens_ones"],
  "unknown_required": [],
  "suggested_next": ["N05_make_ten"],
  "explanation": "이 문제는 '받아올림이 있는 20 이내 덧셈'을 요구하는데, …"
}
```

`explanation`은 템플릿 기반 한국어 문장. LLM 호출 없음. unknown(기록 없음)과
미확보(시작 전·형성 중)를 문장에서도 구분한다.

## 4. CLI

```
python -m checker check --graph graph.yaml --student student.yaml --problem problem.yaml [--json]
python -m checker validate --graph graph.yaml        # DAG·source 필수·ID 중복 검사
python -m checker fringe --graph graph.yaml --student student.yaml   # 학생의 outer fringe 출력(기록 없는 노드는 [unknown] 표시)
python -m checker batch --graph graph.yaml --students students/ --problems problems/ --out results.csv
```

`batch` CSV 열: `student_id, problem_id, verdict, requires, gap_hard, gap_soft,
unknown_hard, unknown_required, suggested_next, explanation`(리스트는 `;` 연결).

## 5. 구현 제약

- Python 3.11+, 의존성: `networkx`, `pyyaml`, `pydantic>=2`. 그 외 금지.
- 패키지 구조: `checker/{__init__,models,loader,engine,explain,cli}.py`
- 모든 공개 함수에 타입 힌트 + docstring.
- `pytest` 테스트: `tests/test_engine.py`. 최소 케이스:
  1. 선형 체인 A→B→C, M={A}, B 명시적 미시작, R={C} → COLLISION, gap={B}, suggested={B}
  2. 같은 그래프, M={A,B}, C 형성 중(명시), R={C} → ALIGNED
  3. M={A,B,C}, R={C} → TOO_EASY
  4. soft 선수 명시적 미시작 → ALIGNED + 참고(gap_soft)
  5. 다이아몬드 A→B, A→C, B→D, C→D; M={A,B}, C 명시적 미시작, R={D} → COLLISION, gap={C}, suggested={C}
  6. 사이클 그래프 로드 → 에러
  7. source 없는 노드 로드 → 에러
  8. requires에 없는 노드 ID → 에러 / 빈 requires → 엔진도 거부
  - (2026-11-07 추가) 미확인 선수 → NEEDS_REVIEW, 미확인 요구 개념 → NEEDS_REVIEW,
    COLLISION+미확인 혼재 표시, soft 미확인은 판정 불변, suggested 에서 미확인 선수 노드 제외,
    상태 모델(version 1/2, 명시적 not_started 보존), v1 파일 이전(빠진 항목 → unknown).
- 합성 데이터 생성 스크립트 `scripts/gen_synthetic.py`: 하향 폐쇄 집합 학생을 만들되
  **모든 노드에 상태를 명시**한다(완전 확인 학생: mastered / fringe 50% emerging / 나머지 not_started,
  `version: 2`로 기록). 부분 확인 학생(unknown 포함)은 명시적 not_started를 지워 만들 수 있다.
- 불변식(테스트 9번, 완전 확인 학생): 문제 노드가 M 또는 outer fringe 에 속하면
  **COLLISION 0건**, 그 밖의 노드는 **항상 COLLISION**. 부분 확인 학생에 대해서는
  범위 밖 노드가 COLLISION 또는 NEEDS_REVIEW (TOO_EASY/ALIGNED 없음)로 약화된다.
- 공통 판정 사례 fixture `tests/fixtures/shared_cases.json`: Python 과 TypeScript 엔진이
  같은 판정과 개념 목록을 내는지 양쪽에서 검증한다. 재생성은 `python scripts/gen_shared_cases.py`.

## 6. v0 범위 밖 (하지 말 것)

변이 검사 구현, LLM 호출, DB, 웹 UI, 확률 모델.
