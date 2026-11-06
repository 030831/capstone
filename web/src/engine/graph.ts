import { DataError, type GraphSpec } from './types';

/** hard/soft 엣지를 따로 보관하는 조회용 그래프. 방향: 선수 -> 후속. */
export interface ConceptGraph {
  spec: GraphSpec;
  /** 정의 순서의 노드 ID */
  nodeIds: string[];
  labels: Map<string, string>;
  hardPred: Map<string, Set<string>>;
  hardSucc: Map<string, Set<string>>;
  softPred: Map<string, Set<string>>;
  softSucc: Map<string, Set<string>>;
}

/** 스키마(필수 필드·sources 1개 이상)와 구조(ID 중복·미존재 노드·사이클)를 검증한다. */
export function validateGraphSpec(spec: GraphSpec): string[] {
  const errors: string[] = [];
  const seen = new Map<string, number[]>();
  spec.nodes.forEach((n, i) => {
    if (!n.id || !n.label) errors.push(`nodes[${i}]: id/label 이 비어 있습니다`);
    if (!Array.isArray(n.sources) || n.sources.length === 0) {
      errors.push(`nodes[${i}] (id=${n.id}).sources: sources 가 없거나 비어 있습니다 (근거 source 는 1개 이상 필수)`);
    }
    seen.set(n.id, [...(seen.get(n.id) ?? []), i]);
  });
  for (const [id, idxs] of seen) {
    if (idxs.length > 1) {
      errors.push(`노드 ID가 중복되었습니다: '${id}' (${idxs.map((i) => `nodes[${i}]`).join(', ')})`);
    }
  }
  const adj = new Map<string, string[]>();
  for (const id of seen.keys()) adj.set(id, []);
  spec.edges.forEach((e, i) => {
    if (e.kind !== 'hard' && e.kind !== 'soft') {
      errors.push(`edges[${i}] (${e.from} -> ${e.to}).kind: 허용되지 않는 값입니다 (입력: ${String(e.kind)}, 허용: hard, soft)`);
    }
    if (!Array.isArray(e.sources) || e.sources.length === 0) {
      errors.push(`edges[${i}] (${e.from} -> ${e.to}).sources: sources 가 없거나 비어 있습니다`);
    }
    let ok = true;
    for (const [k, v] of [['from', e.from], ['to', e.to]] as const) {
      if (!seen.has(v)) {
        errors.push(`edges[${i}] (${e.from} -> ${e.to}): '${k}' 가 존재하지 않는 노드 ID 입니다: '${v}'`);
        ok = false;
      }
    }
    if (ok) adj.get(e.from)!.push(e.to);
  });

  // 사이클 탐지(DFS). 가장 작은 ID 부터 시작하도록 회전해 결정적 메시지를 만든다.
  const color = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  let cycle: string[] | null = null;
  const dfs = (u: string): void => {
    if (cycle) return;
    color.set(u, 1);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      if (cycle) return;
      const c = color.get(v) ?? 0;
      if (c === 1) {
        cycle = stack.slice(stack.indexOf(v));
        return;
      }
      if (c === 0) dfs(v);
    }
    stack.pop();
    color.set(u, 2);
  };
  for (const id of seen.keys()) if (!color.get(id) && !cycle) dfs(id);
  if (cycle) {
    const c: string[] = cycle;
    let k = 0;
    c.forEach((x, i) => {
      if (x < c[k]) k = i;
    });
    const rot = [...c.slice(k), ...c.slice(0, k)];
    errors.push(`그래프에 사이클이 있습니다: ${[...rot, rot[0]].join(' -> ')} (그래프는 DAG 여야 합니다)`);
  }
  return errors;
}

/** 검증을 통과한 GraphSpec 으로 조회용 그래프를 만든다. 오류가 있으면 DataError. */
export function buildGraph(spec: GraphSpec): ConceptGraph {
  const errors = validateGraphSpec(spec);
  if (errors.length > 0) throw new DataError(errors);
  const mk = () => new Map<string, Set<string>>(spec.nodes.map((n) => [n.id, new Set<string>()]));
  const g: ConceptGraph = {
    spec,
    nodeIds: spec.nodes.map((n) => n.id),
    labels: new Map(spec.nodes.map((n) => [n.id, n.label])),
    hardPred: mk(),
    hardSucc: mk(),
    softPred: mk(),
    softSucc: mk(),
  };
  for (const e of spec.edges) {
    if (e.kind === 'hard') {
      g.hardPred.get(e.to)!.add(e.from);
      g.hardSucc.get(e.from)!.add(e.to);
    } else {
      g.softPred.get(e.to)!.add(e.from);
      g.softSucc.get(e.from)!.add(e.to);
    }
  }
  return g;
}

export function hasNode(g: ConceptGraph, id: string): boolean {
  return g.labels.has(id);
}

export function label(g: ConceptGraph, id: string): string {
  return g.labels.get(id) ?? id;
}
