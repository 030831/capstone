// 룰 기반 초안 제안 (LLM 없음, 결정적). 스펙 원칙: 최종 확정은 교사.
// 두 가지 기능:
//   (1) suggestConcepts(문제 글)   → "문제에서 찾은 개념 후보" (교사가 눌러서 담음)
//   (2) draftIepFromText(현행수준 문장, 현재 상태) → 상태 변경 제안 + 확인 필요 항목
//       (미리 보기일 뿐 — "선택한 내용 적용"을 누르기 전까지 학생 데이터는 바뀌지 않는다)
// 이 모듈은 engine 판정에 아무 영향을 주지 않는다.
//
// 규칙 설계 원칙(2026-11-07 지시서 §4·§5):
// - 구체적인 연산·숫자 규칙이 일반 키워드보다 우선한다(우선도 순 상위 6개만 표시).
// - 수식이 명확하지 않으면 숫자 기반 후보를 보류한다(문항 번호·문맥 숫자 조합 금지).
// - "못함"을 "미시작"과 동일시하지 않는다. 미시작은 명시적 표현이 있을 때만 제안한다.
// - 한 문장에 긍정·부정이 섞였거나 어느 개념인지 구분되지 않으면 판단을 보류한다.
import type { State, States } from '../engine';
import { graph, nodeSpec } from '../graph';
import { nodeNumber } from './groups';

// ── (1) 문제 글 → 개념 후보 ─────────────────────────────────────────
export interface ConceptHint {
  id: string;
  /** 어떤 단어/수식이 근거인지(예: "받아올림", "8+5처럼 합이 10을 넘는 덧셈"). */
  hit: string;
  /** 우선도. 클수록 먼저 표시한다. 3=명시적 수식, 2=좁은 키워드, 1=넓은 키워드. */
  priority: number;
}

interface Rule {
  words: string[];
  ids: string[];
  priority: 1 | 2;
}

// 좁은 단서(구체적 표현) — 우선도 2.
const SPECIFIC_RULES: Rule[] = [
  { words: ['받아올림'], ids: ['N26_add_single_digit_carry', 'N34_add_sub_two_digit_regroup'], priority: 2 },
  { words: ['받아내림'], ids: ['N27_sub_teen_borrow', 'N34_add_sub_two_digit_regroup'], priority: 2 },
  { words: ['곱셈구구', '구구단'], ids: ['N39_mult_table'], priority: 2 },
  { words: ['곱셈', '곱하기', '×', '배수'], ids: ['N38_mult_meaning', 'N39_mult_table'], priority: 2 },
  { words: ['뛰어 세', '뛰어세', '묶어 세', '2씩', '5씩', '10씩'], ids: ['N37_skip_counting'], priority: 2 },
  { words: ['세 수', '세 개의 수'], ids: ['N35_three_addends'], priority: 2 },
  { words: ['□', '빈칸', '알맞은 수', '들어갈 수'], ids: ['N36_missing_number_equation'], priority: 2 },
  { words: ['몇십', '십의 자리'], ids: ['N28_ten_as_unit', 'N32_add_sub_tens'], priority: 2 },
  { words: ['자릿값', '자리값'], ids: ['N29_two_digit_place_value'], priority: 2 },
  { words: ['10의 보수', '10 만들기', '텐프레임', '텐 프레임'], ids: ['N16_ten_complements'], priority: 2 },
  { words: ['10에서 빼', '10 빼기'], ids: ['N25_sub_from_10'], priority: 2 },
  {
    words: ['두 통', '두 그릇', '두 무리', '나누어 담', '나눠 담', '가르기', '가르고'],
    ids: ['N15_compose_decompose_to_10', 'N16_ten_complements'],
    priority: 2,
  },
  { words: ['십몇', '십과 몇'], ids: ['N17_teen_as_ten_and_ones'], priority: 2 },
  { words: ['이어 세', '이어서 세'], ids: ['N13_count_on_from_n'], priority: 2 },
  { words: ['번째', '첫째', '둘째'], ids: ['N12_ordinal_to_10'], priority: 2 },
  {
    words: ['크기 비교', '더 큰', '더 작은', '어느 쪽이 많', '많은지', '적은지'],
    ids: ['N11_compare_numbers_to_10', 'N02_perceptual_compare'],
    priority: 2,
  },
  { words: ['짝짓', '짝을', '대응'], ids: ['N01_one_to_one_matching'], priority: 2 },
  { words: ['세지 않고', '한눈에'], ids: ['N04_subitize_small'], priority: 2 },
  { words: ['꺼내', '만큼 가져'], ids: ['N08_produce_set_to_10'], priority: 2 },
  { words: ['읽고 쓰', '숫자를 쓰'], ids: ['N09_numerals_to_9'], priority: 2 },
  { words: ['100까지', '백까지'], ids: ['N30_count_to_100_sequence'], priority: 2 },
  { words: ['0을 더', '0 더하기', '0을 빼', '0 빼기'], ids: ['N23_add_sub_with_zero'], priority: 2 },
  {
    words: ['두 자리 수 덧셈', '두 자리 수 더하기', '두 자리 수 뺄셈', '두 자리 수 빼기'],
    ids: ['N33_add_sub_two_digit_no_regroup', 'N34_add_sub_two_digit_regroup'],
    priority: 2,
  },
  { words: ['두 자리 수'], ids: ['N29_two_digit_place_value', 'N31_compare_two_digit'], priority: 2 },
];

// 넓은 단서(일반적 표현) — 우선도 1. 명시적 수식·좁은 규칙이 못 잡았을 때의 기본 후보.
const GENERAL_RULES: Rule[] = [
  {
    words: ['덧셈', '더하기', '더하', '더 받', '더 먹', '더 준', '합쳐', '합하', '모두 몇', '전부 몇', '+'],
    ids: ['N18_add_sub_meaning', 'N19_add_within_5', 'N21_add_within_9_equation'],
    priority: 1,
  },
  {
    words: ['뺄셈', '빼기', '뺐', '남을까', '남았', '가져가', '먹었', '−', '-'],
    ids: ['N18_add_sub_meaning', 'N20_sub_within_5', 'N22_sub_within_9_equation'],
    priority: 1,
  },
];

/** 수량 표시로 쓰일 수 없는 숫자(문항 번호·순서·연도 등)의 접미어. */
const NON_QUANTITY_SUFFIX = /^(번째|번|자리|학년|년|월|일|쪽|페이지)/;
/** 덧셈 동사·표현(수량과 함께 쓰였을 때만 두 수의 관계를 본다). */
const ADD_VERB = /더\s*(?:받|먹|주|했|하|있)|합쳐|합하|모두|모아서/;
/** 뺄셈 동사·표현. */
const SUB_VERB = /빼|뺐|가져가|먹었|남았|남을|없어/;

/** 문제 속 **명시적 수식**(연산 기호/연산 단어가 있는 두 수)과, 수량 단위가 붙은 두 수가
 * 연산 동사와 함께 쓰인 문장에서 개념을 좁힌다.
 * 수식·동사가 분명하지 않으면 숫자 기반 후보를 보류한다 — 문항 번호나 문맥 속 숫자를
 * 임의로 조합하지 않는다. 받아내림 여부는 일의 자리 대소로 구분한다(15−3 ≠ 13−5). */
function numberHints(text: string): ConceptHint[] {
  const out: ConceptHint[] = [];
  const push = (id: string, hit: string) => out.push({ id, hit, priority: 3 });

  const addPair = (a: number, b: number, why: string) => {
    if (a >= 1 && a <= 9 && b >= 1 && b <= 9) {
      const sum = a + b;
      if (sum > 10) {
        push('N26_add_single_digit_carry', `${why} 합이 10을 넘는 덧셈(${a}+${b})`);
        push('N16_ten_complements', '10을 넘는 덧셈의 준비');
      } else if (sum === 10) {
        push('N16_ten_complements', `${why} 합이 10인 덧셈(${a}+${b})`);
      } else if (sum <= 5) {
        push('N19_add_within_5', `${why} 합이 5 이하(${a}+${b})`);
      } else {
        push('N21_add_within_9_equation', `${why} 합이 9 이하(${a}+${b})`);
      }
    } else if (a >= 10 && a <= 99 && b >= 1 && b <= 99) {
      const carry = (a % 10) + (b % 10) >= 10;
      push(carry ? 'N34_add_sub_two_digit_regroup' : 'N33_add_sub_two_digit_no_regroup',
        `${why} 받아올림 ${carry ? '있' : '없'}는 두 자리 덧셈(${a}+${b})`);
    }
  };

  const subPair = (a: number, b: number, why: string) => {
    if (a === 10 && b >= 1 && b <= 9) {
      push('N25_sub_from_10', `${why} 10에서 빼기(${a}−${b})`);
    } else if (a >= 11 && a <= 19 && b >= 1 && b <= 9) {
      // 십몇 − 몇: 일의 자리가 빼는 수보다 작으면 받아내림.
      const borrow = a % 10 < b;
      push(borrow ? 'N27_sub_teen_borrow' : 'N33_add_sub_two_digit_no_regroup',
        `${why} 받아내림 ${borrow ? '있' : '없'}는 (십몇)−(몇)(${a}−${b})`);
    } else if (a >= 1 && a <= 9 && b >= 1 && b <= 9 && a > b) {
      if (a <= 5) push('N20_sub_within_5', `${why} 피감수 5 이하 뺄셈(${a}−${b})`);
      else push('N22_sub_within_9_equation', `${why} 피감수 9 이하 뺄셈(${a}−${b})`);
    } else if (a >= 10 && a <= 99 && b >= 10 && b <= 99) {
      const borrow = a % 10 < b % 10 || Math.floor(a / 10) < Math.floor(b / 10);
      push(borrow ? 'N34_add_sub_two_digit_regroup' : 'N33_add_sub_two_digit_no_regroup',
        `${why} 받아내림 ${borrow ? '있' : '없'}는 두 자리 뺄셈(${a}−${b})`);
    }
  };

  // 1) 연산 기호/연산 단어가 명시된 수식: "8+5", "13−5", "3 곱하기 4"
  let hasExplicitExpr = false;
  for (const m of text.matchAll(/(\d+)\s*(?:\+|＋|더하기)\s*(\d+)/g)) {
    hasExplicitExpr = true;
    addPair(parseInt(m[1], 10), parseInt(m[2], 10), '수식');
  }
  for (const m of text.matchAll(/(\d+)\s*(?:−|－|-|빼기)\s*(\d+)/g)) {
    hasExplicitExpr = true;
    subPair(parseInt(m[1], 10), parseInt(m[2], 10), '수식');
  }
  for (const m of text.matchAll(/(\d+)\s*(?:×|✕|곱하기)\s*(\d+)/g)) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a >= 2 && a <= 9 && b >= 2 && b <= 9) {
      push('N39_mult_table', `${a}×${b} 곱셈구구`);
      out.push({ id: 'N38_mult_meaning', hit: '곱셈식', priority: 2 });
    } else {
      push('N38_mult_meaning', `${a}×${b} 곱셈`);
    }
  }

  // 2) 자연어 수량 문장: 수식이 없고, 수량 숫자가 정확히 2개이며 연산 동사가 있을 때만 본다.
  if (!hasExplicitExpr) {
    const quantities: number[] = [];
    for (const m of text.matchAll(/\d+/g)) {
      const after = text.slice(m.index + m[0].length);
      if (!NON_QUANTITY_SUFFIX.test(after)) quantities.push(parseInt(m[0], 10));
    }
    if (quantities.length === 2) {
      const [x, y] = quantities;
      if (ADD_VERB.test(text)) addPair(Math.min(x, y), Math.max(x, y), '문장 속 두 수');
      else if (SUB_VERB.test(text)) subPair(Math.max(x, y), Math.min(x, y), '문장 속 두 수');
    }
  }

  return out;
}

/** 문제 글에서 개념 후보를 뽑는다. 후보일 뿐이며 확정은 교사가 한다.
 * 우선도(명시적 수식 3 > 좁은 키워드 2 > 넓은 키워드 1) 순으로 최대 6개,
 * 동률일 때만 개념 ID(노드 번호) 오름차순으로 안정적으로 정렬한다. */
export function suggestConcepts(text: string): ConceptHint[] {
  const t = text.replace(/\s+/g, ' ');
  if (!t.trim()) return [];
  const best = new Map<string, ConceptHint>();
  const add = (h: ConceptHint): void => {
    const prev = best.get(h.id);
    if (!prev || h.priority > prev.priority) best.set(h.id, h);
  };
  for (const rule of [...SPECIFIC_RULES, ...GENERAL_RULES]) {
    const w = rule.words.find((x) => t.includes(x));
    if (w) for (const id of rule.ids) add({ id, hit: w, priority: rule.priority });
  }
  for (const h of numberHints(t)) add(h);
  return [...best.values()]
    .sort((a, b) => b.priority - a.priority || nodeNumber(a.id) - nodeNumber(b.id))
    .slice(0, 6);
}

// ── (2) IEP 현행수준 문장 → 상태 변경 제안(미리 보기) ──────────────────

export interface IepProposal {
  node: string;
  current: State;
  proposed: State;
  /** 제안의 근거가 된 문장. */
  evidence: string;
}

export interface IepReviewItem {
  node: string;
  evidence: string;
  /** 확인이 필요한 이유(교사에게 설명). */
  note: string;
}

export interface IepDraftResult {
  /** 자동 제안 가능한 항목(교사가 적용할 항목을 선택한다). */
  proposals: IepProposal[];
  /** 판단을 보류한 항목(상태를 자동으로 바꾸지 않는다). */
  needsReview: IepReviewItem[];
}

// 명시적 미시작 표현 — 이 표현이 있을 때만 not_started 를 제안한다.
const NOT_STARTED_WORDS = ['다루지 않', '시작하지 않', '시도하지 않', '미시작', '학습하지 않', '배우지 않', '지도한 적 없', '경험한 적 없'];
// 부정적 수행 표현 — 미시작과 동일시하지 않는다(판단 보류).
const NEG_PERF_WORDS = ['못하', '못함', '못했', '어려워', '힘들', '실패', '미숙'];
// 형성 중 표현(지원 조건 포함 — 지원을 받아 해결했다는 서술은 독립 수행이 아니다).
const PART_WORDS = ['불안정', '형성', '시도', '연습 중', '아직', '부분', '가끔', '발달 중', '도움', '구체물', '지원', '프롬프트', '힌트'];
// 긍정(독립 수행) 표현.
const POS_WORDS = ['해결', '할 수 있', '수행', '안정적', '안정하게', '유창', '정확', '완료', '성취', '잘한다', '잘함', '스스로'];

interface IepRule {
  words: string[];
  ids: string[];
  /** 여러 노드에 대응하면 자동 제안하지 않고 확인 필요로 돌린다. */
  ambiguous: boolean;
}

// 한 개념으로 좁혀지는 규칙(제안 가능).
const SINGLE_IEP_RULES: IepRule[] = [
  { words: ['5까지 세'], ids: ['N06_count_objects_to_5'], ambiguous: false },
  { words: ['10 만들기', '10의 보수'], ids: ['N16_ten_complements'], ambiguous: false },
  { words: ['받아올림'], ids: ['N26_add_single_digit_carry'], ambiguous: false },
  { words: ['받아내림'], ids: ['N27_sub_teen_borrow'], ambiguous: false },
  { words: ['자릿값', '자리값'], ids: ['N29_two_digit_place_value'], ambiguous: false },
  { words: ['곱셈구구', '구구단'], ids: ['N39_mult_table'], ambiguous: false },
  { words: ['곱셈'], ids: ['N38_mult_meaning'], ambiguous: false },
  { words: ['가르기', '모으기'], ids: ['N15_compose_decompose_to_10'], ambiguous: false },
  { words: ['5 이하 가르'], ids: ['N14_compose_decompose_to_5'], ambiguous: false },
  { words: ['이어 세', '이어서 세'], ids: ['N13_count_on_from_n'], ambiguous: false },
  { words: ['100까지', '백까지'], ids: ['N30_count_to_100_sequence'], ambiguous: false },
  { words: ['묶어 세', '뛰어 세'], ids: ['N37_skip_counting'], ambiguous: false },
  { words: ['0의 개념'], ids: ['N10_zero'], ambiguous: false },
];

// 여러 개념으로 해석될 수 있는 규칙 — 자동 제안하지 않는다.
// 예: "두 자리 수 덧셈을 해결함"만으로 받아올림 있/없음과 수 비교까지 숙달로 두지 않는다.
const AMBIGUOUS_IEP_RULES: IepRule[] = [
  { words: ['10까지 세', '10까지'], ids: ['N05_count_sequence_to_10', 'N07_count_objects_to_10', 'N08_produce_set_to_10'], ambiguous: true },
  { words: ['한 자리 수 덧셈'], ids: ['N19_add_within_5', 'N21_add_within_9_equation'], ambiguous: true },
  { words: ['한 자리 수 뺄셈'], ids: ['N20_sub_within_5', 'N22_sub_within_9_equation'], ambiguous: true },
  { words: ['덧셈·뺄셈', '덧뺄셈'], ids: ['N18_add_sub_meaning', 'N19_add_within_5', 'N20_sub_within_5', 'N21_add_within_9_equation', 'N22_sub_within_9_equation'], ambiguous: true },
  { words: ['두 자리 수 덧셈', '두 자리 수 더하기', '두 자리 수 뺄셈', '두 자리 수 빼기'], ids: ['N33_add_sub_two_digit_no_regroup', 'N34_add_sub_two_digit_regroup'], ambiguous: true },
  { words: ['두 자리 수'], ids: ['N29_two_digit_place_value', 'N31_compare_two_digit'], ambiguous: true },
  { words: ['몇십'], ids: ['N28_ten_as_unit', 'N32_add_sub_tens'], ambiguous: true },
];

interface MatchedConcept {
  node: string;
  ambiguous: boolean;
}

/** 문장에서 언급된 개념을 찾는다: 키워드 규칙 + 노드 라벨(괄호 앞) 직접 매칭. */
function conceptsFromSentence(text: string): MatchedConcept[] {
  const out = new Map<string, MatchedConcept>();
  for (const rule of [...SINGLE_IEP_RULES, ...AMBIGUOUS_IEP_RULES]) {
    if (rule.words.some((w) => text.includes(w))) {
      for (const id of rule.ids) out.set(id, { node: id, ambiguous: rule.ambiguous });
    }
  }
  for (const id of graph.nodeIds) {
    const core = nodeSpec(id).label.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (core.length >= 3 && text.includes(core)) out.set(id, { node: id, ambiguous: false });
  }
  return [...out.values()].sort((a, b) => nodeNumber(a.node) - nodeNumber(b.node));
}

type Polarity = 'not_started_explicit' | 'neg_perf' | 'mixed' | 'part' | 'pos' | 'none';

/** 문장의 상태 표현을 분류한다. 우선순위: 명시적 미시작/부정 > 혼재 > 형성 중 > 긍정. */
function classifySentence(s: string): Polarity {
  const notStarted = NOT_STARTED_WORDS.some((w) => s.includes(w));
  const negPerf = NEG_PERF_WORDS.some((w) => s.includes(w));
  const pos = POS_WORDS.some((w) => s.includes(w));
  const part = PART_WORDS.some((w) => s.includes(w));
  const hasNeg = notStarted || negPerf;
  if (hasNeg && pos) return 'mixed';
  if (notStarted) return 'not_started_explicit';
  if (negPerf) return 'neg_perf';
  if (part) return 'part';
  if (pos) return 'pos';
  return 'none';
}

/**
 * IEP 현행수준 문장에서 상태 변경 제안을 뽑는다(미리 보기용).
 *
 * - 문장 단위(. ! ? 줄바꿈)로 나누고 문장마다 상태를 한 번만 정한다.
 * - 상태 표현이 없는 문장은 건너뛴다(추측하지 않는다).
 * - 한 문장에 긍정·부정이 섞였거나(예: "10까지 세기는 할 수 있지만 받아올림은 못함")
 *   어느 개념인지 구분되지 않으면(예: "두 자리 수 덧셈") 자동 제안하지 않고
 *   확인 필요(needsReview)로 돌린다.
 * - "못함"은 미시작으로 해석하지 않는다(확인 필요).
 * - 결과는 어디까지나 미리 보기. "선택한 내용 적용" 전에는 학생 데이터가 바뀌지 않는다.
 */
export function draftIepFromText(text: string, current: States): IepDraftResult {
  const proposals = new Map<string, IepProposal>();
  const review = new Map<string, IepReviewItem>();
  const conflictNodes = new Set<string>();

  const addReview = (node: string, evidence: string, note: string): void => {
    conflictNodes.add(node);
    proposals.delete(node);
    if (!review.has(node)) review.set(node, { node, evidence, note });
  };

  for (const raw of text.split(/[.!?\n]+/)) {
    // "도움 없이 해결"은 형성 중('도움')이 아니라 긍정('스스로')이다.
    const s = raw.replace(/도움\s*없이|도움없이/g, '스스로').trim();
    if (!s) continue;
    const polarity = classifySentence(s);
    if (polarity === 'none') continue; // 상태 표현이 없는 문장은 추측하지 않는다

    for (const { node, ambiguous } of conceptsFromSentence(s)) {
      if (polarity === 'mixed') {
        addReview(node, s, '한 문장에 잘하는 표현과 못하는 표현이 섞여 있어 자동 제안을 보류해요. 어떤 개념이 어떤 상태인지 직접 확인해 주세요.');
        continue;
      }
      if (polarity === 'neg_perf') {
        addReview(node, s, '"못함/어려워함"은 아직 다루지 않은 것과 다르게 봐요. 시작 전인지 형성 중인지 직접 확인해 주세요.');
        continue;
      }
      if (ambiguous) {
        addReview(node, s, '이 서술만으로는 어느 개념인지 구분되지 않아요(범위·연산 유형 확인 필요). 표에서 직접 골라 주세요.');
        continue;
      }
      if (conflictNodes.has(node)) continue; // 이미 판단 보류된 개념은 제안하지 않는다

      const proposed: State =
        polarity === 'not_started_explicit' ? 'not_started' : polarity === 'part' ? 'emerging' : 'mastered';
      const prev = proposals.get(node);
      if (prev && prev.proposed !== proposed) {
        // 문장 간 상태가 다르게 나오면 판단을 보류한다.
        addReview(node, prev.evidence, '문장마다 기록이 다르게 나와 자동 제안을 보류해요. 어느 문장이 최신 기록인지 직접 확인해 주세요.');
        continue;
      }
      proposals.set(node, { node, current: current[node] ?? 'unknown', proposed, evidence: s });
    }
  }
  return { proposals: proposalsSorted(proposals), needsReview: [...review.values()].sort((a, b) => nodeNumber(a.node) - nodeNumber(b.node)) };
}

function proposalsSorted(proposals: Map<string, IepProposal>): IepProposal[] {
  return [...proposals.values()].sort((a, b) => nodeNumber(a.node) - nodeNumber(b.node));
}

/** 예시 IEP 현행수준 문장 (student_A.yaml의 서술 예와 같은 내용). */
export const SAMPLE_IEP_TEXT =
  '10까지 세고 한 자리 수 덧셈·뺄셈은 구체물로 해결함. 10 만들기는 아직 불안정. 받아올림 덧셈은 시도하지 않음.';
