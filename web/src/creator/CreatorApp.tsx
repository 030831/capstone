// 학습지 제작 도구 최상위 컴포넌트.
// - 저장: 이 브라우저(localStorage)에만 저장되고 실패는 숨기지 않는다(지시서 §12.1~12.2).
// - 손상 데이터: 앱을 멈추지 않고, 원본을 즉시 덮어쓰지 않는다(백업 → 새 작업 시작, §12.3).
// - 기존 검사기 학생 데이터는 읽기만 한다(§4.2).
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { EditorScreen } from './EditorScreen';
import { WorksScreen } from './WorksScreen';
import { WorksheetScreen } from './WorksheetScreen';
import { creatorReducer, type CreatorState } from './reducer';
import { downloadCorruptBackup, loadCreator, saveCreator, type ParseBackupResult } from './storage';
import { emptyDoc } from './storage';

export function CreatorApp({ onOpenChecker }: { onOpenChecker?: () => void }) {
  const initial = useRef(loadCreator()).current;
  const [corruptRaw] = useState<string | null>(initial.corruptRaw);
  const [corruptAcked, setCorruptAcked] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  const [state, dispatch] = useReducer(creatorReducer, undefined, (): CreatorState => ({
    doc: initial.doc ?? emptyDoc(),
    view: { screen: 'works' },
    history: {},
  }));

  // ── 저장 (변경 후 500ms, 실패 시 안내) ──
  const firstRender = useRef(true);
  const saveNow = (): void => {
    if (corruptRaw !== null && !corruptAcked) return; // 손상 원본을 확인 전에 덮어쓰지 않는다
    const ok = saveCreator(state.doc);
    setSaveStatus(ok ? 'saved' : 'failed');
  };
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveStatus('saving');
    const t = setTimeout(() => {
      if (corruptRaw !== null && !corruptAcked) return;
      const ok = saveCreator(state.doc);
      setSaveStatus(ok ? 'saved' : 'failed');
    }, 500);
    return () => clearTimeout(t);
  }, [state.doc, corruptRaw, corruptAcked]);

  // 페이지를 닫기 직전에도 저장을 시도한다.
  useEffect(() => {
    const onLeave = (): void => {
      if (corruptRaw !== null && !corruptAcked) return;
      saveCreator(state.doc);
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [state.doc, corruptRaw, corruptAcked]);

  const workId = state.view.screen === 'works' ? null : state.view.workId;
  const works = state.doc.works;
  const work = useMemo(() => (workId ? works.find((w) => w.id === workId) : undefined), [workId, works]);

  const importResult = (r: ParseBackupResult): void => {
    if (r.ok) dispatch({ type: 'importWorks', works: r.works });
  };

  return (
    <div className="creator-root">
      {corruptRaw !== null && !corruptAcked && (
        <div className="corrupt-banner" role="alert">
          <p>
            저장된 작업 목록을 읽을 수 없어요(데이터가 손상되었을 수 있어요). 앱은 계속 쓸 수 있어요.
            원본을 백업한 뒤 새로 시작할 수 있어요.
          </p>
          <span className="corrupt-actions">
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                downloadCorruptBackup(corruptRaw);
              }}
            >
              원본 백업하기
            </button>
            <button type="button" className="btn btn-small btn-confirm" onClick={() => setCorruptAcked(true)}>
              백업했어요, 새로 시작하기
            </button>
            <button type="button" className="btn btn-small btn-danger" onClick={() => setCorruptAcked(true)}>
              백업 없이 새로 시작하기
            </button>
          </span>
        </div>
      )}

      {state.view.screen === 'works' || !work ? (
        <WorksScreen state={state} dispatch={dispatch} legacyStudents={initial.legacyStudents} importResult={importResult} />
      ) : state.view.screen === 'editor' ? (
        <EditorScreen
          state={state}
          work={work}
          dispatch={dispatch}
          legacyStudents={initial.legacyStudents}
          saveStatus={saveStatus}
          onRetrySave={saveNow}
        />
      ) : (
        <WorksheetScreen work={work} version={state.view.version} dispatch={dispatch} />
      )}

      <footer className="creator-foot">
        <span className="muted">작업은 이 브라우저에만 저장돼요.</span>
        {onOpenChecker && (
          <button type="button" className="btn btn-quiet btn-small" onClick={onOpenChecker}>
            이전 도구: 판정 검사기 (독립 모듈)
          </button>
        )}
      </footer>
    </div>
  );
}
