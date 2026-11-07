// 작성 오류 검증(지시서 §8). 교육적 적합성 검사가 아니다.
// "좋은 문제입니다" 같은 판정은 하지 않는다. 오류가 있어도 초안 저장은 허용한다.
// 학습지 출력 전에 오류 목록을 보여주고 문제로 이동할 수 있게 한다.
import { computedAnswer } from './answers';
import type { Problem } from './types';

export type IssueLevel = 'error' | 'warn';

export interface ProblemIssue {
  problemId: string;
  level: IssueLevel;
  /** 오류가 붙는 요소('question' | 'response' | 'pictures' | 'equation' | 'hint' | 'problem'). */
  element: string;
  message: string;
}

const RANGE_MAX = 20; // 편집기 지원 범위 (교육학적 기준이 아님 — 지시서 §6.1)

export function validateProblem(p: Problem): ProblemIssue[] {
  const issues: ProblemIssue[] = [];
  const add = (element: string, message: string, level: IssueLevel = 'error'): void => {
    issues.push({ problemId: p.id, level, element, message });
  };

  if (!p.question.trim()) add('question', '질문 문장이 비어 있어요.');

  // 수량 범위 (편집기 지원 범위 안내)
  if (p.kind === 'count') {
    if (p.count < 1 || p.count > RANGE_MAX) add('pictures', `그림 개수는 1~${RANGE_MAX} 사이로 지정해 주세요 (지원 범위).`);
    if (p.perRow < 1 || p.perRow > 10) add('pictures', '한 줄 개수는 1~10 사이로 지정해 주세요.');
    if (p.count > 12 && p.itemSize === 'large') add('pictures', '그림이 많아 한 페이지에 다 들어가지 않을 수 있어요. 크기를 줄여 보세요.', 'warn');
  }
  if (p.kind === 'two_groups' || p.kind === 'compare') {
    for (const side of ['left', 'right'] as const) {
      const g = p[side];
      if (g.count < 1 || g.count > RANGE_MAX) add('pictures', `${side === 'left' ? '왼쪽' : '오른쪽'} 수량은 1~${RANGE_MAX} 사이로 지정해 주세요 (지원 범위).`);
    }
  }
  if (p.kind === 'equation') {
    for (const [name, v] of [['첫 번째 수', p.a], ['두 번째 수', p.b]] as const) {
      if (v < 0 || v > RANGE_MAX) add('equation', `${name}은 0~${RANGE_MAX} 사이로 지정해 주세요 (지원 범위).`);
    }
    const result = p.operation === 'add' ? p.a + p.b : p.a - p.b;
    if (result < 0) add('equation', '뺄셈 결과는 0 이상이어야 해요 (지원 범위). 두 수의 순서를 확인해 주세요.');
    if (result > RANGE_MAX) add('equation', `계산 결과가 ${RANGE_MAX}을 넘어요 (지원 범위: 0~${RANGE_MAX}).`);
  }
  if (p.kind === 'compare' && p.responseMode === 'symbol' && !p.showNumbers) {
    // 비교 기호를 쓰려면 비교할 수가 보여야 한다.
    add('pictures', '비교 기호 빈칸 방식에서는 숫자를 함께 보여 주세요.', 'warn');
  }

  // 응답 방식
  if (p.response.mode === 'choices') {
    const nonEmpty = p.response.choices.filter((c) => c.trim());
    if (p.response.choices.length === 0 || nonEmpty.length === 0) {
      add('response', '선택지 방식인데 선택지가 없어요. 선택지를 채워 주세요.');
    } else {
      if (p.response.choices.some((c) => !c.trim())) add('response', '비어 있는 선택지가 있어요.');
      const seen = new Set<string>();
      for (const c of nonEmpty) {
        if (seen.has(c)) {
          add('response', `같은 선택지가 반복돼요: '${c}'`);
          break;
        }
        seen.add(c);
      }
      const { correctIndex } = p.response;
      if (correctIndex < 0 || correctIndex >= p.response.choices.length || !p.response.choices[correctIndex]?.trim()) {
        add('response', '정답으로 지정한 선택지가 없어요. 정답에 ○ 표시로 지정해 주세요.');
      }
      const ans = computedAnswer(p);
      if (ans !== null && correctIndex >= 0 && correctIndex < p.response.choices.length && p.response.choices[correctIndex]?.trim() === ans) {
        // 정답 지정이 계산 결과와 일치 — 문제 없음.
      } else if (ans !== null && nonEmpty.length > 0) {
        add('response', `계산된 정답은 '${ans}'이에요. 정답 선택지와 다르게 지정되어 있어요.`);
      }
    }
  }

  // 힌트
  if (p.hint.enabled && !p.hint.text.trim() && p.hint.pictureCount === 0) {
    add('hint', '힌트를 켰는데 내용이 없어요. 안내 문장이나 보조 그림을 넣어 주세요.');
  }
  return issues;
}

export function hasError(issues: ProblemIssue[]): boolean {
  return issues.some((i) => i.level === 'error');
}
