// 같은 구조화된 데이터(목표 + 설정)에서 활동지를 그린다. 그림은 코드로 그린 SVG.
import { ACTIVITY, instructionText } from './model.js';

const ITEMS = {
  discriminate: {
    '1-5': [
      [3, 5],
      [4, 2],
      [1, 3],
      [5, 5],
      [2, 4],
    ],
    '1-10': [
      [7, 4],
      [6, 9],
      [8, 8],
      [3, 7],
      [10, 6],
    ],
    '1-20': [
      [12, 15],
      [17, 11],
      [14, 14],
      [9, 16],
      [20, 13],
    ],
  },
  produce: {
    '1-5': [
      [5, 3],
      [2, 4],
      [4, 1],
      [3, 5],
      [5, 2],
    ],
    '1-10': [
      [8, 5],
      [4, 9],
      [10, 7],
      [6, 8],
      [9, 3],
    ],
    '1-20': [
      [15, 11],
      [9, 14],
      [18, 12],
      [13, 17],
      [20, 16],
    ],
  },
};
const EXAMPLE_ITEM = { '1-5': [4, 2], '1-10': [6, 4], '1-20': [12, 9] };
const SHAPES = ['circle', 'apple', 'star'];
const CELL = 26;
const SCALE = 1.4; // 화면·인쇄에서 그림이 너무 작지 않도록

export function itemsFor(goal, config) {
  return ITEMS[goal.behavior][config.range];
}

function Shape({ kind, x, y }) {
  if (kind === 'apple')
    return (
      <g>
        <circle cx={x} cy={y + 1} r={8} fill="#c98a6c" />
        <rect x={x - 0.8} y={y - 10} width={1.8} height={5} rx={1} fill="#6b5a44" />
        <ellipse cx={x + 4} cy={y - 8} rx={3.4} ry={1.8} fill="#7f9f6f" />
      </g>
    );
  if (kind === 'star') {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 ? 4 : 9.5;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    return <polygon points={pts} fill="#d6b25e" />;
  }
  return <circle cx={x} cy={y} r={8.5} fill="#7fa48b" />;
}

// 정렬하지 않을 때도 매번 같은 자리에 그려지도록 고정된 흩뿌림 위치를 쓴다.
function scatter(n, seed) {
  const cols = 5;
  return Array.from({ length: n }, (_, i) => {
    const h = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    const j = h - Math.floor(h);
    return {
      x: 18 + (i % cols) * CELL + (j - 0.5) * 8,
      y: 18 + Math.floor(i / cols) * CELL + (((j * 7) % 1) - 0.5) * 8,
    };
  });
}

function Groups({ a, b, shape, config, partial, index }) {
  const showNumbers = config.presentation === 'pictures-numbers';
  if (config.presentation === 'numbers') {
    return (
      <div className="ws-numbers" role="img" aria-label={`가 ${a}, 나 ${b}`}>
        <span>
          <small>가</small>
          {a}
        </span>
        <span>
          <small>나</small>
          {b}
        </span>
      </div>
    );
  }
  const label = `가 묶음 ${a}개, 나 묶음 ${b}개 그림`;
  const cue = config.support === 'visual-cue';
  if (config.aligned || cue) {
    const cols = Math.max(a, b);
    const width = 40 + cols * CELL + (showNumbers ? 40 : 10);
    const rowY = [20, 64];
    return (
      <svg
        className="ws-groups"
        width={width * SCALE}
        height={86 * SCALE}
        viewBox={`0 0 ${width} 86`}
        role="img"
        aria-label={label}
      >
        {cue &&
          Array.from({ length: Math.min(a, b) }, (_, i) => (
            <line
              key={i}
              x1={40 + i * CELL + CELL / 2}
              x2={40 + i * CELL + CELL / 2}
              y1={rowY[0] + 11}
              y2={rowY[1] - 12}
              stroke="#9fb39a"
              strokeDasharray="3 3"
            />
          ))}
        {[a, b].map((n, row) => (
          <g key={row}>
            <text x={10} y={rowY[row] + 5} className="ws-svg-label">
              {row ? '나' : '가'}
            </text>
            {Array.from({ length: n }, (_, i) => (
              <Shape key={i} kind={shape} x={40 + i * CELL + CELL / 2} y={rowY[row]} />
            ))}
            {(showNumbers || (partial && row === 0)) && (
              <text x={40 + cols * CELL + 12} y={rowY[row] + 5} className="ws-svg-number">
                {n}
              </text>
            )}
          </g>
        ))}
      </svg>
    );
  }
  const rows = (n) => Math.ceil(n / 5);
  const h = Math.max(rows(a), rows(b)) * CELL + 22 + (showNumbers || partial ? 22 : 0);
  const boxW = 5 * CELL + 14;
  return (
    <svg
      className="ws-groups"
      width={(boxW * 2 + 24) * SCALE}
      height={(h + 20) * SCALE}
      viewBox={`0 0 ${boxW * 2 + 24} ${h + 20}`}
      role="img"
      aria-label={label}
    >
      {[a, b].map((n, g) => {
        const ox = g * (boxW + 24);
        return (
          <g key={g}>
            <rect x={ox + 1} y={14} width={boxW - 2} height={h} rx={10} className="ws-svg-box" />
            <text x={ox + 8} y={10} className="ws-svg-label">
              {g ? '나' : '가'}
            </text>
            {scatter(n, index * 2 + g).map((p, i) => (
              <Shape key={i} kind={shape} x={ox + p.x} y={14 + p.y} />
            ))}
            {(showNumbers || (partial && g === 0)) && (
              <text x={ox + boxW / 2} y={h + 6} textAnchor="middle" className="ws-svg-number">
                {n}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Answer({ a, b, goal, config, solved }) {
  const produce = goal.behavior === 'produce';
  const more = a === b ? '같아요' : a > b ? '가' : '나';
  const diff = Math.abs(a - b);
  const partial = config.support === 'partial' && !solved;
  if (config.response === 'point') {
    const nums = [diff, diff + 1, diff + 2];
    const shift = a % 3;
    const opts = produce ? [...nums.slice(shift), ...nums.slice(0, shift)] : ['가', '나', '같아요'];
    const mark = produce ? diff : more;
    return (
      <div className="ws-answer ws-choices">
        {opts.map((o) => (
          <span key={o} className={solved && o === mark ? 'marked' : ''}>
            <i aria-hidden="true" />
            {o}
            {produce ? '개' : ''}
          </span>
        ))}
      </div>
    );
  }
  if (config.response === 'symbol') {
    const sym = a === b ? '=' : a > b ? '>' : '<';
    return (
      <div className="ws-answer ws-symbol">
        가 <b className="ws-blank">{solved ? sym : ''}</b> 나
      </div>
    );
  }
  if (produce) {
    return (
      <div className="ws-answer ws-write">
        <b className="ws-blank wide">{solved || partial ? more : ''}</b> 쪽이
        <b className="ws-blank">{solved ? diff : ''}</b>개 더 많습니다.
      </div>
    );
  }
  return (
    <div className="ws-answer ws-write">
      더 많은 쪽의 수 <b className="ws-blank">{solved ? Math.max(a, b) : ''}</b>
    </div>
  );
}

export default function Worksheet({ goal, config, versionLabel }) {
  const items = itemsFor(goal, config);
  const partial = config.support === 'partial';
  const example = EXAMPLE_ITEM[config.range];
  return (
    <article className="ws-sheet" aria-label={`${versionLabel} 활동지 미리보기`}>
      <header className="ws-head">
        <div>
          <span className="ws-kicker">{versionLabel}</span>
          <h3>{ACTIVITY.name}</h3>
        </div>
        <div className="ws-fill">
          <span>날짜</span>
          <span>이름</span>
        </div>
      </header>
      <p className="ws-instruction">{instructionText(config, goal)}</p>
      {config.support === 'worked-example' && (
        <section className="ws-item ws-example" aria-label="예시 문항">
          <span className="ws-no">예시</span>
          <div className="ws-body">
            <Groups a={example[0]} b={example[1]} shape="circle" config={config} index={9} />
            <Answer a={example[0]} b={example[1]} goal={goal} config={config} solved />
          </div>
        </section>
      )}
      <ol className="ws-items">
        {items.map(([a, b], i) => (
          <li key={i} className="ws-item">
            <span className="ws-no">{i + 1}</span>
            <div className="ws-body">
              <Groups
                a={a}
                b={b}
                shape={SHAPES[i % SHAPES.length]}
                config={config}
                partial={partial}
                index={i}
              />
              <Answer a={a} b={b} goal={goal} config={config} />
            </div>
          </li>
        ))}
      </ol>
      <footer className="ws-foot">가상 사례 · 늘봄 프로토타입에서 만든 활동지</footer>
    </article>
  );
}
