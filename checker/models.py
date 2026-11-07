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


# 명시하지 않은 노드는 unknown(기록 없음)으로 해석한다.
StateName = Literal["unknown", "not_started", "emerging", "mastered"]


class StudentState(_Strict):
    """student.yaml.

    상태 의미 (v2):

    - ``unknown``: 아직 확인한 기록이 없음. **명시하지 않은 노드의 해석값.**
    - ``not_started``: 교사가 아직 다루지 않았다고 확인함.
    - ``emerging``: 수행이 형성 중이거나 불안정함.
    - ``mastered``: 교사가 숙달로 확인함.

    ``version`` 은 저장 형식 버전이다. 1 = 과거 형식(빠진 항목이 미시작인지
    미확인인지 구분이 없어 복원 불가 — 빠진 항목은 미확인으로 이전),
    2 = 현재 형식. 명시적 ``not_started`` 는 저장·로드에서 지우지 않는다.
    """

    student_id: NonEmptyStr
    version: Literal[1, 2] = 1
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
    """판정 결과. 판정 순서는 스펙 3장(2026-11-07 개정)을 따른다.

    우선순위:

    1. ``COLLISION`` — 필수 선수 중 명시적 not_started/emerging 이 있음.
    2. ``NEEDS_REVIEW`` — 필수 선수 또는 요구 개념에 unknown(기록 없음)이 있음.
    3. ``TOO_EASY`` — 위 조건이 없고 요구 개념이 모두 mastered.
    4. ``ALIGNED`` — 나머지(필수 선수 확인, 요구 개념 미숙달).
    """

    COLLISION = "COLLISION"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    TOO_EASY = "TOO_EASY"
    ALIGNED = "ALIGNED"


class CheckResult(BaseModel):
    """스펙 3.2 출력. 필드 순서가 JSON 키 순서가 된다.

    - ``gap_hard``/``gap_soft``: 명시적으로 미확보(not_started/emerging)인 선수만.
    - ``unknown_hard``/``unknown_required``: 기록이 없는(unknown) 선수/요구 개념.
      unknown 은 gap 목록과 분리된다(미확인 ≠ 미시작).
    """

    problem_id: str
    student_id: str
    verdict: Verdict
    requires: list[str]
    gap_hard: list[str]
    gap_soft: list[str]
    unknown_hard: list[str]
    unknown_required: list[str]
    suggested_next: list[str]
    explanation: str
