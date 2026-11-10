import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CircleCheck,
  Clock,
  Play,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { makeId, usePersistentState } from '../lib/storage';
import {
  ACTIVITY_MINUTES,
  ACTIVITY_STATUS,
  ITEM_STATUS,
  PURPOSE_LABEL,
  SCENARIOS,
  SUPPORT_LABEL,
  createDb,
  editItem,
  expireActivities,
  isDb,
  runScenario,
  setItemStatus,
  startActivity,
  submitAttempt,
  summarize,
} from './store';
import './compare.css';

// 수량 비교 학습기록: 늘봄 디자인 셸 안에서 학생 풀이와 기록을 확인하는 화면.
// 자료 설계(#/design)와 별개로 동작하며, 기록은 이 브라우저에만 저장한다.

const percent = (v) => (v === null || v === undefined ? '응답 없음' : `${v}%`);
const seconds = (ms) => `${(ms / 1000).toFixed(1)}초`;
const rangeOf = (goal) => `${goal.min}~${goal.max}`;
const presentationOf = (goal) => (goal.presentation === 'number' ? '숫자' : '그림');

export default function CompareApp({ tab }) {
  const fallback = useMemo(createDb, []);
  const [stored, setDb] = usePersistentState('compare-db', createDb);
  const [offset, setOffset] = usePersistentState('compare-clock', 0);
  const [studentId, setStudentId] = usePersistentState('compare-student', 's1');
  const db = isDb(stored) ? stored : fallback;
  const clock = Number(offset) || 0;
  const now = () => Date.now() + clock;

  useEffect(() => {
    if (!isDb(stored)) setDb(createDb());
  }, [stored]);
  // 기한이 지난 활동은 주기적으로 마감한다.
  useEffect(() => {
    const tick = () =>
      setDb((prev) => {
        if (!isDb(prev)) return prev;
        const r = expireActivities(prev, Date.now() + clock);
        return r.expired.length ? r.db : prev;
      });
    tick();
    const timer = setInterval(tick, 20000);
    return () => clearInterval(timer);
  }, [clock]);

  const student = db.students.find((s) => s.id === studentId) || db.students[0];

  return (
    <div className="design-proto cmp">
      <header className="dp-work-header">
        <div>
          <span className="dp-mini-label">수량 비교 기록 · 가상 사례</span>
          <h1>더 많은 쪽 고르기</h1>
        </div>
        <nav className="cmp-tabs" aria-label="화면 선택">
          <a href="#/compare" aria-current={tab === 'student' ? 'page' : undefined}>
            학생 화면
          </a>
          <a href="#/compare/teacher" aria-current={tab === 'teacher' ? 'page' : undefined}>
            교사 화면
          </a>
        </nav>
      </header>
      {tab === 'student' ? (
        <StudentPanel
          key={student.id}
          db={db}
          setDb={setDb}
          now={now}
          student={student}
          setStudentId={setStudentId}
        />
      ) : (
        <TeacherPanel
          db={db}
          setDb={setDb}
          student={student}
          setStudentId={setStudentId}
          clock={clock}
          setOffset={setOffset}
        />
      )}
    </div>
  );
}

function Pills({ legend, name, options, value, onChange }) {
  return (
    <fieldset className="cmp-field">
      <legend className="dp-block-title">{legend}</legend>
      <div className="dp-pills">
        {options.map((o) => (
          <label key={o.value} className={`dp-pill ${value === o.value ? 'selected' : ''}`}>
            <input
              type="radio"
              name={name}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
            {o.note && <small>{o.note}</small>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function studentOptions(db) {
  return db.students.map((s) => {
    const g = db.goals.find((x) => x.studentId === s.id);
    return { value: s.id, label: s.alias, note: `${rangeOf(g)} · ${presentationOf(g)}` };
  });
}

// ---------- 학생 화면 ----------
function StudentPanel({ db, setDb, now, student, setStudentId }) {
  const goal = db.goals.find((g) => g.studentId === student.id);
  const open = db.activities.find((a) => a.studentId === student.id && a.status === 'open');
  const [purpose, setPurpose] = useState('practice');
  const [viewId, setViewId] = useState(open ? open.id : null);
  const [notice, setNotice] = useState('');
  const activity = db.activities.find((a) => a.id === viewId);

  const start = () => {
    const r = startActivity(db, { studentId: student.id, purpose, now: now(), id: makeId() });
    if (r.error) {
      setNotice('지금은 승인된 문항이 없어요. 교사 화면에서 문항을 승인해 주세요.');
      return;
    }
    setNotice('');
    setDb(r.db);
    setViewId(r.activity.id);
  };
  const submit = (request) =>
    setDb((prev) => (isDb(prev) ? submitAttempt(prev, { ...request, now: now() }).db : prev));

  if (activity) {
    return (
      <Player
        db={db}
        activity={activity}
        student={student}
        submit={submit}
        exit={() => setViewId(null)}
      />
    );
  }

  const last = db.activities.filter((a) => a.studentId === student.id).at(-1);
  return (
    <section className="dp-panel cmp-start" aria-labelledby="cmp-start-title">
      <div className="dp-panel-head">
        <span className="dp-mini-label">학생 화면</span>
        <h2 id="cmp-start-title">누가, 어떤 목적으로 풀까요?</h2>
        <p className="muted">
          가상 학생을 고르면 그 학생의 목표에 맞는 문항이 나옵니다. 연습은 지원이 들어간 문항도
          포함하고, 평가는 지원 없는 문항만 배정합니다.
        </p>
      </div>
      <Pills
        legend="가상 학생"
        name="student"
        options={studentOptions(db)}
        value={student.id}
        onChange={setStudentId}
      />
      <p className="cmp-goal">
        <strong>{student.alias}의 목표</strong>
        {rangeOf(goal)} 범위에서 더 많은 쪽을 고른다 · {goal.response}
      </p>
      <Pills
        legend="활동의 목적"
        name="purpose"
        options={Object.entries(PURPOSE_LABEL).map(([value, label]) => ({
          value,
          label,
          note: value === 'practice' ? '지원 문항 포함' : '지원 없는 문항만',
        }))}
        value={purpose}
        onChange={setPurpose}
      />
      {notice && (
        <p className="cmp-alert" role="alert">
          <TriangleAlert size={16} />
          {notice}
        </p>
      )}
      <div className="cmp-actions">
        <button className="btn btn-primary" onClick={start}>
          <Play size={17} />
          활동 시작
        </button>
        {last && (
          <span className="dp-counts">
            지난 활동: {PURPOSE_LABEL[last.purpose]} · {ACTIVITY_STATUS[last.status]} · 첫 시도
            정답률 {percent(summarize(db, { activityId: last.id }).accuracy)}
          </span>
        )}
      </div>
    </section>
  );
}

function Player({ db, activity, student, submit, exit }) {
  const assignments = db.assignments
    .filter((x) => x.activityId === activity.id)
    .sort((a, b) => a.order - b.order);
  const triesOf = (itemId) =>
    db.attempts.filter((a) => a.activityId === activity.id && a.itemId === itemId);
  const unsolved = assignments.filter((x) => !triesOf(x.itemId).some((a) => a.correct));
  const [shownId, setShownId] = useState(unsolved[0]?.itemId ?? null);
  const [showResult, setShowResult] = useState(unsolved.length === 0);
  const shownAt = useRef(Date.now());
  useEffect(() => {
    shownAt.current = Date.now();
  }, [shownId]);

  const expired = activity.status === 'expired';
  if (showResult || expired || !shownId) {
    return <Result db={db} activity={activity} student={student} expired={expired} exit={exit} />;
  }

  const shown = assignments.find((x) => x.itemId === shownId);
  const item = shown.snapshot;
  const tries = triesOf(shownId);
  const solved = tries.some((a) => a.correct);
  const lastTry = tries.at(-1);
  const index = assignments.indexOf(shown) + 1;
  const mark = (side) => (lastTry?.selected === side ? (lastTry.correct ? 'right' : 'wrong') : '');
  const choose = (selected) => {
    const elapsedMs = Date.now() - shownAt.current;
    shownAt.current = Date.now();
    // 화면에 보이는 시도 번호로 요청 식별키를 만든다. 같은 화면에서 연달아 눌러도 한 번만 저장된다.
    submit({
      activityId: activity.id,
      itemId: shownId,
      selected,
      requestId: `${activity.id}:${shownId}:${tries.length + 1}`,
      elapsedMs,
    });
  };
  const next = () => {
    const rest = assignments.filter(
      (x) => x.itemId !== shownId && !triesOf(x.itemId).some((a) => a.correct),
    );
    if (rest.length) setShownId(rest[0].itemId);
    else setShowResult(true);
  };

  return (
    <section className="dp-panel cmp-player" aria-label="문항 풀이">
      <div className="cmp-meta">
        <span className="dp-chip">
          {student.alias} · {PURPOSE_LABEL[activity.purpose]}
        </span>
        <span className="dp-counts">
          문항 {index} / {assignments.length}
        </span>
      </div>
      <h2 className="cmp-prompt">더 많은 쪽을 골라 보세요.</h2>
      {item.support === 'align' ? (
        <>
          <Aligned item={item} />
          <div className="cmp-choice-row">
            {['가', '나'].map((side) => (
              <button
                key={side}
                className={`cmp-choice-button ${mark(side)}`}
                disabled={solved}
                onClick={() => choose(side)}
              >
                {side} 고르기
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="cmp-choice-grid">
          {['가', '나'].map((side) => {
            const n = side === '가' ? item.left : item.right;
            return (
              <button
                key={side}
                className={`cmp-choice-card ${mark(side)}`}
                disabled={solved}
                onClick={() => choose(side)}
              >
                <span className="cmp-choice-label">
                  {side}
                  <span className="dp-visually-hidden"> 고르기</span>
                </span>
                {item.presentation === 'number' ? (
                  <span className="cmp-numeral">{n}</span>
                ) : (
                  <Scatter n={n} seed={`${shownId}-${side}`} label={`${side} 묶음 그림`} />
                )}
              </button>
            );
          })}
        </div>
      )}
      <p className={`cmp-feedback ${solved ? 'good' : lastTry ? 'retry' : ''}`} aria-live="polite">
        {solved && (
          <>
            <CircleCheck size={19} /> 맞았어요. {item.answer}가 더 많아요.
          </>
        )}
        {!solved && lastTry && '다시 한번 살펴볼까요? 다른 쪽을 골라 보세요.'}
      </p>
      {solved && (
        <div className="cmp-actions">
          <button className="btn btn-primary" onClick={next}>
            {unsolved.length ? '다음 문항' : '결과 보기'}
            <ArrowRight size={17} />
          </button>
        </div>
      )}
    </section>
  );
}

function Result({ db, activity, student, expired, exit }) {
  const s = summarize(db, { activityId: activity.id });
  return (
    <section className="dp-panel" aria-labelledby="cmp-result-title">
      <div className="dp-panel-head">
        <span className="dp-mini-label">
          {student.alias} · {PURPOSE_LABEL[activity.purpose]} · {ACTIVITY_STATUS[activity.status]}
        </span>
        <h2 id="cmp-result-title">{expired ? '활동 시간이 끝났어요.' : '활동을 마쳤어요.'}</h2>
        {expired && (
          <p className="muted">시작 후 {ACTIVITY_MINUTES}분이 지나 자동으로 마감되었습니다.</p>
        )}
      </div>
      <dl className="cmp-stats">
        <div>
          <dt>첫 시도 정답률</dt>
          <dd>{percent(s.accuracy)}</dd>
        </div>
        <div>
          <dt>지원 없는 문항</dt>
          <dd>{percent(s.bySupport.none.accuracy)}</dd>
        </div>
        <div>
          <dt>지원이 들어간 문항</dt>
          <dd>{s.bySupport.align.assigned ? percent(s.bySupport.align.accuracy) : '배정 없음'}</dd>
        </div>
        <div>
          <dt>미응답</dt>
          <dd>{s.unanswered}문항</dd>
        </div>
      </dl>
      <div className="cmp-actions">
        <button className="btn btn-primary" onClick={exit}>
          <RotateCcw size={17} />
          처음으로
        </button>
        <a className="btn btn-secondary" href="#/compare/teacher">
          교사 화면에서 기록 보기
        </a>
      </div>
    </section>
  );
}

// ---------- 그림 ----------
function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function Dot({ x, y, r }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#c98a6b" />
      <ellipse cx={x + r * 0.1} cy={y - r} rx={r * 0.22} ry={r * 0.3} fill="#5e8e6e" />
    </g>
  );
}
function Scatter({ n, seed, label }) {
  const dots = useMemo(() => {
    const cols = n <= 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : 5;
    const cell = 200 / cols;
    const random = seeded(seed);
    const cells = Array.from({ length: cols * cols }, (_, i) => i);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    return cells.slice(0, n).map((c) => ({
      x: (c % cols) * cell + cell / 2 + (random() - 0.5) * cell * 0.3,
      y: Math.floor(c / cols) * cell + cell / 2 + (random() - 0.5) * cell * 0.3,
      r: cell * 0.27,
    }));
  }, [n, seed]);
  return (
    <svg className="cmp-scatter" viewBox="-6 -12 212 220" role="img" aria-label={label}>
      {dots.map((d, i) => (
        <Dot key={i} {...d} />
      ))}
    </svg>
  );
}
function Aligned({ item }) {
  const { left, right } = item;
  const max = Math.max(left, right);
  const min = Math.min(left, right);
  const step = 44;
  const x0 = 78;
  const width = x0 + max * step + 14;
  const moreY = left > right ? 44 : 132;
  return (
    <svg
      className="cmp-aligned"
      viewBox={`0 0 ${width} 176`}
      role="img"
      aria-label="가와 나를 한 줄씩 짝지어 놓은 그림"
    >
      <rect
        x={x0 + min * step - 8}
        y={moreY - 28}
        width={(max - min) * step - 6}
        height={50}
        rx={10}
        fill="#f7ebdf"
        stroke="#c57b4a"
        strokeWidth="2"
      />
      {Array.from({ length: min }, (_, i) => (
        <line
          key={i}
          x1={x0 + i * step + 15}
          x2={x0 + i * step + 15}
          y1={60}
          y2={116}
          stroke="#9aa3af"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
      ))}
      {[
        ['가', left, 44],
        ['나', right, 132],
      ].map(([name, n, y]) => (
        <g key={name}>
          <text x={8} y={y + 8} className="cmp-row-label">
            {name}
            {item.presentation === 'number' ? ` ${n}` : ''}
          </text>
          {Array.from({ length: n }, (_, i) => (
            <Dot key={i} x={x0 + i * step + 15} y={y} r={14} />
          ))}
        </g>
      ))}
    </svg>
  );
}

// ---------- 교사 화면 ----------
function TeacherPanel({ db, setDb, student, setStudentId, clock, setOffset }) {
  const [checks, setChecks] = useState({});
  const goal = db.goals.find((g) => g.studentId === student.id);
  const items = db.items.filter((i) => i.goalId === goal.id);
  const recent = db.attempts.slice(-10).reverse();
  const counts = [
    ['학생', db.students.length],
    ['학생별 목표', db.goals.length],
    ['문항', db.items.length],
    ['학습활동', db.activities.length],
    ['배정', db.assignments.length],
    ['응답', db.attempts.length],
  ];
  const apply = (fn) => setDb((prev) => (isDb(prev) ? fn(prev).db : prev));

  return (
    <div className="cmp-teacher">
      <section className="dp-panel" aria-labelledby="cmp-t-summary">
        <div className="dp-panel-head">
          <span className="dp-mini-label">교사 화면</span>
          <h2 id="cmp-t-summary">기록으로 계산한 값</h2>
          <p className="muted">
            정답률은 첫 시도만으로 계산하고, 지원이 들어간 문항과 지원 없는 문항을 나누어 셉니다.
            미응답은 오답으로 세지 않습니다.
          </p>
        </div>
        <div className="cmp-student-grid">
          {db.students.map((s) => {
            const g = db.goals.find((x) => x.studentId === s.id);
            const sum = summarize(db, { studentId: s.id });
            const wrong = Object.entries(sum.wrongByCategory);
            return (
              <article key={s.id} className="dp-student cmp-student-card">
                <header>
                  <div>
                    <strong>{s.alias}</strong>
                    <small>
                      {rangeOf(g)} · {presentationOf(g)} · {g.criterion}
                    </small>
                  </div>
                </header>
                <dl className="cmp-stats small">
                  <div>
                    <dt>첫 시도 정답률</dt>
                    <dd>{percent(sum.accuracy)}</dd>
                  </div>
                  <div>
                    <dt>지원 없음</dt>
                    <dd>
                      {percent(sum.bySupport.none.accuracy)}
                      <small>
                        {sum.bySupport.none.firstCorrect}/{sum.bySupport.none.answered}
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>일대일 대응 배열</dt>
                    <dd>
                      {percent(sum.bySupport.align.accuracy)}
                      <small>
                        {sum.bySupport.align.firstCorrect}/{sum.bySupport.align.answered}
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>미응답 · 재시도</dt>
                    <dd>
                      {sum.unanswered} · {sum.retries}
                    </dd>
                  </div>
                </dl>
                <p className="dp-counts">
                  활동 {sum.activities}회 (완료 {sum.done} · 만료 {sum.expired} · 진행 {sum.open})
                  {wrong.length > 0 && (
                    <>
                      <br />
                      오답 범주: {wrong.map(([k, v]) => `${k} ${v}회`).join(', ')}
                    </>
                  )}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="dp-panel" aria-labelledby="cmp-t-checks">
        <div className="dp-panel-head cmp-head-row">
          <div>
            <span className="dp-mini-label">기록 규칙</span>
            <h2 id="cmp-t-checks">기록이 틀리지 않게 하는 네 가지 처리</h2>
            <p className="muted">
              실제 기록을 건드리지 않도록 새 데이터에서 실행합니다. 지금은 브라우저에서 계산합니다.
            </p>
          </div>
          <button
            className="btn btn-secondary dp-small-btn"
            onClick={() =>
              setChecks(Object.fromEntries(SCENARIOS.map((s) => [s.id, runScenario(s.id)])))
            }
          >
            모두 실행
          </button>
        </div>
        <ol className="dp-notes">
          {SCENARIOS.map((s, i) => {
            const result = checks[s.id];
            return (
              <li key={s.id} className="dp-note">
                <div className="dp-note-row">
                  <span
                    className={`dp-severity ${result ? (result.ok ? 'info' : 'check') : 'done'}`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p>
                      <b>{s.title}</b>
                    </p>
                    <small>{s.handle}</small>
                    {result && (
                      <p className={result.ok ? 'cmp-check-ok' : 'cmp-check-bad'} role="status">
                        {result.ok ? <Check size={15} /> : <TriangleAlert size={15} />}
                        {result.ok ? '확인됨' : '실패'} · {result.text}
                      </p>
                    )}
                  </div>
                  <button
                    className="btn btn-secondary dp-small-btn"
                    aria-label={`${i + 1}번 확인 실행`}
                    onClick={() => setChecks((c) => ({ ...c, [s.id]: runScenario(s.id) }))}
                  >
                    실행
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="dp-panel" aria-labelledby="cmp-t-items">
        <div className="dp-panel-head">
          <span className="dp-mini-label">문항</span>
          <h2 id="cmp-t-items">문항 관리</h2>
          <p className="muted">
            승인된 문항만 학생에게 배정됩니다. 문항을 고치면 초안으로 돌아가고, 이미 배정된 기록은
            풀이 당시 내용을 유지합니다.
          </p>
        </div>
        <Pills
          legend="문항을 볼 학생"
          name="teacher-student"
          options={studentOptions(db)}
          value={student.id}
          onChange={setStudentId}
        />
        <div className="dp-table-scroll cmp-table">
          <table className="dp-compare">
            <thead>
              <tr>
                <th scope="col">문항</th>
                <th scope="col">가</th>
                <th scope="col">나</th>
                <th scope="col">지원</th>
                <th scope="col">판</th>
                <th scope="col">상태</th>
                <th scope="col">처리</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.id}</th>
                  <td>{item.left}</td>
                  <td>{item.right}</td>
                  <td>{SUPPORT_LABEL[item.support]}</td>
                  <td>{item.version}</td>
                  <td>
                    <span
                      className={`dp-severity ${item.status === 'approved' ? 'info' : item.status === 'rejected' ? 'check' : 'done'}`}
                    >
                      {ITEM_STATUS[item.status]}
                    </span>
                  </td>
                  <td className="cmp-cell-actions">
                    <button
                      className="cmp-link"
                      disabled={item.status === 'approved'}
                      aria-label={`${item.id} 승인`}
                      onClick={() => apply((d) => setItemStatus(d, item.id, 'approved'))}
                    >
                      승인
                    </button>
                    <button
                      className="cmp-link"
                      disabled={item.status === 'rejected'}
                      aria-label={`${item.id} 반려`}
                      onClick={() => apply((d) => setItemStatus(d, item.id, 'rejected'))}
                    >
                      반려
                    </button>
                    <button
                      className="cmp-link"
                      aria-label={`${item.id} 가·나 바꾸기`}
                      onClick={() =>
                        apply((d) => editItem(d, item.id, { left: item.right, right: item.left }))
                      }
                    >
                      가·나 바꾸기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dp-panel" aria-labelledby="cmp-t-data">
        <div className="dp-panel-head">
          <span className="dp-mini-label">데이터</span>
          <h2 id="cmp-t-data">저장된 데이터</h2>
        </div>
        <ul className="dp-chips cmp-counts">
          {counts.map(([name, n]) => (
            <li key={name}>
              <b>{name}</b>
              {n}
            </li>
          ))}
        </ul>
        <h3 className="dp-block-title cmp-recent-title">최근 응답</h3>
        {recent.length === 0 ? (
          <p className="muted">아직 응답이 없습니다. 학생 화면에서 활동을 시작해 보세요.</p>
        ) : (
          <div className="dp-table-scroll">
            <table className="dp-compare">
              <thead>
                <tr>
                  <th scope="col">학생</th>
                  <th scope="col">활동</th>
                  <th scope="col">풀이 당시 문항</th>
                  <th scope="col">지원</th>
                  <th scope="col">시도</th>
                  <th scope="col">선택</th>
                  <th scope="col">결과</th>
                  <th scope="col">소요 시간</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => {
                  const activity = db.activities.find((x) => x.id === a.activityId);
                  const snap = db.assignments.find(
                    (x) => x.activityId === a.activityId && x.itemId === a.itemId,
                  ).snapshot;
                  return (
                    <tr key={a.id}>
                      <th scope="row">
                        {db.students.find((s) => s.id === activity.studentId).alias}
                      </th>
                      <td>
                        {PURPOSE_LABEL[activity.purpose]} · {ACTIVITY_STATUS[activity.status]}
                      </td>
                      <td>
                        가 {snap.left} · 나 {snap.right} ({snap.version}판)
                      </td>
                      <td>{SUPPORT_LABEL[snap.support]}</td>
                      <td>{a.attemptNo}</td>
                      <td>{a.selected}</td>
                      <td>{a.correct ? '정답' : '오답'}</td>
                      <td>{seconds(a.elapsedMs)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="cmp-actions cmp-tools">
          <button
            className="btn btn-secondary dp-small-btn"
            onClick={() => setOffset((o) => (Number(o) || 0) + (ACTIVITY_MINUTES + 1) * 60 * 1000)}
          >
            <Clock size={15} />
            시계를 {ACTIVITY_MINUTES + 1}분 뒤로 넘기기
          </button>
          <span className="dp-counts" role="status">
            {clock ? `가상 시계 +${Math.round(clock / 60000)}분` : '가상 시계 사용 안 함'}
          </span>
          <button
            className="dp-reset-btn"
            onClick={() => {
              setDb(createDb());
              setOffset(0);
              setChecks({});
            }}
          >
            <RotateCcw size={15} />
            기록 초기화
          </button>
        </div>
        <p className="muted">
          진행 중인 활동은 시작 후 {ACTIVITY_MINUTES}분이 지나면 만료됩니다. 시계를 넘기면 그 처리를
          바로 확인할 수 있습니다.
        </p>
      </section>
    </div>
  );
}
