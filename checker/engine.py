"""판정 엔진(스펙 3장). 순수 함수 중심, I/O 없음."""

from __future__ import annotations

from collections.abc import Iterable

import networkx as nx

from checker.explain import explain
from checker.models import (
    CheckResult,
    DataError,
    GraphSpec,
    ProblemSpec,
    StudentState,
    UnknownConceptError,
    Verdict,
)


class ConceptGraph:
    """검증된 GraphSpec 위의 hard/soft 선수 관계 조회 도우미.

    hard 엣지와 soft 엣지를 별도의 방향 그래프로 보관한다(엣지 방향: 선수 -> 후속).
    """

    def __init__(self, spec: GraphSpec) -> None:
        """GraphSpec(로더로 검증을 마친 것)으로 그래프를 만든다."""
        self.spec = spec
        self._labels: dict[str, str] = {n.id: n.label for n in spec.nodes}
        self._hard: nx.DiGraph = nx.DiGraph()
        self._soft: nx.DiGraph = nx.DiGraph()
        for g in (self._hard, self._soft):
            g.add_nodes_from(self._labels)
        for e in spec.edges:
            (self._hard if e.kind == "hard" else self._soft).add_edge(e.from_, e.to)

    @property
    def node_ids(self) -> list[str]:
        """노드 ID 목록(정의 순서)."""
        return list(self._labels)

    def has_node(self, node_id: str) -> bool:
        """노드 ID 존재 여부."""
        return node_id in self._labels

    def label(self, node_id: str) -> str:
        """노드의 한국어 라벨."""
        return self._labels[node_id]

    def hard_predecessors(self, node_id: str) -> set[str]:
        """직접 hard 선수 집합."""
        return set(self._hard.predecessors(node_id))

    def hard_ancestors(self, nodes: Iterable[str]) -> set[str]:
        """주어진 노드들의 hard 엣지 조상(이행적 폐포)의 합집합. 노드 자신은 포함하지 않는다."""
        out: set[str] = set()
        for n in nodes:
            out |= nx.ancestors(self._hard, n)
        return out

    def soft_predecessors(self, nodes: Iterable[str]) -> set[str]:
        """주어진 노드들의 soft 직접 선수(1단계)의 합집합."""
        out: set[str] = set()
        for n in nodes:
            out |= set(self._soft.predecessors(n))
        return out

    def hard_distance_to(self, source: str, targets: Iterable[str]) -> int | None:
        """source 에서 targets 중 하나까지의 hard 최단 경로 길이. 닿지 않으면 None."""
        best: int | None = None
        for t in targets:
            if nx.has_path(self._hard, source, t):
                d = nx.shortest_path_length(self._hard, source, t)
                if best is None or d < best:
                    best = d
        return best


def _ensure_known(graph: ConceptGraph, ids: Iterable[str], what: str) -> None:
    """ids 가 모두 그래프에 있는지 확인한다. 없으면 UnknownConceptError."""
    unknown = sorted({i for i in ids if not graph.has_node(i)})
    if unknown:
        raise UnknownConceptError(
            f"{what}에 그래프에 없는 노드 ID가 있습니다: " + ", ".join(f"'{u}'" for u in unknown)
        )


def _mastered(student: StudentState) -> set[str]:
    """학생이 mastered 로 기록한 노드 집합 M."""
    return {n for n, s in student.states.items() if s == "mastered"}


def _state_of(student: StudentState) -> dict[str, str]:
    """모든 노드의 상태 조회용. 기록에 없는 노드는 ``unknown`` (미확인 = 기록 없음)."""
    return student.states  # dict.get(id, "unknown") 로 사용한다


def check(graph: ConceptGraph, student: StudentState, problem: ProblemSpec) -> CheckResult:
    """문제 하나가 학생에게 준비된 문제인지 판정한다(스펙 3장, 2026-11-07 개정).

    판정 순서(고정):

    1. 필수 선수 중 명시적 not_started/emerging → ``COLLISION``
    2. 필수 선수 또는 요구 개념에 unknown(기록 없음) → ``NEEDS_REVIEW``
    3. 요구 개념 모두 mastered → ``TOO_EASY``
    4. 나머지 → ``ALIGNED``

    unknown 은 gap_hard/gap_soft(명시적 미확보 목록)와 분리해
    unknown_hard(선수)/unknown_required(요구 개념)로 반환한다.
    soft 선수의 unknown 만으로는 판정을 바꾸지 않는다.

    Args:
        graph: 개념 그래프.
        student: 학생 상태(명시 안 된 노드는 unknown).
        problem: 검사할 문제.

    Returns:
        스펙 3.2 형식의 CheckResult.

    Raises:
        DataError: problem.requires 가 비어 있을 때(엔진 차원의 명시적 거부).
        UnknownConceptError: problem.requires 또는 student.states 에 그래프에 없는
            노드 ID가 있을 때.
    """
    _ensure_known(graph, problem.requires, f"문제 '{problem.problem_id}'의 requires")
    _ensure_known(graph, student.states, f"학생 '{student.student_id}'의 states")
    if not problem.requires:
        raise DataError(
            f"문제 '{problem.problem_id}'의 requires 가 비어 있습니다 "
            "(검사에 쓸 개념이 1개 이상 필요합니다)"
        )

    requires = list(dict.fromkeys(problem.requires))  # 순서 유지 중복 제거
    state = _state_of(student)
    mastered = _mastered(student)

    hard_pre = graph.hard_ancestors(requires)  # 다른 R 의 조상인 R 노드 포함(기존 해석 유지)
    req_set = set(requires)

    # 명시적 미확보(시작 전·형성 중)만 gap 목록에 넣는다. unknown 은 별도.
    gap_hard = sorted(
        n for n in hard_pre if state.get(n, "unknown") in ("not_started", "emerging")
    )
    gap_soft = sorted(
        n
        for n in graph.soft_predecessors(requires)
        if state.get(n, "unknown") in ("not_started", "emerging")
    )
    # 미확인은 '선수'와 '요구 개념'을 구분한다. R 안의 노드는 unknown_required 로만 센다.
    unknown_hard = sorted(
        n for n in hard_pre - req_set if state.get(n, "unknown") == "unknown"
    )
    unknown_required = sorted(n for n in requires if state.get(n, "unknown") == "unknown")

    if gap_hard:
        verdict = Verdict.COLLISION
    elif unknown_hard or unknown_required:
        verdict = Verdict.NEEDS_REVIEW
    elif req_set <= mastered:
        verdict = Verdict.TOO_EASY
    else:
        verdict = Verdict.ALIGNED

    suggested: list[str] = []
    if verdict is Verdict.COLLISION:
        # 자신의 hard 선수가 '실제로 모두 mastered'인 gap 노드만 제안한다.
        # 선수 중 unknown 이 있으면 제안하지 않는다(확인되지 않은 상태로는 후보라고 할 수 없다).
        ready = [n for n in gap_hard if graph.hard_predecessors(n) <= mastered]
        suggested = sorted(
            ready, key=lambda n: (graph.hard_distance_to(n, requires) or 0, n)
        )

    lab = graph.label
    explanation = explain(
        verdict,
        requires=[lab(n) for n in requires],
        gap_hard=[lab(n) for n in gap_hard],
        gap_soft=[lab(n) for n in gap_soft],
        unknown_hard=[lab(n) for n in unknown_hard],
        unknown_required=[lab(n) for n in unknown_required],
        suggested_next=[lab(n) for n in suggested],
        unmastered_requires=[lab(n) for n in requires if n not in mastered],
    )
    return CheckResult(
        problem_id=problem.problem_id,
        student_id=student.student_id,
        verdict=verdict,
        requires=requires,
        gap_hard=gap_hard,
        gap_soft=gap_soft,
        unknown_hard=unknown_hard,
        unknown_required=unknown_required,
        suggested_next=suggested,
        explanation=explanation,
    )


def outer_fringe(graph: ConceptGraph, student: StudentState) -> list[str]:
    """학생의 outer fringe: mastered 가 아니면서 hard 선수가 모두 mastered 인 노드.

    주의: 이 정의는 그래프 구조상 '지금 배울 수 있는 후보'이며, 노드 자신의
    상태(unknown 포함)는 따로 확인해야 한다.

    Args:
        graph: 개념 그래프.
        student: 학생 상태.

    Returns:
        노드 ID 목록(그래프 정의 순서).

    Raises:
        UnknownConceptError: student.states 에 그래프에 없는 노드 ID 가 있을 때.
    """
    _ensure_known(graph, student.states, f"학생 '{student.student_id}'의 states")
    mastered = _mastered(student)
    return [
        n
        for n in graph.node_ids
        if n not in mastered and graph.hard_predecessors(n) <= mastered
    ]
