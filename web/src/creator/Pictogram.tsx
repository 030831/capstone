// 그림 자산(지시서 §7.1) — 외부 검색 없이 쓰는 최소한의 SVG.
// 그림은 장식이 아니라 문제의 수량을 나타낸다:
// - 한 개와 여러 개가 명확히 구별된다(겹치지 않는 배치는 ProblemCard 의 줄바꿈이 담당).
// - 화면과 인쇄에서 수량이 같다(SVG 는 장치·인쇄 결과가 같다).
// - 흑백 인쇄에서도 형태(원/별/사과/공)로 구별된다.
// - 접근 가능한 이름(대체 설명)은 묶음 단위로 제공한다.
import { PICTO_LABEL, type PictogramKind } from './types';

export const PICTO_SIZE: Record<'small' | 'medium' | 'large', number> = { small: 28, medium: 40, large: 56 };

export function PictogramSvg({ kind, px }: { kind: PictogramKind; px: number }) {
  const s = 24; // viewBox 24x24 — px 로 확대/축소
  const common = { width: px, height: px, viewBox: `0 0 ${s} ${s}`, 'aria-hidden': true, focusable: false as const };
  switch (kind) {
    case 'circle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" fill="#35506d" stroke="#243447" strokeWidth="2" />
        </svg>
      );
    case 'star':
      return (
        <svg {...common}>
          <path
            d="M12 2.5l2.7 6.1 6.6.6-5 4.4 1.5 6.5L12 16.8l-5.8 3.3 1.5-6.5-5-4.4 6.6-.6z"
            fill="#f0b429"
            stroke="#8a6114"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'apple':
      return (
        <svg {...common}>
          <path d="M12 7c-1.2-1.8-3.4-2.3-5.1-1.2C4.6 7.3 4.2 11 6.4 14c1.7 2.4 3.9 4 5.6 4s3.9-1.6 5.6-4c2.2-3 1.8-6.7-.5-8.2C15.4 4.7 13.2 5.2 12 7z" fill="#c2521f" stroke="#7a3410" strokeWidth="1.5" />
          <path d="M12 6.5c.2-2 1.4-3.2 3.4-3.5" fill="none" stroke="#5d6774" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M15.4 3c-2.6.2-3.4 1.9-3.4 3.5 1.9.4 3.4-.9 3.4-3.5z" fill="#167a63" stroke="#0e5b4a" strokeWidth="1" />
        </svg>
      );
    case 'ball':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" fill="#e8effd" stroke="#1d4ba8" strokeWidth="2" />
          <path d="M3 12h18M12 3v18M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8" fill="none" stroke="#1d4ba8" strokeWidth="1.6" />
        </svg>
      );
  }
}

/** 수량을 나타내는 그림 묶음. perRow 개씩 줄을 바꿔 겹치지 않게 놓는다. */
export function PictureGroup({
  kind,
  count,
  perRow,
  itemSize,
  labelPrefix,
}: {
  kind: PictogramKind;
  count: number;
  perRow: number;
  itemSize: 'small' | 'medium' | 'large';
  /** 접근 가능한 이름(예: "사과 5개"). */
  labelPrefix?: string;
}) {
  const n = Math.max(0, Math.floor(count));
  const px = PICTO_SIZE[itemSize];
  const row = Math.max(1, Math.floor(perRow) || 1);
  const items = Array.from({ length: n }, (_, i) => i);
  const rows: number[][] = [];
  for (let i = 0; i < items.length; i += row) rows.push(items.slice(i, i + row));
  const aria = `${labelPrefix ?? PICTO_LABEL[kind]} ${n}개`;
  return (
    <span className="pic-group" role="img" aria-label={aria}>
      {rows.map((r, ri) => (
        <span className="pic-row" key={ri} style={{ maxHeight: px }}>
          {r.map((i) => (
            <PictogramSvg key={i} kind={kind} px={px} />
          ))}
        </span>
      ))}
    </span>
  );
}
