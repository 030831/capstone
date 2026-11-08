import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  Coffee,
  Lightbulb,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import { usePersistentState, speak, makeId, writeStored } from '../lib/storage';
import './focus.css';

const BANK = {
  국어: [
    {
      id: 'bag',
      label: '준비물 찾기',
      context: '내일 미술 시간에는 색연필과 풀을 가져와요.',
      short: '가져올 것: 색연필, 풀',
      prompt: '안내에 나온 준비물을 골라요.',
      options: ['색연필과 풀', '색연필과 공', '풀과 우산'],
      answer: 0,
      hint: '“가져와요” 앞에 있는 두 물건을 찾아요.',
      example: '“책과 공책을 가져와요”라는 안내의 준비물은 책과 공책이에요.',
      explanation: '안내에는 색연필과 풀을 가져오라고 쓰여 있어요.',
    },
    {
      id: 'order',
      label: '첫 행동 찾기',
      context: '도서관에 가면 먼저 책을 골라요. 그다음 대출대에 책을 가져가요.',
      short: '① 책 고르기 → ② 대출대에 가져가기',
      prompt: '도서관에서 가장 먼저 할 일은 무엇인가요?',
      options: ['대출대에 가져가기', '책 고르기', '집에 가기'],
      answer: 1,
      hint: '“먼저” 다음에 나오는 행동을 찾아요.',
      example: '“먼저 손을 씻고, 그다음 간식을 먹어요.”에서는 손 씻기가 첫 행동이에요.',
      explanation: '먼저 책을 고른 다음, 대출대에 가져가요.',
    },
    {
      id: 'place',
      label: '장소 찾기',
      context: '오늘 방과후 모임은 2층 음악실에서 해요. 모임은 오후 3시에 시작해요.',
      short: '장소: 2층 음악실 · 시작: 오후 3시',
      prompt: '모임을 하는 장소는 어디인가요?',
      options: ['1층 도서관', '운동장', '2층 음악실'],
      answer: 2,
      hint: '시간이 아니라 “어디에서” 하는지 찾아요.',
      example: '“교실에서 만나요”라는 말에서 만나는 장소는 교실이에요.',
      explanation: '2층 음악실이 모임 장소예요. 오후 3시는 시작 시간이에요.',
    },
    {
      id: 'next',
      label: '다음 행동 찾기',
      context: '화분에 흙을 담아요. 다음으로 씨앗을 심어요. 마지막으로 물을 줘요.',
      short: '흙 담기 → 씨앗 심기 → 물 주기',
      prompt: '흙을 담은 다음에는 무엇을 하나요?',
      options: ['씨앗 심기', '물 주기', '흙 담기'],
      answer: 0,
      hint: '“흙 담기” 바로 다음 칸을 봐요.',
      example: '“가방 열기 → 책 꺼내기 → 읽기”에서 가방을 연 다음에는 책을 꺼내요.',
      explanation: '흙을 담은 다음 씨앗을 심고, 마지막에 물을 줘요.',
    },
    {
      id: 'notice',
      label: '바뀐 안내 확인',
      context: '비가 와서 오늘 체육 활동은 운동장 대신 강당에서 해요. 실내 운동화를 준비해요.',
      short: '오늘 체육: 강당 · 준비물: 실내 운동화',
      prompt: '오늘 체육 활동을 하러 어디로 가야 하나요?',
      options: ['운동장', '강당', '음악실'],
      answer: 1,
      hint: '“대신” 뒤에 있는 새 장소를 찾아요.',
      example: '“공원 대신 도서관에 가요”에서는 가는 곳이 도서관으로 바뀌었어요.',
      explanation: '오늘은 운동장 대신 강당에서 체육 활동을 해요.',
    },
  ],
  수학: [
    {
      id: 'sum',
      label: '두 묶음 모으기',
      context: '노트가 3권 있어요. 노트 2권을 더 모았어요.',
      short: '노트 3권 + 노트 2권',
      prompt: '노트는 모두 몇 권인가요?',
      options: ['4권', '5권', '6권'],
      answer: 1,
      hint: '3에서 시작해서 2만큼 더 세어 봐요.',
      example: '연필 2자루에 1자루를 더 모으면 모두 3자루예요.',
      explanation: '3에 2를 더하면 5예요. 노트는 모두 5권이에요.',
    },
    {
      id: 'compare',
      label: '가격 비교하기',
      context: '지우개는 500원이에요. 연필은 700원이에요.',
      short: '지우개 500원 · 연필 700원',
      prompt: '두 물건 중 가격이 더 낮은 것은 무엇인가요?',
      options: ['지우개', '연필', '두 물건의 가격이 같아요'],
      answer: 0,
      hint: '500과 700을 비교해요. 더 작은 수를 찾아요.',
      example: '300원과 400원 중에서는 300원이 더 낮은 가격이에요.',
      explanation: '500원은 700원보다 작아요. 지우개의 가격이 더 낮아요.',
    },
    {
      id: 'left',
      label: '남은 수 세기',
      context: '스티커가 6장 있어요. 그중 2장을 공책에 붙였어요.',
      short: '스티커 6장 중 2장 사용',
      prompt: '아직 붙이지 않은 스티커는 몇 장인가요?',
      options: ['2장', '3장', '4장'],
      answer: 2,
      hint: '6에서 사용한 2를 빼요.',
      example: '종이 5장 중 1장을 쓰면 4장이 남아요.',
      explanation: '6에서 2를 빼면 4예요. 아직 붙이지 않은 스티커는 4장이에요.',
    },
    {
      id: 'time',
      label: '안내의 시각 읽기',
      context: '모임은 오후 2시에 시작해요. 알람에는 “오후 2:00”이라고 표시되어 있어요.',
      short: '오후 2:00 = 오후 2시',
      prompt: '알람이 알려 주는 시각은 언제인가요?',
      options: ['오후 2시', '오후 3시', '오전 2시'],
      answer: 0,
      hint: '숫자 2와 “오후”를 함께 확인해요.',
      example: '오전 9:00은 오전 9시예요.',
      explanation: '오후 2:00은 오후 2시를 나타내요.',
    },
    {
      id: 'budget',
      label: '금액 합치기',
      context: '100원 동전 2개와 500원 동전 1개가 있어요.',
      short: '100원 + 100원 + 500원',
      prompt: '동전을 모두 합하면 얼마인가요?',
      options: ['600원', '700원', '800원'],
      answer: 1,
      hint: '100원 2개를 먼저 합한 뒤, 500원을 더해요.',
      example: '100원 1개와 500원 1개를 합하면 600원이에요.',
      explanation: '100원 2개는 200원이고, 500원을 더하면 700원이에요.',
    },
  ],
};

function emptyProgress() {
  return {
    stage: 'setup',
    subject: '국어',
    count: 3,
    feeling: '',
    id: null,
    index: 0,
    step: 'read',
    results: [],
    selected: null,
    feedback: null,
    short: false,
    shownHint: false,
    shownExample: false,
    resumed: 0,
    reflection: '',
    recorded: false,
  };
}
function blankResult(q, subject) {
  return {
    id: `focus-${subject}-${q.id}`,
    prompt: `${q.context} ${q.prompt}`,
    firstCorrect: null,
    correct: false,
    attempts: 0,
    hints: 0,
    accessSupports: [],
  };
}
function PaperArt({ compact = false }) {
  return (
    <svg
      className={`focus-paper-art ${compact ? 'is-compact' : ''}`}
      viewBox="0 0 360 280"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="185" cy="145" r="115" fill="#EBE4F8" />
      <circle cx="310" cy="53" r="9" fill="#C9B6E8" />
      <circle cx="42" cy="211" r="6" fill="#D9BE8F" />
      <path
        d="M61 104a12 12 0 0112-12h87l17 18h95a12 12 0 0112 12v112H61V104z"
        fill="#DCCAF3"
        stroke="#A88CC8"
        strokeWidth="2"
      />
      <g transform="rotate(-8 180 132)">
        <rect
          x="106"
          y="31"
          width="150"
          height="188"
          rx="12"
          fill="#FFFCF4"
          stroke="#AF98CA"
          strokeWidth="2"
        />
        <path d="M216 31v54l-14-9-14 9V31" fill="#B699D8" />
        <rect x="125" y="64" width="45" height="8" rx="4" fill="#D7C8E8" />
        <rect x="125" y="91" width="104" height="5" rx="2.5" fill="#D7D0DA" />
        <rect x="125" y="104" width="80" height="5" rx="2.5" fill="#E3DDE5" />
        <rect x="125" y="133" width="17" height="17" rx="5" fill="#E8E0F2" />
        <path d="m130 141 3 3 6-7" stroke="#82629F" strokeWidth="2" strokeLinecap="round" />
        <rect x="153" y="139" width="66" height="5" rx="2.5" fill="#C5B3D9" />
        <rect x="125" y="166" width="17" height="17" rx="5" stroke="#C5B3D9" />
        <rect x="153" y="172" width="50" height="5" rx="2.5" fill="#D7D0DA" />
      </g>
      <path d="M57 153h235l-16 88H73l-16-88z" fill="#EADDF8" stroke="#AF98CA" strokeWidth="2" />
      <rect x="140" y="176" width="73" height="24" rx="8" fill="#FFF9ED" />
      <path d="M162 188h29" stroke="#BCA4D0" strokeWidth="3" strokeLinecap="round" />
      <path d="m48 64 3 8 9 1-7 5 2 9-7-5-7 5 2-9-7-5 9-1 3-8z" fill="#D9BE8F" />
    </svg>
  );
}

export default function Focus({ onRecord, onHome, settings = {} }) {
  const [progress, setProgress] = usePersistentState('focus-progress', emptyProgress);
  const [notice, setNotice] = useState('');
  const [storageOk, setStorageOk] = useState(true);
  const mounted = useRef(false);
  const heading = useRef(null);
  const submitted = useRef(false);
  const validProgress =
    progress &&
    BANK[progress.subject] &&
    ['setup', 'learn', 'pause', 'resume', 'finish', 'done'].includes(progress.stage) &&
    [3, 5].includes(progress.count) &&
    Number.isInteger(progress.index) &&
    progress.index >= 0 &&
    progress.index < progress.count &&
    Array.isArray(progress.results) &&
    progress.results.every(
      (r) =>
        r &&
        typeof r === 'object' &&
        Array.isArray(r.accessSupports) &&
        Number.isFinite(r.hints) &&
        Number.isFinite(r.attempts),
    );
  const p = validProgress ? progress : emptyProgress();
  const bank = BANK[p.subject];
  const tasks = bank.slice(0, p.count === 5 ? 5 : 3);
  const q = tasks[p.index] || tasks[0];
  const current = p.results[p.index] || blankResult(q, p.subject);
  const solved = p.results.filter((r) => r.correct).length;
  const answered = p.results.filter((r) => r.firstCorrect !== null).length;

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (!validProgress) {
      setProgress(emptyProgress());
      return;
    }
    if (progress?.stage === 'learn' && progress.id)
      setProgress((s) => ({ ...s, stage: 'resume', resumed: (s.resumed || 0) + 1 }));
  }, []);
  useEffect(() => {
    setStorageOk(writeStored('focus-progress', progress));
  }, [progress]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    setNotice('');
  }, [p.stage, p.index, p.step]);

  function updateCurrent(change, extra = {}) {
    setProgress((s) => {
      const results = [...s.results];
      results[s.index] = change(results[s.index] || blankResult(q, s.subject));
      return { ...s, ...extra, results };
    });
  }
  function support(name) {
    if (p.stage !== 'learn') return;
    updateCurrent((r) => ({ ...r, accessSupports: [...new Set([...r.accessSupports, name])] }));
  }
  function read() {
    const ok = speak(`${p.short ? q.short : q.context} ${p.step === 'answer' ? q.prompt : ''}`);
    if (ok) support('읽어주기');
    else setNotice('이 기기에서는 읽어주기를 사용할 수 없어요. 안내를 글로 확인해요.');
  }
  function start() {
    submitted.current = false;
    setProgress({
      ...emptyProgress(),
      stage: 'learn',
      subject: p.subject,
      count: p.count,
      feeling: p.feeling,
      id: makeId(),
      results: tasks.map((t) => blankResult(t, p.subject)),
    });
  }
  function answer() {
    if (p.selected === null || current.correct) return;
    const correct = p.selected === q.answer;
    updateCurrent(
      (r) => ({
        ...r,
        firstCorrect: r.firstCorrect === null ? correct : r.firstCorrect,
        correct,
        attempts: r.attempts + 1,
      }),
      { feedback: correct ? 'correct' : 'retry', selected: correct ? p.selected : null },
    );
  }
  function hint(type) {
    const field = type === 'example' ? 'shownExample' : 'shownHint';
    if (p[field]) return;
    updateCurrent((r) => ({ ...r, hints: r.hints + 1 }), { [field]: true });
  }
  function next() {
    if (p.index === tasks.length - 1) {
      setProgress((s) => ({ ...s, stage: 'finish' }));
      return;
    }
    setProgress((s) => ({
      ...s,
      index: s.index + 1,
      step: 'read',
      selected: null,
      feedback: null,
      short: false,
      shownHint: false,
      shownExample: false,
    }));
  }
  function resume() {
    setProgress((s) => ({ ...s, stage: 'resume', resumed: s.resumed + 1 }));
  }
  function saveRecord() {
    if (p.recorded || submitted.current) return;
    submitted.current = true;
    const complete = solved === tasks.length;
    const reflection = [
      p.feeling ? `시작할 때: ${p.feeling}` : '',
      p.reflection ? `다음에는: ${p.reflection}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const record = {
      id: p.id || makeId(),
      prototype: 'focus',
      subject: p.subject,
      title: `${p.subject === '국어' ? '안내를 읽고 한 걸음씩' : '생활 속 수와 한 걸음씩'}${complete ? '' : ' · 여기까지'}`,
      completedAt: new Date().toISOString(),
      questions: p.results,
      resumed: p.resumed,
      reflection,
      mode: 'prepared-demo',
    };
    try {
      onRecord?.(record);
      setProgress((s) => ({ ...s, stage: 'done', recorded: true }));
    } catch {
      submitted.current = false;
      setNotice('기록을 전달하지 못했어요. 다시 저장할 수 있어요. 학습 내용은 그대로 있어요.');
    }
  }
  function reset() {
    window.speechSynthesis?.cancel();
    submitted.current = false;
    setProgress(emptyProgress());
  }
  const className = `focus-proto ${settings.largeText ? 'focus-large' : ''}`;

  return (
    <section className={className} aria-label="한 걸음 교실">
      <div className="focus-topline">
        <span className="focus-kicker">
          <span className="focus-mark">
            <Bookmark size={15} />
          </span>{' '}
          한 걸음 교실
        </span>
        <span className="focus-topic-tag">내 속도로, 한 가지씩</span>
      </div>
      {!storageOk && (
        <div className="focus-storage-warning" role="status">
          이 기기에서 이어하기 저장을 사용할 수 없어요. 화면을 닫기 전에 지금까지 기록을 남겨
          주세요.
        </div>
      )}

      {p.stage === 'setup' && (
        <div className="focus-setup-grid">
          <div className="focus-setup-main">
            <div className="focus-intro">
              <span className="focus-overline">작게 정하고, 편하게 시작해요</span>
              <h1 tabIndex="-1" ref={heading}>
                오늘은 어떤 한 걸음을
                <br />
                내디뎌 볼까요?
              </h1>
              <p>
                할 만큼 골라요. 중간에 쉬어도
                <br className="focus-mobile-break" /> 하던 곳에서 이어갈 수 있어요.
              </p>
            </div>
            <fieldset className="focus-goals">
              <legend>
                <span>01</span> 오늘 연습할 것을 골라요
              </legend>
              {[
                ['국어', '안내를 읽고 움직여요', '준비물과 할 일의 순서를 찾아요.'],
                ['수학', '생활 속 수를 살펴요', '개수, 가격, 시각을 확인해요.'],
              ].map(([subject, title, desc]) => (
                <button
                  type="button"
                  className={`focus-goal ${p.subject === subject ? 'is-selected' : ''}`}
                  aria-pressed={p.subject === subject}
                  key={subject}
                  onClick={() => setProgress((s) => ({ ...s, subject }))}
                >
                  <span className="focus-subject-icon">
                    {subject === '국어' ? (
                      <Bookmark size={23} />
                    ) : (
                      <span className="focus-math-symbol">＋</span>
                    )}
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{desc}</small>
                  </span>
                  <span className="focus-radio">{p.subject === subject && <span />}</span>
                </button>
              ))}
            </fieldset>
            <fieldset className="focus-count">
              <legend>
                <span>02</span> 오늘 할 만큼 정해요
              </legend>
              <div>
                {[3, 5].map((n) => (
                  <button
                    type="button"
                    className={p.count === n ? 'is-selected' : ''}
                    aria-pressed={p.count === n}
                    onClick={() => setProgress((s) => ({ ...s, count: n }))}
                    key={n}
                  >
                    <strong>{n}개 활동</strong>
                    <small>{n === 3 ? '작게 시작하기' : '조금 더 해보기'}</small>
                    {p.count === n && <Check size={18} />}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="focus-feeling">
              <legend>
                지금 시작할 준비는 어떤가요? <small>선택하지 않아도 돼요</small>
              </legend>
              <div>
                {['편안하게 시작해요', '천천히 해볼래요', '조금 벅차요'].map((t) => (
                  <button
                    type="button"
                    aria-pressed={p.feeling === t}
                    className={p.feeling === t ? 'is-selected' : ''}
                    onClick={() =>
                      setProgress((s) => ({ ...s, feeling: s.feeling === t ? '' : t }))
                    }
                    key={t}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>
            <button className="focus-btn focus-primary focus-start" onClick={start}>
              첫 안내 열기 <ArrowRight size={19} />
            </button>
          </div>
          <aside className="focus-plan">
            <span className="focus-plan-label">TODAY’S LITTLE PLAN</span>
            <PaperArt />
            <h2>
              거창한 계획 대신,
              <br />
              나에게 맞는 한 걸음.
            </h2>
            <div className="focus-plan-line">
              <span>
                <Check size={16} />
              </span>
              <p>{p.subject === '국어' ? '짧은 안내 읽기' : '생활 속 숫자 살피기'}</p>
            </div>
            <div className="focus-plan-line">
              <span>
                <span className="focus-tiny-dot" />
              </span>
              <p>{p.count}개만 차근차근 해보기</p>
            </div>
            <div className="focus-plan-line">
              <span>
                <Coffee size={15} />
              </span>
              <p>필요하면 쉬었다 돌아오기</p>
            </div>
            <div className="focus-plan-foot">
              <Bookmark size={15} /> 하던 곳을 기억해 둘게요.
            </div>
          </aside>
        </div>
      )}

      {p.stage === 'learn' && (
        <div className="focus-learning-grid">
          <aside className="focus-path">
            <span className="focus-overline">오늘의 작은 계획</span>
            <h2>{p.subject === '국어' ? '안내를 읽고\n움직여요' : '생활 속 수를\n살펴요'}</h2>
            <div className="focus-path-track">
              {tasks.map((t, i) => (
                <div
                  key={t.id}
                  className={`focus-path-item ${i === p.index ? 'is-current' : ''} ${p.results[i]?.correct ? 'is-done' : ''}`}
                >
                  <span>{p.results[i]?.correct ? <Check size={14} /> : i + 1}</span>
                  <p>
                    {t.label}
                    <small>
                      {p.results[i]?.correct
                        ? '해냈어요'
                        : i === p.index
                          ? '지금 하는 활동'
                          : '다음에 해요'}
                    </small>
                  </p>
                </div>
              ))}
            </div>
            <p className="focus-path-saved">
              <Bookmark size={14} /> 진행한 곳은 자동으로 저장해요.
            </p>
          </aside>
          <div className="focus-work">
            <div className="focus-work-top">
              <span>
                {p.index + 1} / {tasks.length} 활동
              </span>
              <button
                type="button"
                onClick={() => {
                  window.speechSynthesis?.cancel();
                  setProgress((s) => ({ ...s, stage: 'pause' }));
                }}
              >
                <Coffee size={17} /> 잠깐 쉬기
              </button>
            </div>
            <div
              className="focus-progress"
              role="progressbar"
              aria-label="오늘 활동 진행"
              aria-valuemin={0}
              aria-valuemax={tasks.length}
              aria-valuenow={solved}
              aria-valuetext={`${tasks.length}개 중 ${solved}개 완료`}
            >
              <span style={{ width: `${(solved / tasks.length) * 100}%` }} />
            </div>
            <div className="focus-question-card">
              <span className="focus-overline">
                {p.step === 'read' ? '지금 할 일 · 안내 읽기' : '지금 할 일 · 하나 고르기'}
              </span>
              <h1 tabIndex="-1" ref={heading}>
                {p.step === 'read' ? q.label : q.prompt}
              </h1>
              <div className="focus-note">
                <span className="focus-note-label">
                  <Bookmark size={15} /> {p.subject === '국어' ? '오늘의 안내' : '함께 살펴봐요'}
                </span>
                <p>{p.short ? q.short : q.context}</p>
              </div>
              <div className="focus-access">
                <button type="button" onClick={read}>
                  <Volume2 size={17} /> 읽어주기
                </button>
                <button
                  type="button"
                  aria-pressed={p.short}
                  onClick={() => {
                    if (!p.short) support('지시를 짧게 보기');
                    setProgress((s) => ({ ...s, short: !s.short }));
                  }}
                >
                  <span className="focus-short-icon" aria-hidden="true">
                    Aa
                  </span>{' '}
                  {p.short ? '원래 안내 보기' : '지시를 짧게 보기'}
                </button>
              </div>
              {p.step === 'read' ? (
                <div className="focus-first-action">
                  <p>안내를 확인했으면, 다음에서 하나 골라요.</p>
                  <button
                    className="focus-btn focus-primary"
                    onClick={() => setProgress((s) => ({ ...s, step: 'answer' }))}
                  >
                    읽었어요. 골라 볼게요 <ArrowRight size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="focus-options" role="group" aria-label="답 고르기">
                    {q.options.map((option, i) => (
                      <button
                        type="button"
                        key={option}
                        disabled={current.correct}
                        aria-pressed={p.selected === i}
                        className={`${p.selected === i ? 'is-selected' : ''} ${current.correct && i === q.answer ? 'is-correct' : ''}`}
                        onClick={() => setProgress((s) => ({ ...s, selected: i, feedback: null }))}
                      >
                        <span className="focus-option-letter" aria-hidden="true">
                          {['가', '나', '다'][i]}
                        </span>
                        <span>{option}</span>
                        {p.selected === i &&
                          (current.correct ? (
                            <CheckCircle2 size={22} />
                          ) : (
                            <span className="focus-selected-dot" />
                          ))}
                      </button>
                    ))}
                  </div>
                  <div className="focus-feedback" aria-live="polite">
                    {p.feedback === 'correct' && (
                      <div className="focus-good">
                        <CheckCircle2 size={21} />
                        <div>
                          <strong>잘 찾았어요.</strong>
                          <p>{q.explanation}</p>
                        </div>
                      </div>
                    )}
                    {p.feedback === 'retry' && (
                      <div className="focus-retry">
                        <RotateCcw size={20} />
                        <div>
                          <strong>안내를 한 번 더 살펴봐요.</strong>
                          <p>
                            {p.subject === '국어'
                              ? '질문에 필요한 말부터 찾고, 다시 하나 골라요.'
                              : '주어진 수를 다시 확인하고, 하나 골라요.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {!current.correct && (
                    <div className="focus-help">
                      <p>막히면 도움을 골라도 괜찮아요.</p>
                      <div>
                        <button
                          type="button"
                          aria-expanded={p.shownHint}
                          onClick={() => hint('hint')}
                        >
                          <Lightbulb size={17} /> 한 걸음 도움
                        </button>
                        <button
                          type="button"
                          aria-expanded={p.shownExample}
                          onClick={() => hint('example')}
                        >
                          <Bookmark size={17} /> 다른 예시 보기
                        </button>
                      </div>
                      {p.shownHint && (
                        <div className="focus-help-content">
                          <strong>먼저 이렇게 해봐요</strong>
                          <p>{q.hint}</p>
                        </div>
                      )}
                      {p.shownExample && (
                        <div className="focus-help-content">
                          <strong>다른 상황으로 살펴봐요</strong>
                          <p>{q.example}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    className="focus-btn focus-primary focus-submit"
                    disabled={!current.correct && p.selected === null}
                    onClick={current.correct ? next : answer}
                  >
                    {current.correct
                      ? p.index === tasks.length - 1
                        ? '오늘 활동 돌아보기'
                        : '다음 안내 열기'
                      : '고른 답 확인하기'}
                    <ArrowRight size={18} />
                  </button>
                </>
              )}
            </div>
            <button
              className="focus-end-early"
              type="button"
              onClick={() => {
                window.speechSynthesis?.cancel();
                setProgress((s) => ({ ...s, stage: 'finish' }));
              }}
            >
              오늘은 여기까지 하고 기록 남기기 <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {(p.stage === 'pause' || p.stage === 'resume') && (
        <div className="focus-rest">
          <div className="focus-rest-art">
            <PaperArt compact />
          </div>
          <span className="focus-overline">
            {p.stage === 'pause' ? '쉬는 시간' : '다시 돌아온 나를 위해'}
          </span>
          <h1 ref={heading} tabIndex="-1">
            {p.stage === 'pause' ? '잠깐 멈춰도 괜찮아요.' : '하던 곳을 함께 살펴봐요.'}
          </h1>
          <p className="focus-rest-desc">
            {p.stage === 'pause'
              ? '얼마나 쉴지는 내가 정해요. 준비되면 돌아와요.'
              : '처음부터 하지 않아도 돼요. 다음 한 걸음부터 이어가요.'}
          </p>
          <div className="focus-resume-note">
            <div>
              <span>나의 목표</span>
              <strong>
                {p.subject === '국어' ? '안내를 읽고 움직이기' : '생활 속 수 살펴보기'} ·{' '}
                {tasks.length}개
              </strong>
            </div>
            <div>
              <span>해낸 것</span>
              <strong>
                {solved === 0
                  ? '첫 안내를 살펴보고 있어요.'
                  : `${tasks.length}개 중 ${solved}개 활동을 마쳤어요.`}
              </strong>
            </div>
            <div>
              <span>다음 한 걸음</span>
              <strong>
                {current.correct
                  ? p.index === tasks.length - 1
                    ? '오늘 활동 돌아보기'
                    : '다음 안내 열기'
                  : `${q.label} · ${p.step === 'read' ? '안내 읽기' : '답 하나 고르기'}`}
              </strong>
            </div>
          </div>
          <div className="focus-rest-actions">
            {p.stage === 'pause' ? (
              <button className="focus-btn focus-primary" onClick={resume}>
                준비됐어요. 다시 살펴볼게요 <ArrowRight size={18} />
              </button>
            ) : (
              <button
                className="focus-btn focus-primary"
                onClick={() => setProgress((s) => ({ ...s, stage: 'learn' }))}
              >
                이 한 걸음부터 이어하기 <ArrowRight size={18} />
              </button>
            )}
            <button className="focus-btn focus-secondary" onClick={onHome}>
              <ArrowLeft size={17} /> 비교 화면으로
            </button>
            <button
              className="focus-text-btn"
              onClick={() => setProgress((s) => ({ ...s, stage: 'finish' }))}
            >
              오늘은 여기까지 기록하기
            </button>
          </div>
        </div>
      )}

      {(p.stage === 'finish' || p.stage === 'done') && (
        <div className="focus-finish">
          <span className="focus-finish-icon">
            <CheckCircle2 size={34} />
          </span>
          <span className="focus-overline">오늘 내가 내디딘 한 걸음</span>
          <h1 ref={heading} tabIndex="-1">
            {p.stage === 'done'
              ? '오늘의 기록을 남겼어요.'
              : solved === tasks.length
                ? '내가 정한 활동을 마쳤어요.'
                : '오늘은 여기까지 했어요.'}
          </h1>
          <p>
            {p.stage === 'done'
              ? '부모 기록에서 연습한 내용과 사용한 도움을 볼 수 있어요.'
              : '끝까지 하지 못한 활동도 그대로 기록해요.'}
          </p>
          <div className="focus-summary">
            <div>
              <span>내가 고른 목표</span>
              <strong>
                {p.subject === '국어' ? '안내를 읽고 움직이기' : '생활 속 수 살펴보기'}
              </strong>
            </div>
            <div className="focus-summary-numbers">
              <span>
                <strong>
                  {solved}
                  <small> / {tasks.length}</small>
                </strong>
                완료한 활동
              </span>
              <span>
                <strong>{p.resumed}</strong>돌아와 이어한 횟수
              </span>
            </div>
            <div className="focus-summary-foot">
              <Bookmark size={16} />
              <span>
                {answered}개 문항에 답했어요. 읽어주기와 짧은 지시는 정답 힌트와 따로 기록해요.
              </span>
            </div>
          </div>
          {p.stage === 'finish' && (
            <>
              <fieldset className="focus-reflection">
                <legend>
                  다음에는 어떻게 해볼까요? <small>선택하지 않아도 돼요</small>
                </legend>
                {['오늘만큼 해볼래요', '더 작은 묶음으로 할래요', '안내를 들으며 할래요'].map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={p.reflection === t}
                      className={p.reflection === t ? 'is-selected' : ''}
                      onClick={() =>
                        setProgress((s) => ({ ...s, reflection: s.reflection === t ? '' : t }))
                      }
                    >
                      {t}
                      {p.reflection === t && <Check size={17} />}
                    </button>
                  ),
                )}
              </fieldset>
              <button className="focus-btn focus-primary" onClick={saveRecord}>
                이대로 기록 남기기 <Check size={18} />
              </button>
            </>
          )}
          {p.stage === 'done' && (
            <div className="focus-done-actions">
              <button className="focus-btn focus-primary" onClick={onHome}>
                다른 교실 살펴보기 <ArrowRight size={18} />
              </button>
              <button className="focus-btn focus-secondary" onClick={reset}>
                새 활동 고르기
              </button>
            </div>
          )}
        </div>
      )}
      {notice && (
        <div className="focus-notice" role="status">
          {notice}
        </div>
      )}
      <div className="focus-bottom-note">
        <Bookmark size={14} />
        <span>한 번에 한 가지씩. 필요할 때 도움을 선택해요.</span>
      </div>
    </section>
  );
}
