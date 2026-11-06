// 룰 기반 초안 제안 (LLM 없음, 결정적). 스펙 원칙: 최종 확정은 교사.
// 두 가지 기능:
//   (1) suggestConcepts(문제 글)   → 필요 개념 "후보" 힌트 (교사가 눌러서 담음)
//   (2) draftStatesFromIep(현행수준 문장) → 노드 상태 "초안" (교사가 표에서 확인·수정)
// 이 모듈은 engine 판정에 아무 영향을 주지 않는다. 입력 편의를 돕는 자리일 뿐이다.
// 향후 LLM 제안(README §10-2·3)이 들어올 자리이기도 하다 — 인터페이스는 같게 유지.
import type { State } from '../engine';
import { graph, nodeSpec } from '../graph';
import { nodeNumber } from './groups';

export interface ConceptHint {
  id: string;
  /** 어떤 단어가 힌트였는지 (예: "받아올림", "합이 10") — UI에 근거를 함께 보여준다. */
  hit: string;
}

interface Rule {
  words: string[];
  ids: string[];
}

// ── 문제 글 힌트 규칙 ────────────────────────────────────────────────
// 좁은 단서(구체적 표현)를 앞에, 넓은 단서(일반적 표현)를 뒤에 둔다.
const HINT_RULES: Rule[] = [
  { words: ['받아올림'], ids: ['N26_add_single_digit_carry', 'N34_add_sub_two_digit_regroup'] },
  { words: ['받아내림'], ids: ['N27_sub_teen_borrow', 'N34_add_sub_two_digit_regroup'] },
  { words: ['곱셈구구', '구구단'], ids: ['N39_mult_table'] },
  { words: ['곱셈', '곱하기', '×', '배수'], ids: ['N38_mult_meaning', 'N39_mult_table'] },
  { words: ['뛰어 세', '뛰어세', '묶어 세', '2씩', '5씩', '10씩'], ids: ['N37_skip_counting'] },
  { words: ['세 수', '세 개의 수'], ids: ['N35_three_addends'] },
  { words: ['□', '빈칸', '알맞은 수', '들어갈 수'], ids: ['N36_missing_number_equation'] },
  { words: ['몇십', '십의 자리'], ids: ['N28_ten_as_unit', 'N32_add_sub_tens'] },
  { words: ['자릿값', '자리값'], ids: ['N29_two_digit_place_value'] },
  { words: ['10의 보수', '10 만들기', '텐프레임', '텐 프레임'], ids: ['N16_ten_complements'] },
  { words: ['10에서 빼', '10 빼기'], ids: ['N25_sub_from_10'] },
  {
    words: ['두 통', '두 그릇', '두 무리', '나누어 담', '나눠 담', '가르기', '가르고'],
    ids: ['N15_compose_decompose_to_10', 'N16_ten_complements'],
  },
  { words: ['십몇', '십과 몇'], ids: ['N17_teen_as_ten_and_ones'] },
  { words: ['이어 세', '이어서 세', '다음 수부터'], ids: ['N13_count_on_from_n'] },
  { words: ['번째', '첫째', '둘째'], ids: ['N12_ordinal_to_10'] },
  {
    words: ['크기 비교', '더 큰', '더 작은', '어느 쪽이 많', '많은지', '적은지'],
    ids: ['N11_compare_numbers_to_10', 'N02_perceptual_compare'],
  },
  { words: ['짝짓', '짝을', '대응'], ids: ['N01_one_to_one_matching'] },
  { words: ['세지 않고', '한눈에'], ids: ['N04_subitize_small'] },
  { words: ['꺼내', '주세요', '만큼 가져'], ids: ['N08_produce_set_to_10'] },
  { words: ['읽고 쓰', '숫자를 쓰'], ids: ['N09_numerals_to_9'] },
  { words: ['100까지', '백까지'], ids: ['N30_count_to_100_sequence'] },
  { words: ['0을 더', '0 더하기', '0을 빼', '0 빼기'], ids: ['N23_add_sub_with_zero'] },
  {
    words: ['두 자리 수 덧셈', '두 자리 수 더하기', '두 자리 수 뺄셈', '두 자리 수 빼기'],
    ids: ['N33_add_sub_two_digit_no_regroup', 'N34_add_sub_two_digit_regroup'],
  },
  { words: ['두 자리 수'], ids: ['N29_two_digit_place_value', 'N31_compare_two_digit'] },
  // 넓은 규칙: 위의 좁은 규칙이 못 잡았을 때의 기본 후보
  {
    words: ['덧셈', '더하기', '더하', '더 받', '더 먹', '더 준', '합쳐', '합하', '모두 몇', '전부 몇', '+'],
    ids: ['N18_add_sub_meaning', 'N19_add_within_5', 'N21_add_within_9_equation'],
  },
  {
    words: ['뺄셈', '빼기', '뺐', '남을까', '남았', '가져가', '먹었', '−', '-'],
    ids: ['N18_add_sub_meaning', 'N20_sub_within_5', 'N22_sub_within_9_equation'],
  },
];

const ADD_RE = /덧셈|더하기|더하|더 받|더 먹|더 준|합쳐|합하|모두 몇|전부 몇|\+/;
const SUB_RE = /뺄셈|빼기|뺐|남을까|남았|가져가|먹었|−|-/;

/** 문제 속 두 수의 관계로 한 자리 수 덧셈·뺄셈 종류를 좁힌다. "8+5"에서 받아올림 힌트가 나오는 식. */
function numberHints(text: string): ConceptHint[] {
  const out: ConceptHint[] = [];
  const nums = Array.from(text.matchAll(/\d+/g), (m) => parseInt(m[0], 10));
  if (ADD_RE.test(text) && nums.length >= 2) {
    let maxSum = 0;
    let hitPair: [number, number] | null = null;
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const a = nums[i];
        const b = nums[j];
        if (a >= 1 && a <= 9 && b >= 1 && b <= 9 && a + b > maxSum) {
          maxSum = a + b;
          hitPair = [a, b];
        }
      }
    }
    if (hitPair) {
      const [a, b] = hitPair;
      if (maxSum > 10) {
        out.push({ id: 'N26_add_single_digit_carry', hit: `${a}+${b}처럼 10을 넘는 덧셈` });
        out.push({ id: 'N16_ten_complements', hit: '10을 넘는 덧셈의 준비' });
      } else if (maxSum === 10) {
        out.push({ id: 'N16_ten_complements', hit: `${a}+${b}처럼 합이 10` });
        out.push({ id: 'N15_compose_decompose_to_10', hit: '10 가르기·모으기' });
      } else if (maxSum <= 5) {
        out.push({ id: 'N19_add_within_5', hit: `합이 5 이하(${a}+${b})` });
      } else {
        out.push({ id: 'N21_add_within_9_equation', hit: `합이 9 이하(${a}+${b})` });
      }
    }
  }
  if (SUB_RE.test(text) && nums.length >= 2) {
    let teen = false;
    let under9 = false;
    let under5 = false;
    let hitTeen: [number, number] | null = null;
    for (let i = 0; i < nums.length; i++) {
      for (let j = 0; j < nums.length; j++) {
        const a = nums[i];
        const b = nums[j];
        if (i === j || a <= b) continue;
        if (a >= 11 && a <= 18 && b >= 1 && b <= 9) {
          teen = true;
          hitTeen = [a, b];
        } else if (a <= 9 && b >= 1) {
          under9 = true;
          if (a <= 5) under5 = true;
        }
      }
    }
    if (teen && hitTeen) out.push({ id: 'N27_sub_teen_borrow', hit: `${hitTeen[0]}−${hitTeen[1]}처럼 십몇 빼기` });
    else if (under5) out.push({ id: 'N20_sub_within_5', hit: '피감수 5 이하 뺄셈' });
    else if (under9) out.push({ id: 'N22_sub_within_9_equation', hit: '피감수 9 이하 뺄셈' });
  }
  return out;
}

/** 문제 글에서 필요 개념 후보를 뽑는다. 후보일 뿐이며 확정은 교사가 한다. */
export function suggestConcepts(text: string): ConceptHint[] {
  const t = text.replace(/\s+/g, ' ');
  const hits = new Map<string, string>();
  for (const rule of HINT_RULES) {
    const w = rule.words.find((x) => t.includes(x));
    if (w) for (const id of rule.ids) if (!hits.has(id)) hits.set(id, w);
  }
  for (const h of numberHints(t)) if (!hits.has(h.id)) hits.set(h.id, h.hit);
  return [...hits.entries()]
    .map(([id, hit]) => ({ id, hit }))
    .sort((a, b) => nodeNumber(a.id) - nodeNumber(b.id))
    .slice(0, 6);
}

// ── IEP 현행수준 문장 → 노드 상태 초안 ────────────────────────────────

// 문장 단위 상태 판정: 부정(-) → 형성 중(△) → 숙달(○) 순서로 본다.
// "시도하지 않음"처럼 부정과 형성 중 표현이 섞인 문장은 부정이 이긴다.
const NEG_WORDS = ['않', '못', '시작 전', '미시작', '미도달', '불가'];
const PART_WORDS = ['불안정', '아직', '부분', '도움', '형성', '가끔', '시도', '연습 중', '어려워', '힘들', '미숙', '발달 중'];
const POS_WORDS = ['해결', '할 수 있', '수행', '안정적', '안정하게', '유창', '정확', '완료', '성취', '잘한다', '잘함', '스스로'];

const IEP_RULES: Rule[] = [
  { words: ['10까지 세', '10까지'], ids: ['N05_count_sequence_to_10', 'N07_count_objects_to_10', 'N08_produce_set_to_10'] },
  { words: ['5까지 세', '5까지'], ids: ['N06_count_objects_to_5'] },
  { words: ['한 자리 수 덧셈'], ids: ['N19_add_within_5', 'N21_add_within_9_equation'] },
  { words: ['한 자리 수 뺄셈'], ids: ['N20_sub_within_5', 'N22_sub_within_9_equation'] },
  {
    words: ['덧셈·뺄셈'],
    ids: ['N18_add_sub_meaning', 'N19_add_within_5', 'N20_sub_within_5', 'N21_add_within_9_equation', 'N22_sub_within_9_equation'],
  },
  { words: ['10 만들기', '10의 보수'], ids: ['N16_ten_complements'] },
  { words: ['받아올림'], ids: ['N26_add_single_digit_carry'] },
  { words: ['받아내림'], ids: ['N27_sub_teen_borrow'] },
  {
    words: ['두 자리 수 덧셈', '두 자리 수 뺄셈'],
    ids: ['N33_add_sub_two_digit_no_regroup', 'N34_add_sub_two_digit_regroup'],
  },
  { words: ['두 자리 수'], ids: ['N29_two_digit_place_value', 'N31_compare_two_digit'] },
  { words: ['몇십'], ids: ['N28_ten_as_unit', 'N32_add_sub_tens'] },
  { words: ['자릿값', '자리값'], ids: ['N29_two_digit_place_value'] },
  { words: ['곱셈구구'], ids: ['N39_mult_table'] },
  { words: ['곱셈'], ids: ['N38_mult_meaning'] },
  { words: ['가르기', '모으기'], ids: ['N15_compose_decompose_to_10'] },
  { words: ['5 이하 가르'], ids: ['N14_compose_decompose_to_5'] },
  { words: ['이어 세', '이어서 세'], ids: ['N13_count_on_from_n'] },
  { words: ['100까지', '백까지'], ids: ['N30_count_to_100_sequence'] },
  { words: ['묶어 세', '뛰어 세'], ids: ['N37_skip_counting'] },
  { words: ['0의 개념'], ids: ['N10_zero'] },
];

/** 문장에서 개념을 찾는다: 키워드 규칙 + 노드 라벨(괄호 앞 부분) 직접 매칭. */
function nodesFromText(text: string): string[] {
  const out: string[] = [];
  for (const rule of IEP_RULES) {
    if (rule.words.some((w) => text.includes(w))) out.push(...rule.ids);
  }
  for (const id of graph.nodeIds) {
    const core = nodeSpec(id).label.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (core.length >= 3 && text.includes(core)) out.push(id);
  }
  return [...new Set(out)].sort((a, b) => nodeNumber(a) - nodeNumber(b));
}

/**
 * IEP 현행수준 문장에서 노드 상태 초안을 뽑는다.
 * - 문장 단위(. ! ? 줄바꿈)로 나누고, 문장마다 상태를 한 번만 정한다.
 * - 상태 표현이 없는 문장은 건너뛴다(추측하지 않는다).
 * - 같은 개념이 여러 문장에 나오면 마지막 문장이 이긴다.
 * - 결과는 어디까지나 초안. UI에서 교사가 표로 확인·수정한다.
 */
export function draftStatesFromIep(text: string): Record<string, State> {
  const out: Record<string, State> = {};
  for (const raw of text.split(/[.!?\n]+/)) {
    // "도움 없이 해결"은 형성 중('도움')이 아니라 숙달('스스로')이다.
    const s = raw.replace(/도움\s*없이|도움없이/g, '스스로').trim();
    if (!s) continue;
    const state: State | null = NEG_WORDS.some((w) => s.includes(w))
      ? 'not_started'
      : PART_WORDS.some((w) => s.includes(w))
        ? 'emerging'
        : POS_WORDS.some((w) => s.includes(w))
          ? 'mastered'
          : null;
    if (!state) continue;
    for (const id of nodesFromText(s)) out[id] = state;
  }
  return out;
}

/** 예시 IEP 현행수준 문장 (student_A.yaml의 서술 예와 같은 내용). */
export const SAMPLE_IEP_TEXT =
  '10까지 세고 한 자리 수 덧셈·뺄셈은 구체물로 해결함. 10 만들기는 아직 불안정. 받아올림 덧셈은 시도하지 않음.';
