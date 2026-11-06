import { useState } from 'react';
import { draftStatesFromIep, SAMPLE_IEP_TEXT } from '../data/draft';
import { GROUPS, groupOf } from '../data/groups';
import { graph, nodeSpec } from '../graph';
import type { Action, AppState } from '../state';
import { StateSegmented } from './Segmented';

/** 학생 현행수준 모달.
 * v2: ① IEP 현행수준 문장을 붙여넣으면 룰로 상태 "초안"을 채우고(확정은 교사),
 *     ② 39행 표는 그룹별 <details>로 접어서(상태가 있는 그룹만 펼침) 처음 보는 부담을 줄였다.
 * 진도율·개수 집계는 표시하지 않는다(원칙 7). */
export function StudentTab({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const student = state.students.find((s) => s.id === state.currentId)!;
  const [paste, setPaste] = useState('');
  const [applied, setApplied] = useState<'some' | 'none' | null>(null);
  const st = (x: string) => student.states[x] ?? 'not_started';

  const applyDraft = () => {
    const draft = draftStatesFromIep(paste);
    const n = Object.keys(draft).length;
    dispatch({ type: 'applyIepDraft', states: draft });
    setApplied(n > 0 ? 'some' : 'none');
  };

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

      <div className="card iep-paste">
        <h3>IEP 현행수준 문장으로 초안 채우기</h3>
        <p className="muted">
          현행수준 문장을 그대로 붙여넣으면, 문장 속 단어를 보고 아래 표의 초안을 채워요.
          문장에 나온 개념만 고치고 나머지는 그대로 둡니다. <strong>채워진 칸은 반드시 교사가 확인·수정하세요.</strong>
        </p>
        <textarea
          rows={3}
          value={paste}
          onChange={(e) => { setPaste(e.target.value); setApplied(null); }}
          placeholder={`예: ${SAMPLE_IEP_TEXT}`}
          aria-label="IEP 현행수준 문장 붙여넣기"
        />
        <div className="iep-actions">
          <button type="button" className="btn btn-primary" disabled={!paste.trim()} onClick={applyDraft}>초안 채우기</button>
          <button type="button" className="btn" onClick={() => { setPaste(SAMPLE_IEP_TEXT); setApplied(null); }}>예시 문장 넣기</button>
          {applied === 'some' && <span className="ok-note" role="status">초안을 채웠어요 — 아래 표에서 확인하고 고치세요.</span>}
          {applied === 'none' && <span className="muted" role="status">문장에서 힌트를 못 찾았어요. 아래에서 직접 고치세요.</span>}
        </div>
      </div>

      <div className="groups">
        {GROUPS.map((g) => {
          const ids = graph.nodeIds.filter((id) => groupOf(id).key === g.key);
          const hasAny = ids.some((id) => student.states[id]);
          return (
            <details key={g.key} id={`grp-${g.key}`} className="group-fold" open={hasAny}>
              <summary style={{ background: g.bg, borderColor: g.border }}>{g.name}</summary>
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
            </details>
          );
        })}
      </div>

      <p className="note">
        숙달 = 도움 없이 안정적으로 수행 · 형성 중 = 시도하지만 아직 불안정 · 미시작 = 아직 다루지 않음.
        "선수까지 숙달"은 그 개념 아래 필수 선수까지 한 번에 숙달로 표시합니다. 이 표의 확정은 교사가 합니다.
      </p>
    </div>
  );
}
