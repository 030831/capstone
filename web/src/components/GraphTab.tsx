import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { graphlib, layout } from '@dagrejs/dagre';
import { GROUPS, groupOf } from '../data/groups';
import { outerFringe, type State } from '../engine';
import { graph, nodeSpec } from '../graph';
import type { Action, AppState } from '../state';
import { STATE_LABEL } from '../ui';
import { NodePanel } from './NodePanel';

const NODE_W = 200;
const NODE_H = 58;

type Role = 'req' | 'gapHard' | 'gapSoft' | null;

interface ConceptData extends Record<string, unknown> {
  label: string;
  stripe: string;
  state: State;
  fringe: boolean;
  role: Role;
  selected: boolean;
  dim: boolean;
}

const ROLE_TEXT: Record<Exclude<Role, null>, string> = {
  req: '요구 개념',
  gapHard: '선수 미도달',
  gapSoft: '권장 선수 미도달',
};

/** 개념 노드. 상태는 색뿐 아니라 텍스트("숙달/형성 중/미시작")로도 표시한다. */
function ConceptNode({ data }: NodeProps<Node<ConceptData>>) {
  const cls = [
    'cnode',
    `cnode-${data.state}`,
    data.fringe ? 'cnode-fringe' : '',
    data.role ? `cnode-${data.role}` : '',
    data.selected ? 'cnode-selected' : '',
    data.dim ? 'cnode-dim' : '',
  ].join(' ');
  return (
    <div className={cls} style={{ ['--stripe' as string]: data.stripe }}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="cnode-label">{data.label}</div>
      <div className="cnode-tags">
        <span className="cnode-state">{STATE_LABEL[data.state]}</span>
        {data.fringe && <span className="cnode-tag tag-fringe">지금 도전 가능</span>}
        {data.role && <span className={`cnode-tag tag-${data.role}`}>{ROLE_TEXT[data.role]}</span>}
      </div>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { concept: ConceptNode };

/** dagre 로 왼쪽→오른쪽 계층 레이아웃(위치는 그래프에만 의존하므로 한 번만 계산). */
const positions: Map<string, { x: number; y: number }> = (() => {
  const g = new graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 26, ranksep: 96, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const id of graph.nodeIds) g.setNode(id, { width: NODE_W, height: NODE_H });
  for (const e of graph.spec.edges) g.setEdge(e.from, e.to);
  layout(g);
  return new Map(graph.nodeIds.map((id) => [id, { x: g.node(id).x - NODE_W / 2, y: g.node(id).y - NODE_H / 2 }]));
})();

/** 선택 노드가 바뀌거나 포커스 요청이 오면 그 노드로 화면을 옮긴다. */
function CenterOnSelection({ selected, request }: { selected: string | null; request: number }) {
  const rf = useReactFlow();
  const last = useRef(-1);
  useEffect(() => {
    if (!selected || request === last.current) return;
    last.current = request;
    if (!positions.has(selected)) return;
    // 선택 노드 + 직접 선수·후속이 모두 보이도록 맞춘다.
    const ids = new Set<string>([selected]);
    for (const e of graph.spec.edges) {
      if (e.kind !== 'hard') continue;
      if (e.from === selected) ids.add(e.to);
      if (e.to === selected) ids.add(e.from);
    }
    void rf.fitView({ nodes: [...ids].map((id) => ({ id })), padding: 0.2, duration: 400, maxZoom: 1.0, minZoom: 0.7 });
  }, [selected, request, rf]);
  return null;
}

/** 이름으로 개념 찾기. 고르면 선택 + 화면 이동. */
function NodeSearch({ dispatch }: { dispatch: (a: Action) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const t = q.trim();
  const hits = t ? graph.nodeIds.filter((id) => nodeSpec(id).label.includes(t) || id.toLowerCase().includes(t.toLowerCase())).slice(0, 12) : [];
  const pick = (id: string) => {
    dispatch({ type: 'focusNode', node: id });
    setQ('');
    setOpen(false);
  };
  return (
    <div className="search-wrap">
      <input
        type="search"
        className="search"
        placeholder="개념 찾기 (예: 보수, 받아올림)"
        aria-label="개념 찾기"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) pick(hits[0]); if (e.key === 'Escape') setOpen(false); }}
      />
      {open && t && (
        <div className="search-results" role="listbox" aria-label="검색 결과">
          {hits.length === 0 && <div className="muted" style={{ padding: '6px 10px' }}>일치하는 개념이 없습니다</div>}
          {hits.map((id) => (
            <button key={id} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(id)}>
              {nodeSpec(id).label}
              <span className="sr-grp">{groupOf(id).name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function GraphTab({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const student = state.students.find((s) => s.id === state.currentId)!;
  const fringe = useMemo(() => new Set(state.showFringe ? outerFringe(graph, student.states) : []), [state.showFringe, student.states]);
  const hl = state.highlight;
  const [focusNeighbors, setFocusNeighbors] = useState(true);
  const sel = state.selectedNode;

  // 선택 노드의 이웃(선수·후속 전부) — 그 밖은 흐리게.
  const neighborhood = useMemo(() => {
    if (!sel) return null;
    const set = new Set<string>([sel]);
    for (const e of graph.spec.edges) {
      if (e.from === sel) set.add(e.to);
      if (e.to === sel) set.add(e.from);
    }
    return set;
  }, [sel]);

  const nodes: Node<ConceptData>[] = useMemo(() => {
    const roleOf = (id: string): Role => {
      if (!hl) return null;
      if (hl.requires.includes(id)) return 'req';
      if (hl.gapHard.includes(id)) return 'gapHard';
      if (hl.gapSoft.includes(id)) return 'gapSoft';
      return null;
    };
    return graph.nodeIds.map((id) => {
      const role = roleOf(id);
      const dim = focusNeighbors && neighborhood !== null && !neighborhood.has(id) && role === null;
      return {
        id,
        type: 'concept',
        position: positions.get(id)!,
        width: NODE_W,
        height: NODE_H,
        draggable: false,
        data: {
          label: nodeSpec(id).label,
          stripe: groupOf(id).border,
          state: student.states[id] ?? 'not_started',
          fringe: fringe.has(id),
          role,
          selected: sel === id,
          dim,
        },
      };
    });
  }, [student.states, fringe, hl, sel, focusNeighbors, neighborhood]);

  const edges: Edge[] = useMemo(
    () =>
      graph.spec.edges.map((e, i) => {
        const incoming = sel !== null && e.to === sel;   // 선택 노드의 선수
        const outgoing = sel !== null && e.from === sel; // 선택 노드의 후속
        const touch = incoming || outgoing;
        const color = incoming ? '#2f6fed' : outgoing ? '#167a63' : e.kind === 'hard' ? '#55606d' : '#9aa3ae';
        const dim = focusNeighbors && sel !== null && !touch;
        return {
          id: `e${i}`,
          source: e.from,
          target: e.to,
          type: 'default',
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
          style: {
            stroke: color,
            strokeWidth: touch ? 2.6 : e.kind === 'hard' ? 1.5 : 1.2,
            strokeDasharray: e.kind === 'soft' ? '5 4' : undefined,
            opacity: dim ? 0.15 : 1,
          },
          zIndex: touch ? 10 : 0,
        };
      }),
    [sel, focusNeighbors],
  );

  return (
    <div className="graph-tab">
      <div className="graph-main">
        <div className="toolbar">
          <NodeSearch dispatch={dispatch} />
          <label className="toggle">
            <input type="checkbox" checked={state.showFringe} onChange={() => dispatch({ type: 'toggleFringe' })} />
            <span>지금 도전 가능한 개념 표시</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={focusNeighbors} onChange={() => setFocusNeighbors((v) => !v)} />
            <span>선택한 개념 주변만 선명하게</span>
          </label>
          {hl && (
            <span className="hl-notice" role="status">
              검사 결과 표시 중
              <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'clearHighlight' })}>
                지우기
              </button>
            </span>
          )}
        </div>
        <div className="legend" aria-label="범례">
          <span className="legend-item"><i className="lg lg-mastered" />숙달</span>
          <span className="legend-item"><i className="lg lg-emerging" />형성 중</span>
          <span className="legend-item"><i className="lg lg-not_started" />미시작</span>
          {state.showFringe && <span className="legend-item"><i className="lg lg-fringe" />지금 도전 가능 (순서 없는 후보)</span>}
          <span className="legend-sep" />
          <span className="legend-item"><i className="lg-line" />필수 선수</span>
          <span className="legend-item"><i className="lg-line lg-soft" />권장 선수</span>
          {sel && (
            <>
              <span className="legend-item"><i className="lg-line" style={{ borderColor: '#2f6fed' }} />선택한 개념의 선수</span>
              <span className="legend-item"><i className="lg-line" style={{ borderColor: '#167a63' }} />선택한 개념의 후속</span>
            </>
          )}
          <span className="legend-sep" />
          {GROUPS.map((g) => (
            <span key={g.key} className="legend-item">
              <i className="lg lg-dot" style={{ background: g.border }} />
              {g.name}
            </span>
          ))}
        </div>
        <div className="flow-wrap">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.06 }}
              minZoom={0.15}
              maxZoom={1.6}
              nodesDraggable={false}
              nodesConnectable={false}
              onNodeClick={(_, n) => dispatch({ type: 'selectNode', node: n.id })}
              onPaneClick={() => dispatch({ type: 'selectNode', node: null })}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={24} color="#e6e3dc" />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) => {
                  const s = (n.data as ConceptData).state;
                  return s === 'mastered' ? '#243447' : s === 'emerging' ? '#9db0c4' : '#d9dde2';
                }}
              />
              <CenterOnSelection selected={sel} request={state.focusRequest} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
      <NodePanel state={state} dispatch={dispatch} />
    </div>
  );
}
