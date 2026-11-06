// tests/test_engine.py 1~9 + 보조 테스트 포팅, 그리고 학생 A × 샘플 문제 고정 결과.
// 그래프 fixture 는 Python 테스트와 같은 ../../tests/fixtures/*.yaml 을 읽는다(복사하지 않음).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import graphJson from '../data/graph_v0.json';
import { SAMPLE_PROBLEMS } from '../data/problems';
import { makePresets, STUDENT_A_STATES } from '../data/students';
import {
  buildGraph,
  check,
  DataError,
  explain,
  josa,
  outerFringe,
  UnknownConceptError,
  type ConceptGraph,
  type GraphSpec,
  type States,
} from './index';

const ROOT = resolve(__dirname, '../../..');
const FIX = resolve(ROOT, 'tests/fixtures');
const loadYaml = <T>(p: string): T => yaml.load(readFileSync(p, 'utf-8')) as T;
const fixSpec = (name: string): GraphSpec => loadYaml<GraphSpec>(resolve(FIX, name));
const graphOf = (name: string): ConceptGraph => buildGraph(fixSpec(name));
const st = (m: Record<string, string>): States => m as States;

describe('스펙 5장 1~8', () => {
  it('01 선형 체인 M={A}, R={C} -> COLLISION gap={B} suggested={B}', () => {
    const g = graphOf('graph_chain.yaml');
    const s = loadYaml<{ states: States }>(resolve(FIX, 'student_chain_a.yaml')).states;
    const p = loadYaml<{ requires: string[] }>(resolve(FIX, 'problem_c.yaml'));
    const r = check(g, s, p.requires);
    expect(r.verdict).toBe('COLLISION');
    expect(r.gapHard).toEqual(['B']);
    expect(r.suggestedNext).toEqual(['B']);
    expect(r.gapSoft).toEqual([]);
  });

  it('02 같은 그래프 M={A,B}, R={C} -> ALIGNED', () => {
    const g = graphOf('graph_chain.yaml');
    const s = loadYaml<{ states: States }>(resolve(FIX, 'student_chain_ab.yaml')).states;
    const r = check(g, s, ['C']);
    expect(r.verdict).toBe('ALIGNED');
    expect(r.gapHard).toEqual([]);
    expect(r.suggestedNext).toEqual([]);
  });

  it('03 M={A,B,C}, R={C} -> TOO_EASY', () => {
    const g = graphOf('graph_chain.yaml');
    const r = check(g, st({ A: 'mastered', B: 'mastered', C: 'mastered' }), ['C']);
    expect(r.verdict).toBe('TOO_EASY');
  });

  it('04 soft 엣지만 미도달 -> ALIGNED + soft 경고', () => {
    const g = graphOf('graph_soft.yaml');
    const r = check(g, st({ A: 'mastered' }), ['C']);
    expect(r.verdict).toBe('ALIGNED');
    expect(r.gapHard).toEqual([]);
    expect(r.gapSoft).toEqual(['B']);
    expect(r.explanation).toContain('개념 B');
  });

  it('05 다이아몬드 M={A,B}, R={D} -> COLLISION gap={C} suggested={C}', () => {
    const g = graphOf('graph_diamond.yaml');
    const r = check(g, st({ A: 'mastered', B: 'mastered' }), ['D']);
    expect(r.verdict).toBe('COLLISION');
    expect(r.gapHard).toEqual(['C']);
    expect(r.suggestedNext).toEqual(['C']);
  });

  it('06 사이클 그래프 로드 -> 에러', () => {
    let err: unknown;
    try {
      graphOf('graph_cycle.yaml');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DataError);
    expect(String(err instanceof Error ? err.message : '')).toContain('사이클');
    expect((err as Error).message).toContain('A -> B -> C -> A');
  });

  it('07 source 없는 노드(없음/빈 리스트) -> 에러', () => {
    for (const name of ['graph_no_source.yaml', 'graph_empty_source.yaml']) {
      let err: unknown;
      try {
        graphOf(name);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(DataError);
      expect((err as Error).message).toContain('sources');
      expect((err as Error).message).toContain('id=B');
    }
  });

  it('08 requires 에 없는 노드 ID -> 에러', () => {
    const g = graphOf('graph_chain.yaml');
    const p = loadYaml<{ requires: string[] }>(resolve(FIX, 'problem_unknown.yaml'));
    expect(() => check(g, {}, p.requires)).toThrow(UnknownConceptError);
    expect(() => check(g, {}, p.requires)).toThrow(/NOPE/);
  });
});

describe('스펙 5장 9: 합성 학생 불변식 (graph_v0 전체)', () => {
  const g = buildGraph(graphJson as unknown as GraphSpec);

  // 재현 가능한 난수(mulberry32). Python 의 random 과 같은 수열일 필요는 없다.
  function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** gen_synthetic.generate_students 와 같은 절차: 시드 노드 + hard 조상 = mastered(하향 폐쇄), outer fringe 는 50% emerging. */
  function generateStudents(n: number, seed: number): States[] {
    const rand = rng(seed);
    const ids = g.nodeIds;
    const out: States[] = [];
    for (let i = 0; i < n; i++) {
      const k = Math.floor(rand() * (ids.length + 1));
      const pool = [...ids];
      const seeds: string[] = [];
      for (let j = 0; j < k; j++) seeds.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
      const mastered = new Set(seeds);
      for (const a of seeds) {
        const stack = [...g.hardPred.get(a)!];
        while (stack.length) {
          const u = stack.pop()!;
          if (!mastered.has(u)) {
            mastered.add(u);
            stack.push(...g.hardPred.get(u)!);
          }
        }
      }
      const states: States = {};
      for (const m of mastered) states[m] = 'mastered';
      for (const f of outerFringe(g, states)) if (rand() < 0.5) states[f] = 'emerging';
      out.push(states);
    }
    return out;
  }

  it('하향 폐쇄 학생 100명: 문제 노드가 M ∪ fringe 이면 COLLISION 0건, 아니면 항상 COLLISION', () => {
    const students = generateStudents(100, 7);
    const verdicts = new Set<string>();
    for (const s of students) {
      const mastered = new Set(Object.keys(s).filter((k) => s[k] === 'mastered'));
      const reachable = new Set([...mastered, ...outerFringe(g, s)]);
      for (const node of g.nodeIds) {
        const r = check(g, s, [node]);
        verdicts.add(r.verdict);
        if (reachable.has(node)) expect(r.verdict).not.toBe('COLLISION');
        else expect(r.verdict).toBe('COLLISION');
      }
    }
    expect(verdicts.has('ALIGNED') && verdicts.has('TOO_EASY') && verdicts.has('COLLISION')).toBe(true);
  });

  it('프리셋 학생 A/B/C 는 하향 폐쇄 상태다 (mastered 의 hard 선수는 모두 mastered)', () => {
    for (const p of makePresets(g.nodeIds)) {
      const m = Object.keys(p.states).filter((k) => p.states[k] === 'mastered');
      for (const n of m) for (const pre of g.hardPred.get(n)!) expect(p.states[pre], `${p.name} ${n}<-${pre}`).toBe('mastered');
    }
  });
});

describe('학생 A × 샘플 문제 고정 결과', () => {
  const g = buildGraph(graphJson as unknown as GraphSpec);
  const byId = (id: string) => SAMPLE_PROBLEMS.find((p) => p.id === id)!;

  it('student_A.yaml 과 students.ts 의 학생 A 가 일치한다', () => {
    const y = loadYaml<{ states: States }>(resolve(ROOT, 'examples/real/student_A.yaml'));
    expect(STUDENT_A_STATES).toEqual(y.states);
  });

  it('샘플 문제가 examples/real/problem_*.yaml 과 일치한다', () => {
    for (const [file, id] of [['problem_add5', 'P_add5'], ['problem_carry', 'P_carry'], ['problem_make10', 'P_make10']]) {
      const y = loadYaml<{ problem_id: string; text: string; requires: string[] }>(resolve(ROOT, `examples/real/${file}.yaml`));
      const p = byId(id);
      expect(p.id).toBe(y.problem_id);
      expect(p.text).toBe(y.text);
      expect(p.requires).toEqual(y.requires);
    }
  });

  it('받아올림 덧셈 -> COLLISION gap=[N16,N17] suggested=[N16]', () => {
    const r = check(g, STUDENT_A_STATES, byId('P_carry').requires);
    expect(r.verdict).toBe('COLLISION');
    expect(r.gapHard).toEqual(['N16_ten_complements', 'N17_teen_as_ten_and_ones']);
    expect(r.suggestedNext).toEqual(['N16_ten_complements']);
  });

  it('10 가르기 -> ALIGNED', () => {
    const r = check(g, STUDENT_A_STATES, byId('P_make10').requires);
    expect(r.verdict).toBe('ALIGNED');
    expect(r.gapHard).toEqual([]);
  });

  it('5 이내 덧셈 -> TOO_EASY', () => {
    const r = check(g, STUDENT_A_STATES, byId('P_add5').requires);
    expect(r.verdict).toBe('TOO_EASY');
  });
});

describe('보조 테스트', () => {
  it('emerging 은 gap 에 포함된다', () => {
    const g = graphOf('graph_chain.yaml');
    const r = check(g, st({ A: 'mastered', B: 'emerging' }), ['C']);
    expect(r.verdict).toBe('COLLISION');
    expect(r.gapHard).toEqual(['B']);
  });

  it('이행적 조상까지 gap, suggested 는 바로 배울 수 있는 노드뿐', () => {
    const g = graphOf('graph_chain.yaml');
    const r = check(g, {}, ['C']);
    expect(r.gapHard).toEqual(['A', 'B']);
    expect(r.suggestedNext).toEqual(['A']);
  });

  it('R 안의 노드라도 다른 R 의 hard 조상이면 gap 후보', () => {
    const g = graphOf('graph_chain.yaml');
    const r = check(g, st({ A: 'mastered' }), ['B', 'C']);
    expect(r.verdict).toBe('COLLISION');
    expect(r.gapHard).toEqual(['B']);
  });

  it('suggested 는 R 까지 최단 경로 짧은 순, 동률은 ID 순', () => {
    const src = [{ type: 't', ref: 'r' }];
    const spec: GraphSpec = {
      version: '0.1',
      domain: 'd',
      nodes: ['X', 'Y', 'Z', 'R'].map((id) => ({ id, label: id, sources: src })),
      edges: [
        { from: 'X', to: 'Y', kind: 'hard', sources: src },
        { from: 'Y', to: 'R', kind: 'hard', sources: src },
        { from: 'Z', to: 'R', kind: 'hard', sources: src },
      ],
    };
    const r = check(buildGraph(spec), {}, ['R']);
    expect(r.gapHard).toEqual(['X', 'Y', 'Z']);
    expect(r.suggestedNext).toEqual(['Z', 'X']);
  });

  it('student.states 의 없는 노드 ID 도 에러', () => {
    const g = graphOf('graph_chain.yaml');
    expect(() => check(g, st({ A: 'mastered', ZZ: 'mastered' }), ['C'])).toThrow(UnknownConceptError);
  });

  it('ID 중복과 엣지의 미존재 노드 참조를 거부', () => {
    expect(() => graphOf('graph_dup_id.yaml')).toThrow(/중복/);
    expect(() => graphOf('graph_unknown_edge.yaml')).toThrow(/존재하지 않는 노드/);
  });

  it('outer fringe', () => {
    const g = graphOf('graph_diamond.yaml');
    expect(outerFringe(g, {})).toEqual(['A']);
    expect(outerFringe(g, st({ A: 'mastered' }))).toEqual(['B', 'C']);
    expect(outerFringe(g, st({ A: 'mastered', B: 'mastered' }))).toEqual(['C']);
    expect(outerFringe(g, st({ A: 'mastered', B: 'emerging' }))).toEqual(['B', 'C']);
  });

  it('josa', () => {
    expect(josa('덧셈', '을/를')).toBe('덧셈을');
    expect(josa('자릿값', '이/가')).toBe('자릿값이');
    expect(josa('수 세기', '이/가')).toBe('수 세기가');
    expect(josa('10 이내 덧셈', '은/는')).toBe('10 이내 덧셈은');
    expect(josa('10', '이/가')).toBe('10이');
    expect(josa('2', '이/가')).toBe('2가');
  });

  it('스펙 3.2 예시(examples/graph_toy)의 설명 문장을 그대로 재현', () => {
    const g = buildGraph(loadYaml<GraphSpec>(resolve(ROOT, 'examples/graph_toy.yaml')));
    const s = loadYaml<{ states: States }>(resolve(ROOT, 'examples/student_toy.yaml')).states;
    const p = loadYaml<{ requires: string[] }>(resolve(ROOT, 'examples/problem_toy.yaml'));
    const r = check(g, s, p.requires);
    expect(r.verdict).toBe('COLLISION');
    expect(r.gapHard).toEqual(['N05_make_ten', 'N06_place_value_tens_ones']);
    expect(r.suggestedNext).toEqual(['N05_make_ten']);
    expect(r.explanation).toBe(
      "이 문제는 '받아올림이 있는 20 이내 덧셈'을 요구하는데, 학생은 선수 개념 " +
        "'10 만들기', '십과 일의 자릿값'이 미도달입니다. '10 만들기'은(는) 지금 바로 다룰 수 있는 선수 개념입니다.",
    );
    expect(explain(g, r)).toBe(r.explanation);
  });
});
