import { AXES, AXIS_KEYS, DEFAULT_GOAL, GOAL_FIELDS, PURPOSES, STUDENTS } from './model.js';
import { EXAMPLES, configFromExample } from './examples.js';
import { reviewNotes } from './rules.js';

export const STORAGE_KEY = 'design-compare-v1';
export const STEPS = ['목표·목적', '구성 예시', '조절', '검토 안내', '미리보기·출력'];

export function initialState() {
  return {
    version: 1,
    step: 1,
    goal: { ...DEFAULT_GOAL },
    purpose: 'practice',
    exampleId: null,
    base: null,
    variants: {},
    acknowledged: {},
    activeVersion: 'base',
  };
}

const allowed = (key, value) =>
  AXES.find((a) => a.key === key)?.options.some((o) => o.value === value);

function validConfig(c) {
  return !!c && typeof c === 'object' && AXIS_KEYS.every((k) => allowed(k, c[k]));
}

// 저장된 값이 깨졌거나 예전 형식이면 처음 상태로 돌아간다.
export function restore(saved) {
  const s = saved;
  if (!s || typeof s !== 'object' || s.version !== 1) return initialState();
  const goalOk =
    s.goal &&
    ['behavior', 'condition', 'range'].every((k) =>
      GOAL_FIELDS[k].options.some((o) => o.value === s.goal[k]),
    ) &&
    typeof s.goal.criterion === 'string';
  const purposeOk = PURPOSES.some((p) => p.value === s.purpose);
  if (!goalOk || !purposeOk || (s.base !== null && !validConfig(s.base))) return initialState();
  const variants = {};
  for (const st of STUDENTS) {
    const v = s.variants?.[st.id];
    if (v && validConfig(v.config))
      variants[st.id] = {
        config: v.config,
        reasons: typeof v.reasons === 'object' && v.reasons ? v.reasons : {},
      };
  }
  const step = Number.isInteger(s.step) && s.step >= 1 && s.step <= 5 ? s.step : 1;
  return {
    ...initialState(),
    goal: s.goal,
    purpose: s.purpose,
    exampleId: typeof s.exampleId === 'string' ? s.exampleId : null,
    base: s.base,
    variants,
    acknowledged: s.acknowledged && typeof s.acknowledged === 'object' ? s.acknowledged : {},
    step: s.base ? step : Math.min(step, 2),
    activeVersion:
      s.activeVersion === 'base' || variants[s.activeVersion] ? s.activeVersion : 'base',
  };
}

// 공통 설정과 다른 축의 목록
export function diffConfig(base, config) {
  if (!base || !config) return [];
  return AXIS_KEYS.filter((k) => base[k] !== config[k]);
}

export function versionIds(state) {
  return ['base', ...STUDENTS.filter((s) => state.variants[s.id]).map((s) => s.id)];
}

export function configOf(state, versionId) {
  return versionId === 'base' ? state.base : (state.variants[versionId]?.config ?? null);
}

export function versionLabel(versionId) {
  if (versionId === 'base') return '공통';
  return `${STUDENTS.find((s) => s.id === versionId)?.name ?? versionId}용`;
}

// 원본: 공통 설정은 고른 예시, 학생 변형은 공통 설정
export function originalOf(state, versionId) {
  if (versionId !== 'base') return state.base;
  const ex = EXAMPLES.find((e) => e.id === state.exampleId);
  return ex ? configFromExample(ex, state.goal) : null;
}

export function notesFor(state, versionId) {
  const config = configOf(state, versionId);
  if (!config) return [];
  return reviewNotes(state.goal, state.purpose, config, originalOf(state, versionId));
}

// 축 값이 바뀌어 더 이상 적용되지 않는 '의도한 변경' 기록은 지우지 않고 그대로 둔다.
// (같은 안내가 다시 나타나면 기록된 상태로 보인다.)
export function reducer(state, action) {
  switch (action.type) {
    case 'goal':
      return { ...state, goal: { ...state.goal, [action.field]: action.value } };
    case 'purpose':
      return { ...state, purpose: action.value };
    case 'step': {
      const step = Math.max(1, Math.min(5, action.step));
      if (step > 2 && !state.base) return state;
      return { ...state, step };
    }
    case 'chooseExample': {
      const ex = EXAMPLES.find((e) => e.id === action.id);
      if (!ex) return state;
      return { ...state, exampleId: ex.id, base: configFromExample(ex, state.goal) };
    }
    case 'setBase':
      if (!state.base || !allowed(action.field, action.value)) return state;
      return { ...state, base: { ...state.base, [action.field]: action.value } };
    case 'createVariant':
      if (!state.base || state.variants[action.student]) return state;
      return {
        ...state,
        variants: {
          ...state.variants,
          [action.student]: { config: { ...state.base }, reasons: {} },
        },
      };
    case 'removeVariant': {
      const variants = { ...state.variants };
      delete variants[action.student];
      return {
        ...state,
        variants,
        activeVersion: state.activeVersion === action.student ? 'base' : state.activeVersion,
      };
    }
    case 'setVariant': {
      const v = state.variants[action.student];
      if (!v || !allowed(action.field, action.value)) return state;
      return {
        ...state,
        variants: {
          ...state.variants,
          [action.student]: { ...v, config: { ...v.config, [action.field]: action.value } },
        },
      };
    }
    case 'setReason': {
      const v = state.variants[action.student];
      if (!v) return state;
      return {
        ...state,
        variants: {
          ...state.variants,
          [action.student]: { ...v, reasons: { ...v.reasons, [action.field]: action.text } },
        },
      };
    }
    case 'acknowledge':
      return { ...state, acknowledged: { ...state.acknowledged, [action.key]: action.note } };
    case 'unacknowledge': {
      const acknowledged = { ...state.acknowledged };
      delete acknowledged[action.key];
      return { ...state, acknowledged };
    }
    case 'activeVersion':
      return { ...state, activeVersion: action.id };
    case 'reset':
      return initialState();
    default:
      return state;
  }
}
