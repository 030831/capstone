"""YAML 로더. pydantic 스키마 검증 + 그래프 구조 검증(ID 중복·미존재 노드·사이클)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import networkx as nx
import yaml
from pydantic import BaseModel, ValidationError

from checker.models import DataError, GraphSpec, ProblemSpec, StudentState


def _read_yaml(path: str | Path) -> Any:
    """YAML 파일을 읽어 파이썬 객체로 반환한다. 파일/구문 오류는 DataError."""
    p = Path(path)
    try:
        text = p.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise DataError(f"{p}: 파일을 찾을 수 없습니다.") from None
    except OSError as e:
        raise DataError(f"{p}: 파일을 읽을 수 없습니다 ({e}).") from None
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as e:
        mark = getattr(e, "problem_mark", None)
        where = f" (줄 {mark.line + 1}, 칸 {mark.column + 1})" if mark else ""
        raise DataError(f"{p}: YAML 문법 오류{where}: {getattr(e, 'problem', e)}") from None
    if not isinstance(data, dict):
        raise DataError(f"{p}: 최상위는 '키: 값' 형태의 매핑이어야 합니다.")
    return data


def _loc_to_str(loc: tuple[Any, ...], raw: dict[str, Any]) -> str:
    """pydantic 오류 위치를 ``nodes[2] (id=N03).sources`` 같은 문자열로 만든다."""
    out = ""
    cur: Any = raw
    for part in loc:
        if isinstance(part, int):
            out += f"[{part}]"
            try:
                cur = cur[part]
            except (IndexError, KeyError, TypeError):
                cur = None
            if isinstance(cur, dict):
                if "id" in cur:
                    out += f" (id={cur['id']})"
                elif "from" in cur and "to" in cur:
                    out += f" ({cur['from']} -> {cur['to']})"
        else:
            out += ("." if out else "") + str(part)
            try:
                cur = cur[part]
            except (IndexError, KeyError, TypeError):
                cur = None
    return out


def _translate(err: dict[str, Any]) -> str:
    """pydantic 오류 한 건을 한국어 설명으로 바꾼다."""
    etype: str = err["type"]
    loc = err["loc"]
    ctx = err.get("ctx") or {}
    if loc and loc[-1] == "sources" and etype in ("missing", "too_short"):
        return "sources 가 없거나 비어 있습니다 (근거 source 는 1개 이상 필수)"
    if etype == "missing":
        return "필수 필드가 없습니다"
    if etype == "extra_forbidden":
        return "알 수 없는 필드입니다 (필드명 오타인지 확인하세요)"
    if etype in ("literal_error", "enum"):
        return f"허용되지 않는 값입니다 (입력: {err.get('input')!r}, 허용: {ctx.get('expected')})"
    if etype == "too_short":
        return f"비어 있거나 너무 짧습니다 (최소 {ctx.get('min_length')}개/글자 필요)"
    if etype == "string_type":
        return f"문자열이어야 합니다 (입력: {err.get('input')!r})"
    if etype == "list_type":
        return "목록(리스트)이어야 합니다"
    if etype == "dict_type":
        return "'키: 값' 매핑이어야 합니다"
    if etype == "model_type":
        return "객체(매핑)여야 합니다"
    if etype.startswith("date"):
        return f"날짜는 YYYY-MM-DD 형식이어야 합니다 (입력: {err.get('input')!r})"
    return str(err["msg"])


def _parse(model: type[BaseModel], raw: dict[str, Any], path: str | Path) -> Any:
    """raw dict 를 모델로 검증한다. 실패 시 위치가 포함된 DataError."""
    try:
        return model.model_validate(raw)
    except ValidationError as e:
        msgs = [
            f"{path}: {_loc_to_str(tuple(er['loc']), raw)}: {_translate(dict(er))}"
            for er in e.errors()
        ]
        raise DataError(msgs) from None


def validate_graph_spec(spec: GraphSpec) -> list[str]:
    """스키마를 통과한 그래프의 구조 오류(ID 중복·미존재 노드·사이클) 목록을 반환한다.

    오류가 없으면 빈 리스트.
    """
    errors: list[str] = []

    seen: dict[str, list[int]] = {}
    for i, n in enumerate(spec.nodes):
        seen.setdefault(n.id, []).append(i)
    for nid, idxs in seen.items():
        if len(idxs) > 1:
            where = ", ".join(f"nodes[{i}]" for i in idxs)
            errors.append(f"노드 ID가 중복되었습니다: '{nid}' ({where})")

    ids = set(seen)
    g = nx.DiGraph()
    g.add_nodes_from(seen)  # 정의 순서 유지(결과 메시지 결정성)
    for i, e in enumerate(spec.edges):
        missing = [(k, v) for k, v in (("from", e.from_), ("to", e.to)) if v not in ids]
        if missing:
            for k, v in missing:
                errors.append(
                    f"edges[{i}] ({e.from_} -> {e.to}): '{k}' 가 존재하지 않는 노드 ID 입니다: '{v}'"
                )
            continue
        g.add_edge(e.from_, e.to)

    try:
        cycle = nx.find_cycle(g)
    except nx.NetworkXNoCycle:
        pass
    else:
        nodes = [u for u, _ in cycle]
        k = nodes.index(min(nodes))  # 가장 작은 ID 부터 시작하도록 회전(결정적 출력)
        nodes = nodes[k:] + nodes[:k]
        path = nodes + [nodes[0]]
        errors.append(
            "그래프에 사이클이 있습니다: " + " -> ".join(path) + " (그래프는 DAG 여야 합니다)"
        )
    return errors


def load_graph(path: str | Path) -> GraphSpec:
    """graph.yaml 을 읽고 스키마·구조를 모두 검증해 반환한다.

    Raises:
        DataError: 파일/문법/스키마/ID 중복/미존재 노드/사이클 오류. 메시지는 한국어.
    """
    raw = _read_yaml(path)
    spec: GraphSpec = _parse(GraphSpec, raw, path)
    problems = validate_graph_spec(spec)
    if problems:
        raise DataError([f"{path}: {m}" for m in problems])
    return spec


def load_student(path: str | Path) -> StudentState:
    """student.yaml 을 읽고 스키마를 검증해 반환한다.

    Raises:
        DataError: 파일/문법/스키마 오류.
    """
    return _parse(StudentState, _read_yaml(path), path)  # type: ignore[no-any-return]


def load_problem(path: str | Path) -> ProblemSpec:
    """problem.yaml 을 읽고 스키마를 검증해 반환한다.

    Raises:
        DataError: 파일/문법/스키마 오류.
    """
    return _parse(ProblemSpec, _read_yaml(path), path)  # type: ignore[no-any-return]
