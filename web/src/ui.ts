// 표시용 상수·헬퍼. 판정/상태 라벨은 색과 함께 항상 텍스트로 표시한다.
import type { State, Verdict } from './engine';

export const VERDICT_LABEL: Record<Verdict, string> = {
  COLLISION: '선수 개념 미도달',
  ALIGNED: '지금 도전하기 적절',
  TOO_EASY: '이미 숙달한 개념',
};

export const VERDICT_GLYPH: Record<Verdict, string> = {
  COLLISION: '▲',
  ALIGNED: '●',
  TOO_EASY: '■',
};

export const STATE_LABEL: Record<State, string> = {
  mastered: '숙달',
  emerging: '형성 중',
  not_started: '미시작',
};

export const STATES: State[] = ['mastered', 'emerging', 'not_started'];
