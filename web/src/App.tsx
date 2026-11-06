import { useEffect, useReducer } from 'react';
import { BatchTab } from './components/BatchTab';
import { CheckTab } from './components/CheckTab';
import { StudentTab } from './components/StudentTab';
import { initState, reducer, saveStored, type ModalKey } from './state';

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  // 학생 데이터 저장(localStorage 불가 환경에서도 앱은 정상 동작)
  useEffect(() => {
    saveStored(state.students, state.currentId);
  }, [state.students, state.currentId]);

  // 모달 열려 있을 때 Esc 로 닫기
  useEffect(() => {
    if (state.modal === 'none') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'closeModal' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.modal]);

  const fewStudents = state.students.length <= 6;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>이 문제, 이 학생에게 괜찮을까?</h1>
          <small>인지적 정렬 검사기 · 교사용 프로토타입 v2</small>
        </div>

        <div className="student-bar">
          <span className="muted">보는 학생</span>
          {fewStudents ? (
            <div className="student-pills" role="radiogroup" aria-label="학생 선택">
              {state.students.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={state.currentId === s.id}
                  className={`pill${state.currentId === s.id ? ' on' : ''}`}
                  onClick={() => dispatch({ type: 'selectStudent', id: s.id })}
                >
                  {s.name}
                </button>
              ))}
            </div>
          ) : (
            <select aria-label="학생 선택" value={state.currentId} onChange={(e) => dispatch({ type: 'selectStudent', id: e.target.value })}>
              {state.students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        <nav className="header-actions" aria-label="보조 화면">
          <button type="button" className={`btn btn-head${state.modal === 'students' ? ' on' : ''}`} onClick={() => dispatch({ type: 'openModal', modal: 'students' })}>
            학생 현행수준
          </button>
          <button type="button" className={`btn btn-head${state.modal === 'batch' ? ' on' : ''}`} onClick={() => dispatch({ type: 'openModal', modal: 'batch' })}>
            반 일괄 검사
          </button>
        </nav>
      </header>

      <main className="app-main" aria-label="문제 검사">
        <CheckTab state={state} dispatch={dispatch} />
      </main>

      {state.modal !== 'none' && (
        <ModalShell
          modal={state.modal}
          onClose={() => dispatch({ type: 'closeModal' })}
        >
          {state.modal === 'students' && <StudentTab state={state} dispatch={dispatch} />}
          {state.modal === 'batch' && <BatchTab state={state} dispatch={dispatch} />}
        </ModalShell>
      )}
    </div>
  );
}

function ModalShell({ modal, onClose, children }: { modal: ModalKey; onClose: () => void; children: React.ReactNode }) {
  const title = modal === 'students' ? '학생 현행수준 관리' : '반 일괄 검사';
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-quiet modal-close" aria-label="닫기" onClick={onClose}>닫기 ✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
