import { useEffect, useReducer, useRef } from 'react';
import { BatchTab } from './components/BatchTab';
import { CheckTab } from './components/CheckTab';
import { GraphTab } from './components/GraphTab';
import { StudentTab } from './components/StudentTab';
import { initState, reducer, saveStored, type TabKey } from './state';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'graph', label: '개념 그래프' },
  { key: 'student', label: '학생 현행수준' },
  { key: 'check', label: '문제 검사' },
  { key: 'batch', label: '학급 일괄 검사' },
];

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // 학생 데이터 저장(localStorage 불가 환경에서도 앱은 정상 동작)
  useEffect(() => {
    saveStored(state.students, state.currentId);
  }, [state.students, state.currentId]);

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    let j = i;
    if (e.key === 'ArrowRight') j = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') j = (i + TABS.length - 1) % TABS.length;
    else return;
    e.preventDefault();
    dispatch({ type: 'setTab', tab: TABS[j].key });
    tabRefs.current[TABS[j].key]?.focus();
  };

  const fewStudents = state.students.length <= 6;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>인지적 정렬 검사기</h1>
          <small>프로토타입 v0</small>
        </div>
        <nav className="tabs" role="tablist" aria-label="화면">
          {TABS.map((t, i) => (
            <button
              key={t.key}
              ref={(el) => { tabRefs.current[t.key] = el; }}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={state.tab === t.key}
              aria-controls={`panel-${t.key}`}
              tabIndex={state.tab === t.key ? 0 : -1}
              className={`tab${state.tab === t.key ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'setTab', tab: t.key })}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="student-bar">
          <span>보는 학생</span>
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
      </header>
      <main className="app-main" role="tabpanel" id={`panel-${state.tab}`} aria-labelledby={`tab-${state.tab}`}>
        {state.tab === 'graph' && <GraphTab state={state} dispatch={dispatch} />}
        {state.tab === 'student' && <StudentTab state={state} dispatch={dispatch} />}
        {state.tab === 'check' && <CheckTab state={state} dispatch={dispatch} />}
        {state.tab === 'batch' && <BatchTab state={state} dispatch={dispatch} />}
      </main>
    </div>
  );
}
