import type { Verdict } from '../engine';
import { VERDICT_GLYPH, VERDICT_LABEL } from '../ui';

/** 판정 배지: 색 + 도형 + 한국어 라벨. v2: 영문 판정 코드는 "자세히 보기"로 접었다. */
export function VerdictBadge({ verdict, large }: { verdict: Verdict; large?: boolean }) {
  return (
    <span className={`badge badge-${verdict}${large ? ' badge-lg' : ''}`}>
      <span aria-hidden="true">{VERDICT_GLYPH[verdict]}</span> {VERDICT_LABEL[verdict]}
    </span>
  );
}
