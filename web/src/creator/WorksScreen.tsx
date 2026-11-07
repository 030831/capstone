// 화면 A. 제작 작업 목록 (지시서 §5).
// 새 문제 만들기 / 예시 작업 열어보기 / 최근 작업 목록(열기·이름 변경·삭제·내보내기) / 전체 백업.
// 문제 수는 제작 산출물 개수다 — 학생 능력·진도 수치로 쓰지 않는다.
import { useState } from 'react';
import { makeExampleWork } from './defaults';
import { ConfirmDialog, Modal } from './Modal';
import { buildBackup, downloadBackup, type ParseBackupResult, parseBackup } from './storage';
import type { Work } from './types';
import { formatTime } from './util';
import type { Action, CreatorState } from './reducer';

interface Props {
  state: CreatorState;
  dispatch: (a: Action) => void;
  legacyStudents: { id: string; name: string }[];
  importResult: (r: ParseBackupResult) => void;
}

export function WorksScreen({ state, dispatch, legacyStudents, importResult }: Props) {
  const [renaming, setRenaming] = useState<Work | null>(null);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<Work | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const works = [...state.doc.works].sort((a, b) => b.updatedAt - a.updatedAt);
  const hasWorks = works.length > 0;

  const createWork = (): void => {
    // 새 작업은 이름 없이 바로 편집 화면으로 — 이름은 상단에서 언제든 고칠 수 있다.
    const name = `새 작업 ${formatTime(Date.now()).slice(2, 14)}`;
    const work: Work = {
      id: `w_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      students: [],
      common: { problems: {}, order: [] },
      studentSets: {},
      selectedVersion: 'common',
      selectedProblemId: null,
      worksheetTitle: name,
    };
    dispatch({ type: 'createWork', work });
  };

  const openExample = (): void => {
    dispatch({ type: 'createWork', work: makeExampleWork() });
  };

  const exportAll = (): void => {
    const backup = buildBackup(state.doc.works);
    downloadBackup(backup, `worksheet-backup-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const exportWork = (w: Work): void => {
    const backup = buildBackup([w]);
    downloadBackup(backup, `worksheet-${w.name.replace(/[\\/:*?"<>|]/g, '_')}.json`);
  };

  const onImportFile = (file: File): void => {
    void file.text().then((text) => {
      const r = parseBackup(text);
      if (r.ok) importResult(r);
      else setImportError(r.reason);
    });
  };

  return (
    <div className="works-screen">
      <section className="works-hero">
        <h2>수학 학습지 만들기</h2>
        <p className="lead">문제 형태를 고르면 바로 편집할 수 있어요. 그림·수식·답하는 방식을 바꾸고, 학생별로 다르게 만들어 인쇄까지 할 수 있어요.</p>
        <div className="hero-actions">
          <button type="button" className="btn btn-primary" onClick={createWork}>
            새 문제 만들기
          </button>
          <button type="button" className="btn" onClick={openExample}>
            예시 작업 열어보기
          </button>
        </div>
        <p className="note">예시 작업은 가상 데이터예요. 실제 학생 기록이 아닙니다.</p>
        {legacyStudents.length > 0 && (
          <p className="note legacy-note">
            기존 검사기에 저장된 학생 표시 이름 {legacyStudents.length}명을 작업 안 학생으로 불러와 쓸 수 있어요 (작업 편집 화면 → 학생 추가).
          </p>
        )}
      </section>

      {hasWorks && (
        <section className="works-list" aria-label="저장한 작업">
          <div className="works-list-head">
            <h3>저장한 작업</h3>
            <div className="works-list-actions">
              <button type="button" className="btn btn-small" onClick={exportAll}>
                전체 백업 내보내기
              </button>
              <label className="btn btn-small file-btn">
                백업 불러오기
                <input
                  type="file"
                  accept="application/json,.json"
                  aria-label="백업 파일 불러오기"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) onImportFile(f);
                  }}
                />
              </label>
            </div>
          </div>
          <ul>
            {works.map((w) => (
              <li key={w.id} className="work-row">
                <button type="button" className="work-open" onClick={() => dispatch({ type: 'openWork', workId: w.id })}>
                  <span className="work-name">
                    {w.name}
                    {w.isExample && <span className="badge-example">예시</span>}
                  </span>
                  <span className="work-meta muted">
                    공통 문제 {w.common.order.length}개{Object.keys(w.studentSets).length > 0 && ` · 학생별 버전 ${Object.keys(w.studentSets).length}개`} · {formatTime(w.updatedAt)}
                  </span>
                </button>
                <span className="work-actions">
                  <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'openWork', workId: w.id })}>
                    열기
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => {
                      setRenaming(w);
                      setNewName(w.name);
                    }}
                  >
                    이름 변경
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => exportWork(w)}>
                    내보내기
                  </button>
                  <button type="button" className="btn btn-small btn-danger" onClick={() => setDeleting(w)}>
                    삭제
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className="note">작업은 이 브라우저에만 저장돼요. 다른 컴퓨터로 옮길 때는 백업 내보내기를 쓰세요.</p>
        </section>
      )}

      {renaming && (
        <Modal title="작업 이름 변경" onClose={() => setRenaming(null)}>
          <div className="field">
            <span className="field-label">작업 이름</span>
            <input
              type="text"
              className="text-input"
              value={newName}
              aria-label="작업 이름"
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-confirm"
              onClick={() => {
                if (newName.trim()) dispatch({ type: 'renameWork', workId: renaming.id, name: newName.trim() });
                setRenaming(null);
              }}
            >
              이름 바꾸기
            </button>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="작업 삭제"
          danger
          confirmLabel="삭제"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            dispatch({ type: 'deleteWork', workId: deleting.id });
            setDeleting(null);
          }}
          body={
            <p>
              작업 <strong>{deleting.name}</strong>와 그 안의 공통 문제 {deleting.common.order.length}개, 학생별 버전 {Object.keys(deleting.studentSets).length}개가 모두 삭제돼요.
              되돌릴 수 없어요. 필요하면 먼저 내보내기로 백업하세요.
            </p>
          }
        />
      )}

      {importError && (
        <Modal title="백업을 가져오지 못했어요" onClose={() => setImportError(null)}>
          <p>{importError}</p>
          <p className="muted">기존 작업은 그대로 남아 있어요.</p>
        </Modal>
      )}
    </div>
  );
}
