import { groupOf } from '../data/groups';
import { hardAncestors } from '../engine';
import { graph, nodeSpec } from '../graph';
import type { Action, AppState } from '../state';
import { STATE_LABEL } from '../ui';
import { StateSegmented } from './Segmented';

const SOURCE_TYPE: Record<string, string> = {
  curriculum_basic: '특수교육 기본교육과정',
  curriculum_common: '공통교육과정',
  trajectory: '학습궤적',
};

function NodeLink({
  id, kind, state, dispatch,
}: { id: string; kind: 'hard' | 'soft'; state: 'mastered' | 'emerging' | 'not_started'; dispatch: (a: Action) => void }) {
  return (
    <li>
      <button type="button" className="link-btn" onClick={() => dispatch({ type: 'focusNode', node: id })}>
        {nodeSpec(id).label}
      </button>
      <span className={`kind kind-${kind}`}>{kind === 'hard' ? '필수' : '권장'}</span>
      <span className={`st st-${state}`}>{STATE_LABEL[state]}</span>
    </li>
  );
}

/** 탭 1 우측 패널: 선택한 노드의 설명·근거·선후 관계와 현재 학생 상태 편집. */
export function NodePanel({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const id = state.selectedNode;
  if (!id) {
    return (
      <aside className="panel panel-empty" aria-label="개념 상세">
        <h2>개념 상세</h2>
        <p>그래프에서 개념을 누르거나 위에서 이름으로 찾으면, 설명·근거 교육과정·선수와 후속 개념이 여기에 나옵니다.</p>
        <p>현재 학생의 상태도 이 자리에서 바로 바꿀 수 있습니다.</p>
      </aside>
    );
  }
  const n = nodeSpec(id);
  const grp = groupOf(id);
  const student = state.students.find((s) => s.id === state.currentId)!;
  const st = (x: string) => student.states[x] ?? 'not_started';
  const hardPre = [...graph.hardPred.get(id)!];
  const softPre = [...graph.softPred.get(id)!];
  const hardPost = [...graph.hardSucc.get(id)!];
  const softPost = [...graph.softSucc.get(id)!];
  const pre = [...hardPre.map((x) => ({ x, k: 'hard' as const })), ...softPre.map((x) => ({ x, k: 'soft' as const }))];
  const post = [...hardPost.map((x) => ({ x, k: 'hard' as const })), ...softPost.map((x) => ({ x, k: 'soft' as const }))];
  const missingPre = [...hardAncestors(graph, [id])].filter((x) => st(x) !== 'mastered');
  const current = st(id);

  return (
    <aside className="panel" aria-label="개념 상세">
      <span className="panel-group" style={{ background: grp.bg, borderColor: grp.border }}>{grp.name}</span>
      <h2>{n.label}</h2>
      <div className="panel-id">{n.id}</div>
      {n.description && <p>{n.description}</p>}

      <h3>{student.name}의 현재 상태</h3>
      <StateSegmented
        name={`panel-${id}`}
        value={current}
        ariaLabel={`${n.label} 상태`}
        onChange={(s) => dispatch({ type: 'setNodeState', node: id, state: s })}
      />
      {current === 'mastered' && missingPre.length > 0 && (
        <p className="warn">숙달로 표시했지만 필수 선수 개념 {missingPre.length}개가 아직 숙달이 아닙니다. 아래 선수 목록을 확인하세요.</p>
      )}
      {missingPre.length > 0 && (
        <div className="panel-actions">
          <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'masterWithPrereqs', node: id })}>
            이 개념과 필수 선수 모두 숙달로 표시
          </button>
        </div>
      )}

      <h3>선수 개념</h3>
      {pre.length === 0 ? <p className="muted">없음 — 출발 개념입니다.</p> : <ul className="rel">{pre.map((r) => <NodeLink key={r.x + r.k} id={r.x} kind={r.k} state={st(r.x)} dispatch={dispatch} />)}</ul>}
      <h3>후속 개념</h3>
      {post.length === 0 ? <p className="muted">없음 — 이 범위의 끝 개념입니다.</p> : <ul className="rel">{post.map((r) => <NodeLink key={r.x + r.k} id={r.x} kind={r.k} state={st(r.x)} dispatch={dispatch} />)}</ul>}

      {n.level_hint && (
        <>
          <h3>교육과정 위치 (참고용, 판정에 쓰지 않음)</h3>
          <p>{n.level_hint}</p>
        </>
      )}

      <h3>근거</h3>
      <ul className="sources">
        {n.sources.map((s, i) => (
          <li key={i}>
            <span className="src-type">{SOURCE_TYPE[s.type] ?? s.type}</span>
            {s.page && <span className="src-page">{s.page}</span>}
            <div>{s.ref}</div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
