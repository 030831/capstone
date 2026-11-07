// 작성 오류 검증 테스트 (지시서 §8·§17: 잘못된 선택지 검출, 지원 범위).
import { describe, expect, test } from 'vitest';
import { makeProblem } from './defaults';
import type { CompareProblem, CountProblem, EquationProblem, TwoGroupsProblem } from './types';
import { validateProblem } from './validate';

const msgs = (p: Problem): string[] => validateProblem(p as Problem).map((i) => i.message);
type Problem = Parameters<typeof validateProblem>[0];

describe('작성 오류 확인 (§8)', () => {
  test('질문이 비어 있으면 오류', () => {
    const p = makeProblem('count') as CountProblem;
    p.question = '  ';
    expect(msgs(p).some((m) => m.includes('질문 문장이 비어'))).toBe(true);
  });

  test('선택지 방식인데 선택지가 없으면 오류', () => {
    const p = makeProblem('count') as CountProblem;
    p.response = { mode: 'choices', choices: [], correctIndex: 0, blankSize: 'medium' };
    expect(msgs(p).some((m) => m.includes('선택지가 없어요'))).toBe(true);
  });

  test('정답 선택지가 지정되지 않았으면 오류', () => {
    const p = makeProblem('count') as CountProblem;
    p.response = { mode: 'choices', choices: ['6', '7', '8'], correctIndex: 5, blankSize: 'medium' };
    expect(msgs(p).some((m) => m.includes('정답으로 지정한 선택지가 없어요'))).toBe(true);
  });

  test('같은 선택지가 중복되면 오류', () => {
    const p = makeProblem('count') as CountProblem;
    p.response = { mode: 'choices', choices: ['7', '7', '8'], correctIndex: 0, blankSize: 'medium' };
    expect(msgs(p).some((m) => m.includes('반복'))).toBe(true);
  });

  test('계산된 정답과 정답 선택지가 불일치면 오류', () => {
    const p = makeProblem('count') as CountProblem;
    p.count = 7;
    p.response = { mode: 'choices', choices: ['6', '7', '8'], correctIndex: 0, blankSize: 'medium' };
    expect(msgs(p).some((m) => m.includes("계산된 정답은 '7'"))).toBe(true);
  });

  test('정상 선택지는 오류 없음', () => {
    const p = makeProblem('count') as CountProblem;
    p.count = 7;
    p.response = { mode: 'choices', choices: ['6', '7', '8'], correctIndex: 1, blankSize: 'medium' };
    expect(validateProblem(p)).toHaveLength(0);
  });

  test('지원 범위를 벗어난 숫자는 조용히 고치지 않고 오류로 표시', () => {
    const p = makeProblem('count') as CountProblem;
    p.count = 25;
    expect(msgs(p).some((m) => m.includes('1~20'))).toBe(true);
    p.count = 0;
    expect(msgs(p).some((m) => m.includes('1~20'))).toBe(true);
  });

  test('뺄셈 결과가 음수면 오류', () => {
    const p = makeProblem('equation') as EquationProblem;
    p.operation = 'sub';
    p.a = 3;
    p.b = 8;
    expect(msgs(p).some((m) => m.includes('뺄셈 결과는 0 이상'))).toBe(true);
  });

  test('덧셈 결과가 20을 넘으면 오류 (지원 범위)', () => {
    const p = makeProblem('equation') as EquationProblem;
    p.a = 15;
    p.b = 9;
    expect(msgs(p).some((m) => m.includes('20을 넘어요'))).toBe(true);
  });

  test('두 묶음 한쪽 수량이 범위 밖이면 오류', () => {
    const p = makeProblem('two_groups') as TwoGroupsProblem;
    p.right.count = 21;
    expect(msgs(p).some((m) => m.includes('오른쪽 수량'))).toBe(true);
  });

  test('힌트를 켰는데 내용이 없으면 오류', () => {
    const p = makeProblem('count') as CountProblem;
    p.hint.enabled = true;
    p.hint.text = '';
    p.hint.pictureCount = 0;
    expect(msgs(p).some((m) => m.includes('힌트를 켰는데'))).toBe(true);
  });

  test('그림이 많고 크기가 크면 페이지 경고(warn, error 아님)', () => {
    const p = makeProblem('count') as CountProblem;
    p.count = 15;
    p.itemSize = 'large';
    const issues = validateProblem(p);
    expect(issues.some((i) => i.level === 'warn' && i.message.includes('페이지'))).toBe(true);
    expect(issues.every((i) => i.level !== 'error')).toBe(true);
  });

  test('비교 기호 방식에서 숫자가 없으면 경고', () => {
    const p = makeProblem('compare') as CompareProblem;
    p.responseMode = 'symbol';
    p.showNumbers = false;
    expect(validateProblem(p).some((i) => i.level === 'warn' && i.message.includes('비교 기호'))).toBe(true);
  });
});
