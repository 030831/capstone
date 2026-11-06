import { useMemo, useState } from 'react';
import { GROUPS, groupOf, nodeNumber } from '../data/groups';
import { SAMPLE_PROBLEMS } from '../data/problems';
import { check, hardAncestors } from '../engine';
import { basisCode, graph, nodeSpec } from '../graph';
import type { Action, AppState } from '../state';
import { STATE_LABEL } from '../ui';
import { VerdictBadge } from './Badges';

const MEANING: Record<string, string> = {
  COLLISION: '지금 이 문제를 내면 학생은 풀이에 필요한 선수 개념이 없어 막힙니다. 아래 갭을 먼저 다루면 문제를 다시 쓸 필요가 없습니다.',
  ALIGNED: '필요한 선수 개념은 갖추었고 요구 개념은 아직 숙달 전입니다. 지금 배울 수 있는 범위 안의 문제입니다.',
  TOO_EASY: '요구 개념을 이미 숙달한 상태라 새 학습보다는 연습·복습에 가깝습니다.',
};

/** 한 개념의 직접 hard 선수 상태를 짧은 문자열로 요약. */
function predSummary(id: string, states: Record<string, string>): string {
  const preds = [...graph.hardPred.get(id)!];
  if (preds.length === 0) return '출발 개념';
  const parts = preds.map((p) => {
    const s = states[p] ?? 'not_started';
    const mark = s === 'mastered' ? '✓' : s === 'emerging' ? '△' : '✗';
    return `${nodeSpec(p).label} ${mark}`;
  });
  return parts.join(' · ');
}

/** 요구 개념 R 의 hard 조상 + R 자신을 노드 번호순으로 정렬해 돌려준다. */
function ancestorLine(requires: readonly string[]): string[] {
  const set = new Set<string>();
  for (const r of requires) {
    set.add(r);
    for (const a of hardAncestors(graph, [r])) set.add(a);
  }
  return [...set].sort((a, b) => nodeNumber(a) - nodeNumber(b));
}

/** 메인 화면: 문제 입력 + 요구 개념 선택 + 판정 결과 + 인라인 선수 계보. */
export function CheckTab({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const { draft, submitted } = state;
  const student = state.students.find((s) => s.id === state.currentId)!;
  const [query, setQuery] = useState('');
  const [showLine, setShowLine] = useState(false);

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

  const line = useMemo(() => (result ? ancestorLine(result.requires) : []), [result]);
  const reqSet = useMemo(() => new Set(result?.requires ?? []), [result]);
  const gapSet = useMemo(() => new Set(result?.gapHard ?? []), [result]);

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

            {/* 인라인 선수 계보 — ComfyUI 형태 그래프를 대체하는 텍스트 트리 */}
            <div className="prereq-line">
              <button type="button" className="btn btn-quiet line-toggle" aria-expanded={showLine} onClick={() => setShowLine((v) => !v)}>
                {showLine ? '▼ 학습 계보 숨기기' : '▶ 학습 계보 보기'}
              </button>
              {showLine && (
                <ol className="chain-list" aria-label="이 문제의 학습 계보">
                  <li className="chain-intro muted">
                    아래는 이 문제가 요구하는 개념과 그 아래 놓인 필수 선수 개념을 순서대로 나열한 것입니다.
                    <strong>표시된 색</strong> 칸은 학생이 아직 숙달하지 못한 개념(갭)입니다.
                  </li>
                  {line.map((id) => {
                    const st = student.states[id] ?? 'not_started';
                    const isReq = reqSet.has(id);
                    const isGap = gapSet.has(id);
                    const cls = `chain-item chain-st-${st}${isReq ? ' chain-req' : ''}${isGap ? ' chain-gap' : ''}`;
                    return (
                      <li key={id} className={cls}>
                        <span className="chain-marker" aria-hidden="true">
                          {isReq ? '◆' : st === 'mastered' ? '✓' : st === 'emerging' ? '△' : '✗'}
                        </span>
                        <span className="chain-label">{nodeSpec(id).label}</span>
                        <span className="chain-state">{STATE_LABEL[st]}</span>
                        {isReq && <span className="chain-tag tag-req">요구</span>}
                        {isGap && !isReq && <span className="chain-tag tag-gap">갭</span>}
                        <span className="code">{basisCode(id)}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {result.gapHard.length > 0 && (
              <div className="gap-block">
                <h3>아직 숙달하지 못한 필수 선수 개념</h3>
                <ul className="gap-cards">
                  {result.gapHard.map((id) => {
                    const st = student.states[id] ?? 'not_started';
                    return (
                      <li key={id} className={`gap-card gap-st-${st}`}>
                        <div className="gap-card-head">
                          <span className="gap-card-label">{nodeSpec(id).label}</span>
                          <span className="chain-state">{STATE_LABEL[st]}</span>
                        </div>
                        <div className="gap-card-pred muted">직전 선수: {predSummary(id, student.states)}</div>
                        <div className="code">{basisCode(id)}</div>
                      </li>
                    );
                  })}
                </ul>
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
                    <span key={id} className="chip chip-next">{nodeSpec(id).label}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="result-actions">
              <button type="button" className="btn" onClick={() => dispatch({ type: 'openModal', modal: 'batch' })}>
                반 전체에 적용해 보기
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
