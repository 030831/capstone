import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Home,
  Lightbulb,
  Minus,
  Pause,
  Play,
  Plus,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Volume2,
  Wallet,
  X,
} from 'lucide-react';
import { usePersistentState, speak, makeId } from '../lib/storage';
import './life.css';

const PRODUCTS = [
  { id: 'pencil', name: '연필', price: 700, detail: '한 자루', color: 'ochre' },
  { id: 'eraser', name: '지우개', price: 500, detail: '한 개', color: 'rose' },
  { id: 'notebook', name: '공책', price: 1200, detail: '한 권', color: 'sage' },
  { id: 'ruler', name: '자', price: 800, detail: '한 개', color: 'sand' },
];
const MISSIONS = [
  {
    id: 'art',
    tag: '첫 번째 장면',
    title: '미술 시간 준비하기',
    description: '연필과 지우개를 사러 가요.',
    note: '미술 시간에 쓸 연필 2개와 지우개 1개를 사 오세요.',
    needed: { pencil: 2, eraser: 1 },
    budget: 3000,
    paid: 3000,
    icon: 'pencil',
  },
  {
    id: 'math',
    tag: '바뀐 상황에서 한 번 더',
    title: '수학 시간 준비하기',
    description: '물건과 금액이 달라졌어요.',
    note: '수학 시간에 쓸 공책 1권과 자 2개를 사 오세요.',
    needed: { notebook: 1, ruler: 2 },
    budget: 4000,
    paid: 5000,
    icon: 'notebook',
  },
];
const STEPS = ['메모대로 담기', '물건값 구하기', '예산 확인하기', '거스름돈 구하기'];
const QUESTION_IDS = ['cart', 'sum', 'budget', 'change'];
const won = (value) => `${value.toLocaleString('ko-KR')}원`;
const totalFor = (mission) =>
  PRODUCTS.reduce((sum, item) => sum + item.price * (mission.needed[item.id] || 0), 0);
const namesFor = (mission) =>
  PRODUCTS.filter((item) => mission.needed[item.id])
    .map((item) => `${item.name} ${mission.needed[item.id]}${item.id === 'notebook' ? '권' : '개'}`)
    .join(', ');
const equationFor = (mission) =>
  PRODUCTS.filter((item) => mission.needed[item.id])
    .map((item) => `${item.price.toLocaleString()} × ${mission.needed[item.id]}`)
    .join(' + ');

function getPrompts(mission) {
  return [
    `${mission.note} 메모와 같은 종류와 개수를 장바구니에 담으세요.`,
    `${namesFor(mission)}의 물건값은 모두 얼마인가요?`,
    `물건값은 ${won(totalFor(mission))}이고 예산은 ${won(mission.budget)}이에요. 예산 안에서 살 수 있나요?`,
    `물건값은 ${won(totalFor(mission))}이에요. ${won(mission.paid)}을 내면 거스름돈은 얼마인가요?`,
  ];
}

function freshSession(mission) {
  return {
    version: 1,
    id: makeId(),
    missionId: mission.id,
    stage: 0,
    cart: {},
    answers: { sum: '', budget: null, change: '' },
    questions: getPrompts(mission).map((prompt, index) => ({
      id: `${mission.id}-${QUESTION_IDS[index]}`,
      prompt,
      firstCorrect: null,
      correct: false,
      attempts: 0,
      hints: 0,
      accessSupports: [],
    })),
    paused: false,
    completed: false,
    recorded: false,
    resumed: 0,
    reflection: '',
    feedback: null,
  };
}

function ProductArt({ type, className = '' }) {
  return (
    <svg className={`life-product-art ${className}`} viewBox="0 0 180 130" aria-hidden="true">
      <ellipse cx="90" cy="111" rx="58" ry="7" fill="#29372d" opacity=".07" />
      {type === 'pencil' && (
        <g transform="rotate(-28 90 65)">
          <path d="M43 47h91v30H43z" fill="#E4BA60" />
          <path d="M43 47h91v9H43z" fill="#F4D78D" />
          <path d="M43 70h91v7H43z" fill="#C28F37" />
          <path d="m43 47-24 15 24 15" fill="#D9B892" />
          <path d="m19 62 10-6v12z" fill="#29372D" />
          <rect x="134" y="47" width="11" height="30" fill="#C3C3B8" />
          <path d="M145 47h9a7 7 0 0 1 7 7v16a7 7 0 0 1-7 7h-9z" fill="#B96E5C" />
          <path d="M75 62h39" stroke="#936A29" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {type === 'eraser' && (
        <g transform="rotate(-12 90 65)">
          <path d="m44 51 17-18h72l15 18v39H44z" fill="#C78F7C" />
          <path d="M44 51h104v39H44z" fill="#D9AA97" />
          <path d="M69 33h48v57H69z" fill="#F1EBDD" />
          <path d="M69 51h48v39H69z" fill="#E8E0CF" />
          <path d="M80 62h24M80 68h18" stroke="#6C7566" strokeWidth="2" />
          <path d="M44 90h104" stroke="#B37D6D" strokeWidth="3" />
        </g>
      )}
      {type === 'notebook' && (
        <g transform="rotate(8 90 65)">
          <rect x="49" y="18" width="86" height="93" rx="4" fill="#5F7567" />
          <rect x="55" y="18" width="75" height="88" rx="3" fill="#8B9D83" />
          <rect x="70" y="34" width="45" height="30" rx="2" fill="#EFEADA" />
          <path d="M78 43h28M78 50h22" stroke="#9A9E8B" strokeWidth="2" />
          <path d="M61 18v88" stroke="#566D5D" strokeWidth="2" />
          <path d="M57 109h73" stroke="#E6DBBF" strokeWidth="3" />
        </g>
      )}
      {type === 'ruler' && (
        <g transform="rotate(-15 90 65)">
          <rect x="20" y="43" width="140" height="43" rx="3" fill="#D6B879" />
          <rect x="23" y="46" width="134" height="35" rx="2" fill="#E9D6A2" />
          <path
            d="M30 46v15m10-15v9m10-9v9m10-9v9m10-9v9m10-9v15m10-15v9m10-9v9m10-9v9m10-9v9m10-9v15m10-15v9m10-9v9"
            stroke="#82734D"
            strokeWidth="1.5"
          />
          <text x="29" y="75" fill="#6F654D" fontSize="10">
            0
          </text>
          <text x="78" y="75" fill="#6F654D" fontSize="10">
            5
          </text>
          <text x="126" y="75" fill="#6F654D" fontSize="10">
            10
          </text>
        </g>
      )}
    </svg>
  );
}

function ShopArt() {
  return (
    <svg
      className="life-shop-art"
      viewBox="0 0 640 350"
      role="img"
      aria-label="크림색 벽과 줄무늬 차양이 있는 동네 문구점"
    >
      <path d="M20 309h600" stroke="#D6CAB5" strokeWidth="2" />
      <path d="M80 307V102h481v205" fill="#EDE4D1" />
      <path d="M73 109h496v-9a9 9 0 0 0-9-9H82a9 9 0 0 0-9 9z" fill="#D4C4AA" />
      <rect
        x="186"
        y="45"
        width="261"
        height="67"
        rx="2"
        fill="#F7F2E7"
        stroke="#CFC2AA"
        strokeWidth="2"
      />
      <text
        x="317"
        y="86"
        textAnchor="middle"
        fill="#354238"
        fontFamily="sans-serif"
        fontSize="29"
        fontWeight="700"
        letterSpacing="10"
      >
        동네문구
      </text>
      <path d="m67 123 19-18h472l20 18v31H67z" fill="#AD5A45" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
        <path key={n} d={`M${88 + n * 62} 105h30l7 49h-31z`} fill="#EAD7BA" />
      ))}
      <path
        d="M67 151h511v9q-17 16-34 0-17 16-34 0-17 16-34 0-17 16-34 0-17 16-34 0-17 16-34 0-17 16-34 0-17 16-34 0-17 16-34 0-17 16-34 0-17 16-34 0-17 16-34 0-17 16-34 0-17 16-34 0-17 16-35 0z"
        fill="#AD5A45"
      />
      <rect x="105" y="180" width="244" height="108" fill="#8B9C8B" />
      <rect x="114" y="188" width="226" height="90" fill="#CBD3BD" />
      <path d="M115 236h225M228 188v90" stroke="#F4EFDF" strokeWidth="6" />
      <path d="M134 227v-25h29v25m9 0v-32h16v32m64 0v-25h39v25m8 0v-20h14v20" fill="#B16B51" />
      <path d="M140 266v-19h50v19m65 0v-22h21v22m6 0v-17h27v17" fill="#E7C88C" />
      <rect x="383" y="177" width="129" height="129" fill="#687D6A" />
      <rect x="392" y="186" width="111" height="91" fill="#CCD2BD" />
      <rect x="429" y="208" width="39" height="24" fill="#F7F2E7" />
      <text x="448" y="224" textAnchor="middle" fontSize="11" fill="#6A715D">
        열었어요
      </text>
      <circle cx="497" cy="266" r="3" fill="#E1C393" />
      <path d="M54 310v-41q0-15 18-15t18 15v41" fill="#8B9C7D" />
      <path d="M48 280h47l-5 31H54z" fill="#B46E52" />
      <path d="m543 308 9-70h42l8 70" fill="#F4EEE0" stroke="#B39A73" strokeWidth="3" />
      <text x="573" y="258" textAnchor="middle" fontSize="9" fill="#75634D">
        오늘도
      </text>
      <text x="573" y="274" textAnchor="middle" fontSize="11" fill="#75634D">
        반가워요
      </text>
    </svg>
  );
}

export default function Life({ onRecord, onHome, settings = {} }) {
  const [stored, setStored] = usePersistentState('life-progress', null);
  const validStored =
    stored?.version === 1 &&
    MISSIONS.some((mission) => mission.id === stored.missionId) &&
    stored.cart &&
    stored.answers &&
    Array.isArray(stored.questions) &&
    stored.questions.length === 4 &&
    stored.questions.every((question) => Array.isArray(question.accessSupports)) &&
    Number.isInteger(stored.stage) &&
    stored.stage >= 0 &&
    stored.stage <= 4 &&
    (stored.stage === 4) === Boolean(stored.completed);
  const session = validStored ? stored : null;
  const [returning, setReturning] = useState(Boolean(validStored && !stored.completed));
  const [resetConfirm, setResetConfirm] = useState(false);
  const [audioMessage, setAudioMessage] = useState('');
  const headingRef = useRef(null);
  const mission = MISSIONS.find((item) => item.id === session?.missionId);
  const current = session?.questions[session.stage];
  const total = mission ? totalFor(mission) : 0;
  const isPaused = Boolean(session && !session.completed && (session.paused || returning));
  const isDone = Boolean(session?.completed);
  const qid = session ? QUESTION_IDS[session.stage] : null;
  const solved = current?.correct;

  useEffect(() => {
    if (session && !isPaused) headingRef.current?.focus();
  }, [session?.id, session?.stage, isPaused, isDone]);
  useEffect(
    () => () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window)
        window.speechSynthesis.cancel();
    },
    [],
  );

  function startMission(nextMission) {
    setStored(freshSession(nextMission));
    setReturning(false);
    setResetConfirm(false);
    setAudioMessage('');
  }
  function updateSession(update) {
    setStored((previous) => (previous ? update(previous) : previous));
  }
  function addSupport(label, text) {
    updateSession((previous) => ({
      ...previous,
      questions: previous.questions.map((question, index) =>
        index === previous.stage
          ? { ...question, accessSupports: [...new Set([...question.accessSupports, label])] }
          : question,
      ),
    }));
    const available = speak(text);
    setAudioMessage(
      available
        ? '듣기를 시작했어요. 화면의 글로도 확인할 수 있어요.'
        : '이 기기에서는 읽어주기를 사용할 수 없어요. 화면의 같은 글을 읽어 주세요.',
    );
  }
  function changeCart(id, delta) {
    if (solved) return;
    updateSession((previous) => ({
      ...previous,
      cart: { ...previous.cart, [id]: Math.max(0, Math.min(6, (previous.cart[id] || 0) + delta)) },
      feedback: null,
    }));
  }
  function changeAnswer(value) {
    if (solved) return;
    updateSession((previous) => ({
      ...previous,
      answers: { ...previous.answers, [qid]: value },
      feedback: null,
    }));
  }
  function checkAnswer() {
    if (!session || solved) return;
    let correct = false;
    let message = '';
    if (session.stage === 0) {
      if (!Object.values(session.cart).some((quantity) => quantity > 0)) {
        updateSession((previous) => ({
          ...previous,
          feedback: {
            kind: 'notice',
            text: '아직 장바구니가 비어 있어요. 메모를 보고 물건을 하나씩 담아 주세요.',
          },
        }));
        return;
      }
      correct = PRODUCTS.every(
        (item) => (session.cart[item.id] || 0) === (mission.needed[item.id] || 0),
      );
      message = correct
        ? '메모와 같은 물건을 같은 개수로 담았어요.'
        : '메모와 장바구니를 다시 비교해요. 물건의 종류와 개수를 하나씩 확인해 보세요.';
    } else if (session.stage === 2) {
      if (session.answers.budget === null) {
        updateSession((previous) => ({
          ...previous,
          feedback: { kind: 'notice', text: '두 가지 중 하나를 고른 뒤 확인해 주세요.' },
        }));
        return;
      }
      correct = session.answers.budget === (total <= mission.budget ? 'yes' : 'no');
      message = correct
        ? '맞아요. 오늘 예산 안에서 준비물을 살 수 있어요.'
        : '물건값과 예산 중 어느 금액이 더 큰지 다시 살펴보세요.';
    } else {
      const value = session.answers[qid];
      if (!value) {
        updateSession((previous) => ({
          ...previous,
          feedback: {
            kind: 'notice',
            text: '생각한 금액을 숫자로 입력해 주세요. 아직 모르겠으면 힌트를 볼 수 있어요.',
          },
        }));
        return;
      }
      correct = Number(value) === (session.stage === 1 ? total : mission.paid - total);
      message = correct
        ? session.stage === 1
          ? '물건값을 모두 더했어요. 이제 예산을 확인해요.'
          : '거스름돈까지 확인했어요. 준비물 사기 미션을 마쳤어요!'
        : session.stage === 1
          ? '물건 한 개의 가격과 필요한 개수를 다시 확인해요. 같은 물건도 개수만큼 더해야 해요.'
          : '낸 돈에서 물건값을 빼요. 입력한 금액을 한 번 더 살펴보세요.';
    }
    updateSession((previous) => ({
      ...previous,
      questions: previous.questions.map((question, index) =>
        index === previous.stage
          ? {
              ...question,
              firstCorrect: question.firstCorrect === null ? correct : question.firstCorrect,
              correct,
              attempts: question.attempts + 1,
            }
          : question,
      ),
      feedback: { kind: correct ? 'success' : 'retry', text: message },
    }));
  }
  function getHint(level) {
    const hints = [
      [
        '메모에 적힌 물건의 종류와 개수를 따로 확인해요.',
        `담아야 할 물건은 ${namesFor(mission)}이에요. 다른 물건이 들어 있으면 빼 주세요.`,
        `함께 확인해요. 장바구니를 ${namesFor(mission)}으로 맞추면 돼요.`,
      ],
      [
        '각 물건의 가격을 필요한 개수만큼 더해요.',
        `이렇게 계산해 보세요. ${equationFor(mission)} = ?`,
        `함께 계산하면 ${equationFor(mission)} = ${total.toLocaleString()}이에요. 금액을 입력해 확인해 보세요.`,
      ],
      [
        '물건값이 예산보다 크지 않으면 살 수 있어요.',
        `${won(total)}과 ${won(mission.budget)}을 비교해요. 물건값이 더 작아요.`,
        '함께 확인해요. 물건값이 예산보다 작으므로 ‘살 수 있어요’를 골라요.',
      ],
      [
        '낸 돈에서 물건값을 빼면 거스름돈이 돼요.',
        `${mission.paid.toLocaleString()} − ${total.toLocaleString()} = ? 로 계산해요.`,
        `함께 계산하면 거스름돈은 ${won(mission.paid - total)}이에요. 숫자를 입력해 확인해 보세요.`,
      ],
    ];
    return hints[session.stage][Math.min(level, 3) - 1];
  }
  function showHint() {
    if (!solved)
      updateSession((previous) => ({
        ...previous,
        questions: previous.questions.map((question, index) =>
          index === previous.stage
            ? { ...question, hints: Math.min(3, question.hints + 1) }
            : question,
        ),
      }));
  }
  function nextStage() {
    if (!solved) return;
    setAudioMessage('');
    if (session.stage === 3) {
      let recorded = false;
      let feedback = null;
      try {
        onRecord?.(makeRecord());
        recorded = true;
      } catch {
        feedback = {
          kind: 'retry',
          text: '기록을 남기지 못했어요. 활동 내용은 이 기기에 남아 있어요. 다시 눌러 주세요.',
        };
      }
      updateSession((previous) => ({ ...previous, stage: 4, completed: true, recorded, feedback }));
      return;
    }
    updateSession((previous) => ({
      ...previous,
      stage: previous.stage + 1,
      completed: previous.stage === 3,
      feedback: null,
    }));
  }
  function resume() {
    setReturning(false);
    updateSession((previous) => ({
      ...previous,
      paused: false,
      resumed: previous.resumed + 1,
      feedback: null,
    }));
  }
  function pause() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    updateSession((previous) => ({ ...previous, paused: true }));
  }
  function makeRecord() {
    return {
      id: session.id,
      prototype: 'life',
      subject: '생활',
      title: `${mission.title} · 문구점에서 수량과 돈 쓰기`,
      completedAt: new Date().toISOString(),
      questions: session.questions,
      resumed: session.resumed,
      reflection: session.reflection || '따로 선택하지 않았어요.',
      mode: 'prepared-demo',
    };
  }
  function recordCompletion() {
    if (!session || !session.completed || session.recorded) return;
    try {
      onRecord?.(makeRecord());
      updateSession((previous) => ({ ...previous, recorded: true }));
    } catch {
      updateSession((previous) => ({
        ...previous,
        feedback: {
          kind: 'retry',
          text: '기록을 남기지 못했어요. 활동 내용은 이 기기에 남아 있어요. 다시 눌러 주세요.',
        },
      }));
    }
  }

  return (
    <section
      aria-label="생활 실험실"
      className={`life-proto ${settings.largeText ? 'life-large' : ''} ${settings.quiet ? 'life-quiet' : ''}`}
    >
      <div className="life-topline">
        <button className="life-text-btn" onClick={onHome}>
          <ArrowLeft size={16} /> 세 가지 배움으로
        </button>
        <span>
          03 <span className="life-topline-rule" /> 생활 실험실
        </span>
      </div>

      {!session && (
        <>
          <section className="life-hero">
            <div className="life-hero-copy">
              <span className="life-kicker">배운 것을, 오늘의 생활로</span>
              <h1>
                작은 문구점에서
                <br />
                <em>스스로 해보는 하루.</em>
              </h1>
              <p>
                메모를 읽고, 필요한 물건을 담고,
                <br className="life-desktop-break" /> 돈을 계산해요. 한 번에 한 단계씩 함께해요.
              </p>
              <div className="life-hero-tags">
                <span>생활 속 국어</span>
                <span>수량과 돈 계산</span>
                <span>끝나면 다시 확인</span>
              </div>
            </div>
            <div className="life-hero-art">
              <span className="life-art-caption">OUR LITTLE STATIONERY SHOP</span>
              <ShopArt />
              <span className="life-art-footnote">학교 앞, 늘봄 문구점</span>
            </div>
          </section>
          <section className="life-missions" aria-labelledby="life-missions-title">
            <div className="life-section-heading">
              <div>
                <span className="life-kicker">오늘의 작은 도전</span>
                <h2 id="life-missions-title">어떤 준비물을 사러 갈까요?</h2>
              </div>
              <span>4단계 · 내 속도로</span>
            </div>
            <div className="life-mission-grid">
              {MISSIONS.map((item, index) => (
                <button
                  key={item.id}
                  className="life-mission-card"
                  onClick={() => startMission(item)}
                >
                  <div className="life-mission-art">
                    <ProductArt type={item.icon} />
                    <span>0{index + 1}</span>
                  </div>
                  <div className="life-mission-copy">
                    <span>{item.tag}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div className="life-mission-bottom">
                      <span>예산 {won(item.budget)}</span>
                      <span className="life-round-arrow">
                        <ArrowRight size={20} />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
          <div className="life-start-note">
            <Lightbulb size={20} />
            <p>
              문제가 어려워서가 아니라, 시작하거나 순서를 기억하기 어려울 수도 있어요.
              <br />
              메모와 듣기는 언제든 사용할 수 있고, 잠깐 쉬어도 이어 할 수 있어요.
            </p>
          </div>
          {stored && !validStored && (
            <div className="life-feedback notice" role="status">
              이전 기록 형식을 불러오지 못했어요. 위의 미션을 골라 새로 시작할 수 있어요.
            </div>
          )}
        </>
      )}

      {isPaused && (
        <section className="life-pause-view">
          <div className="life-pause-icon">
            <ShoppingBag size={32} />
          </div>
          <span className="life-kicker">메모와 장바구니를 보관했어요</span>
          <h1>여기서 이어 해볼까요?</h1>
          <p>{mission.title}</p>
          <div className="life-return-card">
            <span>지금까지</span>
            <strong>
              {session.stage === 0
                ? '메모를 보고 물건을 담는 중이에요.'
                : `${STEPS[session.stage - 1]}까지 마쳤어요.`}
            </strong>
            <span>다음 한 가지</span>
            <strong>{STEPS[session.stage]}</strong>
            <p>{session.stage === 0 ? mission.note : getPrompts(mission)[session.stage]}</p>
          </div>
          <button className="life-primary-btn" onClick={resume}>
            <Play size={18} /> 이어서 하기
          </button>
          <button className="life-text-btn" onClick={onHome}>
            <Home size={16} /> 나중에 돌아올게요
          </button>
          <button className="life-text-btn life-reset-link" onClick={() => setResetConfirm(true)}>
            <RotateCcw size={15} /> 이 미션 처음부터
          </button>
          {resetConfirm && (
            <div className="life-reset-confirm" role="alert">
              <p>진행 중인 장바구니와 시도가 지워져요.</p>
              <button className="life-secondary-btn" onClick={() => setResetConfirm(false)}>
                이어 할게요
              </button>
              <button className="life-secondary-btn" onClick={() => startMission(mission)}>
                새로 시작할게요
              </button>
            </div>
          )}
        </section>
      )}

      {session && !isPaused && !isDone && (
        <>
          <header className="life-work-header">
            <div>
              <span className="life-kicker">학교 앞 늘봄 문구점</span>
              <h1 ref={headingRef} tabIndex={-1}>
                {mission.title}
              </h1>
            </div>
            <button className="life-secondary-btn" onClick={pause}>
              <Pause size={17} /> 잠깐 쉬기
            </button>
          </header>
          <ol className="life-stepper" aria-label="미션 진행 순서">
            {STEPS.map((step, index) => (
              <li
                key={step}
                className={
                  index === session.stage ? 'current' : index < session.stage ? 'complete' : ''
                }
                aria-current={index === session.stage ? 'step' : undefined}
              >
                <span>{index < session.stage ? <Check size={15} /> : index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="life-workspace">
            <aside className="life-note-column">
              <section className="life-memo">
                <div className="life-memo-top">
                  <span>잊지 않도록 적었어요</span>
                  <span className="life-paperclip" />
                </div>
                <h2>준비물 메모</h2>
                <p>{mission.note}</p>
                <ul>
                  {PRODUCTS.filter((item) => mission.needed[item.id]).map((item) => (
                    <li key={item.id}>
                      <span className="life-checkbox">
                        <Check size={13} />
                      </span>
                      <span>{item.name}</span>
                      <strong>
                        {mission.needed[item.id]}
                        {item.id === 'notebook' ? '권' : '개'}
                      </strong>
                    </li>
                  ))}
                </ul>
                <div className="life-memo-budget">
                  <Wallet size={17} />
                  <span>써도 되는 돈</span>
                  <strong>{won(mission.budget)}</strong>
                </div>
                <button
                  className="life-text-btn"
                  onClick={() =>
                    addSupport(
                      '메모 듣기',
                      `${mission.note} 오늘 써도 되는 돈은 ${won(mission.budget)}이에요.`,
                    )
                  }
                >
                  <Volume2 size={17} /> 메모 듣기
                </button>
              </section>
              <p className="life-memo-caption">
                이 메모는 계속 여기 있어요.
                <br />
                외우지 않아도 괜찮아요.
              </p>
            </aside>
            <section className="life-task-panel" aria-labelledby="life-task-title">
              <div className="life-task-top">
                <span className="life-kicker">STEP 0{session.stage + 1} / 04</span>
                <button
                  className="life-listen-btn"
                  onClick={() => addSupport('문제 듣기', current.prompt)}
                >
                  <Volume2 size={17} /> 문제 듣기
                </button>
              </div>
              <h2 id="life-task-title">
                {session.stage === 0
                  ? '메모대로 물건을 담아요.'
                  : session.stage === 1
                    ? '물건값은 모두 얼마일까요?'
                    : session.stage === 2
                      ? '예산 안에서 살 수 있나요?'
                      : '거스름돈은 얼마일까요?'}
              </h2>
              <p className="life-task-description">
                {session.stage === 0
                  ? '물건 아래 +, − 버튼으로 개수를 바꿔요.'
                  : session.stage === 1
                    ? '가격표를 보고, 필요한 개수만큼 더해 보세요.'
                    : session.stage === 2
                      ? '써도 되는 돈과 물건값을 비교해 보세요.'
                      : '문구점에 낸 돈에서 물건값을 빼 보세요.'}
              </p>

              {session.stage === 0 && (
                <>
                  <div className="life-products">
                    {PRODUCTS.map((item) => (
                      <article
                        key={item.id}
                        className={`life-product ${item.color} ${(session.cart[item.id] || 0) > 0 ? 'in-cart' : ''}`}
                      >
                        <div className="life-product-visual">
                          <ProductArt type={item.id} />
                          {(session.cart[item.id] || 0) > 0 && (
                            <span className="life-added-label">
                              <Check size={12} /> 담았어요
                            </span>
                          )}
                        </div>
                        <div className="life-product-label">
                          <h3>{item.name}</h3>
                          <span>
                            {won(item.price)} <small>/ {item.detail}</small>
                          </span>
                        </div>
                        <div className="life-quantity">
                          <button
                            onClick={() => changeCart(item.id, -1)}
                            disabled={solved || !(session.cart[item.id] > 0)}
                            aria-label={`${item.name} 한 개 빼기`}
                          >
                            <Minus size={17} />
                          </button>
                          <output aria-label={`${item.name} 담은 개수`}>
                            {session.cart[item.id] || 0}
                          </output>
                          <button
                            onClick={() => changeCart(item.id, 1)}
                            disabled={solved || session.cart[item.id] >= 6}
                            aria-label={`${item.name} 한 개 담기`}
                          >
                            <Plus size={17} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="life-cart-strip">
                    <ShoppingBag size={20} />
                    <div>
                      <strong>내 장바구니</strong>
                      <span>
                        {PRODUCTS.filter((item) => session.cart[item.id] > 0)
                          .map(
                            (item) =>
                              `${item.name} ${session.cart[item.id]}${item.id === 'notebook' ? '권' : '개'}`,
                          )
                          .join(' · ') || '아직 비어 있어요.'}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {session.stage === 1 && (
                <>
                  <div className="life-price-lines">
                    {PRODUCTS.filter((item) => mission.needed[item.id]).map((item) => (
                      <div key={item.id}>
                        <ProductArt type={item.id} />
                        <div>
                          <strong>
                            {item.name} {mission.needed[item.id]}
                            {item.id === 'notebook' ? '권' : '개'}
                          </strong>
                          <span>
                            {item.detail} 가격 {won(item.price)}
                          </span>
                        </div>
                        <span className="life-line-math">
                          {item.price.toLocaleString()} × {mission.needed[item.id]}
                        </span>
                      </div>
                    ))}
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      checkAnswer();
                    }}
                  >
                    <label className="life-answer-label" htmlFor="life-sum">
                      물건값 합계
                    </label>
                    <div className="life-money-input">
                      <input
                        id="life-sum"
                        inputMode="numeric"
                        type="text"
                        pattern="[0-9]*"
                        autoComplete="off"
                        placeholder="금액 입력"
                        value={session.answers.sum}
                        disabled={solved}
                        onChange={(event) =>
                          changeAnswer(event.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                      />
                      <span>원</span>
                    </div>
                    <button className="life-sr-only" type="submit" tabIndex={-1}>
                      물건값 확인하기
                    </button>
                  </form>
                </>
              )}

              {session.stage === 2 && (
                <>
                  <div className="life-compare">
                    <div>
                      <span>물건값</span>
                      <strong>{won(total)}</strong>
                    </div>
                    <span className="life-compare-divider">비교해요</span>
                    <div>
                      <span>오늘의 예산</span>
                      <strong>{won(mission.budget)}</strong>
                    </div>
                  </div>
                  <div
                    className="life-budget-options"
                    role="group"
                    aria-label="예산으로 살 수 있는지 고르기"
                  >
                    {[
                      ['yes', '살 수 있어요', '예산 안에서 살 수 있어요.'],
                      ['no', '돈이 부족해요', '예산보다 물건값이 더 커요.'],
                    ].map(([value, title, description]) => (
                      <button
                        key={value}
                        className={session.answers.budget === value ? 'selected' : ''}
                        aria-pressed={session.answers.budget === value}
                        disabled={solved}
                        onClick={() => changeAnswer(value)}
                      >
                        <span className="life-option-check">
                          {session.answers.budget === value && <Check size={16} />}
                        </span>
                        <strong>{title}</strong>
                        <small>{description}</small>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {session.stage === 3 && (
                <>
                  <div className="life-receipt">
                    <div className="life-receipt-heading">
                      <Receipt size={19} />
                      <strong>늘봄 문구점 영수증</strong>
                    </div>
                    <div>
                      <span>물건값</span>
                      <strong>{won(total)}</strong>
                    </div>
                    <div>
                      <span>내가 낸 돈</span>
                      <strong>{won(mission.paid)}</strong>
                    </div>
                    <div className="life-receipt-change">
                      <span>돌려받을 돈</span>
                      <strong>?</strong>
                    </div>
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      checkAnswer();
                    }}
                  >
                    <label className="life-answer-label" htmlFor="life-change">
                      거스름돈
                    </label>
                    <div className="life-money-input">
                      <input
                        id="life-change"
                        inputMode="numeric"
                        type="text"
                        pattern="[0-9]*"
                        autoComplete="off"
                        placeholder="금액 입력"
                        value={session.answers.change}
                        disabled={solved}
                        onChange={(event) =>
                          changeAnswer(event.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                      />
                      <span>원</span>
                    </div>
                    <button className="life-sr-only" type="submit" tabIndex={-1}>
                      거스름돈 확인하기
                    </button>
                  </form>
                </>
              )}

              {session.stage === 3 && solved && (
                <fieldset className="life-reflection">
                  <legend>
                    마치고 나니 어때요? <small>골라도 되고, 안 골라도 돼요.</small>
                  </legend>
                  {[
                    '다른 상황에서도 해보고 싶어요.',
                    '한 번 더 연습하고 싶어요.',
                    '이제 조금 쉬고 싶어요.',
                  ].map((reflection) => (
                    <button
                      type="button"
                      key={reflection}
                      aria-pressed={session.reflection === reflection}
                      className={session.reflection === reflection ? 'selected' : ''}
                      onClick={() => updateSession((previous) => ({ ...previous, reflection }))}
                    >
                      {reflection}
                    </button>
                  ))}
                </fieldset>
              )}
              <div className="life-support-row">
                <button
                  className="life-text-btn"
                  onClick={showHint}
                  disabled={solved || current.hints >= 3}
                >
                  <Lightbulb size={18} />
                  {current.hints === 0
                    ? '작은 힌트 보기'
                    : current.hints < 2
                      ? '조금 더 알려주세요'
                      : current.hints < 3
                        ? '함께 확인하기'
                        : '함께 확인했어요'}
                </button>
                <span>듣기는 힌트 횟수에 넣지 않아요.</span>
              </div>
              {current.hints > 0 && (
                <div className="life-hint" aria-live="polite">
                  <span>도움 {current.hints} / 3</span>
                  <p>{getHint(current.hints)}</p>
                </div>
              )}
              <div aria-live="polite" aria-atomic="true">
                {session.feedback && (
                  <div className={`life-feedback ${session.feedback.kind}`}>
                    {session.feedback.kind === 'success' ? (
                      <CheckCircle2 size={21} />
                    ) : (
                      <span className="life-feedback-dot" />
                    )}
                    <p>{session.feedback.text}</p>
                  </div>
                )}
              </div>
              <p className="life-sr-only" role="status">
                {audioMessage}
              </p>
              <div className="life-task-actions">
                {solved ? (
                  <button className="life-primary-btn" onClick={nextStage}>
                    {session.stage === 3 ? '기록 남기고 마치기' : '다음 단계로'}
                    <ArrowRight size={19} />
                  </button>
                ) : (
                  <button className="life-primary-btn" onClick={checkAnswer}>
                    {session.stage === 0 ? '장바구니 확인하기' : '내 답 확인하기'}
                    <Check size={18} />
                  </button>
                )}
                <span>
                  {solved ? '잘했어요. 준비되면 다음으로 가요.' : '내가 준비됐을 때 확인해요.'}
                </span>
              </div>
            </section>
          </div>
        </>
      )}

      {isDone && (
        <section className="life-completion">
          <div className="life-completion-top">
            <div className="life-complete-bag">
              <ShoppingBag size={32} />
              <span>
                <Check size={14} />
              </span>
            </div>
            <span className="life-kicker">생활 속에서 해냈어요</span>
            <h1 ref={headingRef} tabIndex={-1}>
              필요한 물건도,
              <br />
              거스름돈도 확인했어요.
            </h1>
            <p>
              {mission.title} · {namesFor(mission)}
            </p>
          </div>
          <div className="life-complete-receipt">
            <div>
              <span>준비물 값</span>
              <strong>{won(total)}</strong>
            </div>
            <div>
              <span>내가 낸 돈</span>
              <strong>{won(mission.paid)}</strong>
            </div>
            <div>
              <span>거스름돈</span>
              <strong>{won(mission.paid - total)}</strong>
            </div>
          </div>
          <div className="life-review">
            <h2>오늘 내가 해본 것</h2>
            <ul>
              {session.questions.map((question, index) => (
                <li key={question.id}>
                  <CheckCircle2 size={17} />
                  <span>{STEPS[index]}</span>
                  <small>
                    {question.attempts}번 확인
                    {question.hints > 0 ? ` · 도움 ${question.hints}단계` : ' · 풀이 힌트 없음'}
                  </small>
                </li>
              ))}
            </ul>
            <p>처음 답과 다시 해본 답을 따로 남겨요. 듣기·메모 지원은 오답으로 세지 않아요.</p>
          </div>
          {session.reflection && (
            <p className="life-finished-reflection">내가 남긴 느낌: {session.reflection}</p>
          )}
          <div className="life-parent-note">
            <span>함께 보는 보호자에게</span>
            <p>
              화면에서 계산한 기록이에요. 실제 문구점에서도 같은 물건을 고르고 돈을 확인하는지는
              함께 살펴봐 주세요. 결과만으로 생활 속 수행을 단정하지 않아요.
            </p>
          </div>
          {session.feedback && (
            <p className="life-feedback retry" role="status">
              {session.feedback.text}
            </p>
          )}
          <div className="life-completion-actions">
            {!session.recorded ? (
              <button className="life-primary-btn" onClick={recordCompletion}>
                이 활동 기록 남기기 <ArrowRight size={18} />
              </button>
            ) : (
              <p className="life-saved-message" role="status">
                <CheckCircle2 size={18} /> 보호자가 볼 수 있도록 실제 시도를 기록했어요.
              </p>
            )}
            {session.recorded && (
              <button
                className="life-primary-btn"
                onClick={() => startMission(MISSIONS.find((item) => item.id !== mission.id))}
              >
                다른 준비물로 해보기
                <ChevronRight size={18} />
              </button>
            )}
            <button className="life-secondary-btn" onClick={onHome}>
              <Home size={17} /> 세 가지 배움으로
            </button>
            <button
              className="life-text-btn"
              onClick={() => {
                setStored(null);
                setReturning(false);
              }}
            >
              <X size={15} /> 미션 목록으로
            </button>
          </div>
        </section>
      )}
      <footer className="life-footer">
        <span>늘봄 생활 실험실</span>
        <span>배운 것을 꺼내 쓰는 작은 연습</span>
      </footer>
    </section>
  );
}
