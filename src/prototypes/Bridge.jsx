import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Pause,
  Play,
  Volume2,
  Square,
  Layers,
  Lightbulb,
  BookOpen,
  RotateCcw,
  ChevronRight,
  CircleCheck,
  Grid3X3,
  AlignLeft,
  Leaf,
} from 'lucide-react';
import { usePersistentState, speak, makeId } from '../lib/storage';
import './bridge.css';

const SETS = [
  {
    id: 'join',
    name: '두 묶음 합치기',
    caption: '모두 몇 개인지 알아봐요',
    skill: '10 이내 덧셈',
    a: 5,
    b: 3,
    nextA: 6,
    nextB: 3,
    exampleA: 4,
    exampleB: 2,
    practiceChoices: [7, 8, 9, 2],
    checkChoices: [8, 3, 9, 10],
    object: '색연필',
    unit: '자루',
    color: 'sage',
  },
  {
    id: 'make-ten',
    name: '10을 만들며 더하기',
    caption: '10을 먼저 채워 봐요',
    skill: '20 이내 덧셈',
    a: 8,
    b: 5,
    nextA: 9,
    nextB: 5,
    exampleA: 7,
    exampleB: 4,
    practiceChoices: [12, 3, 14, 13],
    checkChoices: [13, 14, 4, 15],
    object: '블록',
    unit: '개',
    color: 'ochre',
  },
  {
    id: 'tens',
    name: '10과 낱개로 더하기',
    caption: '10 한 묶음과 낱개를 봐요',
    skill: '20 이내 덧셈',
    a: 13,
    b: 4,
    nextA: 12,
    nextB: 6,
    exampleA: 11,
    exampleB: 5,
    practiceChoices: [17, 9, 16, 18],
    checkChoices: [17, 18, 6, 19],
    object: '구슬',
    unit: '개',
    color: 'blue',
  },
];
const TOOLS = [
  { id: 'objects', icon: Grid3X3, title: '그림으로 보기', detail: '두 묶음을 눈으로 합쳐요' },
  { id: 'split', icon: Layers, title: '식을 나누어 보기', detail: '계산을 한 단계씩 살펴요' },
  { id: 'example', icon: BookOpen, title: '비슷한 예시 보기', detail: '다른 수의 풀이를 봐요' },
];
const emptyState = () => ({
  version: 1,
  phase: 'choose',
  setId: null,
  sessionId: null,
  questions: [],
  selected: null,
  feedback: null,
  tool: null,
  depth: 1,
  segmented: false,
  resumed: 0,
  paused: false,
  doneSets: [],
  recorded: false,
});
const validState = (s) =>
  s &&
  s.version === 1 &&
  ['choose', 'practice', 'check', 'result'].includes(s.phase) &&
  Array.isArray(s.questions) &&
  Array.isArray(s.doneSets) &&
  (s.phase === 'choose' ||
    (SETS.some((x) => x.id === s.setId) &&
      s.questions.length === 2 &&
      s.questions.every((q) => Array.isArray(q.accessSupports) && Array.isArray(q.usedHintKeys))));
const promptFor = (set, a, b) =>
  `${set.object}이 ${a}${set.unit} 있어요. ${b}${set.unit}를 더 받았어요. 모두 몇 ${set.unit}일까요?`;
const makeQuestion = (set, a, b, phase) => ({
  id: `${set.id}-${phase}`,
  prompt: promptFor(set, a, b),
  firstCorrect: null,
  correct: false,
  attempts: 0,
  hints: 0,
  accessSupports: [],
  usedHintKeys: [],
  answers: [],
  skipped: false,
});

function TenFrames({ a, b, reveal = false, compact = false, label = true }) {
  const total = a + b;
  return (
    <div className={`bridge-frames ${compact ? 'is-compact' : ''}`}>
      <div className="bridge-frame-pair" role="img" aria-label={`${a}개와 ${b}개를 합치는 수 그림`}>
        {Array.from({ length: Math.max(1, Math.ceil(total / 10)) }, (_, row) => (
          <svg key={row} viewBox="0 0 260 110" className="bridge-tenframe" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => {
              const n = row * 10 + i;
              return (
                <g key={i}>
                  <rect
                    x={(i % 5) * 50 + 5}
                    y={Math.floor(i / 5) * 50 + 5}
                    width="46"
                    height="46"
                    rx="10"
                    fill="#fbfcf9"
                    stroke="#d5dfd4"
                    strokeWidth="1.3"
                  />
                  {n < total && (
                    <circle
                      cx={(i % 5) * 50 + 28}
                      cy={Math.floor(i / 5) * 50 + 28}
                      r="15"
                      fill={n < a ? '#4d7761' : '#dfad57'}
                    />
                  )}
                  {reveal && n < total && (
                    <text
                      x={(i % 5) * 50 + 28}
                      y={Math.floor(i / 5) * 50 + 33}
                      textAnchor="middle"
                      fill={n < a ? '#fff' : '#463715'}
                      fontSize="13"
                      fontWeight="700"
                    >
                      {n + 1}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        ))}
      </div>
      {label && (
        <div className="bridge-frame-key">
          <span>
            <i className="bridge-dot" />
            처음 {a}개
          </span>
          <span>
            <i className="bridge-dot gold" />더 받은 {b}개
          </span>
        </div>
      )}
    </div>
  );
}

function ToolContent({ tool, depth, set, a, b, onMore, finished }) {
  let partition;
  if (set.id === 'make-ten') {
    const need = 10 - a;
    partition = (
      <>
        <p>
          {a}에 <strong>{need}</strong>을 더하면 10이 돼요.
        </p>
        <div className="bridge-split-expression">
          <span>{a}</span>
          <b>+</b>
          <span className="bridge-split-number">
            {b}
            <small>
              {need} + {b - need}
            </small>
          </span>
        </div>
        {depth === 2 ? (
          <div className="bridge-step-reveal">
            <p>
              {a} + {need} = <strong>10</strong>
            </p>
            <p>이제 10 + {b - need}을 계산해 보세요.</p>
          </div>
        ) : (
          <p className="bridge-tool-question">
            {b}를 {need}과 {b - need}로 나누면 어떨까요?
          </p>
        )}
      </>
    );
  } else if (set.id === 'tens') {
    partition = (
      <>
        <p>
          {a}는 <strong>10과 {a - 10}</strong>으로 나눌 수 있어요.
        </p>
        <div className="bridge-split-expression">
          <span className="bridge-split-number">
            {a}
            <small>10 + {a - 10}</small>
          </span>
          <b>+</b>
          <span>{b}</span>
        </div>
        {depth === 2 ? (
          <div className="bridge-step-reveal">
            <p>
              낱개부터: {a - 10} + {b} = <strong>{a - 10 + b}</strong>
            </p>
            <p>10과 낱개 {a - 10 + b}를 합쳐 보세요.</p>
          </div>
        ) : (
          <p className="bridge-tool-question">
            낱개 {a - 10}개와 {b}개부터 합쳐 보세요.
          </p>
        )}
      </>
    );
  } else {
    partition = (
      <>
        <p>
          처음 있는 <strong>{a}</strong>부터 이어 세어 보세요.
        </p>
        <div className="bridge-counting-strip">
          <span>{a}</span>
          <ChevronRight size={17} />
          <span>
            {depth === 2
              ? Array.from({ length: b }, (_, i) => a + i + 1).join(' · ')
              : '한 개씩 더'}
          </span>
        </div>
        <p className="bridge-tool-question">{b}번 더 세면 어떤 수에서 끝날까요?</p>
      </>
    );
  }
  return (
    <div className="bridge-tool-content" key={tool}>
      <span className="bridge-mini-label">
        {tool === 'example' ? '다른 수로 살펴봐요' : `도움 ${depth}단계`}
      </span>
      {tool === 'objects' && (
        <>
          <p>초록 묶음에 노란 묶음을 더해요.</p>
          <TenFrames a={a} b={b} reveal={depth === 2} compact />
          <p className="bridge-tool-question">
            {depth === 2
              ? '번호를 따라 모두 몇 개인지 확인해 보세요.'
              : '빈칸이 아닌, 색칠된 동그라미를 세어 보세요.'}
          </p>
        </>
      )}
      {tool === 'split' && partition}
      {tool === 'example' && (
        <>
          <p>이번 문제와 다른 수의 예시예요.</p>
          <TenFrames a={set.exampleA} b={set.exampleB} compact />
          <div className="bridge-example-equation">
            {set.exampleA} + {set.exampleB} ={' '}
            <strong>{depth === 2 ? set.exampleA + set.exampleB : '?'}</strong>
          </div>
          <p className="bridge-tool-question">
            {depth === 2
              ? `두 묶음을 합치면 ${set.exampleA + set.exampleB}개예요. 이제 원래 문제에 적용해 보세요.`
              : '두 묶음을 합친 수를 생각해 보세요.'}
          </p>
        </>
      )}
      {depth === 1 && !finished && (
        <button className="bridge-more-help" onClick={onMore}>
          한 단계 더 보여 주세요 <ChevronRight size={16} />
        </button>
      )}
      {depth === 2 && (
        <p className="bridge-help-footnote">
          <Check size={14} /> 도구를 보면서 문제를 풀어도 괜찮아요.
        </p>
      )}
    </div>
  );
}

function outcomeLabel(q) {
  if (!q.attempts) return '응답하지 않음';
  if (!q.correct) return '다음에 다시 확인';
  if (q.hints > 0) return '풀이 도움을 받아 해결';
  return q.firstCorrect ? '첫 시도에 스스로 해결' : '풀이 도움 없이 다시 해결';
}

export default function Bridge({ onRecord, onHome, settings = {} }) {
  const [stored, setStored] = usePersistentState('bridge-progress', emptyState);
  const session = validState(stored) ? stored : emptyState();
  const [returning, setReturning] = useState(
    () => validState(stored) && ['practice', 'check'].includes(stored.phase),
  );
  const [speechNotice, setSpeechNotice] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [recordError, setRecordError] = useState(false);
  const feedbackRef = useRef(null);
  const workbookRef = useRef(null);
  const supportRef = useRef(null);
  const set = SETS.find((item) => item.id === session.setId) || SETS[0];
  const isCheck = session.phase === 'check';
  const qIndex = isCheck ? 1 : 0;
  const q = session.questions[qIndex];
  const a = isCheck ? set.nextA : set.a;
  const b = isCheck ? set.nextB : set.b;
  const choices = isCheck ? set.checkChoices : set.practiceChoices;
  const active = ['practice', 'check'].includes(session.phase);

  useEffect(() => {
    if (!validState(stored)) setStored(emptyState());
  }, [stored, setStored]);
  useEffect(() => {
    try {
      localStorage.setItem('neulbom:bridge-probe', '1');
      localStorage.removeItem('neulbom:bridge-probe');
    } catch {
      setStorageAvailable(false);
    }
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    if (session.feedback) feedbackRef.current?.focus();
  }, [session.feedback]);
  useEffect(() => {
    if (
      active &&
      !returning &&
      !session.paused &&
      settings.largeText &&
      q &&
      !q.accessSupports.includes('글씨 크게 보기')
    ) {
      setStored((prev) => ({
        ...prev,
        questions: prev.questions.map((item, i) =>
          i === qIndex
            ? { ...item, accessSupports: [...new Set([...item.accessSupports, '글씨 크게 보기'])] }
            : item,
        ),
      }));
    }
  }, [active, returning, session.paused, settings.largeText, q, qIndex, setStored]);

  function stopReading() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }
  function startSet(chosen) {
    stopReading();
    setSpeechNotice('');
    setReturning(false);
    setRecordError(false);
    setStored({
      ...emptyState(),
      doneSets: session.doneSets,
      phase: 'practice',
      setId: chosen.id,
      sessionId: makeId(),
      questions: [
        makeQuestion(chosen, chosen.a, chosen.b, 'practice'),
        makeQuestion(chosen, chosen.nextA, chosen.nextB, 'check'),
      ],
    });
  }
  function updateQuestion(mutator, extra = {}) {
    setStored((prev) => ({
      ...prev,
      ...extra,
      questions: prev.questions.map((item, i) => (i === qIndex ? mutator(item) : item)),
    }));
  }
  function accessSupport(name) {
    updateQuestion((item) => ({
      ...item,
      accessSupports: [...new Set([...item.accessSupports, name])],
    }));
  }
  function readQuestion() {
    const ok = speak(`${q.prompt} ${a} 더하기 ${b}. 답을 고른 뒤 확인 버튼을 눌러 주세요.`);
    if (ok) accessSupport('문제 읽어주기');
    setSpeaking(ok);
    setSpeechNotice(
      ok ? '' : '이 기기에서는 음성 읽기를 사용할 수 없어요. 문장 나누어 보기를 이용해 주세요.',
    );
  }
  function toggleSegments() {
    const next = !session.segmented;
    updateQuestion(
      (item) => ({
        ...item,
        accessSupports: next
          ? [...new Set([...item.accessSupports, '문장 나누어 보기'])]
          : item.accessSupports,
      }),
      { segmented: next },
    );
  }
  function openTool(tool, depth = 1) {
    if (q.correct) return;
    const key = `${tool}:${depth}`;
    updateQuestion(
      (item) => ({
        ...item,
        usedHintKeys: [...new Set([...item.usedHintKeys, key])],
        hints: item.usedHintKeys.includes(key) ? item.hints : item.hints + 1,
      }),
      { tool, depth },
    );
  }
  function submit(event) {
    event.preventDefault();
    if (session.selected == null || q.correct) return;
    const correct = Number(session.selected) === a + b;
    updateQuestion(
      (item) => ({
        ...item,
        firstCorrect: item.attempts === 0 ? correct : item.firstCorrect,
        correct,
        attempts: item.attempts + 1,
        skipped: false,
        answers: [...item.answers, Number(session.selected)],
      }),
      { feedback: correct ? 'correct' : 'try' },
    );
  }
  function recordResult(finished) {
    const check = finished.questions[1];
    const label = outcomeLabel(check);
    try {
      onRecord?.({
        id: finished.sessionId,
        prototype: 'bridge',
        subject: '수학',
        title: `도움 사다리 · ${set.name}`,
        completedAt: finished.completedAt,
        questions: finished.questions.map(({ usedHintKeys, answers, skipped, ...question }) => ({
          ...question,
          supportKinds: [
            ...new Set(
              usedHintKeys
                .map((key) => TOOLS.find((t) => t.id === key.split(':')[0])?.title)
                .filter(Boolean),
            ),
          ],
          skipped,
        })),
        resumed: finished.resumed,
        reflection: `새 문제 확인: ${label}. 읽기 지원은 풀이 힌트와 구분했어요.`,
        mode: 'prepared-demo',
      });
      setRecordError(false);
      return true;
    } catch {
      setRecordError(true);
      return false;
    }
  }
  function advance(skip = false) {
    stopReading();
    setSpeechNotice('');
    const questions = session.questions.map((item, i) =>
      i === qIndex && skip ? { ...item, skipped: true } : item,
    );
    if (!isCheck) {
      const updated = questions.map((item, i) =>
        i === 1 && session.segmented ? { ...item, accessSupports: ['문장 나누어 보기'] } : item,
      );
      setStored({
        ...session,
        questions: updated,
        phase: 'check',
        selected: null,
        feedback: null,
        tool: null,
        depth: 1,
      });
    } else {
      const finished = {
        ...session,
        questions,
        phase: 'result',
        paused: false,
        completedAt: new Date().toISOString(),
        doneSets: [...new Set([...session.doneSets, set.id])],
      };
      finished.recorded = recordResult(finished);
      setStored(finished);
    }
  }
  function chooseAgain() {
    stopReading();
    setReturning(false);
    setStored({ ...emptyState(), doneSets: session.doneSets });
  }
  function resume() {
    setReturning(false);
    setStored((prev) => ({ ...prev, paused: false, resumed: prev.resumed + 1 }));
  }
  function pause() {
    stopReading();
    setStored((prev) => ({ ...prev, paused: true }));
  }
  function moveTo(ref) {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({
      behavior:
        settings.quiet || window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      block: 'start',
    });
  }
  function foldTool() {
    setStored((prev) => ({ ...prev, tool: null }));
    moveTo(workbookRef);
  }

  return (
    <section
      className={`bridge-proto ${settings.largeText ? 'bridge-large' : ''} ${settings.quiet ? 'bridge-quiet' : ''}`}
    >
      {!storageAvailable && (
        <p className="bridge-storage-warning" role="status">
          이 브라우저에서는 진행을 저장할 수 없어요. 화면을 닫기 전에 학습을 마쳐 주세요.
        </p>
      )}

      {session.phase === 'choose' && (
        <>
          <div className="bridge-intro">
            <div>
              <span className="bridge-kicker">
                <Leaf size={15} /> 나만의 방법을 찾는 수학 시간
              </span>
              <h1>
                도움은 내 방식대로.
                <br />
                <em>다음 한 걸음은 스스로.</em>
              </h1>
              <p>
                어려운 문제를 만나도 괜찮아요.
                <br />
                그림, 나눠진 식, 비슷한 예시 중에서 골라 보세요.
              </p>
              <div className="bridge-intro-path">
                <span>
                  <i>1</i> 연습하기
                </span>
                <ChevronRight size={16} />
                <span>
                  <i>2</i> 새 문제 풀기
                </span>
                <ChevronRight size={16} />
                <span>
                  <i>3</i> 돌아보기
                </span>
              </div>
            </div>
            <div className="bridge-cover-art" aria-hidden="true">
              <div className="bridge-art-note">
                오늘의 수학 노트 <span>01</span>
              </div>
              <TenFrames a={5} b={3} label={false} />
              <div className="bridge-cover-equation">
                5 <span>+</span> 3 <span>=</span> <i>?</i>
              </div>
              <div className="bridge-cover-sticker">
                <Lightbulb size={19} /> 나에게 맞는 도움 찾기
              </div>
            </div>
          </div>
          <div className="bridge-goal-heading">
            <div>
              <span className="bridge-mini-label">TODAY'S CHOICE</span>
              <h2>어떤 덧셈을 해 볼까요?</h2>
            </div>
            <span>목표마다 연습 1개 + 새 문제 1개</span>
          </div>
          <div className="bridge-goal-grid">
            {SETS.map((item, i) => (
              <button
                key={item.id}
                className={`bridge-goal-card ${item.color}`}
                onClick={() => startSet(item)}
              >
                <div className="bridge-goal-card-top">
                  <span className="bridge-card-number">0{i + 1}</span>
                  {session.doneSets.includes(item.id) ? (
                    <span className="bridge-complete-chip">
                      <Check size={13} /> 확인했어요
                    </span>
                  ) : (
                    <span className="bridge-skill-chip">{item.skill}</span>
                  )}
                </div>
                <div className="bridge-card-mini-art" aria-hidden="true">
                  {item.id === 'join' ? (
                    <>
                      <i />
                      <i />
                      <i />
                      <b>+</b>
                      <i className="gold" />
                      <i className="gold" />
                    </>
                  ) : item.id === 'make-ten' ? (
                    <>
                      <span className="bridge-mini-ten">10</span>
                      <b>+</b>
                      <i className="gold" />
                      <i className="gold" />
                    </>
                  ) : (
                    <>
                      <span className="bridge-ten-stick">10</span>
                      <i />
                      <i />
                      <b>+</b>
                      <i className="gold" />
                    </>
                  )}
                </div>
                <h3>{item.name}</h3>
                <p>{item.caption}</p>
                <span className="bridge-start-link">
                  이 목표로 시작 <ArrowRight size={17} />
                </span>
              </button>
            ))}
          </div>
          <p className="bridge-gentle-note">
            <CircleCheck size={17} /> 읽어주기는 계속 쓸 수 있어요. 풀이 도움을 써도 감점하지
            않아요.
          </p>
        </>
      )}

      {active && (returning || session.paused) && (
        <div className="bridge-pause-card">
          <div className="bridge-pause-icon">
            <Pause size={29} />
          </div>
          <span className="bridge-mini-label">내 수학 노트를 잠깐 덮었어요</span>
          <h1>{returning ? '하던 곳에서 이어 갈까요?' : '잠깐 쉬어도 괜찮아요.'}</h1>
          <p>
            <strong>{set.name}</strong>
            <br />
            {isCheck ? '새 문제로 확인하는 중이었어요.' : '나에게 맞는 도움으로 연습 중이었어요.'}
            <br />
            고른 답과 사용한 도움을 그대로 두었어요.
          </p>
          <button className="btn btn-primary" onClick={resume}>
            <Play size={18} /> 이어서 하기
          </button>
          <button className="bridge-text-button" onClick={onHome}>
            다른 배움 둘러보기
          </button>
          <button className="bridge-text-button" onClick={chooseAgain}>
            <RotateCcw size={14} /> 이 학습은 그만하고 목표 다시 고르기
          </button>
        </div>
      )}

      {active && !returning && !session.paused && (
        <>
          <header className="bridge-work-header">
            <div>
              <span className="bridge-mini-label">오늘의 목표 · {set.skill}</span>
              <h1>{set.name}</h1>
            </div>
            <button className="bridge-pause-btn" onClick={pause}>
              <Pause size={16} /> 잠깐 쉬기
            </button>
          </header>
          <ol className="bridge-progress" aria-label="학습 순서">
            <li
              className={!isCheck ? 'current' : 'done'}
              aria-current={!isCheck ? 'step' : undefined}
            >
              <span>{isCheck ? <Check size={15} /> : '1'}</span>도움으로 연습
            </li>
            <li className={isCheck ? 'current' : ''} aria-current={isCheck ? 'step' : undefined}>
              <span>2</span>새 문제 확인
            </li>
            <li>
              <span>3</span>오늘 기록
            </li>
          </ol>
          {isCheck && (
            <div className="bridge-check-explainer">
              <CircleCheck size={20} />
              <div>
                <strong>배운 방법을 새 문제에 써 봐요.</strong>
                <p>
                  풀이 도움은 접어 두었어요. 필요하면 다시 열 수 있고, 읽기 지원은 계속 쓸 수
                  있어요.
                </p>
              </div>
            </div>
          )}
          <div className="bridge-workspace">
            <article
              ref={workbookRef}
              tabIndex={-1}
              className="bridge-workbook"
              aria-label={isCheck ? '새 문제 확인' : '연습 문제'}
            >
              <div className="bridge-page-head">
                <span>{isCheck ? '새 문제 확인' : '연습 문제'}</span>
                <span className={`bridge-performance-tag ${q.hints ? 'assisted' : ''}`}>
                  {isCheck
                    ? q.hints
                      ? '풀이 도움을 사용하는 확인'
                      : '먼저 스스로 해 봐요'
                    : '도움 방식을 골라 보세요'}
                </span>
              </div>
              <div className="bridge-reading-tools">
                <button aria-pressed={speaking} onClick={speaking ? stopReading : readQuestion}>
                  {speaking ? <Square size={16} /> : <Volume2 size={17} />}{' '}
                  {speaking ? '읽기 멈추기' : '문제 읽어주기'}
                </button>
                <button aria-pressed={session.segmented} onClick={toggleSegments}>
                  <AlignLeft size={17} /> 문장 나누어 보기
                </button>
                <span>풀이 힌트와 별개예요</span>
              </div>
              {speechNotice && (
                <p role="status" className="bridge-inline-notice">
                  {speechNotice}
                </p>
              )}
              {!q.correct && (
                <button
                  className="bridge-open-tools-mobile"
                  aria-controls="bridge-support-tools"
                  onClick={() => moveTo(supportRef)}
                >
                  <Lightbulb size={17} /> 풀이 도움 고르기 <ChevronRight size={16} />
                </button>
              )}
              <h2 className={`bridge-story ${session.segmented ? 'segmented' : ''}`}>
                {session.segmented ? (
                  <>
                    <span>
                      {set.object}이{' '}
                      <strong>
                        {a}
                        {set.unit}
                      </strong>{' '}
                      있어요.
                    </span>
                    <span>
                      <strong>
                        {b}
                        {set.unit}
                      </strong>
                      를 더 받았어요.
                    </span>
                    <span>모두 몇 {set.unit}일까요?</span>
                  </>
                ) : (
                  <>
                    {set.object}이{' '}
                    <strong>
                      {a}
                      {set.unit}
                    </strong>{' '}
                    있어요.
                    <br />
                    <strong>
                      {b}
                      {set.unit}
                    </strong>
                    를 더 받았어요.
                    <br />
                    모두 몇 {set.unit}일까요?
                  </>
                )}
              </h2>
              <div className="bridge-main-equation" aria-label={`${a} 더하기 ${b}는 얼마일까요?`}>
                <span>{a}</span>
                <b>+</b>
                <span>{b}</span>
                <b>=</b>
                <span className={`bridge-answer-box ${q.correct ? 'correct' : ''}`}>
                  {q.correct ? a + b : '?'}
                </span>
              </div>
              <form onSubmit={submit}>
                <fieldset className="bridge-answer-options" disabled={q.correct}>
                  <legend>답을 고른 다음 ‘답 확인하기’를 눌러 주세요.</legend>
                  <div>
                    {choices.map((value) => (
                      <label
                        className={`bridge-choice ${Number(session.selected) === value && session.selected != null ? 'selected' : ''} ${q.correct && value === a + b ? 'correct' : ''}`}
                        key={value}
                      >
                        <input
                          type="radio"
                          name={`bridge-answer-${q.id}`}
                          value={value}
                          checked={session.selected != null && Number(session.selected) === value}
                          onChange={() =>
                            setStored((prev) => ({ ...prev, selected: value, feedback: null }))
                          }
                        />
                        <span>{value}</span>
                        <i>
                          {q.correct && value === a + b ? (
                            <Check size={19} />
                          ) : session.selected === value ? (
                            <span className="bridge-radio-dot" />
                          ) : null}
                        </i>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {session.feedback && (
                  <div
                    ref={feedbackRef}
                    tabIndex={-1}
                    className={`bridge-feedback ${session.feedback}`}
                    role="status"
                    aria-live="polite"
                  >
                    <div>{q.correct ? <CircleCheck size={23} /> : <Lightbulb size={23} />}</div>
                    <p>
                      <strong>
                        {q.correct ? '두 묶음을 잘 합쳤어요.' : '다른 방법으로 한 번 더 해 볼까요?'}
                      </strong>
                      <span>
                        {q.correct
                          ? isCheck
                            ? q.hints
                              ? '도움을 활용해 새 문제를 해결한 기록으로 남길게요.'
                              : q.firstCorrect
                                ? '풀이 도움 없이 첫 시도에 해결했어요.'
                                : '풀이 도움 없이 다시 생각해 해결했어요.'
                            : '이제 수가 바뀐 새 문제에서 같은 방법을 써 볼 거예요.'
                          : '답을 바꿔 다시 확인하거나, 옆에서 도움 방식을 골라 보세요.'}
                      </span>
                    </p>
                  </div>
                )}
                <div className="bridge-submit-row">
                  {q.correct ? (
                    <button type="button" className="btn btn-primary" onClick={() => advance()}>
                      {isCheck ? '오늘 기록 보기' : '새 문제로 확인하기'}
                      <ArrowRight size={18} />
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={session.selected == null}
                    >
                      답 확인하기 <Check size={18} />
                    </button>
                  )}
                  <span>
                    {q.correct ? '내가 누르면 다음으로 가요' : '고르기와 확인은 따로 해요'}
                  </span>
                </div>
              </form>
              {!q.correct && (
                <div className="bridge-skip-row">
                  <button onClick={() => advance(true)} className="bridge-text-button">
                    이 문제는 다음에 할래요
                  </button>
                  <span>응답하지 않은 문제는 오답으로 세지 않아요.</span>
                </div>
              )}
              <div className="bridge-page-footer">
                <span>MY MATH WORKBOOK</span>
                <span>{isCheck ? '02' : '01'} / 02</span>
              </div>
            </article>
            <aside
              ref={supportRef}
              id="bridge-support-tools"
              tabIndex={-1}
              className="bridge-support-panel"
              aria-label="풀이 도움 도구"
            >
              <button className="bridge-return-mobile" onClick={() => moveTo(workbookRef)}>
                문제로 돌아가기 <ArrowRight size={15} />
              </button>
              <div className="bridge-support-heading">
                <span className="bridge-tool-symbol">
                  <Lightbulb size={21} />
                </span>
                <div>
                  <span className="bridge-mini-label">내가 고르는</span>
                  <h2>풀이 도움</h2>
                </div>
              </div>
              <p className="bridge-support-intro">
                문제를 쉽게 바꾸는 대신,
                <br />
                같은 문제를 다른 방법으로 봐요.
              </p>
              <div className="bridge-tool-buttons">
                {TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      className={session.tool === tool.id ? 'active' : ''}
                      onClick={() => openTool(tool.id)}
                      disabled={q.correct}
                      aria-pressed={session.tool === tool.id}
                    >
                      <Icon size={21} />
                      <span>
                        <strong>{tool.title}</strong>
                        <small>{tool.detail}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  );
                })}
              </div>
              {session.tool ? (
                <>
                  <ToolContent
                    tool={session.tool}
                    depth={session.depth}
                    set={set}
                    a={a}
                    b={b}
                    onMore={() => openTool(session.tool, 2)}
                    finished={q.correct}
                  />
                  <button className="bridge-fold-tool" onClick={foldTool}>
                    도움 접고 문제 보기 <ArrowRight size={15} />
                  </button>
                </>
              ) : (
                <div className="bridge-empty-tool">
                  <div className="bridge-empty-lines">
                    <i />
                    <i />
                    <i />
                  </div>
                  <p>
                    {q.correct
                      ? '사용한 방법을 기억해 두어요.'
                      : isCheck
                        ? '필요하면 도구를 다시 열어도 괜찮아요.'
                        : '보고 싶은 방법을 누르면 여기에 펼쳐져요.'}
                  </p>
                </div>
              )}
              <p className="bridge-support-note">
                <Leaf size={15} /> 도움 요청은 감점하지 않아요.
              </p>
            </aside>
          </div>
        </>
      )}

      {session.phase === 'result' && (
        <div className="bridge-result">
          <div className="bridge-result-hero">
            <span className="bridge-result-icon">
              <Leaf size={30} />
            </span>
            <span className="bridge-mini-label">오늘의 수학 노트</span>
            <h1>
              내가 쓴 방법을
              <br />
              <em>함께 돌아봐요.</em>
            </h1>
            <p>
              {set.name} · {set.skill}
            </p>
          </div>
          <div className="bridge-result-grid">
            {session.questions.map((question, i) => (
              <article className="bridge-result-item" key={question.id}>
                <span className="bridge-mini-label">
                  {i === 0 ? '01 · 도움으로 연습' : '02 · 수가 바뀐 새 문제'}
                </span>
                <h2>{i === 0 ? `${set.a} + ${set.b}` : `${set.nextA} + ${set.nextB}`}</h2>
                <p
                  className={
                    question.correct ? 'bridge-result-status solved' : 'bridge-result-status'
                  }
                >
                  {question.correct && <CircleCheck size={18} />} {outcomeLabel(question)}
                </p>
                <dl>
                  <div>
                    <dt>첫 시도</dt>
                    <dd>
                      {question.firstCorrect === null
                        ? '응답 없음'
                        : question.firstCorrect
                          ? '정답'
                          : '다시 생각했어요'}
                    </dd>
                  </div>
                  <div>
                    <dt>답 확인</dt>
                    <dd>{question.attempts}번</dd>
                  </div>
                  <div>
                    <dt>풀이 도움</dt>
                    <dd>{question.hints ? `${question.hints}단계 사용` : '사용하지 않음'}</dd>
                  </div>
                  <div>
                    <dt>읽기 지원</dt>
                    <dd>
                      {question.accessSupports.length
                        ? question.accessSupports.join(' · ')
                        : '사용하지 않음'}
                    </dd>
                  </div>
                </dl>
                {question.usedHintKeys.length > 0 && (
                  <p className="bridge-used-tools">
                    {[
                      ...new Set(
                        question.usedHintKeys.map(
                          (key) => TOOLS.find((t) => t.id === key.split(':')[0])?.title,
                        ),
                      ),
                    ].join(' · ')}
                  </p>
                )}
              </article>
            ))}
          </div>
          <div className="bridge-next-note">
            <Lightbulb size={22} />
            <div>
              <strong>
                {session.questions[1].correct && session.questions[1].hints === 0
                  ? '새 문제에 배운 방법을 직접 써 봤어요.'
                  : session.questions[1].correct
                    ? '다음에는 도구를 잠깐 접고 새 문제를 시도해 봐도 좋아요.'
                    : '원할 때 같은 목표를 다시 만나 봐요.'}
              </strong>
              <p>두 문제의 기록이에요. 이것만으로 개념을 완전히 익혔다고 판단하지 않아요.</p>
            </div>
          </div>
          {recordError || !session.recorded ? (
            <div className="bridge-record-status" role="alert">
              <p>결과를 전달하지 못했어요. 이 화면의 기록은 유지돼요.</p>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (recordResult(session)) setStored((prev) => ({ ...prev, recorded: true }));
                }}
              >
                결과 다시 저장
              </button>
            </div>
          ) : (
            <p className="bridge-record-status">
              <Check size={16} /> 이 기기의 학습 기록에 남겼어요.
            </p>
          )}
          <div className="bridge-result-actions">
            <button className="btn btn-primary" onClick={chooseAgain}>
              다른 덧셈 목표 고르기 <ArrowRight size={18} />
            </button>
            <button className="btn btn-secondary" onClick={() => startSet(set)}>
              <RotateCcw size={17} /> 같은 목표 다시 하기
            </button>
            <button className="bridge-text-button" onClick={onHome}>
              다른 배움 보기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
