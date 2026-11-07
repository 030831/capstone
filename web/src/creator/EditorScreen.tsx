// 화면 B. 문제 제작 화면 (지시서 §5·§6·§7·§9·§10·§11·§12.5).
// 상단: 작업 이름·저장 상태·기본 동작 / 왼쪽: 버전·문제 목록 / 중앙: 실제 문제 카드 / 오른쪽: 설정·IEP 참고.
// 중앙이 가장 넓다. 검사·개념 선택·선수관계 절차는 없다.
import { useMemo, useState } from 'react';
import { KIND_LABEL, type Problem, type ProblemKind, type StudentRef, type Work } from './types';
import { ProblemCard, type ElementKey } from './ProblemCard';
import { SettingsPanel } from './SettingsPanel';
import { ConfirmDialog, Modal } from './Modal';
import { canRedo, canUndo, type Action, type CreatorState } from './reducer';
import { validateProblem } from './validate';
import { uid } from './util';
import { PictogramSvg, PICTO_SIZE } from './Pictogram';

interface Props {
  state: CreatorState;
  work: Work;
  dispatch: (a: Action) => void;
  legacyStudents: { id: string; name: string }[];
  saveStatus: 'idle' | 'saving' | 'saved' | 'failed';
  onRetrySave: () => void;
}

const KIND_DESC: Record<ProblemKind, string> = {
  count: '그림을 세어 답하는 문제. 개수·한 줄 배치·그림 크기를 바꿀 수 있어요.',
  two_groups: '두 묶음을 합치는 문제. 그림·수식 표시를 고를 수 있어요.',
  equation: '빈칸이 있는 수식. 빈칸 위치를 고를 수 있어요.',
  compare: '두 묶음을 비교하는 문제. 고르기·비교 기호로 답하게 할 수 있어요.',
};

const KIND_STARTER: Record<ProblemKind, string> = {
  count: '그림 4개 · "그림은 모두 몇 개인가요?"',
  two_groups: '그림 2개 + 3개 · "모두 몇 개인가요?"',
  equation: '3 + 2 = □',
  compare: '그림 3개 vs 5개 · "어느 쪽이 더 많나요?"',
};

export function EditorScreen({ state, work, dispatch, legacyStudents, saveStatus, onRetrySave }: Props) {
  const version = (work.selectedVersion === 'common' || work.studentSets[work.selectedVersion] ? work.selectedVersion : 'common') as string;
  const set = version === 'common' ? work.common : work.studentSets[version];
  const problems = set.order.map((id) => set.problems[id]);
  const current = work.selectedProblemId ? set.problems[work.selectedProblemId] : undefined;
  const [element, setElement] = useState<ElementKey>('question');
  const [chooserOpen, setChooserOpen] = useState(false);
  const [studentModal, setStudentModal] = useState<{ mode: 'add' | 'edit'; student?: StudentRef } | null>(null);
  const [versionModal, setVersionModal] = useState(false);
  const [confirmDeleteProblem, setConfirmDeleteProblem] = useState<string | null>(null);
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<string | null>(null);
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<string | null>(null);

  const issues = useMemo(() => (current ? validateProblem(current) : []), [current]);
  const currentStudent = version !== 'common' ? work.students.find((s) => s.id === version) : undefined;

  const patch = (p: Partial<Problem>, coalesceKey?: string): void => {
    if (!current) return;
    dispatch({ type: 'updateProblem', workId: work.id, problemId: current.id, patch: p, coalesceKey });
  };

  const addProblem = (kind: ProblemKind): void => {
    dispatch({ type: 'addProblem', workId: work.id, kind });
    setChooserOpen(false);
    setElement('question');
  };

  return (
    <div className="ed">
      {/* ── 상단 바 ── */}
      <header className="ed-top">
        <button type="button" className="btn btn-quiet" onClick={() => dispatch({ type: 'closeWork' })}>
          ← 작업 목록
        </button>
        <input
          type="text"
          className="work-name-input"
          value={work.name}
          aria-label="작업 이름"
          onChange={(e) => dispatch({ type: 'renameWork', workId: work.id, name: e.target.value })}
        />
        <span className={`save-status ${saveStatus}`} role="status">
          {saveStatus === 'saving' && '저장 중…'}
          {saveStatus === 'saved' && '저장됨'}
          {saveStatus === 'failed' && (
            <>
              저장하지 못함{' '}
              <button type="button" className="btn btn-small" onClick={onRetrySave}>
                다시 저장
              </button>
            </>
          )}
          {saveStatus === 'idle' && ''}
        </span>
        <span className="ed-actions">
          <button type="button" className="btn btn-primary" onClick={() => setChooserOpen(true)}>
            + 문제 추가
          </button>
          <button type="button" className="btn" disabled={!current} onClick={() => current && dispatch({ type: 'duplicateProblem', workId: work.id, problemId: current.id })}>
            복제
          </button>
          <button type="button" className="btn" disabled={!canUndo(state, work.id, version)} onClick={() => dispatch({ type: 'undo', workId: work.id, version })}>
            실행 취소
          </button>
          <button type="button" className="btn" disabled={!canRedo(state, work.id, version)} onClick={() => dispatch({ type: 'redo', workId: work.id, version })}>
            다시 실행
          </button>
          <button type="button" className="btn" onClick={() => setVersionModal(true)}>
            학생별 버전 만들기
          </button>
          <button type="button" className="btn btn-confirm" onClick={() => dispatch({ type: 'openWorksheet', workId: work.id, version })}>
            학습지 보기
          </button>
        </span>
      </header>

      {saveStatus === 'failed' && (
        <p className="save-failed" role="alert">
          이 브라우저에 저장하지 못했어요. 저장 공간이 꽉 찼거나 브라우저가 저장을 막고 있을 수 있어요.
        </p>
      )}

      <div className="ed-body">
        {/* ── 왼쪽: 버전·문제 목록 ── */}
        <aside className="ed-left" aria-label="버전과 문제 목록">
          <details className="left-fold" open={window.innerWidth >= 1100}>
            <summary>버전 (공통 · 학생별)</summary>
            <div className="version-list" role="radiogroup" aria-label="편집할 버전 선택">
              <button type="button" role="radio" aria-checked={version === 'common'} className={`version-btn${version === 'common' ? ' on' : ''}`} onClick={() => dispatch({ type: 'setVersion', workId: work.id, version: 'common' })}>
                공통 문제 <span className="muted">{work.common.order.length}개</span>
              </button>
              {work.students.map((s) => {
                const has = Boolean(work.studentSets[s.id]);
                return (
                  <span key={s.id} className="version-row">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={version === s.id}
                      className={`version-btn${version === s.id ? ' on' : ''}`}
                      onClick={() => dispatch({ type: 'setVersion', workId: work.id, version: s.id })}
                    >
                      {s.displayName} {has ? <span className="muted">{work.studentSets[s.id].order.length}개</span> : <span className="ver-missing">버전 없음</span>}
                    </button>
                    {has ? (
                      version === s.id && (
                        <button type="button" className="btn btn-small btn-danger" onClick={() => setConfirmDeleteVersion(s.id)}>
                          버전 삭제
                        </button>
                      )
                    ) : (
                      <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'createStudentVersion', workId: work.id, studentId: s.id })}>
                        만들기
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
            <div className="student-manage">
              <button type="button" className="btn btn-small" onClick={() => setStudentModal({ mode: 'add' })}>
                + 학생 추가
              </button>
              {work.students.map((s) => (
                <button key={s.id} type="button" className="btn btn-small btn-quiet student-edit-btn" onClick={() => setStudentModal({ mode: 'edit', student: s })}>
                  {s.displayName} 정보
                </button>
              ))}
            </div>
          </details>

          <details className="left-fold" open={window.innerWidth >= 1100}>
            <summary>문제 목록 ({set.order.length}개)</summary>
            {problems.length === 0 ? (
              <p className="muted empty-hint">아직 문제가 없어요. '문제 추가'를 눌러 형태를 고르면 시작 예시가 만들어져요.</p>
            ) : (
              <ol className="prob-list">
                {problems.map((p, i) => (
                  <li key={p.id} className={`prob-row${current?.id === p.id ? ' on' : ''}`}>
                    <button
                      type="button"
                      className="prob-open"
                      onClick={() => dispatch({ type: 'selectProblem', workId: work.id, problemId: p.id })}
                      aria-current={current?.id === p.id}
                    >
                      <span className="prob-kind">{KIND_LABEL[p.kind]}</span>
                      <span className="prob-q">{p.question || '(질문 없음)'}</span>
                    </button>
                    <span className="prob-ops">
                      <button type="button" className="btn btn-small" aria-label={`${i + 1}번 문제 위로 이동`} disabled={i === 0} onClick={() => dispatch({ type: 'moveProblem', workId: work.id, problemId: p.id, dir: -1 })}>
                        ↑
                      </button>
                      <button type="button" className="btn btn-small" aria-label={`${i + 1}번 문제 아래로 이동`} disabled={i === problems.length - 1} onClick={() => dispatch({ type: 'moveProblem', workId: work.id, problemId: p.id, dir: 1 })}>
                        ↓
                      </button>
                      <button type="button" className="btn btn-small" aria-label={`${i + 1}번 문제 복제`} onClick={() => dispatch({ type: 'duplicateProblem', workId: work.id, problemId: p.id })}>
                        복제
                      </button>
                      <button type="button" className="btn btn-small btn-danger" aria-label={`${i + 1}번 문제 삭제`} onClick={() => setConfirmDeleteProblem(p.id)}>
                        삭제
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </details>
        </aside>

        {/* ── 중앙: 실제 문제 ── */}
        <main className="ed-center" aria-label="문제 편집">
          {current ? (
            <>
              <div className="paper">
                <ProblemCard
                  problem={current}
                  mode="edit"
                  selected={element}
                  onSelect={setElement}
                  onQuestionChange={(text) => patch({ question: text }, `q:${current.id}`)}
                />
              </div>
              {issues.length > 0 && (
                <ul className="issue-list center-issues">
                  {issues.map((e, i) => (
                    <li key={i} className={e.level}>
                      {e.message}
                    </li>
                  ))}
                </ul>
              )}
              <p className="muted center-note">문제의 각 부분(질문·그림·수식·답하는 방식·힌트)을 클릭하면 오른쪽에서 설정을 바꿀 수 있어요.</p>
            </>
          ) : (
            <div className="empty-editor">
              <p className="lead">만들 문제 형태를 고르면 바로 편집할 수 있어요.</p>
              <div className="kind-cards">
                {(Object.keys(KIND_LABEL) as ProblemKind[]).map((k) => (
                  <button key={k} type="button" className="kind-card" onClick={() => addProblem(k)}>
                    <span className="kind-mini">
                      <PictogramSvg kind="apple" px={PICTO_SIZE.small} />
                      <PictogramSvg kind="apple" px={PICTO_SIZE.small} />
                      <PictogramSvg kind="apple" px={PICTO_SIZE.small} />
                    </span>
                    <strong>{KIND_LABEL[k]}</strong>
                    <span className="muted">{KIND_STARTER[k]}</span>
                    <span className="muted kind-desc">{KIND_DESC[k]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* ── 오른쪽: 설정·IEP 참고 ── */}
        <aside className="ed-right" aria-label="설정과 IEP 참고">
          {current ? (
            <SettingsPanel problem={current} element={element} issues={issues} onPatch={patch} />
          ) : (
            <p className="muted">문제를 고르면 설정이 여기에 나타나요.</p>
          )}

          {version === 'common' ? (
            <details className="iep-box">
              <summary>공통 문제 안내</summary>
              <p className="muted">
                공통 문제는 학생별 버전을 만들기 전의 원본이에요. 학생별 버전을 만들면 각각 독립적으로 편집할 수 있어요.
              </p>
            </details>
          ) : (
            <details className="iep-box" open>
              <summary>IEP 참고 — {currentStudent?.displayName ?? '학생'}</summary>
              {currentStudent && (
                <div className="iep-fields">
                  <div className="field">
                    <span className="field-label">이번 수업에서 참고할 IEP 목표</span>
                    <textarea
                      className="q-edit"
                      rows={3}
                      value={currentStudent.iepGoal}
                      aria-label="IEP 목표"
                      placeholder="예: 10까지의 수 세기 (직접 입력)"
                      onChange={(e) => dispatch({ type: 'updateStudent', workId: work.id, studentId: currentStudent.id, patch: { iepGoal: e.target.value } })}
                    />
                  </div>
                  <div className="field">
                    <span className="field-label">지원 메모</span>
                    <textarea
                      className="q-edit"
                      rows={2}
                      value={currentStudent.supportNote}
                      aria-label="지원 메모"
                      placeholder="예: 한 줄에 5개까지, 선택지로 답하게 하기"
                      onChange={(e) => dispatch({ type: 'updateStudent', workId: work.id, studentId: currentStudent.id, patch: { supportNote: e.target.value } })}
                    />
                  </div>
                  <button type="button" className="btn btn-small btn-danger" onClick={() => setConfirmDeleteStudent(currentStudent.id)}>
                    학생 정보 삭제
                  </button>
                </div>
              )}
            </details>
          )}
        </aside>
      </div>

      {/* ── 모달: 문제 형태 선택 ── */}
      {chooserOpen && (
        <Modal title="문제 형태 고르기" onClose={() => setChooserOpen(false)} wide>
          <p className="muted">형태를 고르면 수정할 수 있는 시작 예시가 바로 만들어져요.</p>
          <div className="kind-cards">
            {(Object.keys(KIND_LABEL) as ProblemKind[]).map((k) => (
              <button key={k} type="button" className="kind-card" onClick={() => addProblem(k)}>
                <span className="kind-mini">
                  <PictogramSvg kind="apple" px={PICTO_SIZE.small} />
                  <PictogramSvg kind="apple" px={PICTO_SIZE.small} />
                  <PictogramSvg kind="apple" px={PICTO_SIZE.small} />
                </span>
                <strong>{KIND_LABEL[k]}</strong>
                <span className="muted">{KIND_STARTER[k]}</span>
                <span className="muted kind-desc">{KIND_DESC[k]}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* ── 모달: 학생 추가·편집 ── */}
      {studentModal && (
        <StudentModal
          work={work}
          mode={studentModal.mode}
          student={studentModal.student}
          legacyStudents={legacyStudents}
          onClose={() => setStudentModal(null)}
          dispatch={dispatch}
        />
      )}

      {/* ── 모달: 학생별 버전 만들기 ── */}
      {versionModal && (
        <Modal title="학생별 버전 만들기" onClose={() => setVersionModal(false)}>
          <p className="muted">
            공통 문제를 복사해 각 학생의 독립 편집본을 만들어요. 자동으로 바뀌지는 않아요 — 교사가 문제를 열어 직접 조정해요.
          </p>
          {work.students.length === 0 ? (
            <p>학생을 먼저 추가해 주세요.</p>
          ) : (
            <ul className="version-make-list">
              {work.students.map((s) => {
                const has = Boolean(work.studentSets[s.id]);
                return (
                  <li key={s.id}>
                    <span>{s.displayName}</span>
                    {has ? (
                      <span className="muted">이미 버전이 있어요 ({work.studentSets[s.id].order.length}개 문제)</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-small btn-confirm"
                        onClick={() => {
                          dispatch({ type: 'createStudentVersion', workId: work.id, studentId: s.id });
                          setVersionModal(false);
                        }}
                      >
                        버전 만들기 ({work.common.order.length}개 복사)
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
      )}

      {/* ── 확인 대화상자 ── */}
      {confirmDeleteProblem && (
        <ConfirmDialog
          title="문제 삭제"
          danger
          confirmLabel="삭제"
          onCancel={() => setConfirmDeleteProblem(null)}
          onConfirm={() => {
            dispatch({ type: 'deleteProblem', workId: work.id, problemId: confirmDeleteProblem });
            setConfirmDeleteProblem(null);
          }}
          body={<p>이 문제를 삭제해요. 바로 '실행 취소'로 되돌릴 수 있어요.</p>}
        />
      )}
      {confirmDeleteVersion && (
        <ConfirmDialog
          title="학생별 버전 삭제"
          danger
          confirmLabel="버전 삭제"
          onCancel={() => setConfirmDeleteVersion(null)}
          onConfirm={() => {
            dispatch({ type: 'deleteStudentVersion', workId: work.id, studentId: confirmDeleteVersion });
            setConfirmDeleteVersion(null);
          }}
          body={
            <p>
              이 학생의 <strong>버전(문제 세트)만</strong> 삭제해요. 학생 정보와 공통 문제는 남아요.
            </p>
          }
        />
      )}
      {confirmDeleteStudent && (
        <ConfirmDialog
          title="학생 정보 삭제"
          danger
          confirmLabel="삭제"
          onCancel={() => setConfirmDeleteStudent(null)}
          onConfirm={() => {
            dispatch({ type: 'removeStudent', workId: work.id, studentId: confirmDeleteStudent });
            setConfirmDeleteStudent(null);
          }}
          body={
            <p>
              학생 <strong>{work.students.find((s) => s.id === confirmDeleteStudent)?.displayName}</strong>의 참고 정보(IEP 목표·메모)와 이 학생의 버전이 함께 삭제돼요. 공통 문제는 남아요.
            </p>
          }
        />
      )}
    </div>
  );
}

// ── 학생 추가·편집 모달 ────────────────────────────────────

function StudentModal({
  work,
  mode,
  student,
  legacyStudents,
  onClose,
  dispatch,
}: {
  work: Work;
  mode: 'add' | 'edit';
  student?: StudentRef;
  legacyStudents: { id: string; name: string }[];
  onClose: () => void;
  dispatch: (a: Action) => void;
}) {
  const [displayName, setDisplayName] = useState(student?.displayName ?? '');
  const [iepGoal, setIepGoal] = useState(student?.iepGoal ?? '');
  const [supportNote, setSupportNote] = useState(student?.supportNote ?? '');
  const linked = new Set(work.students.map((s) => s.linkedOldId));
  const importable = legacyStudents.filter((l) => !linked.has(l.id));

  const save = (): void => {
    const name = displayName.trim();
    if (!name) return;
    if (mode === 'add') {
      const s: StudentRef = { id: uid('s'), displayName: name, iepGoal: iepGoal.trim(), supportNote: supportNote.trim() };
      dispatch({ type: 'addStudent', workId: work.id, student: s });
    } else if (student) {
      dispatch({ type: 'updateStudent', workId: work.id, studentId: student.id, patch: { displayName: name, iepGoal: iepGoal.trim(), supportNote: supportNote.trim() } });
    }
    onClose();
  };

  return (
    <Modal title={mode === 'add' ? '학생 추가' : '학생 정보 편집'} onClose={onClose}>
      <div className="field">
        <span className="field-label">익명 표시 이름</span>
        <input type="text" className="text-input" value={displayName} aria-label="익명 표시 이름" placeholder="예: 학생 A" onChange={(e) => setDisplayName(e.target.value)} />
        <span className="field-hint">실명 대신 쓸 표시 이름을 적어 주세요.</span>
      </div>
      <div className="field">
        <span className="field-label">이번 수업에서 참고할 IEP 목표</span>
        <textarea className="q-edit" rows={3} value={iepGoal} aria-label="IEP 목표" placeholder="예: 10까지의 수 세기와 두 수 합 구하기" onChange={(e) => setIepGoal(e.target.value)} />
        <span className="field-hint">제작 참고용으로만 쓰여요. 문제가 자동으로 바뀌지 않아요.</span>
      </div>
      <div className="field">
        <span className="field-label">지원 메모</span>
        <textarea className="q-edit" rows={2} value={supportNote} aria-label="지원 메모" placeholder="예: 짧은 문장으로, 선택지로 답하게 하기" onChange={(e) => setSupportNote(e.target.value)} />
      </div>

      {mode === 'add' && importable.length > 0 && (
        <fieldset className="legacy-box">
          <legend>기존 검사기에서 불러오기 (표시 이름만)</legend>
          <p className="muted">이전 검사기에 저장된 학생이에요. 표시 이름만 가져오고 숙달 기록은 가져오지 않아요.</p>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              dispatch({ type: 'importLegacyStudents', workId: work.id, students: importable });
              onClose();
            }}
          >
            {importable.length}명 전체 추가
          </button>
          <ul className="legacy-list">
            {importable.map((l) => (
              <li key={l.id}>{l.name}</li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn-confirm" onClick={save} disabled={!displayName.trim()}>
          {mode === 'add' ? '추가' : '저장'}
        </button>
      </div>
    </Modal>
  );
}
