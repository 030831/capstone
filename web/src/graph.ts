// 앱 전역에서 쓰는 개념 그래프(graph_v0.json 을 빌드 시점에 검증해 한 번만 만든다).
import graphJson from './data/graph_v0.json';
import { buildGraph, type GraphSpec, type NodeSpec } from './engine';

export const graph = buildGraph(graphJson as unknown as GraphSpec);

const nodeMap = new Map<string, NodeSpec>(graph.spec.nodes.map((n) => [n.id, n]));
export const nodeSpec = (id: string): NodeSpec => nodeMap.get(id)!;

/** 근거 성취기준 코드 1개: 예 "[2수학01-04]". 교육과정 근거의 첫 코드를 우선한다. */
export function basisCode(id: string): string {
  const n = nodeSpec(id);
  const re = /\[\d수학?\d{2}-\d{2}(?:~\d{2})?\]/;
  const cur = n.sources.filter((s) => s.type.startsWith('curriculum'));
  for (const s of [...cur, ...n.sources]) {
    const m = re.exec(s.ref);
    if (m) return m[0];
  }
  return '궤적 근거';
}
