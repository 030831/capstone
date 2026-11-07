import { useMemo, useRef, useState } from 'react';
import { GROUPS, groupOf, nodeNumber } from '../data/groups';
import { suggestConcepts } from '../data/draft';
import { SAMPLE_PROBLEMS } from '../data/problems';
import { check, hardAncestors } from '../engine';
import { basisCode, graph, nodeSpec } from '../graph';
import type { Action, AppState } from '../state';
import { RESULT_SCOPE_NOTE, STATE_LABEL } from '../ui';
import { VerdictBadge } from './Badges';

// v3: 판정 문구는 기록 확인 중심(지시서 §7). "지금 딱 맞는 문제" 같은
// 성공·학습 보장 표현은 쓰지 않는다. 판정 코드·설명 문장은 "자세히 보기" 안.
const MEANING: Record<string, string> = {
  COLLISION: '선수 개념 중 시작 전이거나 형성 중으로 기록된 것이 있어요. 아래 개념의 기록을 확인해 주세요.',
  NEEDS_REVIEW: '선수 개념이나 이 문제의 개념에 아직 기록되지 않은 것이 있어요. 아래 개념의 기록을 확인해 주세요.',
  ALIGNED: '필수 선수 개념은 모두 숙달로 기록되어 있고, 이 문제의 개념은 아직 숙달로 기록되지 않았어요.',
  TOO_EASY: '이 문제의 개념은 모두 숙달로 기록되어 있어요.',
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

/** 메인 화면: 학생 선택 → 문제 작성 → 개념 확인 → 검사. */
export function CheckTab({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const { draft, submitted } = state;
  const student = state.students.find((s) => s.id === state.currentId)!;
  const [query, setQuery] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  const result = useMemo(
    () => (submitted ? check(graph, student.states, submitted.requires) : null),
    [submitted, student.states],
  );

  // 문제 글에서 뽑은 룰 기반 후보(자동 반영하지 않는다 — 교사가 담는다).
  const hints = useMemo(() => suggestConcepts(draft.text), [draft.text]);
  const openHints = hints.filter((h) => !draft.requires.includes(h.id));

  const q = query.trim();
  const toggle = (id: string) => {
    const has = draft.requires.includes(id);
    dispatch({ type: 'setDraft', draft: { requires: has ? draft.requires.filter((x) => x !== id) : [...draft.requires, id] } });
  };
  const setSurface = (k: keyof typeof draft.surface, v: string) =>
    dispatch({ type: 'setDraft', draft: { surface: { ...draft.surface, [k]: v } } });

  // 제출 후 입력이 바뀌었으면 결과 카드에 "이전 입력의 결과"로 표시한다.
  const stale =
    submitted !== null && (submitted.text !== draft.text || submitted.requires.join() !== draft.requires.join());

  const canSubmit = draft.confirmed && draft.requires.length > 0 && draft.text.trim().length > 0;

  const line = useMemo(() => (result ? ancestorLine(result.requires) : []), [result]);
  const reqSet = useMemo(() => new Set(result?.requires ?? []), [result]);
  const gapSet = useMemo(() => new Set(result?.gapHard ?? []), [result]);
  const unknownSet = useMemo(() => new Set([...(result?.unknownHard ?? []), ...(result?.unknownRequired ?? [])]), [result]);

  const focusProblem = () => {
    textRef.current?.focus();
    textRef.current?.scrollIntoView({ block: 'center' });
  };

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
          <textarea
            ref={textRef}
            rows={3}
            value={draft.text}
            onChange={(e) => dispatch({ type: 'setDraft', draft: { text: e.target.value } })}
            placeholder="학생에게 낼 문제를 그대로 적으세요"
          />
        </label>

        <fieldset className="field">
          <legend>이 문제에서 다루는 개념</legend>
          <div className="concept-confirm-row">
            <span className="muted confirm-caption">검사에 사용할 개념:</span>
            {draft.confirmed ? (
              <span className="confirm-badge" role="status">개념 확인 완료</span>
            ) : (
              <button
                type="button"
                className="btn btn-small btn-confirm"
                disabled={draft.requires.length === 0}
                onClick={() => dispatch({ type: 'confirmConcepts' })}
              >
                개념 확인
              </button>
            )}
          </div>
          <div className="selected-chips" aria-live="polite">
            {draft.requires.length === 0 ? (
              <span className="empty">아직 담지 않았어요. 아래 후보를 누르거나 "직접 고르기"에서 고르세요.</span>
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
            <p className="hint-note muted">문제를 적으면 개념 후보가 여기에 떠요.</p>
          ) : openHints.length > 0 ? (
            <div className="hint-area">
              <p className="hint-title muted">문제에서 찾은 개념 후보 — 눌러서 담으세요</p>
              <div className="hint-chips">
                {openHints.map((h) => (
                  <button key={h.id} type="button" className="hint-chip" onClick={() => toggle(h.id)} title={`근거: ${h.hit}`}>
                    {nodeSpec(h.id).label}
                    <span className="hint-why">근거: {h.hit}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="hint-note muted">글에서 후보를 못 찾았어요. 아래 "직접 고르기"에서 고르세요.</p>
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
          <p className="muted note-line">후보는 문제 글에서 찾은 초안이에요. 검사에 쓸 개념은 교사가 확인해 주세요.</p>
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
          <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={() => dispatch({ type: 'submit' })}>
            {student.name} 기준으로 검사
          </button>
          {!canSubmit && (
            <span className="muted">
              {draft.requires.length === 0 || draft.text.trim() === ''
                ? '문제 글과 개념을 채운 뒤 "개념 확인"을 누르세요.'
                : '개념이 바뀌었어요. 다시 "개념 확인"을 눌러 주세요.'}
            </span>
          )}
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
          <p className="result-empty">문제를 적고 개념을 확인한 뒤 검사를 누르면, {student.name}의 기록과 대조한 결과를 보여줘요.</p>
        ) : (
          <div className={`result-card result-${result.verdict}`}>
            {stale && (
              <p className="stale-note" role="status">
                이전 입력의 결과예요. 지금 작성 중인 문제와는 다릅니다.
              </p>
            )}
            <VerdictBadge verdict={result.verdict} large />
            <p className="result-meaning">{MEANING[result.verdict]}</p>
            <p className="result-scope muted">{RESULT_SCOPE_NOTE}</p>
            <p className="result-req"><span className="muted">이 문제에서 다루는 개념:</span> {submitted.requires.map((id) => <span key={id} className="chip chip-req">{nodeSpec(id).label}</span>)}</p>
            {submitted.text && <p className="result-problem" data-user-content>{submitted.text}</p>}

            {/* 1) 확인할 선수 개념 / 미확인 기록 */}
            {(result.unknownHard.length > 0 || result.unknownRequired.length > 0) && (
              <div className="gap-block">
                <h3>아직 확인하지 않은 기록</h3>
                <p className="muted">기록이 없는 개념이에요. 학생 현행수준에서 확인해 주세요.</p>
                <ul className="gap-cards">
                  {[...result.unknownHard, ...result.unknownRequired].map((id) => (
                    <li key={id} className="gap-card gap-st-unknown">
                      <div className="gap-card-head">
                        <span className="gap-card-label">{nodeSpec(id).label}</span>
                        <span className="chain-state">{STATE_LABEL.unknown}</span>
                      </div>
                      <span className="gap-card-tag">
                        {result.unknownRequired.includes(id) ? '이 문제의 개념' : '선수 개념'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.gapHard.length > 0 && (
              <div className="gap-block">
                <h3>확인이 필요한 선수 개념</h3>
                <p className="muted">시작 전 또는 형성 중으로 기록된 선수 개념이에요.</p>
                <ul className="gap-cards">
                  {result.gapHard.map((id) => {
                    const st = student.states[id] ?? 'unknown';
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
                <p className="muted">빠진 준비 가운데 선수가 모두 확인된 후보예요. 순서가 아니라 후보이며, 무엇을 먼저 할지는 교사가 정합니다.</p>
                <div className="chips">
                  {result.suggestedNext.map((id) => (
                    <span key={id} className="chip chip-next">{nodeSpec(id).label}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 2) 교사가 취할 수 있는 동작 */}
            <div className="result-actions">
              <button type="button" className="btn" onClick={() => dispatch({ type: 'openModal', modal: 'students' })}>
                학생 기록 확인
              </button>
              <button type="button" className="btn" onClick={focusProblem}>
                문제 수정하기
              </button>
              <button type="button" className="btn" onClick={() => dispatch({ type: 'openModal', modal: 'batch' })}>
                반 일괄 검사
              </button>
            </div>

            {/* 3) 자세히: 설명 문장·학습 계보·근거 코드·판정 코드 */}
            <details className="detail-fold">
              <summary>자세히 보기 (설명 문장·학습 계보·근거 코드)</summary>
              <p className="result-expl">{result.explanation}</p>
              <p className="detail-code muted">판정 코드: {result.verdict}</p>
              <div className="prereq-line">
                <ol className="chain-list" aria-label="이 문제의 학습 계보">
                  <li className="chain-intro muted">
                    이 문제가 요구하는 개념과 그 아래 필수 선수 개념을 순서대로 나열한 것입니다.
                    <strong>확인이 필요한 줄</strong>은 학생 기록에 시작 전·형성 중으로 남아 있거나 기록이 없는 개념입니다.
                  </li>
                  {line.map((id) => {
                    const st = student.states[id] ?? 'unknown';
                    const isReq = reqSet.has(id);
                    const isGap = gapSet.has(id);
                    const isUnknown = unknownSet.has(id);
                    const cls = `chain-item chain-st-${st}${isReq ? ' chain-req' : ''}${isGap ? ' chain-gap' : ''}${isUnknown ? ' chain-unknown' : ''}`;
                    return (
                      <li key={id} className={cls}>
                        <span className="chain-marker" aria-hidden="true">
                          {isReq ? '◆' : st === 'mastered' ? '✓' : st === 'emerging' ? '△' : st === 'not_started' ? '✗' : '?'}
                        </span>
                        <span className="chain-label">{nodeSpec(id).label}</span>
                        <span className="chain-state">{STATE_LABEL[st]}</span>
                        {isReq && <span className="chain-tag tag-req">이 문제의 개념</span>}
                        {isGap && !isReq && <span className="chain-tag tag-gap">확인 필요</span>}
                        {isUnknown && !isReq && <span className="chain-tag tag-unknown">기록 없음</span>}
                        <span className="code">{basisCode(id)}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </details>
          </div>
        )}
      </section>
    </div>
  );
}
