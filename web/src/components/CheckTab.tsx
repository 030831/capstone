import { useMemo, useState } from 'react';
import { GROUPS, groupOf } from '../data/groups';
import { SAMPLE_PROBLEMS } from '../data/problems';
import { check } from '../engine';
import { basisCode, graph, nodeSpec } from '../graph';
import type { Action, AppState } from '../state';
import { VerdictBadge } from './Badges';

const MEANING: Record<string, string> = {
  COLLISION: '지금 이 문제를 내면 학생은 풀이에 필요한 선수 개념이 없어 막힙니다. 아래 갭을 먼저 다루면 문제를 다시 쓸 필요가 없습니다.',
  ALIGNED: '필요한 선수 개념은 갖추었고 요구 개념은 아직 숙달 전입니다. 지금 배울 수 있는 범위 안의 문제입니다.',
  TOO_EASY: '요구 개념을 이미 숙달한 상태라 새 학습보다는 연습·복습에 가깝습니다.',
};

/** 탭 3: 문제 입력 + 요구 개념 선택 + 판정 결과. */
export function CheckTab({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const { draft, submitted } = state;
  const student = state.students.find((s) => s.id === state.currentId)!;
  const [query, setQuery] = useState('');

  const result = useMemo(
    () => (submitted ? check(graph, student.states, submitted.requires) : null),
    [submitted, student.states],
  );

  const q = query.trim();
  const toggle = (id: string) => {
    const has = draft.requires.includes(id);
    dispatch({ type: 'setDraft', draft: { requires: has ? draft.requires.filter((x) => x !== id) : [...draft.requires, id] } });
  };
  const setSurface = (k: keyof typeof draft.surface, v: string) =>
    dispatch({ type: 'setDraft', draft: { surface: { ...draft.surface, [k]: v } } });
  const stale = submitted !== null && (submitted.text !== draft.text || submitted.requires.join() !== draft.requires.join());

  return (
    <div className="page check-grid">
      <section className="card" aria-label="문제 입력">
        <h2>문제 입력</h2>
        <div className="samples">
          <span className="muted">예시로 채우기:</span>
          {SAMPLE_PROBLEMS.map((p) => (
            <button key={p.id} type="button" className="btn btn-small" onClick={() => dispatch({ type: 'loadSample', sampleId: p.id })}>
              {p.title.replace(/^샘플 \d: /, '')}
            </button>
          ))}
        </div>

        <label className="field">
          <span>문제</span>
          <textarea rows={3} value={draft.text} onChange={(e) => dispatch({ type: 'setDraft', draft: { text: e.target.value } })} placeholder="학생에게 낼 문제를 그대로 적으세요" />
        </label>

        <fieldset className="field">
          <legend>이 문제를 풀려면 필요한 개념</legend>
          <div className="selected-chips" aria-live="polite">
            {draft.requires.length === 0 ? (
              <span className="empty">아직 고르지 않았습니다. 아래에서 1개 이상 고르세요.</span>
            ) : (
              draft.requires.map((id) => (
                <span key={id} className="chip chip-req">
                  {nodeSpec(id).label}
                  <button type="button" className="x" aria-label={`${nodeSpec(id).label} 빼기`} onClick={() => toggle(id)}>×</button>
                </span>
              ))
            )}
          </div>
          <input
            type="search"
            className="search"
            placeholder="개념 검색 (예: 보수, 받아올림)"
            aria-label="개념 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="picker">
            {GROUPS.map((g) => {
              const ids = graph.nodeIds.filter((id) => groupOf(id).key === g.key && (!q || nodeSpec(id).label.includes(q)));
              if (ids.length === 0) return null;
              return (
                <div key={g.key} className="picker-group">
                  <div className="picker-title" style={{ background: g.bg, borderColor: g.border }}>{g.name}</div>
                  {ids.map((id) => (
                    <label key={id} className="check-item">
                      <input type="checkbox" checked={draft.requires.includes(id)} onChange={() => toggle(id)} />
                      <span>{nodeSpec(id).label}</span>
                      <span className="code">{basisCode(id)}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>지금은 교사가 직접 고릅니다. 앞으로는 문제 글을 읽고 초안을 제안하되, 확정은 교사가 합니다.</p>
        </fieldset>

        <details className="surface">
          <summary>표면 속성 (선택 — 저장만 하고 판정에는 쓰지 않음)</summary>
          <div className="surface-grid">
            <label><span>수 범위</span><input type="text" value={draft.surface.numberRange} onChange={(e) => setSurface('numberRange', e.target.value)} placeholder="예: 20 이내" /></label>
            <label><span>문맥</span><input type="text" value={draft.surface.context} onChange={(e) => setSurface('context', e.target.value)} placeholder="예: 사탕" /></label>
            <label><span>표현</span><input type="text" value={draft.surface.representation} onChange={(e) => setSurface('representation', e.target.value)} placeholder="예: 글+그림" /></label>
            <label><span>지원</span><input type="text" value={draft.surface.support} onChange={(e) => setSurface('support', e.target.value)} placeholder="예: 없음" /></label>
          </div>
        </details>

        <div className="form-foot">
          <button type="button" className="btn btn-primary" disabled={draft.requires.length === 0} onClick={() => dispatch({ type: 'submit' })}>
            {student.name} 기준으로 검사
          </button>
          {stale && <span className="muted">입력이 바뀌었습니다. 다시 검사하세요.</span>}
        </div>
      </section>

      <section className="card" aria-label="검사 결과" aria-live="polite">
        <div className="result-head">
          <h2>검사 결과</h2>
          <label className="muted">
            학생{' '}
            <select value={state.currentId} onChange={(e) => dispatch({ type: 'selectStudent', id: e.target.value })}>
              {state.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
        {!result || !submitted ? (
          <p className="result-empty">문제와 필요한 개념을 넣고 검사를 누르면 {student.name} 기준의 판정이 여기에 나옵니다. 학생을 바꾸면 같은 문제로 바로 다시 판정합니다.</p>
        ) : (
          <div className={`result-card result-${result.verdict}`}>
            <VerdictBadge verdict={result.verdict} large />
            <p className="result-meaning">{MEANING[result.verdict]}</p>
            {submitted.text && <p className="result-problem">{submitted.text}</p>}
            <p className="result-req"><span className="muted">필요한 개념:</span> {result.requires.map((id) => <span key={id} className="chip chip-req">{nodeSpec(id).label}</span>)}</p>
            <p className="result-expl">{result.explanation}</p>

            {result.gapHard.length > 0 && (
              <div className="gap-block">
                <h3>아직 숙달하지 못한 필수 선수 개념</h3>
                <div className="chips">
                  {result.gapHard.map((id) => (
                    <span key={id} className="chip chip-hard">{nodeSpec(id).label}<span className="code">{basisCode(id)}</span></span>
                  ))}
                </div>
              </div>
            )}
            {result.gapSoft.length > 0 && (
              <div className="gap-block">
                <h3>권장 선수 중 미도달 (참고)</h3>
                <div className="chips">
                  {result.gapSoft.map((id) => (
                    <span key={id} className="chip">{nodeSpec(id).label}<span className="code">{basisCode(id)}</span></span>
                  ))}
                </div>
              </div>
            )}
            {result.verdict === 'COLLISION' && result.suggestedNext.length > 0 && (
              <div className="gap-block">
                <h3>지금 바로 다룰 수 있는 선수 개념</h3>
                <p className="muted">갭 가운데 학생이 이미 준비가 된 것입니다. 순서가 아니라 후보이며, 무엇을 고를지는 교사가 정합니다.</p>
                <div className="chips">
                  {result.suggestedNext.map((id) => (
                    <button key={id} type="button" className="chip chip-next chip-btn" onClick={() => dispatch({ type: 'focusNode', node: id })} title="그래프에서 보기">
                      {nodeSpec(id).label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="result-actions">
              <button
                type="button"
                className="btn"
                onClick={() => dispatch({ type: 'showInGraph', highlight: { requires: result.requires, gapHard: result.gapHard, gapSoft: result.gapSoft } })}
              >
                그래프에서 보기
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => dispatch({ type: 'setTab', tab: 'batch' })}>
                반 전체에 적용해 보기
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
