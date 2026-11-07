import { useEffect, useReducer, useRef, useState } from 'react';
import { BatchTab } from './components/BatchTab';
import { CheckTab } from './components/CheckTab';
import { StudentTab } from './components/StudentTab';
import { initState, reducer, saveStored, type ModalKey } from './state';

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [saveFailed, setSaveFailed] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);

  // 학생 상태·현재 학생·작성 중 문제·확정 개념·표면 속성 저장.
  // 저장하지 못하면 안내를 표시한다(조용히 무시하지 않는다).
  useEffect(() => {
    setSaveFailed(!saveStored(state.students, state.currentId, state.draft));
  }, [state.students, state.currentId, state.draft]);

  // 모달이 열려 있으면 뒤 화면을 키보드 조작 대상에서 제외한다(inert 속성).
  useEffect(() => {
    const el = appRef.current;
    if (!el) return;
    if (state.modal !== 'none') el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }, [state.modal]);

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
    <>
      {/* 모달은 배경(.app) 밖에 렌더링한다 — 배경에 inert 를 걸어도 모달은 조작 가능해야 한다. */}
      <div className="app" ref={appRef}>
        <header className="app-header">
          <div className="brand">
            <h1>이 문제, 이 학생에게 괜찮을까?</h1>
            <small>인지적 정렬 검사기 · 교사용 프로토타입 v3</small>
          </div>

          <div className="student-bar">
            <span className="muted" id="student-bar-label">보는 학생</span>
            {fewStudents ? (
              <div
                className="student-pills"
                role="radiogroup"
                aria-labelledby="student-bar-label"
                onKeyDown={(e) => {
                  // 라디오 그룹 화살표 이동(단, 모달이 열려 있지 않을 때만)
                  if (state.modal !== 'none') return;
                  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                  const i = state.students.findIndex((s) => s.id === state.currentId);
                  const d = e.key === 'ArrowRight' ? 1 : -1;
                  const next = state.students[(i + d + state.students.length) % state.students.length];
                  dispatch({ type: 'selectStudent', id: next.id });
                }}
              >
                {state.students.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={state.currentId === s.id}
                    tabIndex={state.currentId === s.id ? 0 : -1}
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

        {saveFailed && (
          <p className="save-failed" role="alert">
            이 브라우저에 저장하지 못했어요. 페이지를 새로 고치면 입력한 내용이 사라질 수 있어요.
          </p>
        )}

        <main className="app-main" aria-label="문제 검사">
          <CheckTab state={state} dispatch={dispatch} />
        </main>
      </div>

      {state.modal !== 'none' && (
        <ModalShell
          modal={state.modal}
          onClose={() => dispatch({ type: 'closeModal' })}
        >
          {state.modal === 'students' && <StudentTab state={state} dispatch={dispatch} />}
          {state.modal === 'batch' && <BatchTab state={state} dispatch={dispatch} />}
        </ModalShell>
      )}
    </>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ModalShell({ modal, onClose, children }: { modal: ModalKey; onClose: () => void; children: React.ReactNode }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<Element | null>(null);

  // 모달 접근성: 열리면 포커스를 모달 안으로, Tab/Shift+Tab 은 모달 안에서 순환,
  // 닫히면 열었던 버튼으로 포커스를 되돌린다(Esc 닫기 포함).
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    restoreRef.current = document.activeElement;
    const focusables = (): HTMLElement[] =>
      Array.from(shell.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    (focusables()[0] ?? shell).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !shell.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !shell.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    shell.addEventListener('keydown', onKey);
    return () => {
      shell.removeEventListener('keydown', onKey);
      // inert 해제 후에 포커스를 되돌린다(다음 프레임에 배경이 활성화된 뒤).
      const el = restoreRef.current;
      const restore = (): void => {
        if (el instanceof HTMLElement && document.contains(el)) el.focus();
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
      else restore();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = modal === 'students' ? '학생 현행수준 관리' : '반 일괄 검사';
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="modal-shell" ref={shellRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-quiet modal-close" aria-label="닫기" onClick={onClose}>닫기 ✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
