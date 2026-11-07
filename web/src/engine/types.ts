// 엔진 타입. checker/models.py 와 동일한 의미(필드명만 camelCase).

/** 상태 4종. unknown = 기록 없음(명시하지 않은 노드의 해석값). */
export type State = 'unknown' | 'not_started' | 'emerging' | 'mastered';

/** 판정 4종. 순서: COLLISION > NEEDS_REVIEW > TOO_EASY > ALIGNED (스펙 3장, 2026-11-07). */
export type Verdict = 'COLLISION' | 'NEEDS_REVIEW' | 'TOO_EASY' | 'ALIGNED';
export type EdgeKind = 'hard' | 'soft';

export interface Source {
  type: string;
  ref: string;
  url?: string;
  page?: string;
}

export interface NodeSpec {
  id: string;
  label: string;
  description?: string;
  level_hint?: string;
  sources: Source[];
}

export interface EdgeSpec {
  from: string;
  to: string;
  kind: EdgeKind;
  sources: Source[];
}

export interface GraphSpec {
  version: string;
  domain: string;
  nodes: NodeSpec[];
  edges: EdgeSpec[];
}

/** 명시한 노드만 키로 갖는다. 없는 노드는 unknown(기록 없음)으로 해석한다. */
export type States = Record<string, State>;

export interface CheckResult {
  verdict: Verdict;
  requires: string[];
  /** 명시적으로 미확보(시작 전·형성 중)인 hard/soft 선수만. 미확인은 별도 목록. */
  gapHard: string[];
  gapSoft: string[];
  /** 기록이 없는(미확인) hard 선수 / 요구 개념. 구분해서 반환한다. */
  unknownHard: string[];
  unknownRequired: string[];
  suggestedNext: string[];
  /** requires 중 mastered 가 아닌 노드(설명 문장용). */
  unmasteredRequires: string[];
  explanation: string;
}

/** 그래프 로드/구조 오류 (Python DataError 대응). */
export class DataError extends Error {
  messages: string[];
  constructor(messages: string[] | string) {
    const list = typeof messages === 'string' ? [messages] : messages;
    super(list.join('\n'));
    this.name = 'DataError';
    this.messages = list;
  }
}

/** 그래프에 없는 노드 ID 참조 (Python UnknownConceptError 대응). */
export class UnknownConceptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownConceptError';
  }
}
