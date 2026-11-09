import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  ClipboardList,
  Database,
  Layers3,
  ShieldCheck,
  SlidersHorizontal,
  Sprout,
  X,
} from 'lucide-react';
import Compare from './features/Compare';
import { usePersistentState } from './lib/storage';

function getRoute() {
  const r = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  return ['compare', 'compare/teacher'].includes(r) ? r : 'home';
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
  const inCompare = route !== 'home';

  return (
    <div className={`app route-${inCompare ? 'compare' : 'home'}`}>
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
          <button className="brand" onClick={() => go('home')}>
            <span className="brand-icon">
              <Sprout size={25} />
            </span>
            <span>
              늘봄<small>학생별 목표에 맞춘 반복학습</small>
            </span>
          </button>
          <nav className="main-nav" aria-label="주 메뉴">
            <a href="#/" className={!inCompare ? 'active' : ''}>
              처음
            </a>
            <a href="#/compare" className={inCompare ? 'active' : ''}>
              수량 비교
            </a>
          </nav>
          <div className="header-actions">
            <span className="demo-badge">
              <span />
              프로토타입
            </span>
            <button
              className="settings-button"
              onClick={() => setSettingsOpen(true)}
              aria-label="보기 설정"
            >
              <SlidersHorizontal size={19} />
            </button>
          </div>
        </div>
      </header>
      {storageWarning && (
        <p className="storage-warning" role="status">
          이 브라우저에서는 기록을 저장할 수 없어요. 창을 닫으면 기록이 사라질 수 있습니다.
        </p>
      )}
      <main id="main" tabIndex={-1}>
        {route === 'home' && <Home go={go} />}
        {inCompare && <Compare tab={route === 'compare/teacher' ? 'teacher' : 'student'} go={go} />}
      </main>
      <footer className="site-footer">
        <span>
          <Sprout size={16} />
          늘봄 · 특수학급 학생별 반복학습 프로토타입
        </span>
        <span>가상 학생 · 준비된 문항 · 이 브라우저에만 저장 · AI와 서버 미연결</span>
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
  const points = [
    {
      icon: Layers3,
      title: '학생별 목표',
      text: '같은 ‘수의 크기 비교’에서 출발해 학생마다 수의 범위와 제시 방식이 다른 문항을 풉니다.',
    },
    {
      icon: ClipboardList,
      title: '지원을 함께 기록',
      text: '일대일 대응 배열 같은 지원이 들어간 정답과 혼자 푼 정답을 나누어 셉니다.',
    },
    {
      icon: Database,
      title: '여섯 가지 데이터',
      text: '학생 · 목표 · 문항 · 학습활동 · 배정 · 응답을 나누어 저장하고 그 관계를 확인합니다.',
    },
    {
      icon: ShieldCheck,
      title: '기록이 틀리지 않게',
      text: '중복 저장, 문항 수정, 미승인 문항, 끝내지 않은 활동을 어떻게 처리하는지 실행해 봅니다.',
    },
  ];
  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">수학 · 수량 비교</p>
        <h1>
          더 많은 쪽을 고르고,
          <br />그 풀이를 정확하게 기록합니다.
        </h1>
        <p className="hero-lead">
          특수학급 학생의 개별화교육 목표에 맞춘 반복학습에서, 무엇을 어떻게 기록해야 하는지를 수량
          비교 문항 하나로 확인하는 프로토타입입니다.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => go('compare')}>
            학생 화면에서 풀어 보기
            <ArrowRight size={18} />
          </button>
          <button className="btn btn-secondary" onClick={() => go('compare/teacher')}>
            교사 화면에서 기록 보기
          </button>
        </div>
      </section>
      <section className="points" aria-label="이 프로토타입에서 확인하는 것">
        {points.map(({ icon: Icon, title, text }) => (
          <article key={title} className="point">
            <span className="point-icon">
              <Icon size={22} />
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <p className="home-note">
        학생은 모두 가상 학생이며 실명이나 장애 정보는 받지 않습니다. 문항은 미리 준비한 것이고,
        기록은 이 브라우저에만 저장됩니다. 학습효과를 검증한 도구가 아닙니다.
      </p>
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
