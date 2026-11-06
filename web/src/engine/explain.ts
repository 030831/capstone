// checker/explain.py 의 템플릿 한국어 설명 포팅. LLM 호출 없음.
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

/** 판정 결과를 한국어 문장으로 설명한다. 모든 인자는 노드 *라벨* 배열이다. */
export function explainLabels(
  verdict: Verdict,
  requires: readonly string[],
  gapHard: readonly string[],
  gapSoft: readonly string[],
  suggestedNext: readonly string[],
  unmasteredRequires: readonly string[],
): string {
  const req = quoteLabels(requires);
  if (verdict === 'COLLISION') {
    return (
      `이 문제는 ${josa(req, '을/를')} 요구하는데, ` +
      `학생은 선수 개념 ${josa(quoteLabels(gapHard), '이/가')} 미도달입니다. ` +
      `${quoteLabels(suggestedNext)}은(는) 지금 바로 다룰 수 있는 선수 개념입니다.`
    );
  }
  if (verdict === 'TOO_EASY') {
    return (
      `이 문제가 요구하는 ${josa(req, '은/는')} 학생이 이미 숙달한 개념이어서 ` +
      '새로운 학습 기회가 되기 어렵습니다.'
    );
  }
  let text =
    `이 문제는 ${josa(req, '을/를')} 요구하며, 학생은 필요한 선수 개념을 모두 갖추었고 ` +
    `${josa(quoteLabels(unmasteredRequires), '은/는')} 아직 숙달 전이므로 ` +
    '지금 도전하기에 적절합니다.';
  if (gapSoft.length > 0) {
    text +=
      ` 다만 권장 선수 개념 ${josa(quoteLabels(gapSoft), '이/가')} ` +
      '미도달이므로 함께 살펴보면 좋습니다.';
  }
  return text;
}
