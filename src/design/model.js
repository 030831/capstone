// 「두 집합의 수량 비교」 활동자료의 구조. 자료는 한 덩어리 텍스트가 아니라
// 목표 · 목적 · 제시 · 응답 · 지원의 다섯 축으로 저장한다.

export const ACTIVITY = { id: 'compare-quantity', name: '두 집합의 수량 비교' };

export const GOAL_FIELDS = {
  behavior: {
    label: '목표 행동',
    options: [
      { value: 'discriminate', label: '더 많은 쪽 고르기', hint: '판별' },
      { value: 'produce', label: '몇 개 더 많은지 구하기', hint: '산출' },
    ],
  },
  condition: {
    label: '조건',
    options: [
      { value: 'independent', label: '독립 수행' },
      { value: 'assisted', label: '도움 받아 수행' },
    ],
  },
  range: {
    label: '내용 범위',
    options: [
      { value: '1-5', label: '수 범위 1–5' },
      { value: '1-10', label: '수 범위 1–10' },
      { value: '1-20', label: '수 범위 1–20' },
    ],
  },
};

export const PURPOSES = [
  { value: 'practice', label: '연습', hint: '도움을 받으며 익히는 활동' },
  { value: 'assessment', label: '평가', hint: '현재 수행을 확인하는 활동' },
];

// 조절할 수 있는 축. group은 다섯 축 중 어디에 속하는지 나타낸다.
export const AXES = [
  {
    key: 'presentation',
    group: '제시',
    label: '제시 방식',
    options: [
      { value: 'pictures', label: '그림만' },
      { value: 'pictures-numbers', label: '그림과 숫자' },
      { value: 'numbers', label: '숫자만' },
    ],
  },
  {
    key: 'instruction',
    group: '제시',
    label: '지시문 길이',
    options: [
      { value: 'short', label: '짧게' },
      { value: 'normal', label: '보통' },
    ],
  },
  {
    key: 'aligned',
    group: '제시',
    label: '한 줄 정렬',
    options: [
      { value: true, label: '정렬함' },
      { value: false, label: '정렬 안 함' },
    ],
  },
  {
    key: 'response',
    group: '응답',
    label: '응답 방식',
    options: [
      { value: 'point', label: '가리키기·선택' },
      { value: 'symbol', label: '비교 기호 쓰기' },
      { value: 'number', label: '수 쓰기' },
    ],
  },
  {
    key: 'support',
    group: '지원',
    label: '지원 조건',
    options: [
      { value: 'none', label: '없음' },
      { value: 'visual-cue', label: '시각 단서(짝 지어 정렬)' },
      { value: 'partial', label: '부분 완성' },
      { value: 'worked-example', label: '예시 문항 먼저 보여주기' },
    ],
  },
  {
    key: 'range',
    group: '내용',
    label: '수 범위',
    options: GOAL_FIELDS.range.options,
  },
];

export const AXIS_KEYS = AXES.map((a) => a.key);

export function axisLabel(key) {
  return AXES.find((a) => a.key === key)?.label ?? key;
}

export function optionLabel(key, value) {
  const source =
    AXES.find((a) => a.key === key) ??
    GOAL_FIELDS[key] ??
    (key === 'purpose' ? { options: PURPOSES } : null);
  return source?.options.find((o) => o.value === value)?.label ?? String(value);
}

export const RANGE_MAX = { '1-5': 5, '1-10': 10, '1-20': 20 };

export const DEFAULT_GOAL = {
  behavior: 'discriminate',
  condition: 'independent',
  criterion: '5문항 중 4문항',
  range: '1-5',
};

export const DEFAULT_CONFIG = {
  presentation: 'pictures',
  instruction: 'short',
  aligned: true,
  response: 'point',
  support: 'none',
  range: '1-5',
};

// 가상 학생. 짧고 진단적이지 않은 메모만 둔다.
export const STUDENTS = [
  {
    id: 'g',
    name: '학생 ㄱ',
    profile: '글자 읽기는 어렵고, 그림은 잘 봄',
    idea: '지시문을 짧게, 그림 중심 제시를 생각해 볼 수 있습니다.',
  },
  {
    id: 'n',
    name: '학생 ㄴ',
    profile: '쓰기 대신 가리키기를 선호함',
    idea: '응답을 가리키기·선택으로 바꾸는 것을 생각해 볼 수 있습니다.',
  },
  {
    id: 'd',
    name: '학생 ㄷ',
    profile: '독립 수행이 가능하고, 수 범위를 넓혀도 됨',
    idea: '지원을 줄이거나 수 범위를 넓히는 것을 생각해 볼 수 있습니다.',
  },
];

export function goalSentence(goal) {
  const range = optionLabel('range', goal.range);
  const act =
    goal.behavior === 'produce'
      ? '두 묶음의 수량을 비교하여 몇 개 더 많은지 구한다'
      : '두 묶음의 수량을 비교하여 더 많은 쪽을 고른다';
  const how = goal.condition === 'assisted' ? '도움을 받아' : '혼자서';
  const criterion = goal.criterion?.trim() ? ` (${goal.criterion.trim()})` : '';
  return `${range}에서 ${how} ${act}${criterion}.`;
}

// 지시문은 구조화된 설정에서 만들어진다. 규칙 R6도 같은 함수를 쓴다.
export function instructionText(config, goal) {
  const produce = goal.behavior === 'produce';
  const short = config.instruction === 'short';
  if (config.response === 'point') {
    return short
      ? '더 많은 쪽에 ○ 하세요.'
      : '두 묶음을 잘 보고 어느 쪽이 더 많은지 비교한 다음, 더 많은 쪽을 손으로 가리키거나 ○ 하세요.';
  }
  if (config.response === 'symbol') {
    return short
      ? '>, <, = 중 하나를 쓰세요.'
      : '왼쪽 묶음과 오른쪽 묶음의 수량을 비교하여 빈칸에 >, <, = 중 알맞은 기호를 쓰세요.';
  }
  if (produce) {
    return short
      ? '몇 개 더 많은지 쓰세요.'
      : '두 묶음의 수량을 비교하여 어느 쪽이 몇 개 더 많은지 빈칸에 수를 쓰세요.';
  }
  return short
    ? '더 많은 쪽의 수를 쓰세요.'
    : '두 묶음의 수량을 비교하여 더 많은 쪽의 수를 빈칸에 쓰세요.';
}

export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
