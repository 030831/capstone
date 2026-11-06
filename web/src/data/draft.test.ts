// draft.ts (룰 기반 초안 제안) 테스트.
// 원칙: 제안·초안은 어디까지나 후보이며, 판정 엔진에는 영향을 주지 않는다.
import { describe, expect, it } from 'vitest';
import { draftStatesFromIep, SAMPLE_IEP_TEXT, suggestConcepts } from './draft';

describe('suggestConcepts (문제 글 → 개념 후보 힌트)', () => {
  it('받아올림 덧셈 문제: N26(받아올림)과 N16(10의 보수)이 후보로 나온다', () => {
    const hints = suggestConcepts('사탕이 8개 있었는데 5개를 더 받았어요. 모두 몇 개일까요?');
    const ids = hints.map((h) => h.id);
    expect(ids).toContain('N26_add_single_digit_carry');
    expect(ids).toContain('N16_ten_complements');
  });

  it('"받아올림" 단어만으로도 N26 후보가 나온다', () => {
    const hints = suggestConcepts('받아올림이 있는 덧셈을 하세요.');
    expect(hints.map((h) => h.id)).toContain('N26_add_single_digit_carry');
  });

  it('10 가르기 문제: N15·N16 후보, 받아올림 후보는 나오지 않는다', () => {
    const hints = suggestConcepts('구슬 10개를 두 통에 나누어 담아요. 한 통에 7개면 다른 통에는 몇 개?');
    const ids = hints.map((h) => h.id);
    expect(ids).toContain('N15_compose_decompose_to_10');
    expect(ids).toContain('N16_ten_complements');
    expect(ids).not.toContain('N26_add_single_digit_carry');
  });

  it('합 5 이하 덧셈 문제: N19 후보가 나온다', () => {
    const hints = suggestConcepts('사과 2개와 3개를 합하면 몇 개?');
    expect(hints.map((h) => h.id)).toContain('N19_add_within_5');
  });

  it('곱셈구구 문제: N39 후보가 나온다', () => {
    const hints = suggestConcepts('곱셈구구 7단을 이용해 해결해요.');
    expect(hints.map((h) => h.id)).toContain('N39_mult_table');
  });

  it('빈 글자면 후보가 없다', () => {
    expect(suggestConcepts('')).toEqual([]);
    expect(suggestConcepts('   ')).toEqual([]);
  });

  it('후보는 최대 6개로 제한된다', () => {
    const hints = suggestConcepts(
      '받아올림 받아내림 두 자리 수 덧셈 뺄셈 자릿값 몇십 곱셈구구 100까지 세기 첫째 두 번째 문제',
    );
    expect(hints.length).toBeLessThanOrEqual(6);
  });
});

describe('draftStatesFromIep (현행수준 문장 → 상태 초안)', () => {
  it('예시 문장(학생 A 서술)이 학생 A 상태와 같은 방향으로 풀린다', () => {
    const d = draftStatesFromIep(SAMPLE_IEP_TEXT);
    expect(d['N05_count_sequence_to_10']).toBe('mastered');
    expect(d['N19_add_within_5']).toBe('mastered');
    expect(d['N21_add_within_9_equation']).toBe('mastered');
    expect(d['N16_ten_complements']).toBe('emerging');
    expect(d['N26_add_single_digit_carry']).toBe('not_started');
  });

  it('"도움 없이 해결"은 형성 중이 아니라 숙달로 본다', () => {
    const d = draftStatesFromIep('두 자리 수 덧셈은 도움 없이 해결함.');
    expect(d['N33_add_sub_two_digit_no_regroup']).toBe('mastered');
    expect(d['N34_add_sub_two_digit_regroup']).toBe('mastered');
  });

  it('상태 표현이 없는 문장은 추측하지 않는다', () => {
    const d = draftStatesFromIep('받아올림 덧셈.');
    expect(d['N26_add_single_digit_carry']).toBeUndefined();
  });

  it('같은 개념이 여러 문장에 나오면 마지막 문장이 이긴다', () => {
    const d = draftStatesFromIep('10 만들기는 시도함. 10 만들기는 안정적으로 해결함.');
    expect(d['N16_ten_complements']).toBe('mastered');
  });

  it('빈 글자면 초안도 없다', () => {
    expect(draftStatesFromIep('')).toEqual({});
  });
});
