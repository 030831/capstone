// 샘플 문제 3개: examples/real/problem_*.yaml 내용.
export interface Surface {
  numberRange: string;
  context: string;
  representation: string;
  support: string;
}

export interface SampleProblem {
  id: string;
  title: string; // 버튼 라벨
  text: string;
  requires: string[];
  surface: Surface;
}

export const EMPTY_SURFACE: Surface = { numberRange: '', context: '', representation: '', support: '' };

export const SAMPLE_PROBLEMS: SampleProblem[] = [
  {
    id: 'P_add5',
    title: '샘플 1: 5 이내 덧셈',
    text: '사과 2개와 3개를 합하면 몇 개?',
    requires: ['N19_add_within_5'],
    surface: { ...EMPTY_SURFACE },
  },
  {
    id: 'P_carry',
    title: '샘플 2: 받아올림 덧셈',
    text: '사탕이 8개 있었는데 5개를 더 받았어요. 모두 몇 개일까요?',
    requires: ['N26_add_single_digit_carry'],
    surface: { numberRange: '20이내', context: '사탕', representation: '글+그림', support: '없음' },
  },
  {
    id: 'P_make10',
    title: '샘플 3: 10 가르기',
    text: '구슬 10개를 두 통에 나누어 담아요. 한 통에 7개면 다른 통에는 몇 개?',
    requires: ['N16_ten_complements'],
    surface: { ...EMPTY_SURFACE },
  },
];
