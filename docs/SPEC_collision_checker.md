# 인지적 정렬 검사기(Collision Checker) v0 스펙

작성 2026-11-06. 구현 담당은 이 문서만 보고 구현할 수 있어야 한다.

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

- `kind: hard` — 선수 미도달이면 후속 개념 학습 불가로 간주 → **충돌**.
- `kind: soft` — 권장 선수. 미도달이면 **주의**만.
- 그래프는 DAG여야 한다. 로더가 사이클을 검출하면 에러.

### 2.2 학생 상태 `student.yaml`

```yaml
student_id: "S001"             # 익명 ID. 실명·학교 금지
updated: "2026-11-06"
states:
  N01_count_to_10: mastered    # mastered | emerging | not_started
  N02_count_to_20: emerging
  # 명시 안 된 노드는 not_started
```

3단계 상태만 쓴다. 확률 모델(BKT 등)은 v0 범위 밖.

### 2.3 문제 `problem.yaml`

```yaml
problem_id: "P001"
text: "사과 7개와 5개를 합하면 몇 개?"
requires:                      # 교사 또는 LLM 태깅 후 교사 확인
  - N08_add_within_20_carry
surface:                       # v1 변이 검사용. v0는 저장만
  number_range: "20이내"
  context: "과일"
  representation: "그림+숫자"
  support: "없음"
```

## 3. 판정 알고리즘

```
R  = problem.requires
M  = {n | state[n] == mastered}
E  = {n | state[n] == emerging}

P_hard(R) = R의 모든 hard 엣지 조상(이행적 폐포). R 자신은 제외.
P_soft(R) = R의 soft 엣지 직접 선수 (1단계만).

gap_hard = P_hard(R) − M
gap_soft = P_soft(R) − M

if gap_hard ≠ ∅:
    verdict = COLLISION
elif R ⊆ M:
    verdict = TOO_EASY
else:
    verdict = ALIGNED          # R의 선수는 모두 도달, R 자체는 미도달/진행중 → ZPD
    if gap_soft ≠ ∅: warnings += soft gap
```

### 3.1 충돌 시 제안

`gap_hard`가 비어 있지 않으면 **가장 가까운 선수(nearest gap)** 를 제안한다:
- gap_hard 중에서, 자신의 hard 선수가 모두 M에 속하는 노드들 = 학생이 지금 바로 배울 수 있는 노드 (outer fringe ∩ gap).
- 이 노드들을 `suggested_next`로 반환. 여러 개면 R까지의 최단 경로 길이가 짧은 순.

### 3.2 출력 (JSON)

```json
{
  "problem_id": "P001",
  "student_id": "S001",
  "verdict": "COLLISION",
  "requires": ["N08_add_within_20_carry"],
  "gap_hard": ["N05_make_ten", "N06_place_value_tens_ones"],
  "gap_soft": [],
  "suggested_next": ["N05_make_ten"],
  "explanation": "이 문제는 '받아올림이 있는 20 이내 덧셈'을 요구하는데, 학생은 선수 개념 '10 만들기', '십과 일의 자릿값'이 미도달입니다. '10 만들기'은(는) 지금 바로 다룰 수 있는 선수 개념입니다."
}
```

`explanation`은 템플릿 기반 한국어 문장. LLM 호출 없음.

## 4. CLI

```
python -m checker check --graph graph.yaml --student student.yaml --problem problem.yaml [--json]
python -m checker validate --graph graph.yaml        # DAG·source 필수·ID 중복 검사
python -m checker fringe --graph graph.yaml --student student.yaml   # 학생의 outer fringe 출력
python -m checker batch --graph graph.yaml --students students/ --problems problems/ --out results.csv
```

## 5. 구현 제약

- Python 3.11+, 의존성: `networkx`, `pyyaml`, `pydantic>=2`. 그 외 금지.
- 패키지 구조: `checker/{__init__,models,loader,engine,explain,cli}.py`
- 모든 공개 함수에 타입 힌트 + docstring.
- `pytest` 테스트: `tests/test_engine.py`에 최소 다음 케이스
  1. 선형 체인 A→B→C, 학생 M={A}, 문제 R={C} → COLLISION, gap={B}, suggested={B}
  2. 같은 그래프, M={A,B}, R={C} → ALIGNED
  3. M={A,B,C}, R={C} → TOO_EASY
  4. soft 엣지만 미도달 → ALIGNED + warning
  5. 다이아몬드 A→B, A→C, B→D, C→D; M={A,B}, R={D} → COLLISION, gap={C}, suggested={C}
  6. 사이클 그래프 로드 → 에러
  7. source 없는 노드 로드 → 에러
  8. requires에 없는 노드 ID → 에러
- 합성 데이터 생성 스크립트 `scripts/gen_synthetic.py`: 그래프를 받아 KST 방식(하향 폐쇄 집합 = 어떤 노드가 mastered면 그 모든 hard 조상도 mastered)으로 무작위 학생 상태 N개 생성. 테스트 9번(불변식):
  - 문제 노드가 M(mastered) 또는 학생의 outer fringe에 속하면 **COLLISION이 0건**.
  - 그 밖의 노드(선수 중 하나라도 미도달)는 **항상 COLLISION**.
  - 합성 학생이 실제로 하향 폐쇄인지 먼저 단언하고, ALIGNED와 TOO_EASY가 둘 다 나타나는지(퇴화 데이터 방지)도 확인.
  - *(수정 이력 2026-11-06: 초안의 "모든 단일 노드 문제에서 COLLISION 0건"은 틀린 명제였다. M=∅도 하향 폐쇄 집합인데 체인 A→B→C에서 B 문제는 정의상 COLLISION이다. 구현 담당이 발견해 위 명제로 교체.)*

## 6. v0 범위 밖 (하지 말 것)

- 변이 검사 구현, LLM 호출, DB, 웹 UI, 확률 모델.
