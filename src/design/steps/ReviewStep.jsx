import { useState } from 'react';
import { CircleHelp, NotebookPen, RotateCcw } from 'lucide-react';
import { axisLabel } from '../model.js';
import { SEVERITY, countNotes } from '../rules.js';
import { notesFor, versionIds, versionLabel } from '../reducer.js';

function NoteCard({ note, ackKey, recorded, dispatch }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const inputId = `ack-${ackKey}`;
  if (recorded !== undefined) {
    return (
      <li className="dp-note recorded">
        <div className="dp-note-row">
          <span className="dp-severity done">기록됨</span>
          <p>
            {note.id} · {note.axes.map(axisLabel).join(', ')} — 의도한 변경
            {recorded ? `: ${recorded}` : ''}
          </p>
          <button
            className="btn btn-ghost dp-small-btn"
            onClick={() => dispatch({ type: 'unacknowledge', key: ackKey })}
          >
            <RotateCcw size={14} /> 기록 취소
          </button>
        </div>
      </li>
    );
  }
  const check = note.severity === SEVERITY.CHECK;
  return (
    <li className={`dp-note ${check ? 'check' : 'info'}`}>
      <div className="dp-note-row">
        <span className={`dp-severity ${check ? 'check' : 'info'}`}>{note.severity}</span>
        <div>
          <p>{note.text}</p>
          <small>
            관련 축: {note.axes.map(axisLabel).join(', ')}
            {note.changedFrom.map((c) => ` · 원본 ${c.from} → ${c.to}`).join('')}
          </small>
        </div>
      </div>
      {!note.informational &&
        (open ? (
          <form
            className="dp-ack-form"
            onSubmit={(e) => {
              e.preventDefault();
              dispatch({ type: 'acknowledge', key: ackKey, note: text.trim() });
            }}
          >
            <label htmlFor={inputId}>의도한 이유 (선택)</label>
            <input
              id={inputId}
              className="dp-text"
              type="text"
              value={text}
              placeholder="예: 이번 시간은 도움 받는 연습으로 사용"
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <div>
              <button type="submit" className="btn btn-primary dp-small-btn">
                기록하기
              </button>
              <button
                type="button"
                className="btn btn-ghost dp-small-btn"
                onClick={() => setOpen(false)}
              >
                취소
              </button>
            </div>
          </form>
        ) : (
          <button className="btn btn-secondary dp-small-btn" onClick={() => setOpen(true)}>
            <NotebookPen size={15} /> 의도한 변경으로 기록
          </button>
        ))}
    </li>
  );
}

export default function ReviewStep({ state, dispatch }) {
  const ids = versionIds(state);
  const groups = ids.map((id) => {
    const notes = notesFor(state, id);
    return { id, notes, counts: countNotes(notes, state.acknowledged, id) };
  });
  const total = groups.reduce((n, g) => n + g.counts.check, 0);
  return (
    <section className="dp-panel" aria-labelledby="review-title">
      <div className="dp-panel-head">
        <span className="dp-mini-label">4단계</span>
        <h2 id="review-title">목표와 목적에 비추어 다시 볼 지점입니다.</h2>
        <p className="muted">
          검토 안내는 판정이 아닙니다. 정해 둔 목표 · 목적과 자료 구성 사이에서 확인할 만한 관계를
          이유와 함께 보여 줄 뿐이며, 결정은 교사가 합니다.
        </p>
      </div>
      <p className="dp-notice" aria-live="polite">
        <CircleHelp size={17} />
        {ids.length}개 버전에서 확인 필요 {total}건.
        {total === 0 && ' 지금 남은 확인 필요 안내는 없습니다.'}
      </p>
      <div className="dp-review-list">
        {groups.map(({ id, notes, counts }) => (
          <section key={id} className="dp-version" aria-labelledby={`ver-${id}`}>
            <header>
              <h3 id={`ver-${id}`}>{versionLabel(id)}</h3>
              <span className="dp-counts">
                확인 필요 {counts.check} · 참고 {counts.info} · 기록됨 {counts.recorded}
              </span>
            </header>
            {notes.length ? (
              <ul className="dp-notes">
                {notes.map((note) => {
                  const key = `${id}:${note.id}`;
                  return (
                    <NoteCard
                      key={key}
                      note={note}
                      ackKey={key}
                      recorded={note.informational ? undefined : state.acknowledged[key]}
                      dispatch={dispatch}
                    />
                  );
                })}
              </ul>
            ) : (
              <p className="dp-field-note">이 버전에는 안내가 없습니다.</p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
