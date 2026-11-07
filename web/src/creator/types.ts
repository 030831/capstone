// 학습지 제작 도구 데이터 모델 (지시서 §6·§14).
// 문제는 큰 문자열 하나가 아니라 구조적으로 분리된 값으로 저장한다.
// 화면 편집과 출력(학습지)은 같은 문제 데이터에서 만든다.

export type ProblemKind = 'count' | 'two_groups' | 'equation' | 'compare';

export const KIND_LABEL: Record<ProblemKind, string> = {
  count: '그림 수 세기',
  two_groups: '두 묶음 합치기',
  equation: '수식 완성하기',
  compare: '비교하기',
};

/** 그림 자산. 이모지가 아닌 SVG(내장)로 그린다 — 장치·인쇄 결과가 같아야 한다. */
export type PictogramKind = 'circle' | 'star' | 'apple' | 'ball';

export const PICTO_LABEL: Record<PictogramKind, string> = {
  circle: '원',
  star: '별',
  apple: '사과',
  ball: '공',
};

/** 응답 방식: 답칸(직접 쓰기) 또는 선택지(고르기). */
export type ResponseMode = 'blank' | 'choices';
export type BlankSize = 'small' | 'medium' | 'large';

export interface ResponseConfig {
  mode: ResponseMode;
  /** 선택지 방식에서 고르는 항목들. 기본값은 수정 가능한 시작값이다. */
  choices: string[];
  /** 정답으로 지정한 선택지 index. 범위 밖이면 '정답 미지정' 오류로 표시한다. */
  correctIndex: number;
  /** 답칸 크기. */
  blankSize: BlankSize;
}

/** 힌트(교사가 선택적으로 추가). AI가 만든 것처럼 표현하지 않는다. */
export interface HintConfig {
  enabled: boolean;
  /** 짧은 텍스트 안내. */
  text: string;
  /** 보조 그림 묶음 (0 = 없음). */
  pictureCount: number;
  pictogram: PictogramKind;
  /** 학생용 학습지 출력 포함 여부 (명시적). */
  showInPrint: boolean;
}

export interface BaseProblem {
  id: string;
  kind: ProblemKind;
  /** 질문 문장. 편집 화면 중앙에서 바로 수정한다. */
  question: string;
  questionSize: 'normal' | 'large';
  response: ResponseConfig;
  hint: HintConfig;
}

/** 6.1 그림 수 세기 */
export interface CountProblem extends BaseProblem {
  kind: 'count';
  pictogram: PictogramKind;
  /** 그림 개수. 1~20 (편집기 지원 범위). */
  count: number;
  /** 한 줄에 놓을 개수. */
  perRow: number;
  itemSize: 'small' | 'medium' | 'large';
}

export interface GroupRef {
  /** 묶음 수량. 1~20 (편집기 지원 범위). */
  count: number;
  pictogram: PictogramKind;
}

/** 6.2 두 묶음 합치기 */
export interface TwoGroupsProblem extends BaseProblem {
  kind: 'two_groups';
  left: GroupRef;
  right: GroupRef;
  /** 묶음 테두리 표시. */
  showBorder: boolean;
  /** `+`, `=` 기호 표시. */
  showSymbols: boolean;
  /** 그림만 / 수식만 / 그림과 수식 함께. 표시 방식을 바꿔도 수량은 유지된다. */
  displayMode: 'pictures' | 'equation' | 'both';
}

/** 6.3 수식 완성하기 — 항상 a (op) b = result 이고 blank 가 하나를 가린다. */
export interface EquationProblem extends BaseProblem {
  kind: 'equation';
  operation: 'add' | 'sub';
  a: number;
  b: number;
  blank: 'a' | 'b' | 'result';
  /** 보조 그림 표시. */
  showPictures: boolean;
  pictogram: PictogramKind;
}

/** 6.4 비교하기 */
export interface CompareProblem extends BaseProblem {
  kind: 'compare';
  left: GroupRef;
  right: GroupRef;
  showPictures: boolean;
  showNumbers: boolean;
  /** 질문 방식: 더 많음 / 더 적음 / 같음 여부. */
  questionMode: 'more' | 'less' | 'same';
  /** 응답 방식: 선택지(왼쪽·오른쪽·같음 또는 예·아니요) 또는 비교 기호 빈칸. */
  responseMode: 'choice' | 'symbol';
}

export type Problem = CountProblem | TwoGroupsProblem | EquationProblem | CompareProblem;

/** 학생 참고 정보 (IEP는 제작 참고 자료 — 능력 자동 확정 아님). */
export interface StudentRef {
  id: string;
  /** 익명 표시 이름 (예: "학생 A"). 실명을 예시로 쓰지 않는다. */
  displayName: string;
  /** 이번 수업에서 참고할 IEP 목표 (교사 직접 입력). */
  iepGoal: string;
  /** 교사 지원 메모. */
  supportNote: string;
  /** 기존 검사기 학생과 연결한 경우 그 id (표시 이름만 가져왔다). */
  linkedOldId?: string;
}

/** 문제 세트: 문제 저장소 + 출력 순서. */
export interface ProblemSet {
  problems: Record<string, Problem>;
  order: string[];
}

/** 제작 작업 1건. */
export interface Work {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  students: StudentRef[];
  /** 공통 문제 세트. */
  common: ProblemSet;
  /** 학생별 독립 편집본 (학생 id -> 세트). 복사 후에는 공통과 서로 영향 없다. */
  studentSets: Record<string, ProblemSet>;
  /** 마지막으로 보고 있던 버전 ('common' | 학생 id). */
  selectedVersion: string;
  selectedProblemId: string | null;
  /** 학습지 제목. */
  worksheetTitle: string;
  /** 예시 작업(가상 데이터) 표시. */
  isExample?: boolean;
}

/** localStorage 최상위 문서. 기존 검사기 저장 키(alignment-checker-v0:students)와는 별개다. */
export interface CreatorDoc {
  format: 'worksheet-creator';
  version: 1;
  works: Work[];
  lastOpenedWorkId: string | null;
}

export type VersionKey = 'common' | (string & {});

export function setOf(work: Work, version: VersionKey): ProblemSet {
  return version === 'common' ? work.common : work.studentSets[version];
}
