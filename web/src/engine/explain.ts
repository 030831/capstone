// checker/explain.py 의 템플릿 한국어 설명 포팅. LLM 호출 없음.
// 2026-11-07 개정: 4상태(unknown 포함)·NEEDS_REVIEW 반영. unknown(기록 없음)과
// 미확보(시작 전·형성 중)를 문장에서도 구분한다. 처방 톤은 쓰지 않는다.
import type { Verdict } from './types';

// 받침이 있는 한글 숫자 읽기: 영·일·삼·육·칠·팔
const DIGIT_BATCHIM = new Set('013678');

/** 단어 끝소리에 받침이 있는지 판단한다(한글·숫자만 판단, 기호는 건너뜀). */
function hasBatchim(word: string): boolean {
  const chars = Array.from(word).reverse();
  for (const ch of chars) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
    if (/[0-9]/.test(ch)) return DIGIT_BATCHIM.has(ch);
    // Python str.isalpha() 에 해당(한글 음절은 위에서 처리됨)
    if (/\p{L}/u.test(ch)) return false;
  }
  return false;
}

/** 받침 유무에 따라 조사를 붙인다. pair 는 "을/를" 처럼 (받침 있을 때/없을 때). */
export function josa(word: string, pair: string): string {
  const [withB, withoutB] = pair.split('/');
  return word + (hasBatchim(word) ? withB : withoutB);
}

/** 라벨들을 'A', 'B' 형태로 이어 붙인다. */
export function quoteLabels(labels: readonly string[]): string {
  return labels.map((x) => `'${x}'`).join(', ');
}

/** 미확인(기록 없음) 항목 안내 문장. 선수/요구 개념을 구분한다. */
function unknownSentence(unknownHard: readonly string[], unknownRequired: readonly string[]): string {
  const parts: string[] = [];
  if (unknownHard.length > 0) parts.push(`선수 개념 ${quoteLabels(unknownHard)}`);
  if (unknownRequired.length > 0) parts.push(`이 문제의 개념 ${quoteLabels(unknownRequired)}`);
  return `${parts.join(' 와(과) ')}의 기록이 아직 확인되지 않았습니다.`;
}

export interface ExplainArgs {
  verdict: Verdict;
  requires: readonly string[];
  gapHard: readonly string[];
  gapSoft: readonly string[];
  unknownHard: readonly string[];
  unknownRequired: readonly string[];
  suggestedNext: readonly string[];
  unmasteredRequires: readonly string[];
}

/** 판정 결과를 한국어 문장으로 설명한다. 모든 인자는 노드 *라벨* 배열이다. */
export function explainLabels(a: ExplainArgs): string {
  const req = josa(quoteLabels(a.requires), '을/를');
  const unknownPart = unknownSentence(a.unknownHard, a.unknownRequired);
  const softPart =
    a.gapSoft.length > 0
      ? ` 참고로 권장 선수 개념 ${josa(quoteLabels(a.gapSoft), '이/가')} 아직 시작 전이거나 형성 중입니다.`
      : '';

  if (a.verdict === 'COLLISION') {
    let text =
      `이 문제는 ${req} 요구하는데, 학생의 선수 개념 ` +
      `${josa(quoteLabels(a.gapHard), '이/가')} 시작 전이거나 형성 중입니다.`;
    if (a.unknownHard.length > 0 || a.unknownRequired.length > 0) text += ' ' + unknownPart;
    if (a.suggestedNext.length > 0) {
      text += ` ${quoteLabels(a.suggestedNext)}은(는) 선수 개념이 모두 숙달로 확인된 개념입니다.`;
    }
    return text + softPart;
  }
  if (a.verdict === 'NEEDS_REVIEW') {
    return `이 문제는 ${req} 요구하는데, ${unknownPart} 기록을 확인한 뒤 다시 검사할 수 있습니다.` + softPart;
  }
  if (a.verdict === 'TOO_EASY') {
    return `이 문제가 요구하는 ${josa(req, '은/는')} 학생 기록에서 모두 숙달로 확인됩니다.`;
  }
  // ALIGNED
  return (
    `이 문제는 ${req} 요구하며, 필수 선수 개념은 모두 숙달로 기록되어 있고 ` +
    `${josa(quoteLabels(a.unmasteredRequires), '은/는')} 아직 숙달로 기록되지 않았습니다.` +
    softPart
  );
}
