// 화면 C. 학습지 미리 보기·인쇄 (지시서 §5·§11).
// 학생용 출력에 IEP 원문·교사 메모·내부 ID·판정 코드·편집 버튼·숨겨진 정답이 나오지 않는다.
// 정답은 별도의 교사용 보기. 인쇄는 브라우저 인쇄 기능(A4)을 쓴다.
import { useMemo, useState } from 'react';
import { ProblemCard } from './ProblemCard';
import type { Work } from './types';
import { validateProblem, type ProblemIssue } from './validate';
import type { Action } from './reducer';

interface Props {
  work: Work;
  version: string;
  dispatch: (a: Action) => void;
}

export function WorksheetScreen({ work, version: versionIn, dispatch }: Props) {
  const version = work.studentSets[versionIn] ? versionIn : 'common';
  const set = version === 'common' ? work.common : work.studentSets[version];
  const problems = set.order.map((id) => set.problems[id]);
  const [teacherView, setTeacherView] = useState(false);
  const student = version !== 'common' ? work.students.find((s) => s.id === version) : undefined;

  const issues: ProblemIssue[] = useMemo(
    () => problems.flatMap((p, i) => validateProblem(p).map((e) => ({ ...e, message: `${i + 1}번 문제 — ${e.message}` }))),
    [problems],
  );
  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');

  const jumpTo = (problemId: string): void => {
    dispatch({ type: 'setVersion', workId: work.id, version });
    dispatch({ type: 'selectProblem', workId: work.id, problemId });
  };

  const title = work.worksheetTitle || work.name;

  return (
    <div className="ws">
      <header className="ws-top">
        <button type="button" className="btn btn-quiet" onClick={() => dispatch({ type: 'openWork', workId: work.id })}>
          ← 편집으로
        </button>
        <span className="version-switch" role="radiogroup" aria-label="출력할 버전 선택">
          <button type="button" role="radio" aria-checked={version === 'common'} className={`version-btn${version === 'common' ? ' on' : ''}`} onClick={() => dispatch({ type: 'openWorksheet', workId: work.id, version: 'common' })}>
            공통
          </button>
          {work.students
            .filter((s) => work.studentSets[s.id])
            .map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={version === s.id} className={`version-btn${version === s.id ? ' on' : ''}`} onClick={() => dispatch({ type: 'openWorksheet', workId: work.id, version: s.id })}>
                {s.displayName}
              </button>
            ))}
        </span>
        <label className="field ws-title-field">
          <span className="field-label">학습지 제목</span>
          <input
            type="text"
            className="text-input"
            value={work.worksheetTitle}
            aria-label="학습지 제목"
            onChange={(e) => dispatch({ type: 'setWorksheetTitle', workId: work.id, title: e.target.value })}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={teacherView} onChange={(e) => setTeacherView(e.target.checked)} />
          <span>교사용 정답 보기</span>
        </label>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          인쇄
        </button>
      </header>
      <p className="muted ws-note">
        인쇄 대화상자의 'PDF로 저장'으로 파일로 내보낼 수도 있어요. A4 세로로 맞춰져요.
      </p>

      {(errors.length > 0 || warns.length > 0) && (
        <section className="ws-issues" aria-label="작성 오류 목록">
          <h3>출력 전 확인 ({errors.length + warns.length}건)</h3>
          <ul className="issue-list">
            {errors.map((e, i) => (
              <li key={`e${i}`} className="error">
                {e.message}{' '}
                <button type="button" className="btn btn-small" onClick={() => jumpTo(e.problemId)}>
                  문제로 이동
                </button>
              </li>
            ))}
            {warns.map((e, i) => (
              <li key={`w${i}`} className="warn">
                {e.message}{' '}
                <button type="button" className="btn btn-small" onClick={() => jumpTo(e.problemId)}>
                  문제로 이동
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="sheet" data-sheet-version={version}>
        <h2 className="sheet-title">{title}</h2>
        {teacherView && <p className="sheet-teacher-banner">교사용 — 정답 포함</p>}
        {student && !teacherView && <p className="sheet-name-line">이름: {student.displayName}</p>}
        {!student && !teacherView && <p className="sheet-name-line">이름: ______________</p>}
        <ol className="sheet-problems">
          {problems.map((p, i) => (
            <li key={p.id} className="ws-problem">
              <ProblemCard problem={p} mode={teacherView ? 'teacher' : 'student'} number={i + 1} />
            </li>
          ))}
        </ol>
        {problems.length === 0 && <p className="muted">이 버전에 문제가 없어요. 편집 화면에서 문제를 추가해 주세요.</p>}
      </div>
    </div>
  );
}
