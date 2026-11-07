// 공용 모달(지시서 §13 접근성): 포커스 이동·유지(Tab 순환)·Esc 닫기·닫힌 뒤 포커스 복귀.
// 기존 검사기 App.tsx 의 모달 패턴을 그대로 가져왔다(동일 동작 보장).
import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<Element | null>(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    restoreRef.current = document.activeElement;
    const focusables = (): HTMLElement[] =>
      Array.from(shell.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    (focusables()[0] ?? shell).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !shell.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !shell.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    shell.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onKey);
    return () => {
      shell.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onKey);
      const el = restoreRef.current;
      const restore = (): void => {
        if (el instanceof HTMLElement && document.contains(el)) el.focus();
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
      else restore();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={`modal-shell${wide ? ' modal-wide' : ''}`} ref={shellRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-quiet modal-close" aria-label="닫기" onClick={onClose}>
            닫기 ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** 확인 대화상자(삭제 등) — 무엇이 지워지는지 표시한다(지시서 §10.5). */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  danger,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="confirm-body">
        {body}
        <div className="confirm-actions">
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-confirm'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </Modal>
  );
}
