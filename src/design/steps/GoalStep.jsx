import { Target } from 'lucide-react';
import { ACTIVITY, GOAL_FIELDS, PURPOSES, goalSentence } from '../model.js';
import { ChoiceGroup } from './fields.jsx';

export default function GoalStep({ state, dispatch }) {
  const { goal, purpose } = state;
  const setGoal = (field) => (value) => dispatch({ type: 'goal', field, value });
  return (
    <section className="dp-panel" aria-labelledby="goal-title">
      <div className="dp-panel-head">
        <span className="dp-mini-label">1단계</span>
        <h2 id="goal-title">무엇을, 어떤 목적으로 확인할지 정합니다.</h2>
        <p className="muted">
          목표를 행동 · 조건 · 기준 · 내용 범위로 나누어 적으면, 뒤에서 자료를 바꿀 때 무엇이 영향을
          받는지 함께 볼 수 있습니다.
        </p>
      </div>
      <div className="dp-fixed">
        <span className="dp-mini-label">활동 유형</span>
        <strong>{ACTIVITY.name}</strong>
        <small>이번 시제품에서는 이 유형 하나만 설계할 수 있습니다.</small>
      </div>
      <div className="dp-form-grid">
        <ChoiceGroup
          name="goal-behavior"
          legend={GOAL_FIELDS.behavior.label}
          options={GOAL_FIELDS.behavior.options}
          value={goal.behavior}
          onChange={setGoal('behavior')}
        />
        <ChoiceGroup
          name="goal-condition"
          legend={GOAL_FIELDS.condition.label}
          options={GOAL_FIELDS.condition.options}
          value={goal.condition}
          onChange={setGoal('condition')}
        />
        <div className="dp-field">
          <label className="dp-text-label" htmlFor="goal-criterion">
            기준
          </label>
          <input
            id="goal-criterion"
            className="dp-text"
            type="text"
            value={goal.criterion}
            onChange={(e) => setGoal('criterion')(e.target.value)}
            aria-describedby="goal-criterion-hint"
          />
          <small id="goal-criterion-hint" className="dp-field-note">
            예: 5문항 중 4문항
          </small>
        </div>
        <ChoiceGroup
          name="goal-range"
          legend={GOAL_FIELDS.range.label}
          options={GOAL_FIELDS.range.options}
          value={goal.range}
          onChange={setGoal('range')}
        />
        <ChoiceGroup
          name="purpose"
          legend="활동 목적"
          options={PURPOSES}
          value={purpose}
          onChange={(value) => dispatch({ type: 'purpose', value })}
        />
      </div>
      <div className="dp-summary">
        <Target size={20} />
        <div>
          <strong>정리한 목표</strong>
          <p>{goalSentence(goal)}</p>
          <small>활동 목적: {PURPOSES.find((p) => p.value === purpose).label}</small>
        </div>
      </div>
    </section>
  );
}
