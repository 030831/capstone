import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { usePersistentState } from '../lib/storage';
import { ACTIVITY } from './model.js';
import { STEPS, STORAGE_KEY, initialState, reducer, restore } from './reducer.js';
import GoalStep from './steps/GoalStep.jsx';
import ExampleStep from './steps/ExampleStep.jsx';
import AdjustStep from './steps/AdjustStep.jsx';
import ReviewStep from './steps/ReviewStep.jsx';
import PreviewStep from './steps/PreviewStep.jsx';

const VIEWS = [GoalStep, ExampleStep, AdjustStep, ReviewStep, PreviewStep];

export default function DesignApp() {
  const [raw, setRaw] = usePersistentState(STORAGE_KEY, initialState);
  const state = useMemo(() => restore(raw), [raw]);
  const dispatch = (action) => setRaw((s) => reducer(restore(s), action));
  const [confirmReset, setConfirmReset] = useState(false);
  const panelRef = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    panelRef.current?.focus();
    panelRef.current?.scrollIntoView({ block: 'start' });
  }, [state.step]);

  const go = (step) => dispatch({ type: 'step', step });
  const View = VIEWS[state.step - 1];
  const canEnter = (n) => n <= 2 || !!state.base;

  return (
    <div className="design-proto">
      <header className="dp-work-header">
        <div>
          <span className="dp-mini-label">자료 설계 · 가상 사례</span>
          <h1>{ACTIVITY.name}</h1>
        </div>
        {confirmReset ? (
          <div className="dp-reset-confirm" role="group" aria-label="처음부터 다시 시작 확인">
            <span>설계한 내용을 모두 지울까요?</span>
            <button
              className="btn btn-secondary dp-small-btn"
              onClick={() => {
                dispatch({ type: 'reset' });
                setConfirmReset(false);
              }}
            >
              지우고 처음부터
            </button>
            <button className="btn btn-ghost dp-small-btn" onClick={() => setConfirmReset(false)}>
              취소
            </button>
          </div>
        ) : (
          <button className="dp-reset-btn" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={16} /> 처음부터
          </button>
        )}
      </header>
      <ol className="dp-progress" aria-label="설계 단계">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const current = state.step === n;
          const done = n < state.step;
          return (
            <li key={label} className={current ? 'current' : done ? 'done' : ''}>
              <button
                onClick={() => go(n)}
                disabled={!canEnter(n)}
                aria-current={current ? 'step' : undefined}
              >
                <span>{done ? <Check size={14} /> : n}</span>
                <b>{label}</b>
              </button>
            </li>
          );
        })}
      </ol>
      <div
        ref={panelRef}
        tabIndex={-1}
        className="dp-panel-wrap"
        aria-label={`${state.step}단계 ${STEPS[state.step - 1]}`}
      >
        <View state={state} dispatch={dispatch} />
      </div>
      <nav className="dp-step-nav" aria-label="단계 이동">
        <button
          className="btn btn-secondary"
          onClick={() => go(state.step - 1)}
          disabled={state.step === 1}
        >
          <ArrowLeft size={17} /> 이전 단계
        </button>
        {state.step < 5 && (
          <span className="dp-step-hint">
            {state.step === 2 && !state.base
              ? '예시 하나를 공통 설정으로 고르면 다음 단계로 갈 수 있습니다.'
              : ''}
          </span>
        )}
        {state.step < 5 && (
          <button
            className="btn btn-primary"
            onClick={() => go(state.step + 1)}
            disabled={!canEnter(state.step + 1)}
          >
            다음: {STEPS[state.step]} <ArrowRight size={17} />
          </button>
        )}
      </nav>
    </div>
  );
}
