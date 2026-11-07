// 정답 계산·기본 선택지 테스트 (지시서 §17: 문제 형태별 정답 계산, 수량 변경 반영).
import { describe, expect, test } from 'vitest';
import { computedAnswer, compareAnswer, defaultChoices, equationResult } from './answers';
import { makeProblem } from './defaults';
import type { CompareProblem, CountProblem, EquationProblem, TwoGroupsProblem } from './types';

describe('정답 계산 (§8)', () => {
  test('그림 수 세기: 개수가 곧 정답', () => {
    const p = makeProblem('count') as CountProblem;
    p.count = 7;
    expect(computedAnswer(p)).toBe('7');
  });

  test('두 묶음: 왼쪽+오른쪽 합. 한쪽만 바꿔도 갱신된다', () => {
    const p = makeProblem('two_groups') as TwoGroupsProblem;
    expect(computedAnswer(p)).toBe('5'); // 2+3
    p.left.count = 4;
    expect(computedAnswer(p)).toBe('7'); // 4+3
    p.right.count = 10;
    expect(computedAnswer(p)).toBe('14');
  });

  test('수식: 빈칸 위치에 따라 가려진 수가 정답', () => {
    const p = makeProblem('equation') as EquationProblem; // 3+2
    expect(computedAnswer(p)).toBe('5'); // blank=result
    p.blank = 'a';
    expect(computedAnswer(p)).toBe('3');
    p.blank = 'b';
    expect(computedAnswer(p)).toBe('2');
  });

  test('수식: 피연산자를 바꾸면 정답이 갱신된다', () => {
    const p = makeProblem('equation') as EquationProblem;
    p.a = 8;
    p.b = 5;
    expect(computedAnswer(p)).toBe('13');
    p.operation = 'sub';
    expect(computedAnswer(p)).toBe('3');
    expect(equationResult(p)).toBe(3);
  });

  test('수식: 뺄셈에서 blank=a 면 a 가 정답(표시 결과는 a-b)', () => {
    const p = makeProblem('equation') as EquationProblem;
    p.operation = 'sub';
    p.a = 9;
    p.b = 4;
    p.blank = 'a';
    expect(equationResult(p)).toBe(5);
    expect(computedAnswer(p)).toBe('9');
  });

  test('비교: 더 많음 — 많은 쪽이 정답, 같으면 같음', () => {
    const p = makeProblem('compare') as CompareProblem; // 3 vs 5, more
    expect(computedAnswer(p)).toBe('오른쪽');
    p.left.count = 8;
    expect(computedAnswer(p)).toBe('왼쪽');
    p.left.count = 5;
    expect(computedAnswer(p)).toBe('같음'); // 같은 수량일 때 일관성
  });

  test('비교: 더 적음 — 적은 쪽이 정답', () => {
    const p = makeProblem('compare') as CompareProblem;
    p.questionMode = 'less';
    expect(computedAnswer(p)).toBe('왼쪽'); // 3 < 5
  });

  test('비교: 같음 여부 — 예/아니요', () => {
    const p = makeProblem('compare') as CompareProblem;
    p.questionMode = 'same';
    p.left.count = 5;
    expect(computedAnswer(p)).toBe('예');
    p.left.count = 4;
    expect(computedAnswer(p)).toBe('아니요');
  });

  test('비교: 비교 기호 방식 — >, <, =', () => {
    const p = makeProblem('compare') as CompareProblem;
    p.responseMode = 'symbol';
    expect(compareAnswer(p)).toBe('<'); // 3 vs 5
    p.left.count = 7;
    expect(compareAnswer(p)).toBe('>');
    p.left.count = 5;
    expect(compareAnswer(p)).toBe('=');
    p.questionMode = 'same';
    expect(compareAnswer(p)).toBe('='); // 같음 여부 + 같은 수
    p.left.count = 4;
    expect(compareAnswer(p)).toBe('≠');
  });

  test('기본 선택지는 정답을 포함한 시작값이다', () => {
    const p = makeProblem('count') as CountProblem;
    p.count = 7;
    const { choices, correctIndex } = defaultChoices(p);
    expect(choices[correctIndex]).toBe('7');
    expect(choices).toHaveLength(3);
  });

  test('비교 기본 선택지: 왼쪽·오른쪽·같음 (같음 여부는 예·아니요)', () => {
    const p = makeProblem('compare') as CompareProblem;
    expect(defaultChoices(p).choices).toEqual(['왼쪽', '오른쪽', '같음']);
    p.questionMode = 'same';
    p.left.count = 5; // 같은 수 → 정답 '예'
    expect(defaultChoices(p).choices).toEqual(['예', '아니요']);
    expect(defaultChoices(p).correctIndex).toBe(0);
    p.left.count = 4; // 다른 수 → 정답 '아니요'
    expect(defaultChoices(p).choices).toEqual(['아니요', '예']);
    expect(defaultChoices(p).correctIndex).toBe(0);
    p.responseMode = 'symbol';
    expect(defaultChoices(p).choices).toEqual(['>', '<', '=']);
  });
});
