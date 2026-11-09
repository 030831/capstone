// 미리 준비한 구성 예시(가상 사례). 목표에 맞는 것만 보여 준다.
// range는 고를 때 목표의 내용 범위로 채운다.

const independentAssessment = (goal, purpose) =>
  purpose === 'assessment' && goal.condition === 'independent';

export const EXAMPLES = [
  {
    id: 'pictures-point-cue',
    title: '그림만 보고 가리키기',
    config: {
      presentation: 'pictures',
      instruction: 'short',
      aligned: true,
      response: 'point',
      support: 'visual-cue',
    },
    fits: (goal) => goal.behavior === 'discriminate' && goal.range === '1-5',
    why: (goal, purpose) =>
      `수 범위 1–5에서 더 많은 쪽을 고르는 목표라 글자나 쓰기 없이 그림과 가리키기만으로 수행이 드러납니다. 짝 지어 정렬한 단서가 일대일 대응을 돕습니다.${
        independentAssessment(goal, purpose)
          ? ' 다만 독립 수행 평가라면 단서를 뺄지 검토할 지점이 생깁니다.'
          : ''
      }`,
    adjustable: ['단서를 빼고 그림만 남기기', '응답을 비교 기호 쓰기로 바꾸기'],
  },
  {
    id: 'pictures-numbers-symbol',
    title: '그림과 숫자, 기호 쓰기',
    config: {
      presentation: 'pictures-numbers',
      instruction: 'short',
      aligned: true,
      response: 'symbol',
      support: 'none',
    },
    fits: (goal) => goal.behavior === 'discriminate',
    why: () =>
      '그림 아래에 수를 함께 보여 주어 수량과 수를 연결하고, 비교 기호로 답해 판별 결과가 기록에 남습니다. 지원이 없어 독립 수행 확인에도 쓸 수 있습니다.',
    adjustable: ['숫자를 빼고 그림만 제시하기', '응답을 가리키기로 바꾸기'],
  },
  {
    id: 'pictures-point-plain',
    title: '그림만, 단서 없이 고르기',
    config: {
      presentation: 'pictures',
      instruction: 'short',
      aligned: false,
      response: 'point',
      support: 'none',
    },
    fits: (goal) => goal.behavior === 'discriminate',
    why: (goal, purpose) =>
      purpose === 'assessment'
        ? '정렬과 단서를 모두 빼서, 현재 수행을 확인하는 평가 목적에 맞춘 구성입니다. 응답은 가리키기라 쓰기 부담이 없습니다.'
        : '정렬하지 않은 그림을 보고 고르게 하여, 단서 없이 비교하는 연습으로 이어 갈 수 있습니다.',
    adjustable: ['한 줄 정렬 켜기', '예시 문항 먼저 보여주기'],
  },
  {
    id: 'numbers-write-partial',
    title: '숫자만 보고 차이 쓰기',
    config: {
      presentation: 'numbers',
      instruction: 'normal',
      aligned: false,
      response: 'number',
      support: 'partial',
    },
    fits: (goal) => goal.behavior === 'produce',
    why: (goal, purpose) =>
      `몇 개 더 많은지 구하는 목표라 수를 직접 쓰는 응답이 산출 과정을 드러냅니다. 첫 칸을 채워 둔 부분 완성은 ${
        purpose === 'assessment'
          ? '평가 목적과 맞는지 검토가 필요합니다'
          : '연습 단계의 부담을 줄입니다'
      }.`,
    adjustable: ['그림을 함께 제시하기', '부분 완성 빼기'],
  },
  {
    id: 'pictures-numbers-write-cue',
    title: '그림 짝 짓고 차이 쓰기',
    config: {
      presentation: 'pictures-numbers',
      instruction: 'short',
      aligned: true,
      response: 'number',
      support: 'visual-cue',
    },
    fits: (goal) => goal.behavior === 'produce' && goal.range !== '1-20',
    why: () =>
      '짝 지어 정렬하면 짝이 없는 그림이 바로 차이가 되어, 몇 개 더 많은지 세는 과정이 눈에 보입니다. 답은 수로 쓰게 하여 산출 결과가 남습니다.',
    adjustable: ['단서 빼기', '숫자 빼고 그림만 제시하기'],
  },
  {
    id: 'pictures-numbers-write-plain',
    title: '그림과 숫자, 차이 쓰기',
    config: {
      presentation: 'pictures-numbers',
      instruction: 'short',
      aligned: true,
      response: 'number',
      support: 'none',
    },
    fits: (goal) => goal.behavior === 'produce',
    why: (goal, purpose) =>
      `지원 없이 그림과 수를 보고 차이를 쓰는 구성입니다. ${
        purpose === 'assessment'
          ? '현재 수행을 확인하는 목적과 어긋나는 요소가 적습니다.'
          : '단서 없이 해 보는 연습으로 쓸 수 있습니다.'
      }`,
    adjustable: ['짝 지어 정렬 단서 넣기', '지시문을 보통 길이로 바꾸기'],
  },
];

export function examplesFor(goal) {
  return EXAMPLES.filter((e) => e.fits(goal)).slice(0, 3);
}

export function configFromExample(example, goal) {
  return { ...example.config, range: goal.range };
}
