import { Plus, Trash2, UserRound } from 'lucide-react';
import { STUDENTS, axisLabel } from '../model.js';
import { diffConfig } from '../reducer.js';
import { AxisEditor } from './fields.jsx';

export default function AdjustStep({ state, dispatch }) {
  return (
    <section className="dp-panel" aria-labelledby="adjust-title">
      <div className="dp-panel-head">
        <span className="dp-mini-label">3단계</span>
        <h2 id="adjust-title">제시 · 응답 · 지원을 조절합니다.</h2>
        <p className="muted">
          먼저 공통 설정을 다듬고, 필요한 학생에게만 변형을 만듭니다. 변형은 공통 설정에서 무엇을
          바꿨는지와 그 이유를 함께 남깁니다.
        </p>
      </div>
      <div className="dp-block">
        <h3 className="dp-block-title">공통 설정</h3>
        <AxisEditor
          idPrefix="base"
          config={state.base}
          onChange={(field, value) => dispatch({ type: 'setBase', field, value })}
        />
      </div>
      <div className="dp-block">
        <h3 className="dp-block-title">학생별 변형</h3>
        <p className="dp-field-note">
          가상 학생입니다. 메모는 진단이 아니라 자료를 고를 때의 참고입니다.
        </p>
        <div className="dp-students">
          {STUDENTS.map((s) => {
            const v = state.variants[s.id];
            const diff = v ? diffConfig(state.base, v.config) : [];
            return (
              <article key={s.id} className="dp-student">
                <header>
                  <span className="dp-student-icon">
                    <UserRound size={18} />
                  </span>
                  <div>
                    <strong>{s.name}</strong>
                    <small>{s.profile}</small>
                  </div>
                  {v && (
                    <button
                      className="btn btn-ghost dp-small-btn"
                      onClick={() => dispatch({ type: 'removeVariant', student: s.id })}
                    >
                      <Trash2 size={15} /> 변형 지우기
                    </button>
                  )}
                </header>
                {!v ? (
                  <div className="dp-student-empty">
                    <p>{s.idea}</p>
                    <button
                      className="btn btn-secondary"
                      onClick={() => dispatch({ type: 'createVariant', student: s.id })}
                    >
                      <Plus size={16} /> 공통 설정에서 변형 만들기
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="dp-diff-line" aria-live="polite">
                      {diff.length
                        ? `공통과 다른 항목: ${diff.map(axisLabel).join(', ')}`
                        : '아직 공통 설정과 같습니다.'}
                    </p>
                    <AxisEditor
                      idPrefix={`v-${s.id}`}
                      config={v.config}
                      base={state.base}
                      diffKeys={diff}
                      onChange={(field, value) =>
                        dispatch({ type: 'setVariant', student: s.id, field, value })
                      }
                      renderAfter={(key) => (
                        <label className="dp-reason">
                          <span>변경 사유</span>
                          <input
                            className="dp-text"
                            type="text"
                            placeholder="예: 쓰기 대신 가리키기로 답하도록"
                            value={v.reasons[key] ?? ''}
                            onChange={(e) =>
                              dispatch({
                                type: 'setReason',
                                student: s.id,
                                field: key,
                                text: e.target.value,
                              })
                            }
                          />
                        </label>
                      )}
                    />
                  </>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
