// draft.ts (룰 기반 초안 제안) 테스트.
// 원칙: 제안·초안은 어디까지나 후보이며, 판정 엔진에는 영향을 주지 않는다.
// v3(2026-11-07): ① 후보는 우선도 순 상위 6개(동률만 ID 정렬) ② 15−3 ≠ 13−5
// ③ 수식이 없으면 숫자 기반 후보 보류 ④ 혼재·모호한 IEP 문장은 제안하지 않는다.
import { describe, expect, it } from 'vitest';
import { draftIepFromText, SAMPLE_IEP_TEXT, suggestConcepts } from './draft';

const ids = (text: string): string[] => suggestConcepts(text).map((h) => h.id);

describe('suggestConcepts (문제 글 → 개념 후보)', () => {
  it('받아올림 덧셈 문제: N26(받아올림)과 N16(10의 보수)이 후보로 나온다', () => {
    const hints = suggestConcepts('사탕이 8개 있었는데 5개를 더 받았어요. 모두 몇 개일까요?');
    const list = hints.map((h) => h.id);
    expect(list).toContain('N26_add_single_digit_carry');
    expect(list).toContain('N16_ten_complements');
  });

  it('"받아올림" 단어만으로도 N26 후보가 나온다', () => {
    expect(ids('받아올림이 있는 덧셈을 하세요.')).toContain('N26_add_single_digit_carry');
  });

  it('10 가르기 문제: N15·N16 후보, 받아올림 후보는 나오지 않는다', () => {
    const list = ids('구슬 10개를 두 통에 나누어 담아요. 한 통에 7개면 다른 통에는 몇 개?');
    expect(list).toContain('N15_compose_decompose_to_10');
    expect(list).toContain('N16_ten_complements');
    expect(list).not.toContain('N26_add_single_digit_carry');
  });

  it('합 5 이하 덧셈 문제: N19 후보가 나온다', () => {
    expect(ids('사과 2개와 3개를 합하면 몇 개?')).toContain('N19_add_within_5');
  });

  it('곱셈구구 문제: N39 후보가 나온다', () => {
    expect(ids('곱셈구구 7단을 이용해 해결해요.')).toContain('N39_mult_table');
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

  it('우선도 순 정렬: 구체 수식 규칙이 일반 키워드보다 앞선다', () => {
    // "8+5"(수식 규칙, 우선도 3) → N16·N26 이 먼저, "더했"(일반 키워드, 우선도 1) → N18/N19/N21 은 뒤.
    const hints = suggestConcepts('8+5를 구하시오. 더했을 때의 값도 알려줘.');
    const pos = (id: string) => hints.findIndex((h) => h.id === id);
    expect(pos('N26_add_single_digit_carry')).toBeGreaterThanOrEqual(0);
    expect(pos('N26_add_single_digit_carry')).toBeLessThan(pos('N18_add_sub_meaning'));
    expect(hints.find((h) => h.id === 'N18_add_sub_meaning')?.priority).toBe(1);
    // 동률(우선도 3)끼리는 개념 ID(노드 번호)순 — N16 이 N26 보다 앞.
    expect(pos('N16_ten_complements')).toBeLessThan(pos('N26_add_single_digit_carry'));
  });

  it('수식이 없으면 숫자 기반 후보를 보류한다(문항 번호·문맥 숫자 조합 금지)', () => {
    // "1번." 문항 번호와 "3개" 수가 있어도 수식이 없으면 받아올림/뺄셈 후보를 만들지 않는다.
    const list = ids('1번. 바구니에 사탕 3개가 있어요. 사탕은 몇 개일까요?');
    expect(list).not.toContain('N20_sub_within_5');
    expect(list).not.toContain('N22_sub_within_9_equation');
    expect(list).not.toContain('N19_add_within_5');
  });

  it('15−3 은 받아내림(N27)이 아니라 받아올림 없는 두 자리(N33) 후보다', () => {
    const list = ids('15−3을 계산하세요.');
    expect(list).not.toContain('N27_sub_teen_borrow');
    expect(list).toContain('N33_add_sub_two_digit_no_regroup');
  });

  it('13−5 는 받아내림(N27) 후보다 — 15−3 과 구분된다', () => {
    const list = ids('13−5를 계산하세요.');
    expect(list).toContain('N27_sub_teen_borrow');
    expect(list).not.toContain('N33_add_sub_two_digit_no_regroup');
  });

  it('한 자리 수 덧셈에서 합이 10이면 N16, 10을 넘으면 N26으로 구분한다', () => {
    expect(ids('8+2를 계산하세요.')).toContain('N16_ten_complements');
    expect(ids('8+2를 계산하세요.')).not.toContain('N26_add_single_digit_carry');
    expect(ids('8+5를 계산하세요.')).toContain('N26_add_single_digit_carry');
  });

  it('"곱하기" 단어 수식도 곱셈 후보로 잡는다', () => {
    expect(ids('3 곱하기 4를 구하세요.')).toContain('N39_mult_table');
  });

  it('동률일 때만 개념 ID(노드 번호) 오름차순으로 안정적으로 정렬된다', () => {
    const hints = suggestConcepts('자릿값 100까지 세기 이어 세기');
    const nums = hints.filter((h) => h.priority === 2).map((h) => h.id);
    const sorted = [...nums].sort();
    expect(nums).toEqual(sorted);
  });
});

describe('draftIepFromText (현행수준 문장 → 변경 제안 미리 보기)', () => {
  it('예시 문장: 명확한 제안만 나온다(혼재·모호 서술은 확인 필요)', () => {
    const d = draftIepFromText(SAMPLE_IEP_TEXT, {});
    // "10 만들기는 아직 불안정" → 형성 중 제안
    const n16 = d.proposals.find((p) => p.node === 'N16_ten_complements');
    expect(n16?.proposed).toBe('emerging');
    expect(n16?.evidence).toContain('불안정');
    // "받아올림 덧셈은 시도하지 않음" → 명시적 미시작 제안
    const n26 = d.proposals.find((p) => p.node === 'N26_add_single_digit_carry');
    expect(n26?.proposed).toBe('not_started');
    // "10까지 세고 한 자리 수 덧셈·뺄셈은 구체물로 해결함" → 구분 안 됨, 확인 필요
    const reviewIds = d.needsReview.map((r) => r.node);
    expect(reviewIds).toContain('N05_count_sequence_to_10');
    expect(reviewIds).toContain('N19_add_within_5');
    expect(reviewIds).toContain('N21_add_within_9_equation');
    // 어떤 개념도 "구체물로 해결함"만으로 숙달 제안이 되지 않는다
    for (const p of d.proposals) expect(p.proposed).not.toBe('mastered');
  });

  it('긍정·부정이 섞인 문장은 그 개념들을 미시작으로 만들지 않는다(판단 보류)', () => {
    const d = draftIepFromText('10까지 세기는 할 수 있지만 받아올림은 못함.', {});
    expect(d.proposals).toHaveLength(0);
    const ids2 = d.needsReview.map((r) => r.node);
    expect(ids2).toContain('N05_count_sequence_to_10');
    expect(ids2).toContain('N26_add_single_digit_carry');
  });

  it('"못함"은 미시작과 동일시하지 않는다(확인 필요로 돌린다)', () => {
    const d = draftIepFromText('받아올림 덧셈을 못함.', {});
    expect(d.proposals.find((p) => p.node === 'N26_add_single_digit_carry')).toBeUndefined();
    expect(d.needsReview.map((r) => r.node)).toContain('N26_add_single_digit_carry');
  });

  it('"두 자리 수 덧셈을 해결함"만으로 받아올림 있/없음·수 비교까지 숙달 제안하지 않는다', () => {
    const d = draftIepFromText('두 자리 수 덧셈을 해결함.', {});
    // 해결함(숙달 표현)이 있어도 제안(proposals)은 비어 있어야 한다.
    expect(d.proposals).toHaveLength(0);
    const ids2 = d.needsReview.map((r) => r.node);
    expect(ids2).toContain('N33_add_sub_two_digit_no_regroup');
    expect(ids2).toContain('N34_add_sub_two_digit_regroup');
    // 확인 필요 항목은 상태를 바꾸지 않는다 — 숙달 제안이 아니다.
  });

  it('지원 조건이 있는 서술("도움을 받아 해결")은 숙달이 아니라 형성 중으로 제안한다', () => {
    const d = draftIepFromText('곱셈구구는 도움을 받아 해결함.', {});
    const n39 = d.proposals.find((p) => p.node === 'N39_mult_table');
    expect(n39?.proposed).toBe('emerging');
  });

  it('상태 표현이 없는 문장은 추측하지 않는다', () => {
    const d = draftIepFromText('받아올림 덧셈.', {});
    expect(d.proposals).toHaveLength(0);
    expect(d.needsReview).toHaveLength(0);
  });

  it('현재 상태를 함께 돌려준다(미리 보기 표의 현재 상태 열)', () => {
    const d = draftIepFromText('곱셈구구를 안정적으로 수행함.', { N39_mult_table: 'emerging' });
    const n39 = d.proposals.find((p) => p.node === 'N39_mult_table');
    expect(n39?.current).toBe('emerging');
    expect(n39?.proposed).toBe('mastered');
  });

  it('같은 개념이 문장마다 다르게 나오면 제안하지 않는다(문장 간 충돌)', () => {
    const d = draftIepFromText('10 만들기는 안정적으로 해결함. 10 만들기는 아직 불안정함.', {});
    expect(d.proposals.find((p) => p.node === 'N16_ten_complements')).toBeUndefined();
    expect(d.needsReview.map((r) => r.node)).toContain('N16_ten_complements');
  });

  it('"도움 없이 해결"은 형성 중이 아니라 숙달 제안으로 본다', () => {
    const d = draftIepFromText('곱셈구구는 도움 없이 해결함.', {});
    expect(d.proposals.find((p) => p.node === 'N39_mult_table')?.proposed).toBe('mastered');
  });

  it('빈 글자면 초안도 없다', () => {
    expect(draftIepFromText('', {})).toEqual({ proposals: [], needsReview: [] });
  });
});
