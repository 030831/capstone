"""공유 판정 사례 fixture(tests/fixtures/shared_cases.json) 재생성기.

Python 엔진으로 기대값을 계산해 JSON 으로 저장한다. TypeScript 엔진 테스트가
같은 파일을 읽어 두 엔진의 판정·목록이 일치하는지 검증한다(스펙 2026-11-07).

사용:
    python scripts/gen_shared_cases.py          # 결과 검토 후 커밋
"""

from __future__ import annotations

import json
from pathlib import Path

import yaml

from checker.engine import ConceptGraph, check
from checker.loader import load_graph, load_problem, load_student
from checker.models import ProblemSpec, StudentState

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "tests" / "fixtures"

# (이름, 그래프 경로(루트 기준), states, requires)
CASES: list[tuple[str, str, dict[str, str], list[str]]] = [
    ("명시적 미시작 선수 → COLLISION", "tests/fixtures/graph_chain.yaml",
     {"A": "mastered", "B": "not_started"}, ["C"]),
    ("emerging 선수 → COLLISION", "tests/fixtures/graph_chain.yaml",
     {"A": "mastered", "B": "emerging"}, ["C"]),
    ("미확인 선수 → NEEDS_REVIEW", "tests/fixtures/graph_chain.yaml",
     {"A": "mastered"}, ["C"]),
    ("미확인 요구 개념 → NEEDS_REVIEW", "tests/fixtures/graph_chain.yaml",
     {"A": "mastered", "B": "mastered"}, ["C"]),
    ("모두 기록 없음 → NEEDS_REVIEW(선수+요구)", "tests/fixtures/graph_chain.yaml",
     {}, ["C"]),
    ("요구 개념 형성 중, 선수 숙달 → ALIGNED", "tests/fixtures/graph_chain.yaml",
     {"A": "mastered", "B": "mastered", "C": "emerging"}, ["C"]),
    ("요구 개념 명시적 미시작, 선수 숙달 → ALIGNED", "tests/fixtures/graph_chain.yaml",
     {"A": "mastered", "B": "mastered", "C": "not_started"}, ["C"]),
    ("모두 숙달 → TOO_EASY", "tests/fixtures/graph_chain.yaml",
     {"A": "mastered", "B": "mastered", "C": "mastered"}, ["C"]),
    ("요구 개념 숙달 + 이행 선수 미확인 → NEEDS_REVIEW(판정 순서 확인)", "tests/fixtures/graph_diamond.yaml",
     {"B": "mastered", "C": "mastered", "D": "mastered"}, ["D"]),
    ("다이아몬드 명시적 미시작 → COLLISION suggested", "tests/fixtures/graph_diamond.yaml",
     {"A": "mastered", "B": "mastered", "C": "not_started"}, ["D"]),
    ("다이아몬드 미확인 선수 → NEEDS_REVIEW", "tests/fixtures/graph_diamond.yaml",
     {"A": "mastered", "B": "mastered"}, ["D"]),
    ("다이아몬드 요구 개념 형성 중 → ALIGNED", "tests/fixtures/graph_diamond.yaml",
     {"A": "mastered", "B": "mastered", "C": "mastered", "D": "emerging"}, ["D"]),
    ("gap 노드의 선수가 미확인 → suggested 에서 제외", "tests/fixtures/graph_chain.yaml",
     {"B": "not_started"}, ["C"]),
    ("soft 선수 미확인뿐 → 판정 유지(ALIGNED)", "tests/fixtures/graph_soft.yaml",
     {"A": "mastered", "C": "emerging"}, ["C"]),
    ("soft 선수 명시적 미시작 → ALIGNED + gap_soft", "tests/fixtures/graph_soft.yaml",
     {"A": "mastered", "B": "not_started", "C": "emerging"}, ["C"]),
    ("hard 선수 명시적 미시작 → COLLISION(soft 와 혼재)", "tests/fixtures/graph_soft.yaml",
     {"A": "not_started", "C": "emerging"}, ["C"]),
]


def main() -> None:
    """fixture 를 재생성한다."""
    out: list[dict[str, object]] = []
    graphs: dict[str, ConceptGraph] = {}

    def graph_for(rel: str) -> ConceptGraph:
        if rel not in graphs:
            graphs[rel] = ConceptGraph(load_graph(ROOT / rel))
        return graphs[rel]

    for name, rel, states, requires in CASES:
        r = check(graph_for(rel), StudentState(student_id="S", states=states),
                  ProblemSpec(problem_id="P", text="t", requires=requires))
        out.append({
            "name": name,
            "graph": rel,
            "states": states,
            "requires": requires,
            "expect": {
                "verdict": r.verdict.value,
                "gap_hard": r.gap_hard,
                "gap_soft": r.gap_soft,
                "unknown_hard": r.unknown_hard,
                "unknown_required": r.unknown_required,
                "suggested_next": r.suggested_next,
            },
        })

    # graph_v0 실제 예시(학생 A/B/C × 문제 3종) — examples/real 데이터 그대로.
    g0 = ConceptGraph(load_graph(ROOT / "graph" / "graph_v0.yaml"))
    student_files = ["student_A.yaml"]
    problem_files = ["problem_add5.yaml", "problem_carry.yaml", "problem_make10.yaml"]
    presets: dict[str, dict[str, str]] = {
        "B": {"N01_one_to_one_matching": "mastered", "N02_perceptual_compare": "mastered",
              "N03_ordering_by_attribute": "mastered", "N04_subitize_small": "mastered",
              "N05_count_sequence_to_10": "mastered", "N06_count_objects_to_5": "mastered",
              "N14_compose_decompose_to_5": "emerging"},
        "C": {},
    }
    # 학생 C: N01~N25, N28~N33 mastered, N26·N27 emerging (web presets.ts 와 동일 규칙)
    import re
    for node in g0.node_ids:
        n = int(re.match(r"N(\d+)", node).group(1))
        if n <= 25 or 28 <= n <= 33:
            presets["C"][node] = "mastered"
    presets["C"]["N26_add_single_digit_carry"] = "emerging"
    presets["C"]["N27_sub_teen_borrow"] = "emerging"

    for sid, states in [("A", None), ("B", presets["B"]), ("C", presets["C"])]:
        st = load_student(ROOT / "examples" / "real" / "student_A.yaml") if sid == "A" \
            else StudentState(student_id=f"S_{sid}", version=2, states=states)
        for pf in problem_files:
            pr = load_problem(ROOT / "examples" / "real" / pf)
            r = check(g0, st, pr)
            out.append({
                "name": f"graph_v0 학생 {sid} × {pr.problem_id}",
                "graph": "graph/graph_v0.yaml",
                "states": st.states,
                "requires": pr.requires,
                "expect": {
                    "verdict": r.verdict.value,
                    "gap_hard": r.gap_hard,
                    "gap_soft": r.gap_soft,
                    "unknown_hard": r.unknown_hard,
                    "unknown_required": r.unknown_required,
                    "suggested_next": r.suggested_next,
                },
            })

    doc = {
        "comment": (
            "Python 과 TypeScript 엔진이 같은 판정과 개념 목록을 내야 하는 공통 사례. "
            "재생성: python scripts/gen_shared_cases.py (기대값은 Python 엔진 실행 결과). "
            "상태 4종(unknown/not_started/emerging/mastered), 판정 4종"
            "(COLLISION/NEEDS_REVIEW/TOO_EASY/ALIGNED). states 에 없는 노드는 unknown."
        ),
        "cases": out,
    }
    (FIX / "shared_cases.json").write_text(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"{len(out)}건 -> {FIX / 'shared_cases.json'}")


if __name__ == "__main__":
    main()
