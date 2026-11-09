import { Check, CircleHelp } from 'lucide-react';
import { examplesFor, configFromExample } from '../examples.js';
import { goalSentence } from '../model.js';
import { ConfigChips } from './fields.jsx';

export default function ExampleStep({ state, dispatch }) {
  const list = examplesFor(state.goal);
  return (
    <section className="dp-panel" aria-labelledby="example-title">
      <div className="dp-panel-head">
        <span className="dp-mini-label">2단계</span>
        <h2 id="example-title">목표에 맞춘 구성 예시에서 시작합니다.</h2>
        <p className="muted">{goalSentence(state.goal)}</p>
      </div>
      <p className="dp-notice">
        <CircleHelp size={17} />
        검토된 예시는 아직 적고, 가상 사례입니다. 고른 예시는 공통(원본) 설정이 되며, 다음 단계에서
        자유롭게 바꿀 수 있습니다.
      </p>
      <div className="dp-example-grid">
        {list.map((ex, i) => {
          const selected = state.exampleId === ex.id;
          return (
            <article key={ex.id} className={`dp-example ${selected ? 'selected' : ''}`}>
              <div className="dp-example-top">
                <span className="dp-card-number">0{i + 1}</span>
                {selected && (
                  <span className="dp-chip">
                    <Check size={12} /> 공통 설정
                  </span>
                )}
              </div>
              <h3>{ex.title}</h3>
              <ConfigChips config={configFromExample(ex, state.goal)} />
              <h4>왜 이 예시인가</h4>
              <p>{ex.why(state.goal, state.purpose)}</p>
              <h4>바꿀 수 있는 것</h4>
              <ul className="dp-plain-list">
                {ex.adjustable.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <button
                className={`btn ${selected ? 'btn-primary' : 'btn-secondary'} full-width`}
                aria-pressed={selected}
                onClick={() => dispatch({ type: 'chooseExample', id: ex.id })}
              >
                {selected ? '공통 설정으로 고름' : '이 구성을 공통 설정으로'}
              </button>
            </article>
          );
        })}
      </div>
      {state.base && !list.some((e) => e.id === state.exampleId) && (
        <p className="dp-field-note">
          지금의 공통 설정은 이전 목표에서 고른 예시에서 시작했습니다. 목표가 바뀌었다면 다시
          고르거나, 다음 단계에서 조절하세요.
        </p>
      )}
    </section>
  );
}
