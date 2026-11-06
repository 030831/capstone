import { useMemo } from 'react';
import { SAMPLE_PROBLEMS } from '../data/problems';
import { check } from '../engine';
import { graph, nodeSpec } from '../graph';
import type { Action, AppState } from '../state';
import { VerdictBadge } from './Badges';

/** 탭 4: 같은 문제를 학급 전체에 적용. 행 순서는 학생 목록 순서이며 판정으로 정렬하지 않는다. */
export function BatchTab({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const { draft } = state;
  const usingSample = draft.requires.length === 0;
  const problem = usingSample
    ? { text: SAMPLE_PROBLEMS[1].text, requires: SAMPLE_PROBLEMS[1].requires }
    : { text: draft.text, requires: draft.requires };

  const rows = useMemo(
    () => state.students.map((s) => ({ student: s, result: check(graph, s.states, problem.requires) })),
    [state.students, problem.requires],
  );
  const collisions = rows.filter((r) => r.result.verdict === 'COLLISION').length;
  const open = (id: string) => dispatch({ type: 'openStudentResult', id, text: problem.text, requires: problem.requires });

  return (
    <div className="page">
      <div className="page-head">
        <h2>학급 일괄 검사</h2>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'setTab', tab: 'check' })}>문제 바꾸기</button>
      </div>
      <p className="lead">같은 문제를 반 전체에 낼 때 누구에게 먼저 다른 준비가 필요한지 봅니다. 학생 간 비교나 순위가 아닙니다.</p>

      <div className="card batch-problem" style={{ marginTop: 14 }}>
        <div>
          <span className="muted">검사 대상 문제{usingSample ? ' — 문제 검사 탭에 입력한 문제가 없어 예시(받아올림 덧셈)를 씁니다' : ''}</span>
          <p className="result-problem">{problem.text || '(문제 글 없음)'}</p>
          <p><span className="muted">필요한 개념:</span> {problem.requires.map((id) => <span key={id} className="chip chip-req">{nodeSpec(id).label}</span>)}</p>
        </div>
      </div>

      <p className="summary" role="status">
        {collisions === 0
          ? `학생 ${rows.length}명 모두 선수 개념 충돌이 없습니다.`
          : `학생 ${rows.length}명 중 ${collisions}명에게 선수 개념 충돌이 있습니다.`}
      </p>
      <table className="tbl tbl-batch">
        <thead>
          <tr>
            <th scope="col">학생</th>
            <th scope="col">판정</th>
            <th scope="col">아직 숙달하지 못한 필수 선수 개념</th>
            <th scope="col">지금 바로 다룰 수 있는 선수 개념</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ student, result }) => (
            <tr key={student.id} className="row-click" onClick={() => open(student.id)}>
              <th scope="row">
                <button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); open(student.id); }}>
                  {student.name}
                </button>
              </th>
              <td><VerdictBadge verdict={result.verdict} /></td>
              <td>{result.gapHard.length === 0 ? <span className="muted">없음</span> : result.gapHard.map((id) => <span key={id} className="chip chip-hard">{nodeSpec(id).label}</span>)}</td>
              <td>
                {result.verdict === 'COLLISION'
                  ? result.suggestedNext.map((id) => <span key={id} className="chip chip-next">{nodeSpec(id).label}</span>)
                  : <span className="muted">&mdash;</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">행을 누르면 그 학생의 자세한 결과로 이동합니다.</p>
    </div>
  );
}
