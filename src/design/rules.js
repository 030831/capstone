// 검토 안내 규칙표. 판정이 아니라, 선언한 목표·목적과 자료 구성 사이의 관계에서
// 다시 볼 지점을 이유와 함께 알려 준다. 결정은 교사가 한다.
import { instructionText, optionLabel, wordCount } from './model.js';

export const SEVERITY = { CHECK: '확인 필요', INFO: '참고' };

// 각 규칙: id, severity, axes(관련 축), when(조건), text(안내 문구).
// informational: true 이면 경고가 아니라 정보 표시이며 '의도한 변경' 기록 대상이 아니다.
export const RULES = [
  {
    id: 'R1',
    severity: SEVERITY.CHECK,
    axes: ['support'],
    summary: '목적=평가, 조건=독립 수행인데 지원이 들어 있음',
    when: (goal, purpose, config) =>
      purpose === 'assessment' && goal.condition === 'independent' && config.support !== 'none',
    text: () =>
      '독립 수행을 확인하는 활동에 지원이 들어 있습니다. 도움을 받는 연습용으로 쓸지, 지원을 빼고 평가용으로 둘지 검토하세요.',
  },
  {
    id: 'R2',
    severity: SEVERITY.CHECK,
    axes: ['response'],
    summary: '목표 행동=산출인데 응답이 가리키기·선택',
    when: (goal, purpose, config) => goal.behavior === 'produce' && config.response === 'point',
    text: () => '몇 개 더 많은지 구하는 목표인데 응답이 고르기여서 산출 과정이 드러나지 않습니다.',
  },
  {
    id: 'R3',
    severity: SEVERITY.CHECK,
    axes: ['range'],
    summary: '자료의 수 범위가 목표의 내용 범위와 다름',
    when: (goal, purpose, config) => config.range !== goal.range,
    text: (goal, purpose, config) =>
      `목표의 내용 범위(${optionLabel('range', goal.range)})와 자료의 수 범위(${optionLabel('range', config.range)})가 다릅니다. 목표를 바꿀지, 범위를 되돌릴지 검토하세요.`,
  },
  {
    id: 'R4',
    severity: SEVERITY.INFO,
    axes: ['presentation'],
    summary: '제시=숫자만, 목표 행동=판별',
    when: (goal, purpose, config) =>
      config.presentation === 'numbers' && goal.behavior === 'discriminate',
    text: () =>
      '그림 없이 숫자만으로 비교하면 수량 비교가 아니라 수의 크기 비교가 됩니다. 의도한 것인지 확인하세요.',
  },
  {
    id: 'R5',
    severity: SEVERITY.INFO,
    axes: ['support'],
    summary: '지원=예시 문항 먼저 보여주기, 목적=평가',
    when: (goal, purpose, config) =>
      config.support === 'worked-example' && purpose === 'assessment',
    text: () =>
      '평가 활동 앞에 풀이가 적힌 예시 문항이 있습니다. 예시를 본 뒤의 수행이라는 점을 기록에 함께 남길지 생각해 보세요.',
  },
  {
    id: 'R6',
    severity: SEVERITY.INFO,
    informational: true,
    axes: ['instruction'],
    summary: '지시문 길이=보통일 때 어절 수 표시',
    when: (goal, purpose, config) => config.instruction === 'normal',
    text: (goal, purpose, config) =>
      `지시문은 ${wordCount(instructionText(config, goal))}어절입니다.`,
  },
];

// (goal, purpose, config, originalConfig) → notes[]
// originalConfig가 주어지면, 관련 축이 원본(공통 설정)에서 바뀐 경우 changedFrom에 원래 값을 남긴다.
export function reviewNotes(goal, purpose, config, originalConfig = null) {
  return RULES.filter((rule) => rule.when(goal, purpose, config)).map((rule) => {
    const changed = originalConfig
      ? rule.axes.filter((key) => originalConfig[key] !== config[key])
      : [];
    return {
      id: rule.id,
      severity: rule.severity,
      informational: !!rule.informational,
      axes: rule.axes,
      text: rule.text(goal, purpose, config),
      changedFrom: changed.map((key) => ({
        key,
        from: optionLabel(key, originalConfig[key]),
        to: optionLabel(key, config[key]),
      })),
    };
  });
}

export function countNotes(notes, acknowledged = {}, versionId = '') {
  const open = notes.filter((n) => !n.informational && !acknowledged[`${versionId}:${n.id}`]);
  return {
    check: open.filter((n) => n.severity === SEVERITY.CHECK).length,
    info: notes.filter(
      (n) =>
        n.severity === SEVERITY.INFO && (n.informational || !acknowledged[`${versionId}:${n.id}`]),
    ).length,
    recorded: notes.filter((n) => !n.informational && acknowledged[`${versionId}:${n.id}`]).length,
  };
}
