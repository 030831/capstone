import { useMemo } from 'react';
import { check } from '../engine';
import { graph, nodeSpec } from '../graph';
import type { Action, AppState } from '../state';
import { VerdictBadge } from './Badges';

/** 반 일괄 검사 모달: **검사한 문제**(마지막으로 검사를 통과한 확정 문제)를
 * 학급 전체의 기록과 대조한다. 작성 중인 초안과 마지막 검사 문제를 혼합하지 않고,
 * 입력이 없으면 예시 문제로 자동 대체하지도 않는다(지시서 §6).
 * 행 순서는 학생 목록 순서이며 판정으로 정렬하지 않는다. */
export function BatchTab({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const { submitted } = state;

  const rows = useMemo(
    () =>
      submitted
        ? state.students.map((s) => ({ student: s, result: check(graph, s.states, submitted.requires) }))
        : [],
    [state.students, submitted],
  );

  const counts = useMemo(() => {
    const c = { COLLISION: 0, NEEDS_REVIEW: 0, TOO_EASY: 0, ALIGNED: 0 } as Record<string, number>;
    for (const r of rows) c[r.result.verdict] += 1;
    return c;
  }, [rows]);

  const open = (id: string) =>
    submitted && dispatch({ type: 'openStudentResult', id, text: submitted.text, requires: submitted.requires });

  if (!submitted) {
    return (
      <div className="page page-modal">
        <div className="page-head">
          <h2>학생별 판정 결과</h2>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'closeModal' })}>문제로 돌아가기</button>
        </div>
        <p className="lead">확정한 문제를 반 학생 전체의 기록과 대조해 봅니다. 학생 간 비교나 순위가 아닙니다.</p>
        <div className="empty-guide" role="status">
          <p>아직 검사한 문제가 없어요.</p>
          <p className="muted">
            메인 화면에서 문제를 적고, 개념을 확인한 뒤 검사를 먼저 해 주세요.
            예시 문제를 자동으로 검사하지는 않아요 — 직접 골라 검사한 문제만 반 검사에 씁니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-modal">
      <div className="page-head">
        <h2>학생별 판정 결과</h2>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'closeModal' })}>문제로 돌아가기</button>
      </div>
      <p className="lead">지금 검사한 문제를 반 학생 전체의 기록과 대조해 봅니다. 학생 간 비교나 순위가 아닙니다.</p>

      <div className="card batch-problem" style={{ marginTop: 14 }}>
        <div>
          <span className="muted">검사한 문제</span>
          <p className="result-problem" data-user-content>{submitted.text}</p>
          <p><span className="muted">이 문제에서 다루는 개념:</span> {submitted.requires.map((id) => <span key={id} className="chip chip-req">{nodeSpec(id).label}</span>)}</p>
        </div>
      </div>

      <p className="summary" role="status">
        학생 {rows.length}명 가운데 확인이 필요한 선수 개념이 있는 학생 {counts.COLLISION}명,
        기록을 확인해야 할 학생 {counts.NEEDS_REVIEW}명, 나머지 {counts.ALIGNED + counts.TOO_EASY}명이에요.
      </p>
      <div className="tbl-scroll">
        <table className="tbl tbl-batch">
          <thead>
            <tr>
              <th scope="col">학생</th>
              <th scope="col">판정</th>
              <th scope="col">확인이 필요한 선수 개념</th>
              <th scope="col">아직 확인하지 않은 기록</th>
              <th scope="col">지금 바로 다룰 수 있는 개념</th>
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
                  {result.unknownHard.length + result.unknownRequired.length === 0
                    ? <span className="muted">없음</span>
                    : [...result.unknownHard, ...result.unknownRequired].map((id) => (
                      <span key={id} className="chip chip-unknown">{nodeSpec(id).label}</span>
                    ))}
                </td>
                <td>
                  {result.verdict === 'COLLISION'
                    ? (result.suggestedNext.length === 0 ? <span className="muted">&mdash;</span> : result.suggestedNext.map((id) => <span key={id} className="chip chip-next">{nodeSpec(id).label}</span>))
                    : <span className="muted">&mdash;</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">행을 누르면 그 학생 기준으로 메인 화면에서 자세한 결과를 봅니다. 기록이 없는 학생은 판정에서 '아직 확인하지 않은 기록'으로 구분해요.</p>
    </div>
  );
}
