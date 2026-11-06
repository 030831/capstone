"""명령행 인터페이스: check / validate / fringe / batch."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from checker.engine import ConceptGraph, check, outer_fringe
from checker.loader import load_graph, load_problem, load_student
from checker.models import CheckerError, CheckResult


def _build_parser() -> argparse.ArgumentParser:
    """argparse 파서를 만든다."""
    p = argparse.ArgumentParser(prog="python -m checker", description="인지적 정렬 검사기 v0")
    sub = p.add_subparsers(dest="command", required=True)

    c = sub.add_parser("check", help="문제 1개 x 학생 1명 판정")
    c.add_argument("--graph", required=True)
    c.add_argument("--student", required=True)
    c.add_argument("--problem", required=True)
    c.add_argument("--json", action="store_true", help="스펙 3.2 JSON 으로 출력")

    v = sub.add_parser("validate", help="그래프 검증(스키마·ID 중복·source 필수·DAG)")
    v.add_argument("--graph", required=True)

    f = sub.add_parser("fringe", help="학생의 outer fringe 출력")
    f.add_argument("--graph", required=True)
    f.add_argument("--student", required=True)

    b = sub.add_parser("batch", help="학생 디렉터리 x 문제 디렉터리 일괄 판정 -> CSV")
    b.add_argument("--graph", required=True)
    b.add_argument("--students", required=True, help="student yaml 들이 든 디렉터리")
    b.add_argument("--problems", required=True, help="problem yaml 들이 든 디렉터리")
    b.add_argument("--out", required=True, help="결과 CSV 경로")
    return p


def _format_result(r: CheckResult) -> str:
    """사람이 읽는 형태의 판정 출력."""
    lines = [
        f"[{r.verdict.value}] 문제 {r.problem_id} / 학생 {r.student_id}",
        f"  requires      : {', '.join(r.requires)}",
        f"  gap_hard      : {', '.join(r.gap_hard) or '-'}",
        f"  gap_soft      : {', '.join(r.gap_soft) or '-'}",
        f"  suggested_next: {', '.join(r.suggested_next) or '-'}",
        f"  설명: {r.explanation}",
    ]
    return "\n".join(lines)


def _yaml_files(directory: str) -> list[Path]:
    """디렉터리의 yaml/yml 파일을 이름순으로 반환한다."""
    d = Path(directory)
    if not d.is_dir():
        raise CheckerError(f"{d}: 디렉터리가 아닙니다.")
    files = sorted([*d.glob("*.yaml"), *d.glob("*.yml")])
    if not files:
        raise CheckerError(f"{d}: yaml 파일이 없습니다.")
    return files


def _cmd_check(args: argparse.Namespace) -> int:
    """check 서브커맨드."""
    graph = ConceptGraph(load_graph(args.graph))
    result = check(graph, load_student(args.student), load_problem(args.problem))
    if args.json:
        print(json.dumps(result.model_dump(mode="json"), ensure_ascii=False, indent=2))
    else:
        print(_format_result(result))
    return 0


def _cmd_validate(args: argparse.Namespace) -> int:
    """validate 서브커맨드."""
    spec = load_graph(args.graph)
    print(f"OK: {args.graph} - 노드 {len(spec.nodes)}개, 엣지 {len(spec.edges)}개 (DAG, source, ID 검사 통과)")
    return 0


def _cmd_fringe(args: argparse.Namespace) -> int:
    """fringe 서브커맨드."""
    graph = ConceptGraph(load_graph(args.graph))
    student = load_student(args.student)
    fringe = outer_fringe(graph, student)
    print(f"학생 {student.student_id}의 outer fringe ({len(fringe)}개):")
    if not fringe:
        print("  (없음)")
    for n in fringe:
        state = student.states.get(n, "not_started")
        print(f"  {n}  {graph.label(n)}  [{state}]")
    return 0


def _cmd_batch(args: argparse.Namespace) -> int:
    """batch 서브커맨드. 오류가 나면 파일 이름을 붙여 즉시 중단한다."""
    graph = ConceptGraph(load_graph(args.graph))
    students = []
    for p in _yaml_files(args.students):
        try:
            students.append(load_student(p))
        except CheckerError as e:
            raise CheckerError(str(e)) from None
    problems = [load_problem(p) for p in _yaml_files(args.problems)]
    cols = ["student_id", "problem_id", "verdict", "requires", "gap_hard",
            "gap_soft", "suggested_next", "explanation"]
    n = 0
    with open(args.out, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        for s in students:
            for pr in problems:
                r = check(graph, s, pr)
                w.writerow([
                    r.student_id, r.problem_id, r.verdict.value,
                    ";".join(r.requires), ";".join(r.gap_hard), ";".join(r.gap_soft),
                    ";".join(r.suggested_next), r.explanation,
                ])
                n += 1
    print(f"{n}건 판정 완료 -> {args.out}")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    """CLI 진입점. 성공 0, 데이터/검증 오류 1(메시지는 stderr), 인자 오류 2."""
    args = _build_parser().parse_args(argv)
    handlers = {
        "check": _cmd_check,
        "validate": _cmd_validate,
        "fringe": _cmd_fringe,
        "batch": _cmd_batch,
    }
    try:
        return handlers[args.command](args)
    except CheckerError as e:
        print(f"오류: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
