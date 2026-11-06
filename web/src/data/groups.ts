// 노드 ID 접두 번호(N01~N39)로 6개 그룹을 나눈다. 그래프 YAML 에는 그룹 필드가 없다.
export interface Group {
  key: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  name: string;
  from: number;
  to: number;
  /** 노드·밴드 배경 힌트(연한 색). 색은 장식일 뿐 의미는 그룹 이름 텍스트로도 표시한다. */
  bg: string;
  border: string;
}

export const GROUPS: Group[] = [
  { key: 'A', name: 'A 수의 기초', from: 1, to: 4, bg: '#f1ecf7', border: '#cdbfe0' },
  { key: 'B', name: 'B 수 세기', from: 5, to: 13, bg: '#e8f1f8', border: '#b7d0e4' },
  { key: 'C', name: 'C 합성·분해', from: 14, to: 17, bg: '#e6f3ef', border: '#b4d9cd' },
  { key: 'D', name: 'D 덧셈·뺄셈', from: 18, to: 27, bg: '#f6f0e0', border: '#e0d2a6' },
  { key: 'E', name: 'E 자릿값', from: 28, to: 36, bg: '#f8ebe4', border: '#e2c3b0' },
  { key: 'F', name: 'F 곱셈', from: 37, to: 39, bg: '#eceef0', border: '#c5cad0' },
];

/** 노드 ID("N16_...")의 접두 번호. */
export function nodeNumber(id: string): number {
  const m = /^N(\d+)/.exec(id);
  return m ? parseInt(m[1], 10) : 0;
}

export function groupOf(id: string): Group {
  const n = nodeNumber(id);
  return GROUPS.find((g) => n >= g.from && n <= g.to) ?? GROUPS[GROUPS.length - 1];
}
