"""스펙 5장 테스트 1~9 + 4상태(unknown)/NEEDS_REVIEW 테스트 + 공유 fixture 검증.

2026-11-07 개정: 상태 4종(unknown=기록 없음/not_started/emerging/mastered),
판정 4종(COLLISION/NEEDS_REVIEW/TOO_EASY/ALIGNED)에 맞춰 갱신.
기존 1~9번의 의도(하향 폐쇄 학생의 범위 밖 노드만 COLLISION)는 유지하되,
미확인과 미시작을 구분한다.
"""

from __future__ import annotations

import csv
import importlib.util
import json
from pathlib import Path

import pytest

from checker.cli import main
from checker.engine import ConceptGraph, check, outer_fringe
from checker.explain import josa
from checker.loader import load_graph, load_problem, load_student
from checker.models import (
    DataError,
    ProblemSpec,
    StudentState,
    UnknownConceptError,
    Verdict,
)

FIX = Path(__file__).parent / "fixtures"
ROOT = Path(__file__).parent.parent


def graph_of(name: str) -> ConceptGraph:
    """fixtures 의 그래프를 로드한다."""
    return ConceptGraph(load_graph(FIX / name))


def student(states: dict[str, str], sid: str = "S") -> StudentState:
    """학생 상태를 코드에서 직접 만든다. 명시 안 된 노드는 unknown."""
    return StudentState.model_validate({"student_id": sid, "states": states})


def problem(*requires: str) -> ProblemSpec:
    """문제를 코드에서 직접 만든다."""
    return ProblemSpec(problem_id="P", text="t", requires=list(requires))


# --- 스펙 5장 1~8 ---------------------------------------------------------

def test_01_chain_collision() -> None:
    """선형 체인, M={A}, B 명시적 미시작, R={C} -> COLLISION, gap={B}, suggested={B}.

    R(C)는 기록이 없으므로 unknown_required 에 함께 표시된다(충돌+미확인 혼재).
    """
    g = graph_of("graph_chain.yaml")
    r = check(g, load_student(FIX / "student_chain_a.yaml"), load_problem(FIX / "problem_c.yaml"))
    assert r.verdict is Verdict.COLLISION
    assert r.gap_hard == ["B"]
    assert r.suggested_next == ["B"]
    assert r.gap_soft == []
    assert r.unknown_hard == []
    assert r.unknown_required == ["C"]


def test_02_chain_aligned() -> None:
    """같은 그래프, M={A,B}, C 형성 중(명시), R={C} -> ALIGNED."""
    g = graph_of("graph_chain.yaml")
    r = check(g, load_student(FIX / "student_chain_ab.yaml"), load_problem(FIX / "problem_c.yaml"))
    assert r.verdict is Verdict.ALIGNED
    assert r.gap_hard == [] and r.suggested_next == []
    assert r.unknown_hard == [] and r.unknown_required == []


def test_03_too_easy() -> None:
    """M={A,B,C}, R={C} -> TOO_EASY."""
    g = graph_of("graph_chain.yaml")
    r = check(g, student({"A": "mastered", "B": "mastered", "C": "mastered"}), problem("C"))
    assert r.verdict is Verdict.TOO_EASY


def test_04_soft_gap_is_warning_only() -> None:
    """soft 엣지 선수가 명시적 미시작 -> ALIGNED + soft 경고."""
    g = graph_of("graph_soft.yaml")
    r = check(g, student({"A": "mastered", "B": "not_started", "C": "emerging"}), problem("C"))
    assert r.verdict is Verdict.ALIGNED
    assert r.gap_hard == []
    assert r.gap_soft == ["B"]
    assert "'B'" in r.explanation.replace("개념 B", "'B'") or "개념 B" in r.explanation


def test_04b_soft_unknown_does_not_change_verdict() -> None:
    """soft 선수가 미확인(기록 없음)뿐이면 판정을 NEEDS_REVIEW 로 바꾸지 않는다."""
    g = graph_of("graph_soft.yaml")
    r = check(g, student({"A": "mastered", "C": "emerging"}), problem("C"))
    assert r.verdict is Verdict.ALIGNED
    assert r.gap_soft == []  # 미확인은 gap_soft 에도 포함하지 않는다


def test_05_diamond() -> None:
    """다이아몬드, M={A,B}, C 명시적 미시작, R={D} -> COLLISION, gap={C}, suggested={C}."""
    g = graph_of("graph_diamond.yaml")
    r = check(g, student({"A": "mastered", "B": "mastered", "C": "not_started"}), problem("D"))
    assert r.verdict is Verdict.COLLISION
    assert r.gap_hard == ["C"]
    assert r.suggested_next == ["C"]


def test_06_cycle_graph_rejected() -> None:
    """사이클 그래프 로드 -> 에러."""
    with pytest.raises(DataError) as ei:
        load_graph(FIX / "graph_cycle.yaml")
    assert "사이클" in str(ei.value)
    assert "A -> B -> C -> A" in str(ei.value)


def test_07_node_without_source_rejected() -> None:
    """source 없는 노드 로드 -> 에러(없음/빈 리스트 모두)."""
    for name in ("graph_no_source.yaml", "graph_empty_source.yaml"):
        with pytest.raises(DataError) as ei:
            load_graph(FIX / name)
        assert "sources" in str(ei.value) and "id=B" in str(ei.value)


def test_08_unknown_requires_rejected() -> None:
    """requires 에 없는 노드 ID -> 에러."""
    g = graph_of("graph_chain.yaml")
    with pytest.raises(UnknownConceptError) as ei:
        check(g, student({}), load_problem(FIX / "problem_unknown.yaml"))
    assert "NOPE" in str(ei.value)


# --- 미확인(unknown) · NEEDS_REVIEW ---------------------------------------

def test_unknown_prereq_is_needs_review() -> None:
    """선수가 기록에 없으면(unknown) NEEDS_REVIEW — 미시작으로 표시하지 않는다."""
    g = graph_of("graph_chain.yaml")
    r = check(g, load_student(FIX / "student_chain_unknown.yaml"), load_problem(FIX / "problem_c.yaml"))
    assert r.verdict is Verdict.NEEDS_REVIEW
    assert r.gap_hard == []  # 미확인은 gap 이 아니다
    assert r.unknown_hard == ["B"]
    assert r.unknown_required == ["C"]
    assert "확인되지 않았습니다" in r.explanation


def test_unknown_required_is_needs_review() -> None:
    """선수는 모두 숙달이어도 요구 개념이 미확인이면 NEEDS_REVIEW."""
    g = graph_of("graph_chain.yaml")
    r = check(g, student({"A": "mastered", "B": "mastered"}), problem("C"))
    assert r.verdict is Verdict.NEEDS_REVIEW
    assert r.unknown_hard == [] and r.unknown_required == ["C"]


def test_mastered_requires_with_unknown_ancestor_is_needs_review() -> None:
    """요구 개념이 모두 숙달이어도 이행 선수에 미확인이 있으면 NEEDS_REVIEW(판정 순서 확인)."""
    g = graph_of("graph_diamond.yaml")
    r = check(g, student({"B": "mastered", "C": "mastered", "D": "mastered"}), problem("D"))
    assert r.verdict is Verdict.NEEDS_REVIEW
    assert r.unknown_hard == ["A"]
    assert r.unknown_required == []


def test_all_unknown_student_is_needs_review() -> None:
    """기록이 하나도 없는 학생: 모든 게 미확인(미시작 아님)."""
    g = graph_of("graph_chain.yaml")
    r = check(g, student({}), problem("C"))
    assert r.verdict is Verdict.NEEDS_REVIEW
    assert r.gap_hard == []
    assert r.unknown_hard == ["A", "B"]
    assert r.unknown_required == ["C"]


def test_collision_with_unknown_shows_both() -> None:
    """COLLISION 인데 미확인도 있으면 두 정보를 함께 반환한다."""
    g = graph_of("graph_chain.yaml")
    r = check(g, student({"A": "mastered", "B": "not_started"}), problem("C"))
    assert r.verdict is Verdict.COLLISION
    assert r.gap_hard == ["B"]
    assert r.unknown_required == ["C"]  # 명시적 미확보 + 미확인 동시 표시


def test_suggested_excludes_gap_node_with_unknown_prereq() -> None:
    """gap 노드의 hard 선수가 미확인이면 suggested_next 에 넣지 않는다(실제 mastered 만)."""
    g = graph_of("graph_chain.yaml")
    r = check(g, student({"B": "not_started"}), problem("C"))
    assert r.verdict is Verdict.COLLISION
    assert r.gap_hard == ["B"]
    assert r.unknown_hard == ["A"]
    assert r.suggested_next == []  # B 의 선수 A 가 미확인이므로 B 는 제외


def test_explicit_not_started_required_concept_is_aligned() -> None:
    """요구 개념이 명시적 미시작이라도 선수가 모두 숙달이면 ALIGNED(지금 시작할 수 있음)."""
    g = graph_of("graph_chain.yaml")
    r = check(g, student({"A": "mastered", "B": "mastered", "C": "not_started"}), problem("C"))
    assert r.verdict is Verdict.ALIGNED


def test_empty_requires_rejected_by_engine() -> None:
    """requires 가 빈 검사는 엔진에서도 명확히 거부한다(스키마 우회 방어)."""
    g = graph_of("graph_chain.yaml")
    empty = ProblemSpec.model_construct(problem_id="P", text="t", requires=[])
    with pytest.raises(DataError, match="비어"):
        check(g, student({}), empty)


# --- 상태 모델 · 마이그레이션 ----------------------------------------------

def test_state_model_and_version() -> None:
    """상태 4종 허용, 명시적 not_started 보존, version 필드 규칙."""
    from pydantic import ValidationError

    s = student({"A": "unknown", "B": "not_started", "C": "emerging", "D": "mastered"})
    assert s.states["B"] == "not_started"  # 명시적 미시작은 지우지 않는다
    assert s.version == 1  # version 없는 파일은 과거 형식(1)
    s2 = StudentState.model_validate({"student_id": "S", "version": 2, "states": {"A": "mastered"}})
    assert s2.version == 2
    with pytest.raises(ValidationError):
        StudentState.model_validate({"student_id": "S", "version": 3, "states": {}})


def test_v1_file_missing_nodes_become_unknown() -> None:
    """과거 형식(버전 없음) 파일: 빠진 항목은 미시작인지 미확인인지 복원 불가 -> 미확인으로 이전."""
    g = graph_of("graph_chain.yaml")
    r = check(g, load_student(FIX / "student_chain_unknown.yaml"), load_problem(FIX / "problem_c.yaml"))
    assert r.verdict is Verdict.NEEDS_REVIEW
    assert r.unknown_hard == ["B"]


def test_explicit_unknown_in_yaml_is_allowed() -> None:
    """YAML 에 unknown 을 명시해도 오류는 아니다(기록 없음을 뜻함)."""
    s = student({"A": "unknown"})
    g = graph_of("graph_chain.yaml")
    r = check(g, s, problem("C"))
    assert r.unknown_hard == ["A", "B"]  # B 도 기록 없음(미확인)


# --- 스펙 5장 9 -----------------------------------------------------------

def _load_gen_module():  # type: ignore[no-untyped-def]
    """scripts/gen_synthetic.py 를 경로로 import 한다."""
    spec = importlib.util.spec_from_file_location("gen_synthetic", ROOT / "scripts" / "gen_synthetic.py")
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.parametrize(
    "graph_path",
    [FIX / "graph_chain.yaml", FIX / "graph_diamond.yaml", FIX / "graph_soft.yaml",
     ROOT / "examples" / "graph_toy.yaml"],
    ids=lambda p: p.name,
)
def test_09_synthetic_students_never_collide_on_single_node_problems(graph_path: Path) -> None:
    """KST 하향 폐쇄 합성 학생(모든 노드 명시)에 대해 단일 노드 문제의 COLLISION 은
    정확히 '범위 밖' 노드에서만 난다.

    1. n 이 M 또는 outer fringe 에 속하면 COLLISION 0건(TOO_EASY/ALIGNED).
    2. n 이 둘 다 아니면 항상 COLLISION (어떤 hard 선수가 명시적 미시작·형성 중).
    """
    gen = _load_gen_module()
    g = ConceptGraph(load_graph(graph_path))
    students = gen.generate_students(g, 200, seed=7)
    verdicts: set[Verdict] = set()
    for s in students:
        mastered = {n for n, v in s.states.items() if v == "mastered"}
        # 합성 데이터 자체가 하향 폐쇄인지, 모든 노드가 명시되어 있는지 먼저 확인
        assert g.hard_ancestors(mastered) <= mastered, s.student_id
        assert set(s.states) == set(g.node_ids), s.student_id
        reachable = mastered | set(outer_fringe(g, s))
        for node in g.node_ids:
            r = check(g, s, problem(node))
            verdicts.add(r.verdict)
            if node in reachable:
                assert r.verdict is not Verdict.COLLISION, (s.student_id, node)
            else:
                assert r.verdict is Verdict.COLLISION, (s.student_id, node)
    # 모든 학생이 한 가지 판정만 받는 퇴화 데이터가 아님을 확인
    assert {Verdict.ALIGNED, Verdict.TOO_EASY} <= verdicts


def test_09b_sparse_students_unknown_paths() -> None:
    """부분 확인 학생(명시적 미시작을 지워 미확인으로 둔 합성 학생)의 불변식.

    1. M ∪ outer fringe 의 노드는 COLLISION 이 아니다(TOO_EASY/ALIGNED/NEEDS_REVIEW).
    2. 그 밖의 노드는 COLLISION 또는 NEEDS_REVIEW (TOO_EASY/ALIGNED never).
    3. NEEDS_REVIEW 가 실제로 발생한다(미확인 경로 검증).
    """
    gen = _load_gen_module()
    g = ConceptGraph(load_graph(ROOT / "graph" / "graph_v0.yaml"))
    students = gen.generate_students(g, 40, seed=11)
    seen: set[Verdict] = set()
    for s in students:
        sparse = StudentState(
            student_id=s.student_id,
            version=2,
            states={n: v for n, v in s.states.items() if v != "not_started"},
        )
        mastered = {n for n, v in sparse.states.items() if v == "mastered"}
        reachable = mastered | set(outer_fringe(g, sparse))
        for node in g.node_ids:
            r = check(g, sparse, problem(node))
            seen.add(r.verdict)
            if node in reachable:
                assert r.verdict is not Verdict.COLLISION, (sparse.student_id, node)
            else:
                assert r.verdict in (Verdict.COLLISION, Verdict.NEEDS_REVIEW), (sparse.student_id, node)
    assert Verdict.NEEDS_REVIEW in seen


# --- 공유 fixture(Python ↔ TypeScript 동일 의미 검증) ------------------------

def test_shared_cases() -> None:
    """tests/fixtures/shared_cases.json 의 모든 사례가 Python 엔진 기대값과 일치한다."""
    doc = json.loads((FIX / "shared_cases.json").read_text(encoding="utf-8"))
    graphs: dict[str, ConceptGraph] = {}

    def graph_for(rel: str) -> ConceptGraph:
        if rel not in graphs:
            graphs[rel] = ConceptGraph(load_graph(ROOT / rel))
        return graphs[rel]

    assert len(doc["cases"]) >= 20
    for case in doc["cases"]:
        s = StudentState.model_validate({"student_id": "S", "version": 2, "states": case["states"]})
        p = ProblemSpec(problem_id="P", text="t", requires=case["requires"])
        r = check(graph_for(case["graph"]), s, p)
        e = case["expect"]
        assert r.verdict.value == e["verdict"], case["name"]
        assert r.gap_hard == e["gap_hard"], case["name"]
        assert r.gap_soft == e["gap_soft"], case["name"]
        assert r.unknown_hard == e["unknown_hard"], case["name"]
        assert r.unknown_required == e["unknown_required"], case["name"]
        assert r.suggested_next == e["suggested_next"], case["name"]


# --- 보조 테스트 ----------------------------------------------------------

def test_emerging_counts_as_gap() -> None:
    """emerging 은 명시적 미확보이므로 선수 gap 에 포함된다."""
    g = graph_of("graph_chain.yaml")
    r = check(g, student({"A": "mastered", "B": "emerging"}), problem("C"))
    assert r.verdict is Verdict.COLLISION and r.gap_hard == ["B"]


def test_hard_gap_includes_transitive_and_suggests_nearest() -> None:
    """이행적 조상까지 gap 에 들어가고, suggested 는 바로 배울 수 있는 노드뿐이다."""
    g = graph_of("graph_chain.yaml")
    r = check(g, student({"A": "not_started", "B": "not_started"}), problem("C"))
    assert r.gap_hard == ["A", "B"]
    assert r.suggested_next == ["A"]


def test_requires_member_that_is_ancestor_of_another_requires() -> None:
    """R 안의 노드라도 다른 R 의 hard 조상이면 gap 후보다(해석 3 참조)."""
    g = graph_of("graph_chain.yaml")
    r = check(g, student({"A": "mastered", "B": "not_started"}), problem("B", "C"))
    assert r.verdict is Verdict.COLLISION and r.gap_hard == ["B"]


def test_suggested_sorted_by_distance_to_requires() -> None:
    """suggested 는 R 까지 최단 경로가 짧은 순, 동률은 ID 순."""
    from checker.models import GraphSpec

    src = [{"type": "t", "ref": "r"}]
    spec = GraphSpec.model_validate({
        "version": "0.1", "domain": "d",
        "nodes": [{"id": i, "label": i, "sources": src} for i in ("X", "Y", "Z", "R")],
        "edges": [
            {"from": "X", "to": "Y", "kind": "hard", "sources": src},
            {"from": "Y", "to": "R", "kind": "hard", "sources": src},
            {"from": "Z", "to": "R", "kind": "hard", "sources": src},
        ],
    })
    g = ConceptGraph(spec)
    r = check(g, student({"X": "not_started", "Y": "not_started", "Z": "not_started"}), problem("R"))
    assert r.gap_hard == ["X", "Y", "Z"]
    assert r.suggested_next == ["Z", "X"]  # Z(거리1) < X(거리2); Y 는 X 미확보라 제외


def test_unknown_student_state_node_rejected() -> None:
    """student.states 의 없는 노드 ID 도 에러."""
    g = graph_of("graph_chain.yaml")
    with pytest.raises(UnknownConceptError):
        check(g, load_student(FIX / "student_unknown_node.yaml"), problem("C"))


def test_validate_rejects_duplicate_id_and_unknown_edge_node() -> None:
    """ID 중복과 엣지의 미존재 노드 참조를 각각 명확히 거부."""
    with pytest.raises(DataError, match="중복"):
        load_graph(FIX / "graph_dup_id.yaml")
    with pytest.raises(DataError, match="존재하지 않는 노드"):
        load_graph(FIX / "graph_unknown_edge.yaml")


def test_schema_errors_point_to_location() -> None:
    """잘못된 필드는 위치와 이유를 알려준다."""
    with pytest.raises(DataError) as ei:
        load_graph(FIX / "graph_bad_field.yaml")
    msg = str(ei.value)
    assert "nodes[1]" in msg and "lable" in msg
    assert "edges[0]" in msg and "kind" in msg and "medium" in msg
    with pytest.raises(DataError, match="states.A"):
        load_student(FIX / "student_bad_state.yaml")
    with pytest.raises(DataError, match="requires"):
        load_problem(FIX / "problem_empty_requires.yaml")
    with pytest.raises(DataError, match="찾을 수 없습니다"):
        load_graph(FIX / "nope.yaml")


def test_outer_fringe() -> None:
    """outer fringe = mastered 아님 & hard 선수 모두 mastered."""
    g = graph_of("graph_diamond.yaml")
    assert outer_fringe(g, student({})) == ["A"]
    assert outer_fringe(g, student({"A": "mastered"})) == ["B", "C"]
    assert outer_fringe(g, student({"A": "mastered", "B": "mastered"})) == ["C"]
    assert outer_fringe(g, student({"A": "mastered", "B": "emerging"})) == ["B", "C"]


def test_josa() -> None:
    """받침에 따른 조사 선택."""
    assert josa("덧셈", "을/를") == "덧셈을"
    assert josa("자릿값", "이/가") == "자릿값이"
    assert josa("수 세기", "이/가") == "수 세기가"
    assert josa("10 이내 덧셈", "은/는") == "10 이내 덧셈은"
    assert josa("10", "이/가") == "10이"
    assert josa("2", "이/가") == "2가"


def test_spec_example_explanation_and_json() -> None:
    """스펙 3.2 예시(examples/) 재현. toy 학생은 N05 형성 중·N06 명시적 미시작."""
    g = ConceptGraph(load_graph(ROOT / "examples" / "graph_toy.yaml"))
    r = check(g, load_student(ROOT / "examples" / "student_toy.yaml"),
              load_problem(ROOT / "examples" / "problem_toy.yaml"))
    d = r.model_dump(mode="json")
    assert list(d) == ["problem_id", "student_id", "verdict", "requires", "gap_hard",
                       "gap_soft", "unknown_hard", "unknown_required", "suggested_next",
                       "explanation"]
    assert d["verdict"] == "COLLISION"
    assert d["gap_hard"] == ["N05_make_ten", "N06_place_value_tens_ones"]
    assert d["unknown_required"] == ["N08_add_within_20_carry"]
    assert d["suggested_next"] == ["N05_make_ten"]
    assert d["explanation"] == (
        "이 문제는 '받아올림이 있는 20 이내 덧셈'을 요구하는데, 학생의 선수 개념 "
        "'10 만들기', '십과 일의 자릿값'이 시작 전이거나 형성 중입니다. "
        "이 문제의 개념 '받아올림이 있는 20 이내 덧셈'의 기록이 아직 확인되지 않았습니다. "
        "'10 만들기'은(는) 선수 개념이 모두 숙달로 확인된 개념입니다."
    )


def test_student_a_demo_results() -> None:
    """examples/real 학생 A × 문제 3종 고정 결과(데모 시나리오)."""
    g = ConceptGraph(load_graph(ROOT / "graph" / "graph_v0.yaml"))
    s = load_student(ROOT / "examples" / "real" / "student_A.yaml")
    carry = check(g, s, load_problem(ROOT / "examples" / "real" / "problem_carry.yaml"))
    assert carry.verdict is Verdict.COLLISION
    assert carry.gap_hard == ["N16_ten_complements"]  # 형성 중(명시)
    assert carry.unknown_hard == ["N17_teen_as_ten_and_ones"]  # 기록 없음
    assert carry.suggested_next == ["N16_ten_complements"]
    assert carry.unknown_required == []

    make10 = check(g, s, load_problem(ROOT / "examples" / "real" / "problem_make10.yaml"))
    assert make10.verdict is Verdict.ALIGNED

    add5 = check(g, s, load_problem(ROOT / "examples" / "real" / "problem_add5.yaml"))
    assert add5.verdict is Verdict.TOO_EASY


def test_cli_check_json_validate_fringe_batch(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """CLI 4개 서브커맨드의 기본 동작과 종료 코드."""
    ex = ROOT / "examples"
    gp, sp, pp = str(ex / "graph_toy.yaml"), str(ex / "student_toy.yaml"), str(ex / "problem_toy.yaml")

    assert main(["check", "--graph", gp, "--student", sp, "--problem", pp, "--json"]) == 0
    d = json.loads(capsys.readouterr().out)
    assert d["verdict"] == "COLLISION"
    assert d["unknown_required"] == ["N08_add_within_20_carry"]

    assert main(["validate", "--graph", gp]) == 0
    assert "OK" in capsys.readouterr().out
    assert main(["validate", "--graph", str(FIX / "graph_cycle.yaml")]) == 1
    assert "사이클" in capsys.readouterr().err

    assert main(["fringe", "--graph", gp, "--student", sp]) == 0
    out = capsys.readouterr().out
    assert "N05_make_ten" in out and "N04_subtract_within_10" in out
    assert "[emerging]" in out  # 명시 상태 표시

    sdir, pdir = tmp_path / "students", tmp_path / "problems"
    sdir.mkdir(); pdir.mkdir()
    (sdir / "s1.yaml").write_text(Path(sp).read_text(encoding="utf-8"), encoding="utf-8")
    (pdir / "p1.yaml").write_text(Path(pp).read_text(encoding="utf-8"), encoding="utf-8")
    out_csv = tmp_path / "results.csv"
    assert main(["batch", "--graph", gp, "--students", str(sdir), "--problems", str(pdir),
                 "--out", str(out_csv)]) == 0
    rows = list(csv.DictReader(out_csv.open(encoding="utf-8")))
    assert len(rows) == 1 and rows[0]["verdict"] == "COLLISION"
    assert rows[0]["gap_hard"] == "N05_make_ten;N06_place_value_tens_ones"
    assert rows[0]["unknown_required"] == "N08_add_within_20_carry"
