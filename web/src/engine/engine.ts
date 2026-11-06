// checker/engine.py 포팅. 순수 함수, I/O 없음. 의미는 Python 구현과 동일하다.
import { explainLabels } from './explain';
import { hasNode, label, type ConceptGraph } from './graph';
import {
  UnknownConceptError,
  type CheckResult,
  type States,
  type Verdict,
} from './types';

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** R 의 각 노드의 hard 조상(이행적 폐포) 합집합. R 자신은 (다른 R 의 조상이 아닌 한) 제외. */
export function hardAncestors(g: ConceptGraph, nodeIds: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const start of nodeIds) {
    const stack = [...(g.hardPred.get(start) ?? [])];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const u = stack.pop()!;
      if (seen.has(u)) continue;
      seen.add(u);
      out.add(u);
      for (const p of g.hardPred.get(u) ?? []) stack.push(p);
    }
  }
  return out;
}

/** 주어진 노드들의 soft 직접 선수(1단계) 합집합. */
export function softDirectPrereqs(g: ConceptGraph, nodeIds: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const n of nodeIds) for (const p of g.softPred.get(n) ?? []) out.add(p);
  return out;
}

/** source 에서 targets 중 하나까지의 hard 최단 경로 길이(자신이 target 이면 0). 닿지 않으면 null. */
function hardDistanceTo(g: ConceptGraph, source: string, targets: ReadonlySet<string>): number | null {
  let frontier = [source];
  const seen = new Set<string>([source]);
  for (let d = 0; frontier.length > 0; d++) {
    if (frontier.some((n) => targets.has(n))) return d;
    const next: string[] = [];
    for (const n of frontier) {
      for (const s of g.hardSucc.get(n) ?? []) {
        if (!seen.has(s)) {
          seen.add(s);
          next.push(s);
        }
      }
    }
    frontier = next;
  }
  return null;
}

function ensureKnown(g: ConceptGraph, ids: Iterable<string>, what: string): void {
  const unknown = [...new Set([...ids].filter((i) => !hasNode(g, i)))].sort(byId);
  if (unknown.length > 0) {
    throw new UnknownConceptError(
      `${what}에 그래프에 없는 노드 ID가 있습니다: ` + unknown.map((u) => `'${u}'`).join(', '),
    );
  }
}

function masteredSet(states: States): Set<string> {
  return new Set(Object.entries(states).filter(([, s]) => s === 'mastered').map(([n]) => n));
}

/**
 * outer fringe: mastered 가 아니면서 hard 선수가 모두 mastered 인 노드.
 * "지금 가능한 후보 집합"일 뿐이며 순서에 의미가 없다(ID 정렬은 표시 안정성을 위한 것).
 */
export function outerFringe(g: ConceptGraph, states: States): string[] {
  ensureKnown(g, Object.keys(states), '학생 states');
  const m = masteredSet(states);
  return g.nodeIds
    .filter((n) => !m.has(n) && [...(g.hardPred.get(n) ?? [])].every((p) => m.has(p)))
    .sort(byId);
}

/** 문제 하나(requires)가 학생(states)에게 준비된 문제인지 판정한다. */
export function check(g: ConceptGraph, states: States, requiresIn: readonly string[]): CheckResult {
  ensureKnown(g, requiresIn, '문제의 requires');
  ensureKnown(g, Object.keys(states), '학생 states');

  const requires = [...new Set(requiresIn)]; // 순서 유지 중복 제거
  const mastered = masteredSet(states);

  const gapHard = [...hardAncestors(g, requires)].filter((n) => !mastered.has(n)).sort(byId);
  const gapSoft = [...softDirectPrereqs(g, requires)].filter((n) => !mastered.has(n)).sort(byId);

  let verdict: Verdict;
  let suggestedNext: string[] = [];
  if (gapHard.length > 0) {
    verdict = 'COLLISION';
    // gapHard ∩ outerFringe: 자신의 hard 선수가 모두 mastered 인 gap 노드 = 지금 바로 배울 수 있는 노드
    const ready = gapHard.filter((n) => [...(g.hardPred.get(n) ?? [])].every((p) => mastered.has(p)));
    const reqSet = new Set(requires);
    const dist = new Map(ready.map((n) => [n, hardDistanceTo(g, n, reqSet) ?? 0]));
    suggestedNext = [...ready].sort((a, b) => dist.get(a)! - dist.get(b)! || byId(a, b));
  } else if (requires.every((n) => mastered.has(n))) {
    verdict = 'TOO_EASY';
  } else {
    verdict = 'ALIGNED';
  }

  const unmasteredRequires = requires.filter((n) => !mastered.has(n));
  const partial: CheckResult = {
    verdict,
    requires,
    gapHard,
    gapSoft,
    suggestedNext,
    unmasteredRequires,
    explanation: '',
  };
  return { ...partial, explanation: explain(g, partial) };
}

/** CheckResult 를 Python explain.py 템플릿과 같은 한국어 문장으로 설명한다. */
export function explain(g: ConceptGraph, r: CheckResult): string {
  const lab = (ids: readonly string[]) => ids.map((n) => label(g, n));
  return explainLabels(
    r.verdict,
    lab(r.requires),
    lab(r.gapHard),
    lab(r.gapSoft),
    lab(r.suggestedNext),
    lab(r.unmasteredRequires),
  );
}
