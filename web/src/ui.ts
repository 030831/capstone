// 표시용 상수·헬퍼. 판정/상태 라벨은 색과 함께 항상 텍스트로 표시한다.
// v3(2026-11-07): 판정 4종(NEEDS_REVIEW 추가)·상태 4종(unknown 추가).
// 판정 문구는 "보장·처방" 톤을 쓰지 않고 기록 확인 중심으로만 쓴다.
import type { State, Verdict } from './engine';

export const VERDICT_LABEL: Record<Verdict, string> = {
  COLLISION: '확인이 필요한 선수 개념이 있어요',
  NEEDS_REVIEW: '아직 확인하지 않은 기록이 있어요',
  ALIGNED: '기록상 필수 선수 개념이 확인됐어요',
  TOO_EASY: '선택한 개념은 이미 숙달로 기록돼 있어요',
};

export const VERDICT_GLYPH: Record<Verdict, string> = {
  COLLISION: '▲',
  NEEDS_REVIEW: '◆',
  ALIGNED: '●',
  TOO_EASY: '■',
};

export const STATE_LABEL: Record<State, string> = {
  unknown: '미확인',
  not_started: '미시작',
  emerging: '형성 중',
  mastered: '숙달',
};

/** 현행수준 표시 순서(확인되지 않음 → 시작 전 → 형성 중 → 숙달). */
export const STATES: State[] = ['unknown', 'not_started', 'emerging', 'mastered'];

/** 결과 카드 공통 안내 문장(검사 범위의 한계를 함께 알린다). */
export const RESULT_SCOPE_NOTE =
  '선택한 개념과 학생 기록을 기준으로 확인한 결과입니다. 문제 표현과 지원 방법을 함께 살펴보세요.';
