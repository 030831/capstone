"""YAML 스키마(pydantic 모델)와 결과/예외 타입.

필드명은 스펙 2장·3.2장과 동일하다. 알 수 없는 필드는 오타로 간주해 거부한다.
"""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CheckerError(Exception):
    """검사기에서 발생하는 모든 사용자 대상 오류의 기반 클래스."""


class DataError(CheckerError):
    """YAML 로드·스키마·그래프 구조 오류. 여러 건의 메시지를 담을 수 있다."""

    def __init__(self, messages: list[str] | str) -> None:
        """메시지 목록(또는 단일 메시지)으로 예외를 만든다."""
        self.messages: list[str] = [messages] if isinstance(messages, str) else list(messages)
        super().__init__("\n".join(self.messages))


class UnknownConceptError(CheckerError):
    """그래프에 없는 노드 ID 를 참조했을 때의 오류."""


class _Strict(BaseModel):
    """알 수 없는 필드를 거부하는 기반 모델."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Source(_Strict):
    """근거 출처. type 은 자유 문자열(예: curriculum, trajectory)."""

    type: NonEmptyStr
    ref: NonEmptyStr
    url: str | None = None
    page: str | None = None  # 원문 쪽수 (예: "PDF p.166")


class Node(_Strict):
    """개념 노드."""

    id: NonEmptyStr
    label: NonEmptyStr
    description: str | None = None
    level_hint: str | None = None  # 참고용. 판정에 쓰지 않음
    sources: list[Source] = Field(min_length=1)


class Edge(_Strict):
    """선수 관계 엣지. YAML 에서는 ``from`` 키를 쓴다."""

    from_: NonEmptyStr = Field(alias="from")
    to: NonEmptyStr
    kind: Literal["hard", "soft"]
    sources: list[Source] = Field(min_length=1)


class GraphSpec(_Strict):
    """graph.yaml 전체."""

    version: NonEmptyStr
    domain: NonEmptyStr
    nodes: list[Node]
    edges: list[Edge] = Field(default_factory=list)


StateName = Literal["mastered", "emerging", "not_started"]


class StudentState(_Strict):
    """student.yaml. 명시하지 않은 노드는 not_started 로 취급한다."""

    student_id: NonEmptyStr
    updated: date | None = None
    states: dict[str, StateName] = Field(default_factory=dict)


class Surface(_Strict):
    """문제의 표면 차원. v0 는 저장만 한다(v1 변이 검사용)."""

    number_range: str | None = None
    context: str | None = None
    representation: str | None = None
    support: str | None = None


class ProblemSpec(_Strict):
    """problem.yaml."""

    problem_id: NonEmptyStr
    text: NonEmptyStr
    requires: list[NonEmptyStr] = Field(min_length=1)
    surface: Surface | None = None


class Verdict(str, Enum):
    """판정 결과. 이름은 스펙 3장과 동일하다."""

    COLLISION = "COLLISION"
    TOO_EASY = "TOO_EASY"
    ALIGNED = "ALIGNED"


class CheckResult(BaseModel):
    """스펙 3.2 출력. 필드 순서가 JSON 키 순서가 된다."""

    problem_id: str
    student_id: str
    verdict: Verdict
    requires: list[str]
    gap_hard: list[str]
    gap_soft: list[str]
    suggested_next: list[str]
    explanation: str
