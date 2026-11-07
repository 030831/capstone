// 정답 계산과 기본 선택지 (지시서 §8).
// 구조화된 수량·수식에서는 정답을 계산한다. 숫자를 바꾸면 정답도 갱신된다.
// 자유롭게 수정한 질문 문장의 의미까지 이해했다고 주장하지 않는다.
import type { CompareProblem, EquationProblem, Problem } from './types';

/** 계산 가능한 정답. 문자열로 통일해 선택지·표시에 함께 쓴다. 계산 불가면 null. */
export function computedAnswer(p: Problem): string | null {
  switch (p.kind) {
    case 'count':
      return String(p.count);
    case 'two_groups':
      return String(p.left.count + p.right.count);
    case 'equation':
      return equationAnswer(p);
    case 'compare':
      return compareAnswer(p);
  }
}

/** 수식의 표시 결과(= 오른쪽 값). blank 가 result 면 이 값이 곧 정답. */
export function equationResult(p: EquationProblem): number {
  return p.operation === 'add' ? p.a + p.b : p.a - p.b;
}

/** 수식에서 가려진 값이 정답이다. */
function equationAnswer(p: EquationProblem): string {
  if (p.blank === 'a') return String(p.a);
  if (p.blank === 'b') return String(p.b);
  return String(equationResult(p));
}

/** 비교 문제의 정답. 같은 수량일 때도 정답·선택지가 일관되게 한다. */
export function compareAnswer(p: CompareProblem): string | null {
  const { left, right, questionMode, responseMode } = p;
  const equal = left.count === right.count;
  if (responseMode === 'symbol') {
    // 비교 기호 빈칸: 크기 방향은 questionMode 와 무관하게 수 자체의 대소를 쓴다.
    // questionMode 'same' 이면 = / ≠ 로 답한다.
    if (questionMode === 'same') return equal ? '=' : '≠';
    return equal ? '=' : left.count > right.count ? '>' : '<';
  }
  if (questionMode === 'same') return equal ? '예' : '아니요';
  // more/less: 같으면 '같음' 이 정답(어느 쪽도 많지/적지 않음).
  if (equal) return '같음';
  if (questionMode === 'more') return left.count > right.count ? '왼쪽' : '오른쪽';
  return left.count < right.count ? '왼쪽' : '오른쪽';
}

/** 선택지 방식으로 바꿀 때 채워 넣는 기본 선택지(수정 가능한 시작값). */
export function defaultChoices(p: Problem): { choices: string[]; correctIndex: number } {
  switch (p.kind) {
    case 'compare': {
      const ans = compareAnswer(p);
      if (p.responseMode === 'symbol') return { choices: ['>', '<', '='], correctIndex: ['>', '<', '='].indexOf(ans ?? '=') };
      if (p.questionMode === 'same') {
        const choices = ans === '예' ? ['예', '아니요'] : ['아니요', '예'];
        return { choices, correctIndex: choices.indexOf(ans ?? '예') };
      }
      return { choices: ['왼쪽', '오른쪽', '같음'], correctIndex: ['왼쪽', '오른쪽', '같음'].indexOf(ans ?? '같음') };
    }
    default: {
      const n = Number(computedAnswer(p));
      // 정답 기준 -1/+1 (0 밑으로 내려가면 0, +1, +2).
      const below = Math.max(0, n - 1);
      const choices = [String(below), String(n), String(n + 1)];
      return { choices, correctIndex: 1 };
    }
  }
}

/** 계산된 정답을 현재 선택지에 반영할 수 있는지(버튼 안내에 쓴다). */
export function answerMissingInChoices(p: Problem): boolean {
  if (p.response.mode !== 'choices') return false;
  const ans = computedAnswer(p);
  if (ans === null) return false;
  return !p.response.choices.some((c) => c.trim() === ans);
}
