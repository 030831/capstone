// @vitest-environment jsdom
// 저장·복원·백업 테스트 (지시서 §12·§17: 저장·복원, 기존 학생 데이터 보존, 백업 검증).
import { afterEach, describe, expect, test } from 'vitest';
import { makeEmptyWork, makeExampleWork, makeProblem } from './defaults';
import type { CountProblem } from './types';
import {
  buildBackup,
  clearCreatorStorage,
  LEGACY_CHECKER_KEY,
  loadCreator,
  mergeImported,
  parseBackup,
  readLegacyStudents,
  saveCreator,
  STORAGE_KEY,
} from './storage';
import type { CreatorDoc, Work } from './types';

afterEach(() => {
  clearCreatorStorage();
  window.localStorage.removeItem(LEGACY_CHECKER_KEY);
});

describe('저장·복원 (§12.1)', () => {
  test('저장한 문서를 그대로 복원한다', () => {
    const doc: CreatorDoc = { format: 'worksheet-creator', version: 1, works: [makeExampleWork()], lastOpenedWorkId: null };
    doc.works[0].name = '덧셈 학습지';
    expect(saveCreator(doc)).toBe(true);
    const r = loadCreator();
    expect(r.corruptRaw).toBeNull();
    expect(r.doc?.works).toHaveLength(1);
    expect(r.doc?.works[0].name).toBe('덧셈 학습지');
    expect(r.doc?.works[0].common.order.length).toBeGreaterThan(0);
  });

  test('빈 문서/없는 문서는 doc=null (예시로 덮어쓰지 않는다)', () => {
    const r = loadCreator();
    expect(r.doc).toBeNull();
    expect(r.corruptRaw).toBeNull();
  });

  test('손상된 JSON: 앱이 멈추지 않고 원본을 보관한다', () => {
    window.localStorage.setItem(STORAGE_KEY, '{{{broken');
    const r = loadCreator();
    expect(r.doc).toBeNull();
    expect(r.corruptRaw).toBe('{{{broken');
  });

  test('형식·버전이 다르면 손상으로 본다 (즉시 덮어쓰지 않음)', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ format: 'other-tool', version: 9, works: [] }));
    const r = loadCreator();
    expect(r.doc).toBeNull();
    expect(r.corruptRaw).not.toBeNull();
  });

  test('구조가 어긋난 work 는 손상으로 본다', () => {
    const w = makeEmptyWork('깨진 작업') as unknown as Record<string, unknown>;
    delete w.common;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ format: 'worksheet-creator', version: 1, works: [w] }));
    const r = loadCreator();
    expect(r.doc).toBeNull();
    expect(r.corruptRaw).not.toBeNull();
  });

  test('문제 하나라도 스키마를 어기면 손상으로 본다 (조용히 고쳐 쓰지 않음)', () => {
    const w = makeEmptyWork('작업');
    const p = makeProblem('count');
    (p as CountProblem).count = '7' as unknown as number;
    w.common = { problems: { [p.id]: p }, order: [p.id] };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ format: 'worksheet-creator', version: 1, works: [w] }));
    const r = loadCreator();
    expect(r.doc).toBeNull();
    expect(r.corruptRaw).not.toBeNull();
  });
});

describe('기존 검사기 학생 데이터 보존 (§4.2)', () => {
  test('기존 키는 읽기만 한다 — 제작 도구 저장이 기존 키를 건드리지 않는다', () => {
    const legacy = JSON.stringify({ version: 2, students: [{ id: 'stu_a', name: '학생 가', states: { N01: 'mastered' } }], currentId: 'stu_a' });
    window.localStorage.setItem(LEGACY_CHECKER_KEY, legacy);

    const doc: CreatorDoc = { format: 'worksheet-creator', version: 1, works: [makeExampleWork()], lastOpenedWorkId: null };
    saveCreator(doc);
    saveCreator(doc);

    expect(window.localStorage.getItem(LEGACY_CHECKER_KEY)).toBe(legacy); // 원본 그대로
    expect(readLegacyStudents()).toEqual([{ id: 'stu_a', name: '학생 가' }]);
    expect(loadCreator().legacyStudents).toHaveLength(1);
  });

  test('기존 키가 없으면 legacyStudents 는 빈 배열', () => {
    expect(readLegacyStudents()).toEqual([]);
  });
});

describe('백업 내보내기·불러오기 (§12.4)', () => {
  const roundtrip = (works: Work[]): Work[] => {
    const backup = buildBackup(works);
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.reason);
    return parsed.works;
  };

  test('내보낸 백업을 그대로 되돌릴 수 있다', () => {
    const w = makeExampleWork();
    const back = roundtrip([w]);
    expect(back).toHaveLength(1);
    expect(back[0].name).toBe(w.name);
    expect(back[0].common.order).toEqual(w.common.order);
    expect(back[0].common.order.length).toBe(4);
  });

  test('잘못된 JSON 은 이유와 함께 거부', () => {
    const r = parseBackup('not-json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('JSON');
  });

  test('다른 도구 파일은 거부', () => {
    const r = parseBackup(JSON.stringify({ format: 'something-else', version: 1, works: [] }));
    expect(r.ok).toBe(false);
  });

  test('지원하지 않는 버전은 거부', () => {
    const r = parseBackup(JSON.stringify({ format: 'worksheet-creator-backup', version: 2, works: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('버전');
  });

  test('백업 안 작업이 손상되었으면 거부 (기존 작업 보존)', () => {
    const w = makeEmptyWork('깨짐') as unknown as Record<string, unknown>;
    w.common = 'not-a-set';
    const r = parseBackup(JSON.stringify({ format: 'worksheet-creator-backup', version: 1, works: [w] }));
    expect(r.ok).toBe(false);
  });

  test('불러오기는 기존 작업을 덮어쓰지 않는다 — id 충돌 시 새 작업으로 추가', () => {
    const existing = makeEmptyWork('기존');
    const doc: CreatorDoc = { format: 'worksheet-creator', version: 1, works: [existing], lastOpenedWorkId: existing.id };
    const imported = makeEmptyWork('불러온');
    imported.id = existing.id; // id 충돌 만들기
    imported.common = (() => {
      const p = makeProblem('count');
      return { problems: { [p.id]: p }, order: [p.id] };
    })();

    const { doc: merged, added, renamed } = mergeImported(doc, [imported]);
    expect(added).toBe(1);
    expect(renamed).toBe(1);
    expect(merged.works).toHaveLength(2);
    expect(merged.works[0]).toEqual(existing); // 기존 작업 무변경
    expect(merged.works[1].id).not.toBe(existing.id);
    expect(merged.works[1].common.order).toHaveLength(1);
  });
});
