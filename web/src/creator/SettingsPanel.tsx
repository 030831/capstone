// 오른쪽 설정 패널 — 선택한 요소에 필요한 설정만 보여준다(지시서 §5·§7·§9).
// IEP 참고 정보로 교사가 하려는 조정이 실제 편집 동작으로 이어진다:
// 작은 수량(수량 변경)·그림 함께(그림 표시)·고르게 하기(응답 방식)·짧은 설명(질문 편집)·
// 넓은 답칸(답칸 크기)·도움말(힌트).
import { answerMissingInChoices, computedAnswer, defaultChoices } from './answers';
import { ELEMENT_LABEL, type ElementKey } from './ProblemCard';
import { withResponseMode } from './reducer';
import { PICTO_LABEL, type PictogramKind, type Problem } from './types';
import { clampNumber } from './util';
import type { ProblemIssue } from './validate';
import { PictogramSvg, PICTO_SIZE } from './Pictogram';

interface PanelProps {
  problem: Problem;
  element: ElementKey;
  issues: ProblemIssue[];
  onPatch: (patch: Partial<Problem>, coalesceKey?: string) => void;
}

export function SettingsPanel({ problem: p, element, issues, onPatch }: PanelProps) {
  const errs = issues.filter((i) => i.element === element || i.element === 'problem');
  const setQuestion = (text: string): void => onPatch({ question: text }, `q:${p.id}`);

  return (
    <div className="settings">
      <h3 className="panel-title">{ELEMENT_LABEL[element]} 설정</h3>
      {errs.length > 0 && (
        <ul className="issue-list">
          {errs.map((e, i) => (
            <li key={i} className={e.level}>
              {e.message}
            </li>
          ))}
        </ul>
      )}

      {element === 'question' && (
        <>
          <Field label="질문 문장">
            <textarea className="q-edit" rows={3} value={p.question} aria-label="질문 문장" onChange={(e) => setQuestion(e.target.value)} />
          </Field>
          <Field label="글자 크기">
            <Segmented
              options={[
                { value: 'normal', label: '보통' },
                { value: 'large', label: '크게' },
              ]}
              value={p.questionSize}
              onChange={(v) => onPatch({ questionSize: v as 'normal' | 'large' })}
            />
          </Field>
        </>
      )}

      {element === 'pictures' && <PicturesSettings p={p} onPatch={onPatch} />}
      {element === 'equation' && p.kind === 'equation' && <EquationSettings p={p} onPatch={onPatch} />}
      {element === 'response' && <ResponseSettings p={p} onPatch={onPatch} />}
      {element === 'hint' && <HintSettings p={p} onPatch={onPatch} />}
    </div>
  );
}

// ── 공통 필드들 ────────────────────────────────────────────

// label 요소 안에 버튼(radiogroup 등)을 넣으면 접근 가능한 이름이 섞이므로
// Field 는 div 로 감싸고, 입력 요소에는 각자 aria-label 을 명시해 둔다.
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

function Segmented({ options, value, onChange, ariaLabel }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; ariaLabel?: string }) {
  return (
    <span className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`seg-btn${value === o.value ? ' on' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

function Stepper({ label, value, min, max, onChange, hint }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <Field label={label} hint={hint ?? `${min}~${max} (지원 범위)`}>
      <span className="stepper">
        <button type="button" className="btn btn-small" aria-label={`${label} 1 줄이기`} onClick={() => onChange(clampNumber(value - 1, min, max))}>
          −
        </button>
        <input
          type="number"
          className="num-input"
          value={value}
          min={min}
          max={max}
          aria-label={label}
          onChange={(e) => onChange(clampNumber(Number(e.target.value), min, max))}
        />
        <button type="button" className="btn btn-small" aria-label={`${label} 1 늘리기`} onClick={() => onChange(clampNumber(value + 1, min, max))}>
          +
        </button>
      </span>
    </Field>
  );
}

function PictogramPicker({ value, onChange }: { value: PictogramKind; onChange: (v: PictogramKind) => void }) {
  const kinds: PictogramKind[] = ['circle', 'star', 'apple', 'ball'];
  return (
    <span className="picto-picker" role="radiogroup" aria-label="그림 종류">
      {kinds.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={`picto-btn${value === k ? ' on' : ''}`} onClick={() => onChange(k)} aria-label={PICTO_LABEL[k]}>
          <PictogramSvg kind={k} px={PICTO_SIZE.small} />
          <span>{PICTO_LABEL[k]}</span>
        </button>
      ))}
    </span>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// ── 형태별 그림 설정 ───────────────────────────────────────

function PicturesSettings({ p, onPatch }: { p: Problem; onPatch: PanelProps['onPatch'] }) {
  if (p.kind === 'count') {
    return (
      <>
        <Field label="그림 종류">
          <PictogramPicker value={p.pictogram} onChange={(v) => onPatch({ pictogram: v } as Partial<Problem>)} />
        </Field>
        <Stepper label="그림 개수" value={p.count} min={1} max={20} onChange={(v) => onPatch({ count: v } as Partial<Problem>)} />
        <Stepper label="한 줄에 놓을 개수" value={p.perRow} min={1} max={10} onChange={(v) => onPatch({ perRow: v } as Partial<Problem>)} />
        <Field label="그림 크기">
          <Segmented
            options={[
              { value: 'small', label: '작게' },
              { value: 'medium', label: '보통' },
              { value: 'large', label: '크게' },
            ]}
            value={p.itemSize}
            onChange={(v) => onPatch({ itemSize: v } as Partial<Problem>)}
          />
        </Field>
      </>
    );
  }
  if (p.kind === 'two_groups') {
    return (
      <>
        <Field label="표시 방식" hint="바꿔도 수량은 그대로 남아요">
          <Segmented
            options={[
              { value: 'pictures', label: '그림만' },
              { value: 'equation', label: '수식만' },
              { value: 'both', label: '그림+수식' },
            ]}
            value={p.displayMode}
            onChange={(v) => onPatch({ displayMode: v } as Partial<Problem>)}
          />
        </Field>
        <Stepper label="왼쪽 수량" value={p.left.count} min={1} max={20} onChange={(v) => onPatch({ left: { ...p.left, count: v } })} />
        <Field label="왼쪽 그림 종류">
          <PictogramPicker value={p.left.pictogram} onChange={(v) => onPatch({ left: { ...p.left, pictogram: v } })} />
        </Field>
        <Stepper label="오른쪽 수량" value={p.right.count} min={1} max={20} onChange={(v) => onPatch({ right: { ...p.right, count: v } })} />
        <Field label="오른쪽 그림 종류">
          <PictogramPicker value={p.right.pictogram} onChange={(v) => onPatch({ right: { ...p.right, pictogram: v } })} />
        </Field>
        <Check label="묶음 테두리 보이기" checked={p.showBorder} onChange={(v) => onPatch({ showBorder: v })} />
        <Check label="+ , = 기호 보이기" checked={p.showSymbols} onChange={(v) => onPatch({ showSymbols: v })} />
      </>
    );
  }
  if (p.kind === 'equation') {
    return (
      <>
        <Check label="보조 그림 보이기" checked={p.showPictures} onChange={(v) => onPatch({ showPictures: v })} />
        {p.showPictures && (
          <Field label="보조 그림 종류">
            <PictogramPicker value={p.pictogram} onChange={(v) => onPatch({ pictogram: v } as Partial<Problem>)} />
          </Field>
        )}
      </>
    );
  }
  // compare
  return (
    <>
      <Stepper label="왼쪽 수량" value={p.left.count} min={1} max={20} onChange={(v) => onPatch({ left: { ...p.left, count: v } })} />
      <Field label="왼쪽 그림 종류">
        <PictogramPicker value={p.left.pictogram} onChange={(v) => onPatch({ left: { ...p.left, pictogram: v } })} />
      </Field>
      <Stepper label="오른쪽 수량" value={p.right.count} min={1} max={20} onChange={(v) => onPatch({ right: { ...p.right, count: v } })} />
      <Field label="오른쪽 그림 종류">
        <PictogramPicker value={p.right.pictogram} onChange={(v) => onPatch({ right: { ...p.right, pictogram: v } })} />
      </Field>
      <Check label="그림 보이기" checked={p.showPictures} onChange={(v) => onPatch({ showPictures: v })} />
      <Check label="숫자 보이기" checked={p.showNumbers} onChange={(v) => onPatch({ showNumbers: v })} />
      <Field label="질문 방식">
        <Segmented
          options={[
            { value: 'more', label: '더 많음' },
            { value: 'less', label: '더 적음' },
            { value: 'same', label: '같음 여부' },
          ]}
          value={p.questionMode}
          onChange={(v) => onPatch({ questionMode: v } as Partial<Problem>)}
        />
      </Field>
      <Field label="답하는 방식">
        <Segmented
          options={[
            { value: 'choice', label: '고르기' },
            { value: 'symbol', label: '비교 기호' },
          ]}
          value={p.responseMode}
          onChange={(v) => onPatch({ responseMode: v } as Partial<Problem>)}
        />
      </Field>
    </>
  );
}

// ── 수식 설정 ─────────────────────────────────────────────

function EquationSettings({ p, onPatch }: { p: Extract<Problem, { kind: 'equation' }>; onPatch: PanelProps['onPatch'] }) {
  return (
    <>
      <Field label="연산">
        <Segmented
          options={[
            { value: 'add', label: '덧셈 +' },
            { value: 'sub', label: '뺄셈 −' },
          ]}
          value={p.operation}
          onChange={(v) => onPatch({ operation: v } as Partial<Problem>)}
        />
      </Field>
      <Stepper label="첫 번째 수" value={p.a} min={0} max={20} onChange={(v) => onPatch({ a: v })} />
      <Stepper label="두 번째 수" value={p.b} min={0} max={20} onChange={(v) => onPatch({ b: v })} />
      <Field label="빈칸 위치" hint="가려진 수가 정답이 돼요">
        <Segmented
          options={[
            { value: 'a', label: '첫 번째 수' },
            { value: 'b', label: '두 번째 수' },
            { value: 'result', label: '결과' },
          ]}
          value={p.blank}
          onChange={(v) => onPatch({ blank: v } as Partial<Problem>)}
        />
      </Field>
    </>
  );
}

// ── 응답 설정 ─────────────────────────────────────────────

function ResponseSettings({ p, onPatch }: { p: Problem; onPatch: PanelProps['onPatch'] }) {
  const answer = computedAnswer(p);
  const missing = answerMissingInChoices(p);
  const setMode = (mode: 'blank' | 'choices'): void => {
    // 답칸↔선택지 전환. 선택지가 비어 있으면 기본 선택지(시작값)를 채워 넣는다.
    onPatch({ response: withResponseMode(p, mode).response });
  };
  const setChoices = (choices: string[], correctIndex: number): void => {
    onPatch({ response: { ...p.response, choices, correctIndex } }, `choices:${p.id}`);
  };

  return (
    <>
      <Field label="답하는 방식">
        <Segmented
          options={[
            { value: 'blank', label: '답칸에 쓰기' },
            { value: 'choices', label: '골라 보기' },
          ]}
          value={p.response.mode}
          onChange={(v) => setMode(v as 'blank' | 'choices')}
        />
      </Field>

      {p.response.mode === 'blank' && (
        <Field label="답칸 크기">
          <Segmented
            options={[
              { value: 'small', label: '좁게' },
              { value: 'medium', label: '보통' },
              { value: 'large', label: '넓게' },
            ]}
            value={p.response.blankSize}
            onChange={(v) => onPatch({ response: { ...p.response, blankSize: v as 'small' | 'medium' | 'large' } })}
          />
        </Field>
      )}

      {p.response.mode === 'choices' && (
        <>
          {answer !== null && (
            <p className="calc-answer">
              계산된 정답: <strong>{answer}</strong>
            </p>
          )}
          <fieldset className="choices-edit">
            <legend>선택지 (정답에 ○ 표시)</legend>
            {p.response.choices.map((c, i) => (
              <span className="choice-edit-row" key={i}>
                <input
                  type="radio"
                  name={`correct-${p.id}`}
                  checked={i === p.response.correctIndex}
                  aria-label={`${i + 1}번 선택지를 정답으로 지정`}
                  onChange={() => setChoices([...p.response.choices], i)}
                />
                <input
                  type="text"
                  className="choice-input"
                  value={c}
                  aria-label={`선택지 ${i + 1}`}
                  onChange={(e) => {
                    const choices = [...p.response.choices];
                    choices[i] = e.target.value;
                    setChoices(choices, p.response.correctIndex);
                  }}
                />
                <button type="button" className="btn btn-small btn-danger" aria-label={`선택지 ${i + 1} 삭제`} onClick={() => {
                  const choices = p.response.choices.filter((_, j) => j !== i);
                  let correctIndex = p.response.correctIndex;
                  if (correctIndex === i) correctIndex = -1; // 삭제된 항목이 정답이면 미지정 상태로 — 조용히 옮기지 않는다
                  else if (correctIndex > i) correctIndex -= 1;
                  setChoices(choices, correctIndex);
                }}>
                  ✕
                </button>
              </span>
            ))}
            <button type="button" className="btn btn-small" onClick={() => setChoices([...p.response.choices, ''], Math.min(p.response.correctIndex, p.response.choices.length))}>
              + 선택지 추가
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                const { choices, correctIndex } = defaultChoices(p);
                setChoices(choices, correctIndex);
              }}
            >
              기본 선택지로 다시 채우기
            </button>
          </fieldset>
          {missing && answer !== null && (
            <p className="answer-fix">
              계산된 정답 '{answer}'이(가) 선택지에 없어요.{' '}
              <button
                type="button"
                className="btn btn-small btn-confirm"
                onClick={() => {
                  const choices = [...p.response.choices.filter((c) => c.trim())];
                  if (!choices.some((c) => c === answer)) choices.push(answer);
                  setChoices(choices, choices.indexOf(answer));
                }}
              >
                '{answer}' 추가하고 정답으로 지정
              </button>
            </p>
          )}
        </>
      )}
    </>
  );
}

// ── 힌트 설정 ─────────────────────────────────────────────

function HintSettings({ p, onPatch }: { p: Problem; onPatch: PanelProps['onPatch'] }) {
  const h = p.hint;
  return (
    <>
      <Check label="힌트 넣기" checked={h.enabled} onChange={(v) => onPatch({ hint: { ...h, enabled: v } })} />
      {h.enabled && (
        <>
          <Field label="안내 문장">
            <textarea className="q-edit" rows={2} value={h.text} aria-label="힌트 안내 문장" onChange={(e) => onPatch({ hint: { ...h, text: e.target.value } }, `hint:${p.id}`)} />
          </Field>
          <Stepper label="보조 그림 개수" value={h.pictureCount} min={0} max={20} onChange={(v) => onPatch({ hint: { ...h, pictureCount: v } })} />
          {h.pictureCount > 0 && (
            <Field label="보조 그림 종류">
              <PictogramPicker value={h.pictogram} onChange={(v) => onPatch({ hint: { ...h, pictogram: v } })} />
            </Field>
          )}
          <Check label="학습지에도 힌트 넣기" checked={h.showInPrint} onChange={(v) => onPatch({ hint: { ...h, showInPrint: v } })} />
        </>
      )}
    </>
  );
}
