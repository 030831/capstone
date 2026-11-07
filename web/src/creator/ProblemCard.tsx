// 문제 카드 — 편집 화면과 학습지 출력이 **같은 데이터**로 만드는 렌더링(지시서 §14).
// mode: 'edit' (편집·요소 선택), 'student' (학생용 출력: 정답·IEP·편집 UI 없음), 'teacher' (교사용 정답 보기).
import { computedAnswer, equationResult } from './answers';
import { PictureGroup } from './Pictogram';
import { PICTO_LABEL, type Problem } from './types';

export type ElementKey = 'question' | 'pictures' | 'equation' | 'response' | 'hint';

const ELEMENT_LABEL: Record<ElementKey, string> = {
  question: '질문 문장',
  pictures: '그림',
  equation: '수식',
  response: '답하는 방식',
  hint: '힌트',
};

export interface ProblemCardProps {
  problem: Problem;
  mode: 'edit' | 'student' | 'teacher';
  /** 문제 번호(학습지·목록용). */
  number?: number;
  /** edit 모드: 현재 선택된 요소. */
  selected?: ElementKey | null;
  onSelect?: (el: ElementKey) => void;
  /** edit 모드: 질문 문장 직접 편집. */
  onQuestionChange?: (text: string) => void;
}

const BLANK_PX: Record<'small' | 'medium' | 'large', number> = { small: 44, medium: 64, large: 96 };

function BlankBox({ size, label }: { size: 'small' | 'medium' | 'large'; label?: string }) {
  return (
    <span className="ans-blank" style={{ minWidth: BLANK_PX[size], minHeight: Math.round(BLANK_PX[size] * 0.62) }} aria-label={label} />
  );
}

function Choices({
  choices,
  correctIndex,
  showCorrect,
  horizontal,
}: {
  choices: string[];
  correctIndex: number;
  showCorrect: boolean;
  horizontal: boolean;
}) {
  return (
    <span className={`choices${horizontal ? ' h' : ''}`}>
      {choices.map((c, i) => (
        <span key={i} className={`choice${showCorrect && i === correctIndex ? ' correct' : ''}`}>
          {showCorrect && i === correctIndex && <span className="choice-mark" aria-hidden>✓</span>}
          <span className="choice-circle" aria-hidden />
          <span className="choice-text">{c}</span>
          {showCorrect && i === correctIndex && <span className="visually-hidden">정답</span>}
        </span>
      ))}
    </span>
  );
}

/** 요소(편집 가능한 영역) 래퍼. 선택 표시는 화면에서만 — 인쇄·학생용엔 나오지 않는다. */
function Element({
  el,
  selected,
  onSelect,
  children,
  className,
}: {
  el: ElementKey;
  selected?: ElementKey | null;
  onSelect?: (el: ElementKey) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const interactive = onSelect !== undefined;
  return (
    <div
      className={`element ${className ?? ''}${selected === el ? ' sel' : ''}`}
      data-element={el}
      {...(interactive
        ? {
            tabIndex: 0,
            role: 'group',
            'aria-label': `${ELEMENT_LABEL[el]} — 선택하면 오른쪽에서 설정을 바꿀 수 있어요`,
            onClick: () => onSelect?.(el),
            onFocus: () => onSelect?.(el),
          }
        : {})}
    >
      {interactive && selected === el && <span className="sel-chip">{ELEMENT_LABEL[el]}</span>}
      {children}
    </div>
  );
}

export function ProblemCard({ problem: p, mode, number, selected, onSelect, onQuestionChange }: ProblemCardProps) {
  const edit = mode === 'edit';
  const teacher = mode === 'teacher';
  const answer = computedAnswer(p);
  const qClass = p.questionSize === 'large' ? 'q q-lg' : 'q';

  return (
    <article className={`problem-card kind-${p.kind}`} data-problem-kind={p.kind} data-problem-id={edit ? p.id : undefined}>
      {number !== undefined && <span className="pnum" aria-hidden>{number}. </span>}
      <div className="pbody">
        <Element el="question" selected={selected} onSelect={onSelect} className="q-wrap">
          {edit ? (
            <textarea
              className={qClass}
              value={p.question}
              rows={2}
              aria-label="질문 문장"
              onChange={(e) => onQuestionChange?.(e.target.value)}
            />
          ) : (
            <p className={qClass}>{p.question}</p>
          )}
        </Element>

        {/* ── 형태별 표현 ── */}
        {p.kind === 'count' && (
          <Element el="pictures" selected={selected} onSelect={onSelect} className="vis">
            <PictureGroup kind={p.pictogram} count={p.count} perRow={p.perRow} itemSize={p.itemSize} />
          </Element>
        )}

        {p.kind === 'two_groups' && (
          <>
            {(p.displayMode === 'pictures' || p.displayMode === 'both') && (
              <Element el="pictures" selected={selected} onSelect={onSelect} className="vis">
                <span className="two-groups">
                  <span className={`grp${p.showBorder ? ' bordered' : ''}`}>
                    <PictureGroup kind={p.left.pictogram} count={p.left.count} perRow={Math.max(3, Math.min(10, p.left.count))} itemSize="medium" />
                    <span className="grp-cap">{PICTO_LABEL[p.left.pictogram]} {p.left.count}개</span>
                  </span>
                  {p.showSymbols && <span className="grp-op" aria-hidden>+</span>}
                  <span className={`grp${p.showBorder ? ' bordered' : ''}`}>
                    <PictureGroup kind={p.right.pictogram} count={p.right.count} perRow={Math.max(3, Math.min(10, p.right.count))} itemSize="medium" />
                    <span className="grp-cap">{PICTO_LABEL[p.right.pictogram]} {p.right.count}개</span>
                  </span>
                  {p.showSymbols && <span className="grp-op" aria-hidden>=</span>}
                </span>
              </Element>
            )}
            {(p.displayMode === 'equation' || p.displayMode === 'both') && (
              <Element el="equation" selected={selected} onSelect={onSelect} className="eq-line">
                <span className="eq-static">
                  {p.left.count} + {p.right.count} ={' '}
                  {p.response.mode === 'blank' ? <BlankBox size={p.response.blankSize} /> : null}
                </span>
                {p.response.mode === 'choices' && (
                  <Choices choices={p.response.choices} correctIndex={p.response.correctIndex} showCorrect={teacher} horizontal />
                )}
              </Element>
            )}
          </>
        )}

        {p.kind === 'equation' && (
          <>
            <Element el="equation" selected={selected} onSelect={onSelect} className="eq-line">
              <span className="eq-static">
                {p.blank === 'a' ? <BlankBox size={p.response.blankSize} /> : p.a}
                {' '}
                {p.operation === 'add' ? '+' : '−'}
                {' '}
                {p.blank === 'b' ? <BlankBox size={p.response.blankSize} /> : p.b}
                {' = '}
                {p.blank === 'result' ? (p.response.mode === 'blank' ? <BlankBox size={p.response.blankSize} /> : null) : equationResult(p)}
              </span>
              {p.response.mode === 'choices' && (
                <Choices choices={p.response.choices} correctIndex={p.response.correctIndex} showCorrect={teacher} horizontal />
              )}
            </Element>
            {p.showPictures && (
              <Element el="pictures" selected={selected} onSelect={onSelect} className="vis">
                <span className="two-groups">
                  <span className="grp bordered">
                    <PictureGroup kind={p.pictogram} count={p.a} perRow={Math.max(3, Math.min(10, p.a))} itemSize="medium" />
                    <span className="grp-cap">{PICTO_LABEL[p.pictogram]} {p.a}개</span>
                  </span>
                  <span className="grp-op" aria-hidden>{p.operation === 'add' ? '+' : '−'}</span>
                  <span className="grp bordered">
                    <PictureGroup kind={p.pictogram} count={p.b} perRow={Math.max(3, Math.min(10, p.b))} itemSize="medium" />
                    <span className="grp-cap">{PICTO_LABEL[p.pictogram]} {p.b}개</span>
                  </span>
                </span>
              </Element>
            )}
          </>
        )}

        {p.kind === 'compare' && (
          <Element el="pictures" selected={selected} onSelect={onSelect} className="vis">
            <span className="two-groups cmp">
              <span className="grp bordered">
                {p.showPictures && <PictureGroup kind={p.left.pictogram} count={p.left.count} perRow={Math.max(3, Math.min(10, p.left.count))} itemSize="medium" />}
                {p.showNumbers && <span className="grp-num">{p.left.count}</span>}
                <span className="grp-cap">왼쪽</span>
              </span>
              <span className="grp bordered">
                {p.showPictures && <PictureGroup kind={p.right.pictogram} count={p.right.count} perRow={Math.max(3, Math.min(10, p.right.count))} itemSize="medium" />}
                {p.showNumbers && <span className="grp-num">{p.right.count}</span>}
                <span className="grp-cap">오른쪽</span>
              </span>
            </span>
          </Element>
        )}

        {/* ── 응답 영역 ── */}
        {(p.kind === 'count' || p.kind === 'compare' || (p.kind === 'two_groups' && p.displayMode !== 'equation' && p.displayMode !== 'both')) && (
          <Element el="response" selected={selected} onSelect={onSelect} className="resp">
            {p.kind === 'compare' && p.responseMode === 'symbol' ? (
              // 비교 기호 빈칸: 숫자를 함께 보여 준다.
              <span className="eq-static symbol-line">
                {p.left.count} <BlankBox size={p.response.blankSize} /> {p.right.count}
              </span>
            ) : p.response.mode === 'blank' ? (
              <BlankBox size={p.response.blankSize} />
            ) : (
              <Choices choices={p.response.choices} correctIndex={p.response.correctIndex} showCorrect={teacher} horizontal={p.kind === 'compare'} />
            )}
          </Element>
        )}

        {/* ── 힌트 ── 편집 화면에서는 항상 노출: 꺼져 있으면 '추가' 안내 ── */}
        {(mode === 'edit' || (p.hint.enabled && (mode === 'teacher' || p.hint.showInPrint))) && (
          <Element el="hint" selected={selected} onSelect={onSelect} className="hint-box">
            {edit && !p.hint.enabled && <span className="hint-off-note">＋ 힌트 — 오른쪽에서 ‘힌트 넣기’를 켜면 추가돼요</span>}
            {p.hint.enabled && p.hint.text.trim() && <p className="hint-text">{p.hint.text}</p>}
            {p.hint.enabled && p.hint.pictureCount > 0 && <PictureGroup kind={p.hint.pictogram} count={p.hint.pictureCount} perRow={Math.max(3, p.hint.pictureCount)} itemSize="small" />}
          </Element>
        )}

        {/* ── 교사용 정답 (student 출력에 없음) ── */}
        {teacher && (
          <p className="teacher-answer">
            정답: <strong>{answer ?? '(계산할 수 없음)'}</strong>
            {p.kind === 'equation' && p.blank !== 'result' && <span className="muted"> (가려진 수가 정답)</span>}
          </p>
        )}
      </div>
    </article>
  );
}

export { ELEMENT_LABEL };
