// 프리셋 학생(합성 데이터, 익명 ID 만). 실명·학교명 없음.
import type { State, States } from '../engine';

export interface Student {
  id: string; // 내부 키
  name: string; // 표시용 익명 이름 ("학생 A")
  states: States;
}

const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** 접두 번호 -> 노드 ID 변환용(그래프 JSON 의 ID 를 받아 사용). */
export function makeStates(
  allIds: readonly string[],
  spec: { mastered?: number[]; emerging?: number[] },
): States {
  const num = (id: string) => parseInt(/^N(\d+)/.exec(id)![1], 10);
  const out: States = {};
  for (const id of allIds) {
    const n = num(id);
    const s: State = spec.mastered?.includes(n) ? 'mastered' : spec.emerging?.includes(n) ? 'emerging' : 'not_started';
    if (s !== 'not_started') out[id] = s;
  }
  return out;
}

// 학생 A: examples/real/student_A.yaml 그대로.
// IEP 현행수준 서술 예: "10까지 세고 한 자리 수 덧셈·뺄셈은 구체물로 해결함. 10 만들기는 아직 불안정.
// 받아올림 덧셈은 시도하지 않음."
export const STUDENT_A_STATES: States = {
  N01_one_to_one_matching: 'mastered',
  N02_perceptual_compare: 'mastered',
  N03_ordering_by_attribute: 'mastered',
  N04_subitize_small: 'mastered',
  N05_count_sequence_to_10: 'mastered',
  N06_count_objects_to_5: 'mastered',
  N07_count_objects_to_10: 'mastered',
  N08_produce_set_to_10: 'mastered',
  N09_numerals_to_9: 'mastered',
  N10_zero: 'mastered',
  N11_compare_numbers_to_10: 'mastered',
  N13_count_on_from_n: 'emerging',
  N14_compose_decompose_to_5: 'mastered',
  N15_compose_decompose_to_10: 'mastered',
  N16_ten_complements: 'emerging',
  N18_add_sub_meaning: 'mastered',
  N19_add_within_5: 'mastered',
  N20_sub_within_5: 'mastered',
  N21_add_within_9_equation: 'mastered',
  N22_sub_within_9_equation: 'mastered',
  N28_ten_as_unit: 'mastered',
};

/** 프리셋 3명. 그래프 노드 ID 목록이 필요한 B, C 는 함수로 만든다. */
export function makePresets(allIds: readonly string[]): Student[] {
  return [
    { id: 'A', name: '학생 A', states: { ...STUDENT_A_STATES } },
    {
      // 수의 기초~10까지 세기 mastered, 5 이하 가르기·모으기 emerging (기본교육과정 초1~2 수준)
      id: 'B',
      name: '학생 B',
      states: makeStates(allIds, { mastered: range(1, 7), emerging: [14] }),
    },
    {
      // 받아올림 직전: N01~N25, N28~N33 mastered, N26·N27 emerging
      id: 'C',
      name: '학생 C',
      states: makeStates(allIds, { mastered: [...range(1, 25), ...range(28, 33)], emerging: [26, 27] }),
    },
  ];
}
