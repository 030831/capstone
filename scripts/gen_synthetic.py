"""KST 방식 합성 학생 생성기.

하향 폐쇄 집합(어떤 노드가 mastered 면 그 모든 hard 조상도 mastered)을 만족하는
무작위 학생 상태를 만든다. 모든 노드에 상태를 **명시**한다(완전 확인 학생):
mastered / fringe 50% emerging / 나머지 not_started.
명시하지 않으면 unknown(기록 없음)으로 해석되므로, '의도상 미시작'인 항목은
합성 예시 데이터에서 명시적으로 기록한다(스펙 2026-11-07).

사용 예:
    python scripts/gen_synthetic.py --graph examples/graph_toy.yaml --n 20 --seed 1 --out /tmp/students
"""

from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

import yaml

from checker.engine import ConceptGraph, outer_fringe
from checker.loader import load_graph
from checker.models import CheckerError, StudentState


def generate_students(graph: ConceptGraph, n: int, seed: int = 0) -> list[StudentState]:
    """하향 폐쇄 집합 조건을 만족하는 합성 학생 n 명을 만든다.

    절차: 무작위 개수의 시드 노드를 뽑고, 시드와 그 hard 조상 전체를 mastered 로 둔다.
    그런 다음 outer fringe 노드를 각각 50% 확률로 emerging 으로 둔다.
    나머지 노드는 not_started 로 **명시**한다(완전 확인 학생: unknown 없음).

    Args:
        graph: 개념 그래프.
        n: 생성할 학생 수.
        seed: 난수 시드(재현성).

    Returns:
        student_id 가 ``SYN001`` 형태인 StudentState 목록.
    """
    rng = random.Random(seed)
    ids = graph.node_ids
    students: list[StudentState] = []
    for i in range(n):
        seeds = rng.sample(ids, rng.randint(0, len(ids)))
        mastered = set(seeds) | graph.hard_ancestors(seeds)
        states: dict[str, str] = {m: "mastered" for m in sorted(mastered)}
        tmp = StudentState(student_id=f"SYN{i + 1:03d}", version=2, states=dict(states))
        fringe = outer_fringe(graph, tmp)
        for f in fringe:
            states[f] = "emerging" if rng.random() < 0.5 else "not_started"
        for node in ids:
            if node not in states:
                states[node] = "not_started"
        students.append(StudentState(student_id=f"SYN{i + 1:03d}", version=2, states=states))
    return students


def main(argv: list[str] | None = None) -> int:
    """CLI: 합성 학생 yaml 을 출력 디렉터리에 N 개 쓴다."""
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--graph", required=True)
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", required=True, help="출력 디렉터리")
    args = ap.parse_args(argv)
    try:
        graph = ConceptGraph(load_graph(args.graph))
    except CheckerError as e:
        print(f"오류: {e}", file=sys.stderr)
        return 1
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for s in generate_students(graph, args.n, args.seed):
        doc = {"student_id": s.student_id, "version": s.version, "states": dict(s.states)}
        (out / f"{s.student_id}.yaml").write_text(
            yaml.safe_dump(doc, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )
    print(f"{args.n}명 생성 -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
