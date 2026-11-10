import React, { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Sprout,
  SlidersHorizontal,
  X,
  Check,
  BookOpen,
  Layers3,
  Store,
  RotateCcw,
  ChartNoAxesColumnIncreasing,
  Volume2,
  Pause,
  Play,
  CheckCheck,
  CircleHelp,
  Download,
  Trash2,
  ChevronRight,
  CircleCheck,
  NotebookPen,
  Leaf,
  Compass,
  ShieldCheck,
} from 'lucide-react';
import Focus from './prototypes/Focus';
import Bridge from './prototypes/Bridge';
import Life from './prototypes/Life';
import { usePersistentState, writeStored } from './lib/storage';
import { summarize } from './lib/metrics';

const prototypes = [
  {
    id: 'focus',
    letter: 'A',
    name: '한 걸음 교실',
    tag: '시작과 다시 돌아오기',
    desc: '오늘 할 만큼 고르고, 한 걸음씩. 잠깐 쉬어도 하던 곳으로 편하게 돌아와요.',
    color: 'lavender',
    icon: BookOpen,
    subject: '국어 · 활동 순서',
    focus: '학습을 이어가는 힘',
  },
  {
    id: 'bridge',
    letter: 'B',
    name: '도움 사다리',
    tag: '필요한 도움을 내가 선택',
    desc: '같은 문제도 나에게 맞는 방법으로. 도움받아 연습하고, 새로운 문제를 직접 풀어요.',
    color: 'sage',
    icon: Layers3,
    subject: '수학 · 덧셈',
    focus: '도움에서 독립적인 풀이로',
  },
  {
    id: 'life',
    letter: 'C',
    name: '생활 실험실',
    tag: '배운 것을 생활 속으로',
    desc: '문구점에서 준비물을 골라 볼까요? 읽고, 계산하고, 다른 상황에도 적용해 봐요.',
    color: 'peach',
    icon: Store,
    subject: '생활 · 국어 · 수학',
    focus: '문제 밖에서도 써 보는 배움',
  },
];
function getRoute() {
  const r = window.location.hash.replace(/^#\/?/, '');
  return ['focus', 'bridge', 'life', 'records', 'about'].includes(r) ? r : 'home';
}
function App() {
  const [route, setRoute] = useState(getRoute);
  const [settings, setSettings] = usePersistentState('settings', { largeText: false, quiet: true });
  const [records, setRecords] = usePersistentState('records', []);
  const safeRecords = Array.isArray(records)
    ? records.filter(
        (r) =>
          r &&
          typeof r === 'object' &&
          Array.isArray(r.questions) &&
          r.questions.every((q) => q && typeof q === 'object'),
      )
    : [];
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  useEffect(() => {
    const change = () => {
      setRoute(getRoute());
      window.scrollTo(0, 0);
      window.speechSynthesis?.cancel();
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.largeText = settings?.largeText ? 'true' : 'false';
    document.documentElement.dataset.quiet = settings?.quiet ? 'true' : 'false';
  }, [settings]);
  useEffect(() => {
    try {
      localStorage.setItem('neulbom:check', '1');
      localStorage.removeItem('neulbom:check');
    } catch {
      setStorageWarning(true);
    }
  }, []);
  const go = (r) => {
    window.location.hash = r === 'home' ? '/' : `/${r}`;
    setSettingsOpen(false);
  };
  useEffect(() => {
    const failed = () => setStorageWarning(true);
    window.addEventListener('neulbom-storage-error', failed);
    return () => window.removeEventListener('neulbom-storage-error', failed);
  }, []);
  const addRecord = (record) => {
    const next = [record, ...safeRecords.filter((r) => r.id !== record.id)].slice(0, 100);
    if (!writeStored('records', next)) {
      setStorageWarning(true);
      throw new Error('학습 기록을 이 기기에 저장하지 못했습니다.');
    }
    setRecords(next);
  };
  const current = prototypes.find((p) => p.id === route);
  const componentProps = {
    onRecord: addRecord,
    onHome: () => go('home'),
    settings: settings || { largeText: false, quiet: true },
  };
  return (
    <div className={`app route-${route}`}>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
          document.getElementById('main')?.scrollIntoView();
        }}
      >
        본문으로 바로가기
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" onClick={() => go('home')} aria-label="늘봄 처음 화면">
            <span className="brand-icon">
              <Sprout size={25} />
            </span>
            <span>
              늘봄<small>나에게 맞는 배움</small>
            </span>
          </button>
          <nav className="main-nav" aria-label="주 메뉴">
            <a href="#/" className={route === 'home' || current ? 'active' : ''}>
              배움 시작
            </a>
            <a href="#/records" className={route === 'records' ? 'active' : ''}>
              학습 기록
            </a>
            <a href="#/about" className={route === 'about' ? 'active' : ''}>
              세 가지 방향
            </a>
          </nav>
          <div className="header-actions">
            <span className="demo-badge">
              <span />
              체험판
            </span>
            <button
              className="settings-button"
              onClick={() => setSettingsOpen(true)}
              aria-label="보기 설정"
            >
              <SlidersHorizontal size={20} />
              <span>보기 설정</span>
            </button>
          </div>
        </div>
      </header>
      {storageWarning && (
        <p className="storage-warning" role="status">
          이 브라우저에서는 기록을 저장할 수 없어요. 창을 닫으면 체험 기록이 사라질 수 있습니다.
        </p>
      )}
      {current && (
        <div className="session-strip">
          <button onClick={() => go('home')}>
            <ArrowLeft size={16} />
            다른 배움 보기
          </button>
          <span>
            <i className={current.color}>{current.letter}</i>
            {current.name}
          </span>
          <button onClick={() => go('records')}>
            보호자 기록
            <ChevronRight size={15} />
          </button>
        </div>
      )}
      <main id="main" tabIndex={-1}>
        {route === 'home' && <Home go={go} records={safeRecords} />}
        {route === 'focus' && <Focus {...componentProps} />}
        {route === 'bridge' && <Bridge {...componentProps} />}
        {route === 'life' && <Life {...componentProps} />}
        {route === 'records' && (
          <Records records={safeRecords} clear={() => setRecords([])} go={go} />
        )}
        {route === 'about' && <About go={go} />}
      </main>
      <footer className="site-footer">
        <span>
          <Sprout size={16} />
          늘봄 <span className="footer-dot">·</span> 저마다의 속도로, 스스로의 힘으로.
        </span>
        <span>
          준비된 문제로 체험 중 <span className="footer-dot">·</span> AI API 미연결
        </span>
      </footer>
      {settingsOpen && (
        <Settings
          settings={settings || {}}
          setSettings={setSettings}
          close={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
function Home({ go, records }) {
  const summary = summarize(records);
  return (
    <div className="home-page page-width">
      <section className="home-hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-line" /> LEARNING, AT YOUR PACE
          </div>
          <h1>
            혼자 해내는 순간이
            <br />
            <span>조금씩 늘어나도록.</span>
          </h1>
          <p>
            어떤 도움이 나에게 맞을까요?
            <br />세 가지 배움 속에서 나만의 방법을 찾아보세요.
          </p>
          <div className="hero-note">
            <span className="note-icon">
              <Leaf size={17} />
            </span>
            잘하는 것부터, 오늘 할 수 있는 만큼.
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="hero-paper">
            <div className="paper-header">
              <span className="paper-mark">
                <Sprout size={23} />
              </span>
              <span>
                오늘의 작은 배움<small>한 번에 한 걸음</small>
              </span>
              <span className="paper-sun">✳</span>
            </div>
            <div className="paper-line done">
              <span>
                <Check size={15} />
              </span>
              내가 할 만큼 고르기
            </div>
            <div className="paper-line current">
              <span>2</span>필요한 도움 찾기
              <div className="line-underline" />
            </div>
            <div className="paper-line">
              <span>3</span>내 힘으로 다시 해보기
            </div>
            <div className="paper-bottom">
              <span>조금 쉬었다 와도 괜찮아요</span>
              <Pause size={16} />
            </div>
          </div>
          <div className="floating-note">
            <span>나의 배움, 나의 속도</span>
            <div>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <span className="art-spark spark-one">✧</span>
          <span className="art-spark spark-two">✦</span>
        </div>
      </section>
      <section className="prototype-section" aria-labelledby="choose-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIND YOUR WAY</span>
            <h2 id="choose-title">오늘은 어떻게 배워볼까요?</h2>
          </div>
          <p>같은 목표, 서로 다른 도움.</p>
        </div>
        <div className="prototype-grid">
          {prototypes.map((p) => (
            <article key={p.id} className={`prototype-card ${p.color}`}>
              <div className="card-top">
                <span className="card-letter">{p.letter}</span>
                <span className="card-tag">{p.tag}</span>
                <p.icon size={19} />
              </div>
              <Preview type={p.id} />
              <div className="card-copy">
                <span className="card-subject">{p.subject}</span>
                <h3>{p.name}</h3>
                <p>{p.desc}</p>
                <button className="card-start" onClick={() => go(p.id)}>
                  {p.id === 'focus'
                    ? '한 걸음 시작하기'
                    : p.id === 'bridge'
                      ? '나에게 맞는 도움 찾기'
                      : '문구점에 가 보기'}
                  <ArrowUpRight size={19} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="parent-invitation">
        <div className="parent-illustration">
          <ChartNoAxesColumnIncreasing size={27} />
        </div>
        <div>
          <span className="eyebrow">FOR PARENTS</span>
          <h3>몇 개를 맞혔는지, 그다음 이야기도.</h3>
          <p>
            {summary.sessions ? `이 기기에서 마친 ${summary.sessions}번의 배움이 있어요. ` : ''}혼자
            해낸 것과 도움받아 해낸 것을 함께 확인해요.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => go('records')}>
          학습 기록 보기
          <ArrowRight size={17} />
        </button>
      </section>
      <div className="home-bottom-note">
        <ShieldCheck size={17} />
        <span>
          특수학급의 다양한 학습·지원 필요를 고려한 시제품입니다. 학습효과나 진단을 제공하지
          않습니다.
        </span>
      </div>
    </div>
  );
}
function Preview({ type }) {
  if (type === 'focus')
    return (
      <div className="card-preview preview-focus" aria-hidden="true">
        <div className="mini-schedule">
          <span>나의 작은 계획</span>
          <div>
            <i>
              <Check size={12} />
            </i>
            <b>안내문 읽기</b>
          </div>
          <div className="now">
            <i>2</i>
            <b>준비물 찾기</b>
            <span>지금</span>
          </div>
          <div>
            <i>3</i>
            <b>직접 확인하기</b>
          </div>
        </div>
        <div className="mini-bookmark">
          <Pause size={15} />
          쉬었다 이어가기
        </div>
      </div>
    );
  if (type === 'bridge')
    return (
      <div className="card-preview preview-bridge" aria-hidden="true">
        <div className="mini-equation">
          7 <span>+</span> 5 <span>=</span> <i>?</i>
        </div>
        <div className="ten-frame">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={i < 7 ? 'filled' : ''} />
          ))}
        </div>
        <div className="mini-help">
          <span>
            <Volume2 size={13} />
            읽어주기
          </span>
          <span>
            <Layers3 size={13} />
            나누어 보기
          </span>
        </div>
      </div>
    );
  return (
    <div className="card-preview preview-life" aria-hidden="true">
      <div className="mini-shop-awning">
        {Array.from({ length: 7 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <div className="mini-shop-items">
        <div>
          <span className="draw-pencil" />
          <b>연필</b>
        </div>
        <div>
          <span className="draw-notebook" />
          <b>공책</b>
        </div>
        <div>
          <span className="draw-eraser" />
          <b>지우개</b>
        </div>
      </div>
      <div className="mini-receipt">
        <Check size={13} />
        준비물을 골라 보세요
      </div>
    </div>
  );
}
function Records({ records, clear, go }) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const filtered = records.filter((r) => filter === 'all' || r.prototype === filter);
  const s = summarize(filtered);
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), records }, null, 2)], {
        type: 'application/json',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = '늘봄-체험기록.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="records-page page-width">
      <div className="page-heading">
        <span className="eyebrow">THE STORY BEHIND LEARNING</span>
        <h1>배움의 과정도 함께 봐요.</h1>
        <p>정답 너머, 어떤 도움이 필요했는지 확인하는 보호자용 기록입니다.</p>
      </div>
      <div className="local-notice">
        <CircleHelp size={18} />
        <span>
          이 기기·브라우저에 저장된 체험 기록이에요. 실제 부모 계정 연결이나 다른 기기와의 동기화는
          제공하지 않습니다.
        </span>
      </div>
      <div className="record-filters" role="group" aria-label="학습 종류 필터">
        <button
          aria-pressed={filter === 'all'}
          onClick={() => {
            setFilter('all');
            setSelected(null);
          }}
        >
          모든 배움
        </button>
        {prototypes.map((p) => (
          <button
            key={p.id}
            aria-pressed={filter === p.id}
            onClick={() => {
              setFilter(p.id);
              setSelected(null);
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
      {!filtered.length ? (
        <div className="empty-state">
          <span>
            <NotebookPen size={38} />
          </span>
          <h2>아직 이곳에 담긴 배움이 없어요.</h2>
          <p>
            활동을 끝내면 첫 시도와 도움 사용 기록이 쌓여요.
            <br />
            가장 편한 배움부터 시작해 보세요.
          </p>
          <button className="btn btn-primary" onClick={() => go('home')}>
            배움 선택하기
            <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <Stat
              label="남긴 학습"
              value={s.sessions}
              suffix="회"
              detail="일부만 진행한 기록도 포함"
              icon={BookOpen}
            />
            <Stat
              label="첫 시도 정답"
              value={`${s.firstCorrect}/${s.answered}`}
              suffix="문항"
              detail="응답한 문항만 계산"
              icon={CheckCheck}
            />
            <Stat
              label="풀이 도움 사용"
              value={s.withHint}
              suffix="문항"
              detail="읽어주기와 보기 설정 제외"
              icon={Layers3}
            />
            <Stat
              label="첫 시도 정답률"
              value={s.accuracy ?? '—'}
              suffix={s.accuracy === null ? '' : '%'}
              detail="이 기록의 결과 · 능력 진단 아님"
              icon={ChartNoAxesColumnIncreasing}
            />
          </div>
          <div className="record-layout">
            <section className="record-history">
              <div className="section-heading">
                <h2>배움별 기록</h2>
                <span>{filtered.length}개의 이야기</span>
              </div>
              {filtered.map((r) => {
                const p = prototypes.find((p) => p.id === r.prototype) || prototypes[0];
                const a = summarize([r]);
                return (
                  <button
                    className={`history-row ${selected === r.id ? 'selected' : ''}`}
                    key={r.id}
                    onClick={() => setSelected(selected === r.id ? null : r.id)}
                    aria-expanded={selected === r.id}
                  >
                    <span className={`history-icon ${p.color}`}>
                      <p.icon size={22} />
                    </span>
                    <span className="history-copy">
                      <small>
                        {p.name} ·{' '}
                        {new Date(r.completedAt).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                        })}
                      </small>
                      <strong>{r.title}</strong>
                      <span>
                        첫 시도 {a.firstCorrect}/{a.answered} · 풀이 도움 {a.withHint}문항
                      </span>
                    </span>
                    <ChevronRight size={20} />
                  </button>
                );
              })}
            </section>
            <aside className="record-insight">
              <span className="insight-icon">
                <Leaf size={23} />
              </span>
              <h3>기록은 질문의 시작이에요.</h3>
              <p>
                힌트를 사용한 것은 실패가 아니에요. 어떤 도움이 있었는지, 새로운 문제에서는 어떻게
                했는지 함께 살펴보세요.
              </p>
              <div className="insight-rule" />
              <h4>이렇게 이야기해 보세요</h4>
              <p>
                “오늘 어떤 방법이 도움이 됐어?”
                <br />
                “다음에는 어떤 걸 직접 해볼까?”
              </p>
              <small>
                문항 수가 적거나 활동이 다르면 결과를 직접 비교하기 어려워요. 요약은 기록에 따른
                고정 문구입니다.
              </small>
            </aside>
          </div>
          {selected && filtered.find((r) => r.id === selected) && (
            <RecordDetails record={filtered.find((r) => r.id === selected)} />
          )}
        </>
      )}
      {records.length > 0 && (
        <div className="data-actions">
          <button className="btn btn-secondary" onClick={download}>
            <Download size={16} />
            기록 내려받기
          </button>
          <button className="btn btn-ghost" onClick={() => setConfirm(true)}>
            <Trash2 size={16} />
            완료 기록 비우기
          </button>
          <span>진행 중인 학습은 각 체험에서 다시 시작할 수 있어요.</span>
        </div>
      )}
      {confirm && (
        <Modal title="완료한 체험 기록을 지울까요?" close={() => setConfirm(false)}>
          <p>
            이 브라우저에 저장된 완료 기록 {records.length}개가 삭제됩니다. 진행 중인 학습은
            남습니다.
          </p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setConfirm(false)}>
              돌아가기
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                clear();
                setSelected(null);
                setConfirm(false);
              }}
            >
              기록 지우기
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Stat({ label, value, suffix, detail, icon: Icon }) {
  return (
    <article className="stat-card">
      <div>
        <span>{label}</span>
        <Icon size={19} />
      </div>
      <strong>
        {value}
        <small>{suffix}</small>
      </strong>
      <p>{detail}</p>
    </article>
  );
}
function RecordDetails({ record }) {
  return (
    <section className="record-details">
      <h2>{record.title} · 자세히 보기</h2>
      {record.reflection && (
        <p className="student-reflection">학습 돌아보기: {record.reflection}</p>
      )}
      {record.resumed > 0 && <p>쉬었다 이어간 횟수: {record.resumed}회</p>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>학습 내용</th>
              <th>첫 시도</th>
              <th>마지막 결과</th>
              <th>풀이 도움</th>
              <th>읽기·조작 지원</th>
            </tr>
          </thead>
          <tbody>
            {(record.questions || []).map((q, i) => (
              <tr key={q.id || i}>
                <td>{q.prompt}</td>
                <td>
                  {q.firstCorrect === true
                    ? '정답'
                    : q.firstCorrect === false
                      ? '다시 생각함'
                      : '미응답'}
                </td>
                <td>{q.correct ? '해결' : '미해결'}</td>
                <td>
                  {q.hints || 0}회
                  {q.supportKinds?.length > 0 && (
                    <small className="support-kind">{q.supportKinds.join(' · ')}</small>
                  )}
                </td>
                <td>{q.accessSupports?.length ? q.accessSupports.join(', ') : '사용 기록 없음'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        이 표는 체험 중 눌렀던 행동을 보여줍니다. 집중력, 장애 정도 또는 교과 전체의 숙달을 의미하지
        않습니다.
      </p>
    </section>
  );
}
function About({ go }) {
  return (
    <div className="about-page page-width">
      <div className="page-heading">
        <span className="eyebrow">THREE IDEAS, ONE PURPOSE</span>
        <h1>
          문제보다 먼저,
          <br />
          배우는 과정을 살펴봤어요.
        </h1>
        <p>
          AI 퀴즈를 더하는 것만으로 충분하지 않아서.
          <br />
          학생이 멈추는 순간과 다시 해내는 순간을 세 가지 방향으로 탐색합니다.
        </p>
      </div>
      <div className="about-principle">
        <Compass size={32} />
        <div>
          <h2>특수학급이라는 이름이, 하나의 수준을 뜻하지는 않으니까.</h2>
          <p>
            교과 수준과 필요한 도움을 구분합니다. 읽어주기는 유지하면서 풀이 도움을 줄일 수도 있고,
            쉬었다가 같은 목표로 돌아올 수도 있어요. 학생의 선택을 학습 과정에 남깁니다.
          </p>
        </div>
      </div>
      <div className="about-cards">
        {prototypes.map((p, i) => (
          <article key={p.id}>
            <span className={`about-number ${p.color}`}>{p.letter}</span>
            <h2>{p.focus}</h2>
            <p>
              {
                [
                  '시작할 행동을 작게 만들고, 중단 뒤에도 목표와 다음 행동을 다시 찾는 경험을 살펴봅니다.',
                  '도움을 받아 푼 결과와 새로운 문제를 직접 푼 결과를 나누어 봅니다. 도움 사용을 실패로 취급하지 않습니다.',
                  '교과에서 배운 읽기와 계산을 장보기 상황에 적용합니다. 물건과 숫자가 달라져도 사용할 수 있는지 탐색합니다.',
                ][i]
              }
            </p>
            <button onClick={() => go(p.id)}>
              {p.name} 체험
              <ArrowRight size={17} />
            </button>
          </article>
        ))}
      </div>
      <section className="research-note">
        <h2>조사에서 시제품으로</h2>
        <p>
          국내 특수교육 자료, 학습 서비스와 공개 문항 엔진을 참고했습니다. 아래 경험의 구성 요소는
          기존 서비스에도 있습니다. 세 안의 우월성이나 학습효과는 아직 검증되지 않았습니다.
        </p>
        <div className="source-links">
          <a
            href="https://www.nise.go.kr/boardCnts/list.do?boardID=355&m=010504"
            target="_blank"
            rel="noreferrer"
          >
            국립특수교육원 조사자료
            <ArrowUpRight size={16} />
          </a>
          <a href="https://github.com/CAHLR/OATutor" target="_blank" rel="noreferrer">
            OATutor · 공개 학습 엔진
            <ArrowUpRight size={16} />
          </a>
          <a href="https://www.w3.org/TR/coga-usable/" target="_blank" rel="noreferrer">
            W3C · 인지 접근성
            <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="prototype-limit">
          <strong>현재 체험할 수 있는 범위</strong>
          <p>
            미리 준비한 자체 문항, 단계별 도움, 기기 내 기록, 보호자용 결과 확인이 작동합니다.
            실시간 AI 생성·학생 인증·기기 간 기록 공유는 연결하지 않았습니다.
          </p>
        </div>
      </section>
    </div>
  );
}
function Settings({ settings, setSettings, close }) {
  return (
    <Modal title="나에게 편한 보기" close={close}>
      <p>공부하는 내용은 그대로, 보는 방법을 바꿔요.</p>
      <label className="setting-row">
        <span>
          <strong>글씨 크게 보기</strong>
          <small>문제와 안내를 조금 더 크게 표시해요.</small>
        </span>
        <input
          type="checkbox"
          checked={!!settings.largeText}
          onChange={(e) => setSettings((s) => ({ ...s, largeText: e.target.checked }))}
        />
      </label>
      <label className="setting-row">
        <span>
          <strong>차분한 화면</strong>
          <small>움직이는 효과를 줄여요.</small>
        </span>
        <input
          type="checkbox"
          checked={!!settings.quiet}
          onChange={(e) => setSettings((s) => ({ ...s, quiet: e.target.checked }))}
        />
      </label>
      <button className="btn btn-primary full-width" onClick={close}>
        이렇게 볼게요
        <Check size={18} />
      </button>
    </Modal>
  );
}
function Modal({ title, close, children }) {
  const ref = React.useRef(null);
  const previous = React.useRef(null);
  useEffect(() => {
    previous.current = document.activeElement;
    const dialog = ref.current;
    dialog?.focus();
    const key = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const nodes = dialog.querySelectorAll('button,input,a[href]');
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous.current?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="modal"
      >
        <button className="modal-close" aria-label="닫기" onClick={close}>
          <X size={22} />
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
export default App;
