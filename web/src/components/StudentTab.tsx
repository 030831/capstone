import { GROUPS, groupOf } from '../data/groups';
import { graph, nodeSpec } from '../graph';
import type { Action, AppState } from '../state';
import { StateSegmented } from './Segmented';

/** 학생 현행수준 모달: 현재 학생의 39개 개념 상태를 그룹별 표로 편집. 진도율·개수 집계는 표시하지 않는다. */
export function StudentTab({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const student = state.students.find((s) => s.id === state.currentId)!;
  const st = (x: string) => student.states[x] ?? 'not_started';

  return (
    <div className="page page-modal">
      <div className="page-head">
        <h2>{student.name}의 현행수준</h2>
        <div className="page-actions">
          <button type="button" className="btn" onClick={() => dispatch({ type: 'addStudent' })}>학생 추가</button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={state.students.length <= 1}
            onClick={() => {
              if (window.confirm(`${student.name}을(를) 삭제할까요? 되돌릴 수 없습니다.`)) dispatch({ type: 'deleteStudent', id: student.id });
            }}
          >
            {student.name} 삭제
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              if (window.confirm('학생 목록을 예시(학생 A, B, C)로 되돌립니다. 지금까지 입력한 내용은 사라집니다.')) dispatch({ type: 'resetPresets' });
            }}
          >
            예시 학생으로 되돌리기
          </button>
        </div>
      </div>
      <p className="lead">
        숙달 = 도움 없이 안정적으로 수행 · 형성 중 = 시도하지만 아직 불안정 · 미시작 = 아직 다루지 않음.
        개념 하나를 숙달로 표시하면서 그 아래 선수 개념까지 한 번에 채우려면 "선수까지 숙달"을 누르세요.
      </p>

      <div className="student-layout">
        <nav className="group-nav" aria-label="개념 묶음 바로가기">
          {GROUPS.map((g) => (
            <a key={g.key} href={`#grp-${g.key}`} style={{ borderLeftColor: g.border }}>{g.name}</a>
          ))}
          <p className="nav-note">이 표는 교사가 IEP 현행수준을 보고 채웁니다. 앞으로는 현행수준 문장을 읽고 초안을 제안하되, 확정은 교사가 합니다.</p>
        </nav>

        <div>
          {GROUPS.map((g) => {
            const ids = graph.nodeIds.filter((id) => groupOf(id).key === g.key);
            return (
              <section key={g.key} id={`grp-${g.key}`} className="group-sec" aria-labelledby={`grp-h-${g.key}`}>
                <h3 id={`grp-h-${g.key}`} className="group-title" style={{ background: g.bg, borderColor: g.border }}>{g.name}</h3>
                <table className="tbl">
                  <thead>
                    <tr><th scope="col">개념</th><th scope="col">상태</th><th scope="col"><span className="muted">빠른 입력</span></th></tr>
                  </thead>
                  <tbody>
                    {ids.map((id) => {
                      const cur = st(id);
                      const missing = [...graph.hardPred.get(id)!].filter((p) => st(p) !== 'mastered');
                      const inconsistent = cur === 'mastered' && missing.length > 0;
                      return (
                        <tr key={id}>
                          <th scope="row" className="cell-label">
                            <span className="cell-name">{nodeSpec(id).label}</span>
                            <span className="cell-id">{nodeSpec(id).description}</span>
                            {inconsistent && (
                              <span className="row-warn">
                                필수 선수 {missing.map((m) => nodeSpec(m).label).join(', ')}은(는) 아직 숙달이 아닙니다.
                              </span>
                            )}
                          </th>
                          <td>
                            <StateSegmented
                              name={`st-${student.id}-${id}`}
                              value={cur}
                              ariaLabel={`${nodeSpec(id).label} 상태`}
                              onChange={(s) => dispatch({ type: 'setNodeState', node: id, state: s })}
                            />
                          </td>
                          <td className="cell-actions">
                            {(cur !== 'mastered' || inconsistent) && (
                              <button type="button" className="btn btn-small btn-quiet" onClick={() => dispatch({ type: 'masterWithPrereqs', node: id })}>
                                선수까지 숙달
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
