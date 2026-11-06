"""스펙 5장 테스트 1~9 + 보조 테스트."""

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
    """학생 상태를 코드에서 직접 만든다."""
    return StudentState.model_validate({"student_id": sid, "states": states})


def problem(*requires: str) -> ProblemSpec:
    """문제를 코드에서 직접 만든다."""
    return ProblemSpec(problem_id="P", text="t", requires=list(requires))


# --- 스펙 5장 1~8 ---------------------------------------------------------

def test_01_chain_collision() -> None:
    """선형 체인, M={A}, R={C} -> COLLISION, gap={B}, suggested={B}."""
    g = graph_of("graph_chain.yaml")
    r = check(g, load_student(FIX / "student_chain_a.yaml"), load_problem(FIX / "problem_c.yaml"))
    assert r.verdict is Verdict.COLLISION
    assert r.gap_hard == ["B"]
    assert r.suggested_next == ["B"]
    assert r.gap_soft == []


def test_02_chain_aligned() -> None:
    """같은 그래프, M={A,B}, R={C} -> ALIGNED."""
    g = graph_of("graph_chain.yaml")
    r = check(g, load_student(FIX / "student_chain_ab.yaml"), load_problem(FIX / "problem_c.yaml"))
    assert r.verdict is Verdict.ALIGNED
    assert r.gap_hard == [] and r.suggested_next == []


def test_03_too_easy() -> None:
    """M={A,B,C}, R={C} -> TOO_EASY."""
    g = graph_of("graph_chain.yaml")
    r = check(g, student({"A": "mastered", "B": "mastered", "C": "mastered"}), problem("C"))
    assert r.verdict is Verdict.TOO_EASY


def test_04_soft_gap_is_warning_only() -> None:
    """soft 엣지만 미도달 -> ALIGNED + soft 경고."""
    g = graph_of("graph_soft.yaml")
    r = check(g, student({"A": "mastered"}), problem("C"))
    assert r.verdict is Verdict.ALIGNED
    assert r.gap_hard == []
    assert r.gap_soft == ["B"]
    assert "개념 B" in r.explanation  # 경고가 설명에 드러남


def test_05_diamond() -> None:
    """다이아몬드, M={A,B}, R={D} -> COLLISION, gap={C}, suggested={C}."""
    g = graph_of("graph_diamond.yaml")
    r = check(g, student({"A": "mastered", "B": "mastered"}), problem("D"))
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
    """KST 하향 폐쇄 합성 학생에 대해 단일 노드 문제의 COLLISION 은 정확히 '범위 밖' 노드에서만 난다.

    스펙 5장은 "모든 단일 노드 문제에서 COLLISION 0건"이라 적었으나, 하향 폐쇄 집합이어도
    학생이 아직 도달할 수 없는 먼 노드(M 도 outer fringe 도 아닌 노드)를 묻는 문제는 정의상
    COLLISION 이다(예: M=∅ 인 학생에게 체인의 B). 따라서 스펙의 의도(하향 폐쇄이면 학생의
    '지식 상태 안/바로 앞' 문제는 충돌이 없다)를 다음 두 명제로 검증한다.

    1. n 이 M 또는 outer fringe 에 속하면 COLLISION 0건.
    2. n 이 둘 다 아니면 항상 COLLISION (판정이 너무 느슨하지 않은지 확인).
    """
    gen = _load_gen_module()
    g = ConceptGraph(load_graph(graph_path))
    students = gen.generate_students(g, 200, seed=7)
    verdicts: set[Verdict] = set()
    for s in students:
        mastered = {n for n, v in s.states.items() if v == "mastered"}
        # 합성 데이터 자체가 하향 폐쇄인지 먼저 확인
        assert g.hard_ancestors(mastered) <= mastered, s.student_id
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


# --- 보조 테스트 ----------------------------------------------------------

def test_emerging_counts_as_gap() -> None:
    """emerging 은 mastered 가 아니므로 선수 gap 에 포함된다."""
    g = graph_of("graph_chain.yaml")
    r = check(g, student({"A": "mastered", "B": "emerging"}), problem("C"))
    assert r.verdict is Verdict.COLLISION and r.gap_hard == ["B"]


def test_hard_gap_includes_transitive_and_suggests_nearest() -> None:
    """이행적 조상까지 gap 에 들어가고, suggested 는 바로 배울 수 있는 노드뿐이다."""
    g = graph_of("graph_chain.yaml")
    r = check(g, student({}), problem("C"))
    assert r.gap_hard == ["A", "B"]
    assert r.suggested_next == ["A"]


def test_requires_member_that_is_ancestor_of_another_requires() -> None:
    """R 안의 노드라도 다른 R 의 hard 조상이면 gap 후보다(해석 3 참조)."""
    g = graph_of("graph_chain.yaml")
    r = check(g, student({"A": "mastered"}), problem("B", "C"))
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
    r = check(g, student({}), problem("R"))
    assert r.gap_hard == ["X", "Y", "Z"]
    assert r.suggested_next == ["Z", "X"]  # Z(거리1) < X(거리2); Y 는 X 미도달이라 제외


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
    """스펙 3.2 예시(examples/)를 그대로 재현한다."""
    g = ConceptGraph(load_graph(ROOT / "examples" / "graph_toy.yaml"))
    r = check(g, load_student(ROOT / "examples" / "student_toy.yaml"),
              load_problem(ROOT / "examples" / "problem_toy.yaml"))
    d = r.model_dump(mode="json")
    assert list(d) == ["problem_id", "student_id", "verdict", "requires", "gap_hard",
                       "gap_soft", "suggested_next", "explanation"]
    assert d["verdict"] == "COLLISION"
    assert d["gap_hard"] == ["N05_make_ten", "N06_place_value_tens_ones"]
    assert d["suggested_next"] == ["N05_make_ten"]
    assert d["explanation"] == (
        "이 문제는 '받아올림이 있는 20 이내 덧셈'을 요구하는데, 학생은 선수 개념 "
        "'10 만들기', '십과 일의 자릿값'이 미도달입니다. '10 만들기'은(는) 지금 바로 다룰 수 있는 선수 개념입니다."
    )


def test_cli_check_json_validate_fringe_batch(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """CLI 4개 서브커맨드의 기본 동작과 종료 코드."""
    ex = ROOT / "examples"
    gp, sp, pp = str(ex / "graph_toy.yaml"), str(ex / "student_toy.yaml"), str(ex / "problem_toy.yaml")

    assert main(["check", "--graph", gp, "--student", sp, "--problem", pp, "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["verdict"] == "COLLISION"

    assert main(["validate", "--graph", gp]) == 0
    assert "OK" in capsys.readouterr().out
    assert main(["validate", "--graph", str(FIX / "graph_cycle.yaml")]) == 1
    assert "사이클" in capsys.readouterr().err

    assert main(["fringe", "--graph", gp, "--student", sp]) == 0
    out = capsys.readouterr().out
    assert "N05_make_ten" in out and "N04_subtract_within_10" in out

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
