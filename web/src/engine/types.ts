// 엔진 타입. checker/models.py 와 동일한 의미(필드명만 camelCase).

export type State = 'mastered' | 'emerging' | 'not_started';
export type Verdict = 'COLLISION' | 'ALIGNED' | 'TOO_EASY';
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

/** 명시하지 않은 노드는 not_started 로 취급한다. */
export type States = Record<string, State>;

export interface CheckResult {
  verdict: Verdict;
  requires: string[];
  gapHard: string[];
  gapSoft: string[];
  suggestedNext: string[];
  /** requires 중 mastered 가 아닌 노드(설명 문장용). Python 에서는 check() 안에서 계산해 explain 에 넘기던 값. */
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
