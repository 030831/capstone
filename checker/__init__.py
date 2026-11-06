"""인지적 정렬 검사기(Collision Checker) v0.

개념 그래프 위에서 문제가 학생에게 '지금 풀 준비가 된 문제'인지 판정한다.
v0 는 준비도(readiness) 검사만 구현한다.
"""

from checker.engine import ConceptGraph, check, outer_fringe
from checker.loader import load_graph, load_problem, load_student
from checker.models import (
    CheckerError,
    CheckResult,
    DataError,
    GraphSpec,
    ProblemSpec,
    StudentState,
    UnknownConceptError,
    Verdict,
)

__all__ = [
    "CheckResult",
    "CheckerError",
    "ConceptGraph",
    "DataError",
    "GraphSpec",
    "ProblemSpec",
    "StudentState",
    "UnknownConceptError",
    "Verdict",
    "check",
    "load_graph",
    "load_problem",
    "load_student",
    "outer_fringe",
]

__version__ = "0.1.0"
