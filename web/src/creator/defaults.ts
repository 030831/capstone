// 형태별 시작 예시(지시서 §6) — "형태를 고르면 편집 가능한 시작 예시가 즉시 생성된다".
// 빈 글상자에서 시작하지 않는다. 예시 문장은 교사가 모두 수정할 수 있다.
import { uid } from './util';
import type {
  CompareProblem,
  CountProblem,
  EquationProblem,
  Problem,
  ProblemKind,
  StudentRef,
  TwoGroupsProblem,
  Work,
} from './types';
export const DEFAULT_QUESTION: Record<ProblemKind, string> = {
  count: '그림은 모두 몇 개인가요?',
  two_groups: '모두 몇 개인가요?',
  equation: '알맞은 수를 써 넣으세요.',
  compare: '어느 쪽이 더 많나요?',
};

export function makeProblem(kind: ProblemKind): Problem {
  const base = {
    id: uid('p'),
    kind,
    question: DEFAULT_QUESTION[kind],
    questionSize: 'normal' as const,
    response: { mode: 'blank' as const, choices: [], correctIndex: 0, blankSize: 'medium' as const },
    hint: {
      enabled: false,
      text: '',
      pictureCount: 0,
      pictogram: 'circle' as const,
      showInPrint: false,
    },
  };
  switch (kind) {
    case 'count':
      return { ...base, kind, pictogram: 'apple', count: 4, perRow: 5, itemSize: 'medium' } satisfies CountProblem;
    case 'two_groups':
      return {
        ...base,
        kind,
        left: { count: 2, pictogram: 'star' },
        right: { count: 3, pictogram: 'ball' },
        showBorder: true,
        showSymbols: true,
        displayMode: 'both',
      } satisfies TwoGroupsProblem;
    case 'equation':
      return { ...base, kind, operation: 'add', a: 3, b: 2, blank: 'result', showPictures: false, pictogram: 'circle' } satisfies EquationProblem;
    case 'compare':
      return {
        ...base,
        kind,
        left: { count: 3, pictogram: 'apple' },
        right: { count: 5, pictogram: 'apple' },
        showPictures: true,
        showNumbers: true,
        questionMode: 'more',
        responseMode: 'choice',
      } satisfies CompareProblem;
  }
}

/** 예시 작업(가상 데이터). 실제 학생 기록처럼 꾸미지 않는다 — isExample 표시를 UI 에서 항상 함께 보여준다. */
export function makeExampleWork(): Work {
  const now = Date.now();
  const p1 = makeProblem('count') as CountProblem;
  p1.count = 7;
  p1.perRow = 4;
  p1.question = '사과는 모두 몇 개인가요?';

  const p2 = makeProblem('two_groups') as TwoGroupsProblem;
  p2.left = { count: 4, pictogram: 'star' };
  p2.right = { count: 3, pictogram: 'star' };

  const p3 = makeProblem('equation') as EquationProblem;
  p3.operation = 'add';
  p3.a = 8;
  p3.b = 5;
  p3.blank = 'result';

  const p4 = makeProblem('compare') as CompareProblem;
  p4.left = { count: 6, pictogram: 'ball' };
  p4.right = { count: 6, pictogram: 'ball' };
  p4.questionMode = 'same';
  p4.question = '두 묶음의 개수가 같나요?';

  const sA: StudentRef = { id: uid('s'), displayName: '가상 학생 A', iepGoal: '10까지의 수 세기와 묶기 활동 참여 (예시 목표)', supportNote: '한 줄에 5개까지 보여 주기 (예시 메모)' };
  const sB: StudentRef = { id: uid('s'), displayName: '가상 학생 B', iepGoal: '두 수의 합 구하기 (예시 목표)', supportNote: '' };

  // 학생 A 용 독립 버전: 공통을 복사해 일부만 바꾼 상태로 제공.
  const copySet = (mods: (p: Problem) => void, onlyKind: Problem['kind']): { problems: Record<string, Problem>; order: string[] } => {
    const problems: Record<string, Problem> = {};
    const order: string[] = [];
    for (const src of [p1, p2, p3, p4]) {
      const c = structuredClone(src);
      c.id = uid('p');
      if (c.kind === onlyKind) mods(c);
      problems[c.id] = c;
      order.push(c.id);
    }
    return { problems, order };
  };

  return {
    id: uid('w'),
    name: '예시 작업 (가상 데이터)',
    createdAt: now,
    updatedAt: now,
    students: [sA, sB],
    common: { problems: Object.fromEntries([p1, p2, p3, p4].map((p) => [p.id, p])), order: [p1.id, p2.id, p3.id, p4.id] },
    studentSets: {
      [sA.id]: copySet((p) => {
        if (p.kind === 'count') {
          p.count = 5;
          p.perRow = 5;
        }
      }, 'count'),
    },
    selectedVersion: 'common',
    selectedProblemId: p1.id,
    worksheetTitle: '수학 학습지 (예시)',
    isExample: true,
  };
}

export function makeEmptyWork(name: string): Work {
  const now = Date.now();
  return {
    id: uid('w'),
    name,
    createdAt: now,
    updatedAt: now,
    students: [],
    common: { problems: {}, order: [] },
    studentSets: {},
    selectedVersion: 'common',
    selectedProblemId: null,
    worksheetTitle: name,
  };
}
