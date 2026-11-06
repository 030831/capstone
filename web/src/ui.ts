// 표시용 상수·헬퍼. 판정/상태 라벨은 색과 함께 항상 텍스트로 표시한다.
// v2: 판정 라벨을 교사용 일상 언어로 바꿨다. 영문 판정 코드는 "자세히 보기" 안에서만 노출한다.
import type { State, Verdict } from './engine';

export const VERDICT_LABEL: Record<Verdict, string> = {
  COLLISION: '준비가 덜 된 문제예요',
  ALIGNED: '지금 딱 맞는 문제예요',
  TOO_EASY: '이미 익숙한 문제예요',
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
