import { useMemo, useState } from 'react';
import { GROUPS, groupOf, nodeNumber } from '../data/groups';
import { suggestConcepts } from '../data/draft';
import { SAMPLE_PROBLEMS } from '../data/problems';
import { check, hardAncestors } from '../engine';
import { basisCode, graph, nodeSpec } from '../graph';
import type { Action, AppState } from '../state';
import { STATE_LABEL } from '../ui';
import { VerdictBadge } from './Badges';

// v2: 판정 의미를 교사용 일상 언어로. "처방" 톤은 여전히 금지(원칙 7) — 갭을 먼저 다루면
// 문제를 그대로 쓸 수 있다는 경고 톤을 유지한다.
const MEANING: Record<string, string> = {
  COLLISION:
    '이 문제를 풀려면 아직 없는 준비가 필요해요. 문제를 버릴 필요는 없고, 아래 "아직 없는 준비"를 먼저 다루면 그대로 쓸 수 있어요.',
  ALIGNED: '필요한 준비는 다 되어 있고, 요구 개념은 지금 배울 단계예요. 도전시키기 좋은 문제예요.',
  TOO_EASY: '요구 개념을 이미 다룰 줄 알아요. 새로 배울 게 없어서 연습·복습용으로 어울려요.',
};

/** 요구 개념 R 의 hard 조상 + R 자신을 노드 번호순으로 정렬해 돌려준다. */
function ancestorLine(requires: readonly string[]): string[] {
  const set = new Set<string>();
  for (const r of requires) {
    set.add(r);
    for (const a of hardAncestors(graph, [r])) set.add(a);
  }
  return [...set].sort((a, b) => nodeNumber(a) - nodeNumber(b));
}

/** 메인 화면: 문제 쓰기 → 힌트로 개념 담기 → 검사 → 일상 언어 판정. */
export function CheckTab({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const { draft, submitted } = state;
  const student = state.students.find((s) => s.id === state.currentId)!;
  const [query, setQuery] = useState('');

  const result = useMemo(
    () => (submitted ? check(graph, student.states, submitted.requires) : null),
    [submitted, student.states],
  );

  // 문제 글에서 뽑은 룰 기반 후보. 이미 담은 개념은 후보에서 뺀다.
  const hints = useMemo(() => suggestConcepts(draft.text), [draft.text]);
  const openHints = hints.filter((h) => !draft.requires.includes(h.id));

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
        <h2>문제</h2>
        <div className="samples">
          <span className="muted">예시로 채우기:</span>
          {SAMPLE_PROBLEMS.map((p) => (
            <button key={p.id} type="button" className="btn btn-small" onClick={() => dispatch({ type: 'loadSample', sampleId: p.id })}>
              {p.title.replace(/^샘플 \d: /, '')}
            </button>
          ))}
        </div>

        <label className="field">
          <span>문제 글</span>
          <textarea rows={3} value={draft.text} onChange={(e) => dispatch({ type: 'setDraft', draft: { text: e.target.value } })} placeholder="학생에게 낼 문제를 그대로 적으세요" />
        </label>

        <fieldset className="field">
          <legend>이 문제에 필요한 준비</legend>
          <div className="selected-chips" aria-live="polite">
            {draft.requires.length === 0 ? (
              <span className="empty">아직 담지 않았어요. 힌트를 누르거나 아래에서 직접 고르세요.</span>
            ) : (
              draft.requires.map((id) => (
                <span key={id} className="chip chip-req">
                  {nodeSpec(id).label}
                  <button type="button" className="x" aria-label={`${nodeSpec(id).label} 빼기`} onClick={() => toggle(id)}>×</button>
                </span>
              ))
            )}
          </div>

          {draft.text.trim() === '' ? (
            <p className="hint-note muted">문제를 적으면 필요한 준비 후보가 여기에 떠요.</p>
          ) : openHints.length > 0 ? (
            <div className="hint-area">
              <p className="hint-title muted">문제 글에서 찾은 힌트 — 눌러서 담으세요</p>
              <div className="hint-chips">
                {openHints.map((h) => (
                  <button key={h.id} type="button" className="hint-chip" onClick={() => toggle(h.id)} title={`힌트 단어: ${h.hit}`}>
                    {nodeSpec(h.id).label}
                    <span className="hint-why">힌트: {h.hit}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="hint-note muted">글에서 힌트를 못 찾았어요. 아래 "직접 고르기"에서 고르세요.</p>
          )}

          <details className="manual-picker">
            <summary>직접 고르기 (검색·전체 목록)</summary>
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
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </details>
          <p className="muted note-line">힌트는 문제 글의 단어만 보고 뽑은 초안이에요. 담을지 말지는 교사가 정합니다. (연구 단계에서 LLM 제안으로 확장하는 자리)</p>
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
          {stale && <span className="muted">입력이 바뀌었어요. 다시 검사하세요.</span>}
        </div>
      </section>

      <section className="card" aria-label="검사 결과" aria-live="polite">
        <div className="result-head">
          <h2>결과</h2>
          <label className="muted">
            학생{' '}
            <select value={state.currentId} onChange={(e) => dispatch({ type: 'selectStudent', id: e.target.value })}>
              {state.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
        {!result || !submitted ? (
          <p className="result-empty">문제를 적고 검사를 누르면 {student.name}에게 괜찮은지 바로 알려줘요. 학생을 바꾸면 같은 문제로 다시 판정해요.</p>
        ) : (
          <div className={`result-card result-${result.verdict}`}>
            <VerdictBadge verdict={result.verdict} large />
            <p className="result-meaning">{MEANING[result.verdict]}</p>
            {submitted.text && <p className="result-problem">{submitted.text}</p>}
            <p className="result-req"><span className="muted">필요한 준비:</span> {result.requires.map((id) => <span key={id} className="chip chip-req">{nodeSpec(id).label}</span>)}</p>

            {result.gapHard.length > 0 && (
              <div className="gap-block">
                <h3>아직 없는 준비가 있어요</h3>
                <ul className="gap-cards">
                  {result.gapHard.map((id) => {
                    const st = student.states[id] ?? 'not_started';
                    return (
                      <li key={id} className={`gap-card gap-st-${st}`}>
                        <div className="gap-card-head">
                          <span className="gap-card-label">{nodeSpec(id).label}</span>
                          <span className="chain-state">{STATE_LABEL[st]}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {result.gapSoft.length > 0 && (
              <div className="gap-block">
                <h3>있으면 좋은 준비 (참고)</h3>
                <div className="chips">
                  {result.gapSoft.map((id) => (
                    <span key={id} className="chip">{nodeSpec(id).label}</span>
                  ))}
                </div>
              </div>
            )}
            {result.verdict === 'COLLISION' && result.suggestedNext.length > 0 && (
              <div className="gap-block">
                <h3>지금 바로 다룰 수 있는 개념</h3>
                <p className="muted">빠진 준비 가운데 이미 준비가 된 후보예요. 순서가 아니라 후보이며, 무엇을 먼저 할지는 교사가 정합니다.</p>
                <div className="chips">
                  {result.suggestedNext.map((id) => (
                    <span key={id} className="chip chip-next">{nodeSpec(id).label}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 자세히 보기: 연구·발표용 상세(엔진 설명·학습 계보·근거 코드·판정 코드)는 접어둔다. */}
            <details className="detail-fold">
              <summary>자세히 보기 (설명 문장·학습 계보·근거 코드)</summary>
              <p className="result-expl">{result.explanation}</p>
              <p className="detail-code muted">판정 코드: {result.verdict}</p>
              <div className="prereq-line">
                <ol className="chain-list" aria-label="이 문제의 학습 계보">
                  <li className="chain-intro muted">
                    이 문제가 요구하는 개념과 그 아래 필수 선수 개념을 순서대로 나열한 것입니다.
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
              </div>
            </details>

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
