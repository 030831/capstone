// checker/engine.py 포팅. 순수 함수, I/O 없음. 의미는 Python 구현과 동일하다.
import { explainLabels } from './explain';
import { hasNode, label, type ConceptGraph } from './graph';
import {
  DataError,
  UnknownConceptError,
  type CheckResult,
  type State,
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

const stateOf = (states: States, id: string): State => states[id] ?? 'unknown';

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

/** 문제 하나(requires)가 학생(states)에게 준비된 문제인지 판정한다.
 *
 * 판정 순서(고정, 스펙 3장 2026-11-07):
 *  1. 필수 선수 중 명시적 not_started/emerging → COLLISION
 *  2. 필수 선수 또는 요구 개념에 unknown(기록 없음) → NEEDS_REVIEW
 *  3. 요구 개념 모두 mastered → TOO_EASY
 *  4. 나머지 → ALIGNED
 *
 * unknown 은 gapHard/gapSoft(명시적 미확보)와 분리해 unknownHard/unknownRequired 로
 * 반환한다. soft 선수의 unknown 만으로는 판정을 바꾸지 않는다.
 */
export function check(g: ConceptGraph, states: States, requiresIn: readonly string[]): CheckResult {
  ensureKnown(g, requiresIn, '문제의 requires');
  ensureKnown(g, Object.keys(states), '학생 states');
  if (requiresIn.length === 0) {
    throw new DataError('문제의 requires 가 비어 있습니다 (검사에 쓸 개념이 1개 이상 필요합니다)');
  }

  const requires = [...new Set(requiresIn)]; // 순서 유지 중복 제거
  const mastered = masteredSet(states);

  const hardPre = hardAncestors(g, requires); // 다른 R 의 조상인 R 노드 포함(기존 해석 유지)
  const reqSet = new Set(requires);

  // 명시적 미확보(시작 전·형성 중)만 gap 목록에 넣는다. unknown 은 별도.
  const isExplicitGap = (n: string): boolean => {
    const s = stateOf(states, n);
    return s === 'not_started' || s === 'emerging';
  };
  const gapHard = [...hardPre].filter(isExplicitGap).sort(byId);
  const gapSoft = [...softDirectPrereqs(g, requires)].filter(isExplicitGap).sort(byId);
  // 미확인은 '선수'와 '요구 개념'을 구분. R 안의 노드는 unknownRequired 로만 센다.
  const unknownHard = [...hardPre].filter((n) => !reqSet.has(n) && stateOf(states, n) === 'unknown').sort(byId);
  const unknownRequired = requires.filter((n) => stateOf(states, n) === 'unknown');

  let verdict: Verdict;
  let suggestedNext: string[] = [];
  if (gapHard.length > 0) {
    verdict = 'COLLISION';
    // 자신의 hard 선수가 '실제로 모두 mastered'인 gap 노드만 제안한다(미확인 선수가 있으면 제외).
    const ready = gapHard.filter((n) => [...(g.hardPred.get(n) ?? [])].every((p) => mastered.has(p)));
    const dist = new Map(ready.map((n) => [n, hardDistanceTo(g, n, reqSet) ?? 0]));
    suggestedNext = [...ready].sort((a, b) => dist.get(a)! - dist.get(b)! || byId(a, b));
  } else if (unknownHard.length > 0 || unknownRequired.length > 0) {
    verdict = 'NEEDS_REVIEW';
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
    unknownHard,
    unknownRequired,
    suggestedNext,
    unmasteredRequires,
    explanation: '',
  };
  return { ...partial, explanation: explain(g, partial) };
}

/** CheckResult 를 Python explain.py 템플릿과 같은 한국어 문장으로 설명한다. */
export function explain(g: ConceptGraph, r: CheckResult): string {
  const lab = (ids: readonly string[]) => ids.map((n) => label(g, n));
  return explainLabels({
    verdict: r.verdict,
    requires: lab(r.requires),
    gapHard: lab(r.gapHard),
    gapSoft: lab(r.gapSoft),
    unknownHard: lab(r.unknownHard),
    unknownRequired: lab(r.unknownRequired),
    suggestedNext: lab(r.suggestedNext),
    unmasteredRequires: lab(r.unmasteredRequires),
  });
}
