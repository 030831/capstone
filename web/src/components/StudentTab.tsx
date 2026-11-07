import { useEffect, useMemo, useState } from 'react';
import { draftIepFromText, SAMPLE_IEP_TEXT } from '../data/draft';
import { GROUPS, groupOf } from '../data/groups';
import { graph, nodeSpec } from '../graph';
import { prereqMasteryTargets, type Action, AppState } from '../state';
import { STATE_LABEL } from '../ui';
import type { State } from '../engine';
import { StateSegmented } from './Segmented';

/** 미리 보기 행: IEP 문장 제안 또는 "선수까지 숙달" 제안을 같은 형태로 쓴다. */
interface PreviewRow {
  node: string;
  current: State;
  proposed: State;
  evidence: string;
}

/** 학생 현행수준 모달.
 * v3(지시서 §4): IEP 문장 붙여넣기는 "변경 내용 미리 보기 → 교사가 항목 선택 → 선택한 내용 적용"
 * 흐름만 한다. 미리 보기만으로 학생 데이터·localStorage·검사 결과가 바뀌지 않는다.
 * 적용 뒤 최근 1회를 되돌릴 수 있다. 진도율·개수 집계는 표시하지 않는다(원칙 7). */
export function StudentTab({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const student = state.students.find((s) => s.id === state.currentId)!;
  const [paste, setPaste] = useState('');
  /** 미리 보기를 뺀 원문(버튼을 누른 시점의 문장). 원문을 수정하면 무효화된다. */
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<number | null>(null);
  /** 선수까지 숙달 미리 보기: 대상 노드(null 이면 닫힘)와 선택 상태. */
  const [masteryNode, setMasteryNode] = useState<string | null>(null);
  const [masterySelected, setMasterySelected] = useState<Set<string>>(new Set());

  // 미리 보기는 '변경 내용 미리 보기'를 누른 시점의 문장으로만 계산한다.
  const preview = useMemo(
    () => (previewText && previewText.trim() ? draftIepFromText(previewText, student.states) : null),
    [previewText, student.states],
  );
  const previewRows: PreviewRow[] = preview ? preview.proposals.map((p) => ({ node: p.node, current: p.current, proposed: p.proposed, evidence: p.evidence })) : [];

  // 학생을 바꾸면 다른 학생에게 적용되지 않도록 미리 보기·선택을 초기화한다.
  useEffect(() => {
    setPaste('');
    setPreviewText(null);
    setChecked(new Set());
    setApplied(null);
    setMasteryNode(null);
    setMasterySelected(new Set());
  }, [state.currentId]);

  const doPreview = () => {
    if (!paste.trim()) return;
    setPreviewText(paste);
    // 기본으로 모든 제안을 선택해 두고 교사가 해제할 수 있게 한다.
    setChecked(new Set(draftIepFromText(paste, student.states).proposals.map((p) => p.node)));
    setApplied(null);
  };

  const applySelected = () => {
    if (!preview) return;
    const changes = preview.proposals
      .filter((r) => checked.has(r.node))
      .map((r) => ({ node: r.node, state: r.proposed }));
    if (changes.length === 0) return;
    dispatch({ type: 'applyIepChanges', changes });
    setApplied(changes.length);
    setChecked(new Set());
    setPreviewText(null); // 적용했으면 미리 보기를 닫는다
  };

  const masteryTargets = useMemo(
    () => (masteryNode ? prereqMasteryTargets(masteryNode, student.states) : []),
    [masteryNode, student.states],
  );

  const openMasteryPreview = (node: string) => {
    setMasteryNode(node);
    setMasterySelected(new Set(prereqMasteryTargets(node, student.states)));
  };

  const applyMastery = () => {
    const changes = [...masterySelected].map((node) => ({ node, state: 'mastered' as State }));
    if (changes.length === 0) return;
    dispatch({ type: 'applyIepChanges', changes });
    setMasteryNode(null);
    setMasterySelected(new Set());
    setApplied(changes.length);
  };

  const canUndo = state.lastApplyUndo !== null && state.lastApplyUndo.studentId === student.id;
  const st = (x: string): State => student.states[x] ?? 'unknown';

  return (
    <div className="page page-modal">
      <div className="page-head">
        <h2>{student.name}의 현행수준</h2>
        <div className="page-actions">
          <button type="button" className="btn" onClick={() => dispatch({ type: 'addStudent' })}>학생 추가</button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={state.students.length <= 1}
            onClick={() => {
              if (window.confirm(`${student.name}을(를) 삭제할까요? 되돌릴 수 없습니다.`)) dispatch({ type: 'deleteStudent', id: student.id });
            }}
          >
            {student.name} 삭제
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              if (window.confirm('학생 목록을 예시(학생 A, B, C)로 되돌립니다. 지금까지 입력한 내용은 사라집니다.')) dispatch({ type: 'resetPresets' });
            }}
          >
            예시 학생으로 되돌리기
          </button>
        </div>
      </div>

      <div className="card iep-paste">
        <h3>IEP 현행수준 문장으로 변경 내용 미리 보기</h3>
        <p className="muted">
          현행수준 문장을 붙여넣고 <strong>변경 내용 미리 보기</strong>를 누르면, 바꿀 항목을 먼저 보여줘요.
          적용할 항목을 고른 뒤 <strong>선택한 내용 적용</strong>을 눌러야 학생 기록이 바뀝니다.
          문장 해석은 단서(키워드·수식)만 쓰는 규칙이라 모호한 문장은 자동으로 바꾸지 않아요.
        </p>
        <textarea
          rows={3}
          value={paste}
          onChange={(e) => { setPaste(e.target.value); setPreviewText(null); setChecked(new Set()); setApplied(null); setMasteryNode(null); setMasterySelected(new Set()); }}
          placeholder={`예: ${SAMPLE_IEP_TEXT}`}
          aria-label="IEP 현행수준 문장 붙여넣기"
        />
        <div className="iep-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!paste.trim()}
            onClick={doPreview}
          >
            변경 내용 미리 보기
          </button>
          <button type="button" className="btn" onClick={() => { setPaste(SAMPLE_IEP_TEXT); setPreviewText(null); setChecked(new Set()); setApplied(null); }}>예시 문장 넣기</button>
          {canUndo && (
            <button type="button" className="btn" onClick={() => dispatch({ type: 'undoIepApply' })}>
              적용 되돌리기
            </button>
          )}
          {applied !== null && <span className="ok-note" role="status">{applied}개 항목을 적용했어요.</span>}
        </div>

        {preview && (
          <div className="iep-preview" aria-label="변경 내용 미리 보기">
            {previewRows.length === 0 && preview.needsReview.length === 0 && (
              <p className="muted">문장에서 변경 단서를 못 찾았어요. 아래 표에서 직접 고르세요.</p>
            )}
            {previewRows.length > 0 && (
              <>
                <table className="tbl tbl-preview">
                  <thead>
                    <tr>
                      <th scope="col">개념</th>
                      <th scope="col">현재 상태</th>
                      <th scope="col">제안 상태</th>
                      <th scope="col">근거 문장</th>
                      <th scope="col">적용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r) => (
                      <tr key={r.node}>
                        <th scope="row" className="cell-label"><span className="cell-name">{nodeSpec(r.node).label}</span></th>
                        <td><span className={`st st-${r.current}`}>{STATE_LABEL[r.current]}</span></td>
                        <td><span className={`st st-${r.proposed}`}>{STATE_LABEL[r.proposed]}</span></td>
                        <td className="cell-evidence">{r.evidence}</td>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`${nodeSpec(r.node).label} 적용`}
                            checked={checked.has(r.node)}
                            onChange={(e) => {
                              const next = new Set(checked);
                              if (e.target.checked) next.add(r.node);
                              else next.delete(r.node);
                              setChecked(next);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="iep-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={[...checked].length === 0}
                    onClick={applySelected}
                  >
                    선택한 내용 적용
                  </button>
                  <span className="muted">미리 보기만으로는 기록이 바뀌지 않아요.</span>
                </div>
              </>
            )}
            {preview.needsReview.length > 0 && (
              <div className="iep-review">
                <p className="muted">확인이 필요한 항목(자동으로 바꾸지 않아요):</p>
                <table className="tbl tbl-preview">
                  <thead>
                    <tr><th scope="col">개념</th><th scope="col">근거 문장</th><th scope="col">확인이 필요한 이유</th></tr>
                  </thead>
                  <tbody>
                    {preview.needsReview.map((r) => (
                      <tr key={r.node}>
                        <th scope="row" className="cell-label"><span className="cell-name">{nodeSpec(r.node).label}</span></th>
                        <td className="cell-evidence">{r.evidence}</td>
                        <td className="cell-note">{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {masteryNode && (
          <div className="iep-preview" aria-label="선수까지 숙달 미리 보기">
            <p className="muted">
              <strong>{nodeSpec(masteryNode).label}</strong>과 그 필수 선수 가운데 아직 숙달이 아닌 개념을 숙달로 표시해요.
              확인한 항목만 적용하세요.
            </p>
            <table className="tbl tbl-preview">
              <thead>
                <tr><th scope="col">개념</th><th scope="col">현재 상태</th><th scope="col">제안 상태</th><th scope="col">적용</th></tr>
              </thead>
              <tbody>
                {masteryTargets.map((node) => (
                  <tr key={node}>
                    <th scope="row" className="cell-label"><span className="cell-name">{nodeSpec(node).label}</span></th>
                    <td><span className={`st st-${st(node)}`}>{STATE_LABEL[st(node)]}</span></td>
                    <td><span className="st st-mastered">{STATE_LABEL.mastered}</span></td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${nodeSpec(node).label} 적용`}
                        checked={masterySelected.has(node)}
                        onChange={(e) => {
                          const next = new Set(masterySelected);
                          if (e.target.checked) next.add(node);
                          else next.delete(node);
                          setMasterySelected(next);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="iep-actions">
              <button type="button" className="btn btn-primary" onClick={applyMastery}>
                선택한 내용 적용
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setMasteryNode(null)}>취소</button>
            </div>
          </div>
        )}
      </div>

      <div className="groups">
        {GROUPS.map((g) => {
          const ids = graph.nodeIds.filter((id) => groupOf(id).key === g.key);
          const hasAny = ids.some((id) => student.states[id]);
          return (
            <details key={g.key} id={`grp-${g.key}`} className="group-fold" open={hasAny}>
              <summary style={{ background: g.bg, borderColor: g.border }}>{g.name}</summary>
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr><th scope="col">개념</th><th scope="col">상태</th><th scope="col"><span className="muted">빠른 입력</span></th></tr>
                  </thead>
                  <tbody>
                    {ids.map((id) => {
                      const cur = st(id);
                      const missing = [...graph.hardPred.get(id)!].filter((p) => st(p) !== 'mastered');
                      const inconsistent = cur === 'mastered' && missing.length > 0;
                      return (
                        <tr key={id}>
                          <th scope="row" className="cell-label">
                            <span className="cell-name">{nodeSpec(id).label}</span>
                            <span className="cell-id">{nodeSpec(id).description}</span>
                            {inconsistent && (
                              <span className="row-warn">
                                필수 선수 {missing.map((m) => nodeSpec(m).label).join(', ')}은(는) 아직 숙달이 아닙니다.
                              </span>
                            )}
                          </th>
                          <td>
                            <StateSegmented
                              name={`st-${student.id}-${id}`}
                              value={cur}
                              ariaLabel={`${nodeSpec(id).label} 상태`}
                              onChange={(s) => dispatch({ type: 'setNodeState', node: id, state: s })}
                            />
                          </td>
                          <td className="cell-actions">
                            {(cur !== 'mastered' || inconsistent) && (
                              <button type="button" className="btn btn-small btn-quiet" onClick={() => openMasteryPreview(id)}>
                                선수까지 숙달(미리 보기)
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>

      <p className="note">
        미확인 = 기록이 아직 없음 · 미시작 = 다루지 않았다고 확인함 · 형성 중 = 시도하지만 불안정 · 숙달 = 도움 없이 안정적으로 수행.
        이 표의 확정은 교사가 합니다.
      </p>
    </div>
  );
}
