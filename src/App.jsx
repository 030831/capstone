import React, { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Sprout,
  SlidersHorizontal,
  X,
  Check,
  Layers3,
  Shapes,
  Compass,
  ShieldCheck,
  Leaf,
  NotebookPen,
  Scale,
  Image,
  PenLine,
} from 'lucide-react';
import DesignApp from './design/DesignApp';
import { usePersistentState } from './lib/storage';
import './design/design.css';

const README_URL = 'https://github.com/030831/capstone#readme';

const FLOW = [
  {
    title: '목표·목적 정하기',
    desc: '행동 · 조건 · 기준 · 내용 범위와 활동 목적(연습/평가)을 적습니다.',
  },
  { title: '구성 예시 고르기', desc: '목표에 맞는 예시와 선택 이유를 보고 공통 설정을 고릅니다.' },
  { title: '제시·응답·지원 조절', desc: '공통 설정을 다듬고, 필요한 학생에게만 변형을 만듭니다.' },
  {
    title: '검토 안내 확인',
    desc: '목표나 수행 조건에 영향을 줄 수 있는 변경을 이유와 함께 봅니다.',
  },
  { title: '미리보기·출력', desc: '같은 데이터에서 버전별 활동지를 그리고 비교 · 인쇄합니다.' },
];

const cards = [
  {
    id: 'design',
    letter: 'A',
    name: '두 집합의 수량 비교',
    tag: '설계 체험',
    desc: '더 많은 쪽 고르기, 몇 개 더 많은지 구하기. 목표를 정하고 학생별 활동지까지 만들어 봅니다.',
    color: 'sage',
    icon: Shapes,
    subject: '수학 · 수와 연산',
    action: '자료 설계 시작하기',
    route: 'design',
  },
  {
    id: 'addition',
    letter: 'B',
    name: '10 이내 덧셈',
    tag: '설계 체험',
    desc: '같은 구조로 덧셈 활동자료를 설계하는 화면을 준비하고 있습니다.',
    color: 'lavender',
    icon: Layers3,
    subject: '수학 · 덧셈',
    action: '준비 중',
    route: null,
  },
  {
    id: 'about',
    letter: 'C',
    name: '프로젝트 방향과 할 일',
    tag: '프로젝트',
    desc: '왜 이 도구를 만드는지, 도구와 교사의 역할, 아직 확인하지 못한 가설과 다음 할 일.',
    color: 'peach',
    icon: Compass,
    subject: '졸업작품 · 캡스톤디자인',
    action: '프로젝트 보기',
    route: 'about',
  },
];

function getRoute() {
  const r = window.location.hash.replace(/^#\/?/, '');
  return ['design', 'about'].includes(r) ? r : 'home';
}
function App() {
  const [route, setRoute] = useState(getRoute);
  const [settings, setSettings] = usePersistentState('settings', { largeText: false, quiet: true });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  useEffect(() => {
    const change = () => {
      setRoute(getRoute());
      window.scrollTo(0, 0);
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
    const failed = () => setStorageWarning(true);
    window.addEventListener('neulbom-storage-error', failed);
    return () => window.removeEventListener('neulbom-storage-error', failed);
  }, []);
  const go = (r) => {
    window.location.hash = r === 'home' ? '/' : `/${r}`;
    setSettingsOpen(false);
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
              늘봄<small>같은 목표, 서로 다른 자료</small>
            </span>
          </button>
          <nav className="main-nav" aria-label="주 메뉴">
            <a href="#/design" className={route === 'design' ? 'active' : ''}>
              자료 설계
            </a>
            <a href="#/about" className={route === 'about' ? 'active' : ''}>
              프로젝트
            </a>
            <a href="#/" className={route === 'home' ? 'active' : ''}>
              홈
            </a>
          </nav>
          <div className="header-actions">
            <span className="demo-badge">
              <span />
              프로토타입 · 가상 사례
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
          이 브라우저에서는 설계 내용을 저장할 수 없어요. 창을 닫으면 작업한 내용이 사라질 수
          있습니다.
        </p>
      )}
      <main id="main" tabIndex={-1}>
        {route === 'home' && <Home go={go} />}
        {route === 'design' && <DesignApp />}
        {route === 'about' && <About go={go} />}
      </main>
      <footer className="site-footer">
        <span>
          <Sprout size={16} />
          늘봄 <span className="footer-dot">·</span> 같은 목표를 향해, 학생마다 다른 자료를.
        </span>
        <span>
          프로토타입 <span className="footer-dot">·</span> 가상 사례{' '}
          <span className="footer-dot">·</span> 이 브라우저에만 저장{' '}
          <span className="footer-dot">·</span> 학생 실명 없음 <span className="footer-dot">·</span>{' '}
          AI 미사용
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
function Home({ go }) {
  return (
    <div className="home-page page-width">
      <section className="home-hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-line" /> SAME GOAL, DIFFERENT SUPPORT
          </div>
          <h1>
            같은 목표를 향해,
            <br />
            <span>학생마다 다른 자료를.</span>
          </h1>
          <p>
            학습목표와 활동 목적을 정하면, 제시·응답·지원 방식을 조절해 학생별 활동자료를 만듭니다.
            <br />
            검토할 지점은 도구가 알려 주고, 판단은 교사가 합니다.
          </p>
          <div className="hero-note">
            <span className="note-icon">
              <Leaf size={17} />
            </span>
            특수학급 교사를 위한 활동자료 설계 도구 · 졸업작품 프로토타입
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
                자료 설계 흐름<small>다섯 단계, 판단은 교사가</small>
              </span>
              <span className="paper-sun">✳</span>
            </div>
            <div className="paper-line done">
              <span>
                <Check size={15} />
              </span>
              {FLOW[0].title}
            </div>
            <div className="paper-line current">
              <span>2</span>
              {FLOW[1].title}
              <div className="line-underline" />
            </div>
            {FLOW.slice(2).map((f, i) => (
              <div className="paper-line" key={f.title}>
                <span>{i + 3}</span>
                {f.title}
              </div>
            ))}
            <div className="paper-bottom">
              <span>검토 안내는 판정이 아니에요</span>
              <NotebookPen size={16} />
            </div>
          </div>
          <div className="floating-note">
            <span>공통 · 학생 ㄱ · ㄴ · ㄷ</span>
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
            <span className="eyebrow">TRY THE AUTHORING FLOW</span>
            <h2 id="choose-title">어떤 자료를 설계해 볼까요?</h2>
          </div>
          <p>같은 목표, 서로 다른 자료.</p>
        </div>
        <div className="prototype-grid">
          {cards.map((p) => (
            <article
              key={p.id}
              className={`prototype-card ${p.color} ${p.route ? '' : 'is-pending'}`}
            >
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
                <button
                  className="card-start"
                  onClick={() => p.route && go(p.route)}
                  disabled={!p.route}
                >
                  {p.action}
                  <ArrowUpRight size={19} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="parent-invitation">
        <div className="parent-illustration">
          <Scale size={27} />
        </div>
        <div>
          <span className="eyebrow">FOR TEACHERS</span>
          <h3>도구는 검토할 지점을, 결정은 교사가.</h3>
          <p>
            지원을 넣거나 수 범위를 바꾸면 목표나 활동 목적과 어긋날 수 있습니다. 도구는 그 관계를
            이유와 함께 알려 주고, 의도한 변경이라면 기록으로 남깁니다.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => go('design')}>
          자료 설계 시작
          <ArrowRight size={17} />
        </button>
      </section>
      <div className="home-bottom-note">
        <ShieldCheck size={17} />
        <span>
          가상 사례로 구성한 졸업작품 프로토타입입니다. 학생 실명 · 진단 · 점수를 다루지 않으며,
          AI를 사용하지 않습니다.
        </span>
      </div>
    </div>
  );
}
function Preview({ type }) {
  if (type === 'design')
    return (
      <div className="card-preview preview-compare" aria-hidden="true">
        <div className="mini-compare">
          <div>
            <b>가</b>
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <div>
            <b>나</b>
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} className={i < 3 ? 'gold' : 'empty'} />
            ))}
          </div>
        </div>
        <div className="mini-versions">
          <span>공통</span>
          <span>학생 ㄱ</span>
          <span>학생 ㄴ</span>
        </div>
      </div>
    );
  if (type === 'addition')
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
            <Image size={13} />
            그림 제시
          </span>
          <span>
            <PenLine size={13} />
            부분 완성
          </span>
        </div>
      </div>
    );
  return (
    <div className="card-preview preview-axes" aria-hidden="true">
      <div className="mini-axes">
        <span>자료의 다섯 축</span>
        {['목표', '활동 목적', '제시 방식', '응답 방식', '지원 조건'].map((t, i) => (
          <div key={t}>
            <i>{i + 1}</i>
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}
const AXES_TABLE = [
  [
    '목표',
    '행동 · 조건 · 기준 · 내용 범위로 나누어 저장',
    '수 범위 1–5에서 혼자서 더 많은 쪽을 고른다 (5문항 중 4문항)',
  ],
  ['활동 목적', '연습 또는 평가(현재 수행 확인)', '평가'],
  [
    '제시 방식',
    '과제를 어떻게 보여 주는지',
    '그림만 / 그림과 숫자 / 숫자만, 지시문 길이, 한 줄 정렬',
  ],
  ['응답 방식', '학생이 어떻게 답하는지', '가리키기·선택 / 비교 기호 쓰기 / 수 쓰기'],
  [
    '지원 조건',
    '자료 안에 어떤 도움이 들어 있는지',
    '없음 / 시각 단서 / 부분 완성 / 예시 문항 먼저 보여주기',
  ],
];
const HYPOTHESES = [
  '교사는 같은 목표를 두고 학생별 자료를 따로 만드는 데 시간을 많이 쓴다.',
  '자료를 고치다 보면 목표나 수행 조건이 의도와 다르게 바뀌는 일이 생긴다.',
  '목표와 목적을 먼저 구조화해 두면, 변경의 영향을 설명하는 안내가 교사에게 도움이 된다.',
  '검토 안내가 너무 많지 않으면 교사가 귀찮게 여기지 않고 확인한다.',
  '검토된 구성 예시가 처음 설계의 부담을 줄인다.',
];
function About({ go }) {
  return (
    <div className="about-page page-width">
      <div className="page-heading">
        <span className="eyebrow">PROJECT DIRECTION</span>
        <h1>
          자료를 대신 만드는 도구가 아니라,
          <br />
          교사의 설계를 돕는 도구.
        </h1>
        <p>
          교사가 학습목표와 활동 목적을 정하고, 제시·응답·지원 방식을 조합해 학생별 활동자료를
          설계합니다. 도구는 구성 예시와 선택 이유를 제공하고, 편집 중 목표나 수행 조건에 영향을 줄
          수 있는 변경을 설명합니다. 최종 판단은 교사가 합니다.
        </p>
      </div>
      <div className="about-principle">
        <Compass size={32} />
        <div>
          <h2>문제 인식 — 아직 확인 중인 가설입니다.</h2>
          <p>
            특수학급에서는 같은 학습목표를 두고도 학생마다 제시 방식, 응답 방식, 필요한 도움이
            다릅니다. 교사가 자료를 학생별로 고치는 과정에서 목표의 조건이나 범위가 의도와 다르게
            바뀔 수 있다고 보았습니다. 이 문제 인식은 아직 교사 인터뷰로 확인하지 않은 가설입니다.
          </p>
        </div>
      </div>
      <section className="about-section">
        <h2>확정된 방향</h2>
        <p>
          학생용 학습 앱 대신, 교사용 활동자료 설계 도구를 만듭니다. 모든 활동자료는 한 덩어리
          문서가 아니라 목표 · 활동 목적 · 제시 · 응답 · 지원의 다섯 축으로 저장되고, 학생별 변형은
          공통 설정에서 무엇을 왜 바꿨는지를 함께 남깁니다. 규칙은 정답을 내리지 않고, 선언한 목표와
          변경 사이의 관계를 이유와 함께 검토 안내로 보여 줍니다. 이번 시제품은 「두 집합의 수량
          비교」 한 유형을 처음부터 끝까지 구현합니다.
        </p>
      </section>
      <section className="about-section">
        <h2>사용 흐름</h2>
        <ol className="about-flow">
          {FLOW.map((f, i) => (
            <li key={f.title}>
              <span
                className={`about-number ${['sage', 'lavender', 'peach', 'sage', 'lavender'][i]}`}
              >
                {i + 1}
              </span>
              <strong>{f.title}</strong>
              {f.desc}
            </li>
          ))}
        </ol>
      </section>
      <section className="about-section">
        <h2>자료의 다섯 축</h2>
        <div className="table-scroll">
          <table className="about-axes">
            <thead>
              <tr>
                <th scope="col">축</th>
                <th scope="col">저장하는 것</th>
                <th scope="col">수량 비교 활동의 예</th>
              </tr>
            </thead>
            <tbody>
              {AXES_TABLE.map(([a, b, c]) => (
                <tr key={a}>
                  <th scope="row">{a}</th>
                  <td>{b}</td>
                  <td>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="about-section">
        <h2>도구의 역할과 교사의 역할</h2>
        <div className="about-cards about-two">
          <article>
            <span className="about-number sage">도구</span>
            <h2>구조를 잡고, 관계를 설명합니다.</h2>
            <p>
              목표와 자료를 다섯 축으로 구조화하고, 목표에 맞는 구성 예시와 선택 이유를 보여 줍니다.
              변경이 목표나 수행 조건에 영향을 줄 수 있으면 확인 필요 · 참고로 나누어 알려 줍니다.
              좋은 문제인지 판단하지 않습니다.
            </p>
          </article>
          <article>
            <span className="about-number peach">교사</span>
            <h2>목표를 정하고, 최종 판단을 합니다.</h2>
            <p>
              학생을 알고 있는 사람은 교사입니다. 목표와 목적을 정하고, 예시를 고르고, 학생별로
              조절합니다. 검토 안내를 받아들일지, 의도한 변경으로 기록할지 교사가 정합니다.
            </p>
          </article>
        </div>
      </section>
      <section className="about-section">
        <h2>졸업작품의 기여</h2>
        <div className="about-cards">
          {[
            [
              'sage',
              '설계',
              '활동자료를 목표 · 목적 · 제시 · 응답 · 지원의 다섯 축으로 나누는 데이터 모델과, 목표와 변경의 관계로 정의한 검토 규칙표.',
            ],
            [
              'lavender',
              '구현',
              '하나의 활동 유형을 목표 설정부터 학생별 변형, 검토 안내, 활동지 출력까지 이어지는 웹 시제품으로 구현.',
            ],
            [
              'peach',
              '평가',
              '특수교사와 함께 사용 사례를 검토하고, 검토 안내가 실제 판단에 도움이 되는지와 안내 피로를 확인.',
            ],
          ].map(([color, title, text]) => (
            <article key={title}>
              <span className={`about-number ${color}`}>{title.slice(0, 1)}</span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="research-note">
        <h2>아직 검증되지 않은 가설</h2>
        <ul className="about-list">
          {HYPOTHESES.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <div className="source-links">
          <a href={README_URL} target="_blank" rel="noreferrer">
            GitHub README · 프로젝트 문서
            <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="prototype-limit">
          <strong>다음 할 일</strong>
          <ul className="about-list">
            <li>특수교사 인터뷰로 문제 인식과 사용 흐름 확인</li>
            <li>「두 집합의 수량 비교」 사용 사례 1쪽 작성 (가상 학생 기준)</li>
            <li>검토 규칙표를 교사 의견으로 보완하고, 두 번째 활동 유형(10 이내 덧셈) 설계</li>
          </ul>
          <p>
            지금 작동하는 범위: 한 가지 활동 유형, 미리 준비한 구성 예시, 규칙 기반 검토 안내, 이
            브라우저에만 저장되는 설계 내용과 인쇄. AI · 학생 계정 · 기기 간 공유는 없습니다.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => go('design')}>
          자료 설계 체험하기
          <ArrowRight size={17} />
        </button>
      </section>
    </div>
  );
}
function Settings({ settings, setSettings, close }) {
  return (
    <Modal title="나에게 편한 보기" close={close}>
      <p>자료 내용은 그대로, 화면을 보는 방법만 바꿔요.</p>
      <label className="setting-row">
        <span>
          <strong>글씨 크게 보기</strong>
          <small>화면의 글과 안내를 조금 더 크게 표시해요.</small>
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
