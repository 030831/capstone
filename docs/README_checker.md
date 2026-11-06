# 인지적 정렬 검사기 (Collision Checker) v0

교사가 만든 문제 하나가 특정 학생에게 **지금 풀 준비가 된 문제인지**를 개념 그래프 위에서 판정합니다.
v0 는 필요조건 두 가지 중 **준비도(readiness)** 만 구현합니다. 변이 검사·LLM·DB·UI·확률 모델은 범위 밖입니다.
스펙: `docs/SPEC_collision_checker.md`

## 설치

```bash
pip install -e ".[dev]"          # 런타임 의존성: networkx, pyyaml, pydantic>=2 / dev: pytest
# 시스템 파이썬이면: pip install --break-system-packages -e ".[dev]"
pytest -q
```

## 실행 예시

```bash
G=examples/graph_toy.yaml
python -m checker check    --graph $G --student examples/student_toy.yaml --problem examples/problem_toy.yaml [--json]
python -m checker validate --graph $G                       # DAG · source 필수 · ID 중복 · 스키마 검사
python -m checker fringe   --graph $G --student examples/student_toy.yaml
python -m checker batch    --graph $G --students students/ --problems problems/ --out results.csv
python scripts/gen_synthetic.py --graph $G --n 20 --seed 1 --out /tmp/students   # KST 합성 학생
```

### `check --json` 실제 출력

```json
{
  "problem_id": "P001",
  "student_id": "S001",
  "verdict": "COLLISION",
  "requires": [
    "N08_add_within_20_carry"
  ],
  "gap_hard": [
    "N05_make_ten",
    "N06_place_value_tens_ones"
  ],
  "gap_soft": [],
  "suggested_next": [
    "N05_make_ten"
  ],
  "explanation": "이 문제는 '받아올림이 있는 20 이내 덧셈'을 요구하는데, 학생은 선수 개념 '10 만들기', '십과 일의 자릿값'이 미도달입니다. '10 만들기'은(는) 지금 바로 다룰 수 있는 선수 개념입니다."
}
```

### `fringe` 실제 출력

```
학생 S001의 outer fringe (2개):
  N04_subtract_within_10  10 이내 뺄셈  [emerging]
  N05_make_ten  10 만들기  [not_started]
```

### `validate` 거부 예시 (종료 코드 1, stderr)

```
오류: tests/fixtures/graph_cycle.yaml: 그래프에 사이클이 있습니다: A -> B -> C -> A (그래프는 DAG 여야 합니다)
오류: tests/fixtures/graph_no_source.yaml: nodes[1] (id=B).sources: sources 가 없거나 비어 있습니다 (근거 source 는 1개 이상 필수)
오류: tests/fixtures/graph_dup_id.yaml: 노드 ID가 중복되었습니다: 'A' (nodes[0], nodes[2])
```

그 밖에 엣지가 없는 노드를 참조하는 경우, 필드명 오타·잘못된 `kind` 값 등도 위치(`nodes[1] (id=B).lable`)와 함께 보고합니다.

## 판정 로직 요약 (스펙 3장)

```
R = problem.requires,  M = {mastered 노드}
gap_hard = (R 의 hard 엣지 조상 전체) − M
gap_soft = (R 의 soft 직접 선수, 1단계) − M
gap_hard ≠ ∅ → COLLISION   (suggested_next = gap_hard 중 hard 선수가 모두 M 인 노드, R 까지 최단 경로 짧은 순)
R ⊆ M        → TOO_EASY
그 외        → ALIGNED      (gap_soft ≠ ∅ 이면 설명에 soft 경고 포함)
```

`explanation` 은 노드 `label` 과 받침 기반 조사 선택(을/를, 이/가, 은/는)을 쓰는 템플릿 문장이며 LLM 을 호출하지 않습니다.
출력 JSON 키는 스펙 3.2 와 동일합니다(경고는 별도 필드 없이 `gap_soft` 로 표현).

## 해석 (스펙이 모호해서 가장 단순하게 고른 지점)

1. **`P_hard(R)` 의 "R 자신은 제외"**: R 의 각 노드의 hard 조상(자기 자신 제외)을 합집합합니다. R 안의 다른 노드의 조상인 R 노드는 gap 후보로 **남깁니다**(예: A→B→C, R={B,C}, M={A} → gap={B}). R 전체를 빼면 이런 경우 충돌을 놓치기 때문입니다.
2. **테스트 9번 (스펙 오류 가능성)**: 스펙은 "하향 폐쇄 학생 × 모든 단일 노드 문제 → COLLISION 0건"이라 하지만, M=∅ 인 학생(하향 폐쇄)에게 체인의 B 를 내면 정의상 COLLISION 입니다. 그래서 테스트는 *M ∪ outer fringe 에 속한 노드 문제는 COLLISION 0건*, *그 밖의 노드 문제는 항상 COLLISION* 으로 구현했습니다(스펙의 의도를 유지하면서 참이 되는 가장 강한 명제).
3. **outer fringe**: mastered 가 아니면서 hard 선수가 모두 mastered 인 노드(emerging 포함). soft 엣지는 무시.
4. **`emerging` 은 mastered 가 아니므로 gap 에 포함**됩니다. E 집합은 판정에 쓰지 않습니다.
5. **`suggested_next`**: 스펙 3.1 문장대로 "바로 배울 수 있는 gap 노드"를 모두 반환하고, 정렬 키는 (R 까지 hard 최단 거리, ID). `gap_hard`/`gap_soft` 는 ID 오름차순.
6. **ID 검증**: `requires` 뿐 아니라 `student.states` 의 키가 그래프에 없어도 오류로 처리합니다(오타 방지). 오류는 `check`/`fringe`/`batch` 호출 시점에 납니다.
7. **필수/선택 필드**: graph 의 `version`, `domain`, node `id/label/sources`, edge `from/to/kind/sources` 필수, `description/level_hint/url` 선택. student 는 `student_id` 필수·`updated` 선택(YYYY-MM-DD). problem 은 `problem_id/text/requires`(1개 이상) 필수, `surface` 선택(저장만). 알 수 없는 필드는 오류.
8. **source `type`** 은 자유 문자열(예시의 curriculum/trajectory 로 제한하지 않음). 노드 ID 형식(`Nxx_`)은 강제하지 않음(테스트가 A, B, C 를 쓰므로).
9. **DAG 검사 대상**은 hard+soft 전체 엣지입니다. 같은 (from,to) 쌍의 중복 엣지는 허용하며 각 종류 그래프에 따로 반영됩니다.
10. **CLI**: `check` 의 `--json` 이 없으면 사람이 읽는 텍스트 출력. 오류는 `오류: ...` 로 stderr, 종료 코드 1(인자 오류는 argparse 의 2). `batch` 는 `*.yaml`/`*.yml` 을 이름순으로 읽고, 한 파일이라도 오류면 중단하며, CSV 의 리스트 컬럼은 `;` 로 잇습니다(UTF-8).
11. **pytest 의존성**은 `pyproject.toml` 의 `dev` extra 로 둡니다(런타임 의존성은 3개뿐).
12. **합성 학생**: 무작위 시드 노드 + 그 hard 조상을 mastered 로 두고, outer fringe 노드를 50% 확률로 emerging 으로 둡니다.
13. **examples 의 source** 는 형식용 예시 표기(`type: toy`)이며 실제 교육과정·연구 근거가 아닙니다. toy 그래프의 노드 관계(예: 10 만들기 → 자릿값)는 스펙 3.2 예시 출력(gap 2개, suggested 1개)을 재현하도록 설계한 것입니다.

## 구조

```
checker/  models.py(스키마·결과·예외)  loader.py(YAML 로드·검증)  engine.py(판정)  explain.py(한국어 템플릿)  cli.py
tests/    test_engine.py(스펙 5장 1~9 + 보조)  fixtures/
scripts/  gen_synthetic.py
examples/ graph_toy.yaml  student_toy.yaml  problem_toy.yaml
```
