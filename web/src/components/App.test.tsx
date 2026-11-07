// @vitest-environment jsdom
// 실제 화면 흐름으로 검증하는 컴포넌트 테스트 (지시서 §10).
//  - 문제 작성 → 개념 후보 → 개념 확인 → 검사 → 이전 입력 표시 (§5)
//  - IEP 미리 보기만으로 저장 데이터가 바뀌지 않음 / 적용·되돌리기·학생 전환 (§4)
//  - 반 검사 예시 문제 자동 대체 금지 (§6)
//  - 모달 키보드 포커스 동작 (§8)
//  - 저장 실패 안내 (§8)
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { STORAGE_KEY } from '../state';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

/** 로컬 저장 데이터를 읽어 학생 상태를 확인한다(미리 보기가 저장을 바꿨는지 검증용). */
const storedStates = (): Record<string, Record<string, string>> => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  const data = JSON.parse(raw) as { students: { id: string; states: Record<string, string> }[] };
  return Object.fromEntries(data.students.map((s) => [s.id, s.states]));
};

describe('문제 검사 흐름 (§5)', () => {
  it('문제 작성 → 후보 선택 → 개념 확인 → 검사 → 결과 표시', async () => {
    const user = userEvent.setup();
    render(<App />);

    // 후보는 자동 반영되지 않는다: 검사 버튼이 처음엔 비활성화
    const submitBtn = screen.getByRole('button', { name: /기준으로 검사/ });
    expect(submitBtn).toBeDisabled();

    await user.type(screen.getByLabelText('문제 글'), '8+5를 구하시오.');

    // 후보 칩에서 받아올림 개념을 담는다
    await user.click(screen.getByRole('button', { name: /받아올림 있는 \(몇\)\+\(몇\)/ }));
    expect(submitBtn).toBeDisabled(); // 개념을 담았어도 확인 전에는 검사 불가

    await user.click(screen.getByRole('button', { name: '개념 확인' }));
    expect(screen.getByText('개념 확인 완료')).toBeVisible();
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);
    await waitFor(() => expect(screen.getByText('확인이 필요한 선수 개념이 있어요')).toBeVisible());
  });

  it('문제 글을 고치면 이전 개념 확인이 무효화되고, 결과는 "이전 입력의 결과"로 표시된다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('문제 글'), '8+5를 구하시오.');
    await user.click(screen.getByRole('button', { name: /받아올림 있는 \(몇\)\+\(몇\)/ }));
    await user.click(screen.getByRole('button', { name: '개념 확인' }));
    await user.click(screen.getByRole('button', { name: /기준으로 검사/ }));
    await waitFor(() => expect(screen.getByText('확인이 필요한 선수 개념이 있어요')).toBeVisible());
    expect(screen.queryByText(/이전 입력의 결과/)).toBeNull();

    // 문제 글 수정 → 확정 풀림 + 결과에 "이전 입력" 표시
    await user.type(screen.getByLabelText('문제 글'), '!');
    expect(screen.getByRole('button', { name: /기준으로 검사/ })).toBeDisabled();
    expect(screen.getByText(/이전 입력의 결과/)).toBeVisible();
    // 개념은 유지되지만 다시 확인해야 검사할 수 있다
    await user.click(screen.getByRole('button', { name: '개념 확인' }));
    expect(screen.getByRole('button', { name: /기준으로 검사/ })).toBeEnabled();
  });

  it('예시 문제를 불러와도 개념 확인을 거쳐야 검사된다(자동 검사 아님)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '받아올림 덧셈' }));
    expect(screen.getByRole('button', { name: /기준으로 검사/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '개념 확인' }));
    await user.click(screen.getByRole('button', { name: /기준으로 검사/ }));
    await waitFor(() => expect(screen.getByText('확인이 필요한 선수 개념이 있어요')).toBeVisible());
  });
});

describe('IEP 미리 보기·적용·되돌리기 (§4)', () => {
  it('미리 보기만으로 학생 상태·localStorage가 바뀌지 않는다', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '학생 현행수준' }));
    await user.click(screen.getByRole('button', { name: '예시 문장 넣기' }));
    const before = JSON.stringify(storedStates());
    await user.click(screen.getByRole('button', { name: '변경 내용 미리 보기' }));

    // 미리 보기 표가 떠 있다(제안 적용 체크박스 + 확인 필요 안내)
    expect(screen.getAllByRole('checkbox', { name: /적용$/ }).length).toBeGreaterThan(0);
    // 적용 버튼을 누르지 않았으므로 저장 데이터가 하나도 바뀌지 않는다
    expect(JSON.stringify(storedStates())).toBe(before);
  });

  it('선택한 내용 적용 → 저장 반영 → 되돌리기', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '학생 현행수준' }));
    await user.click(screen.getByRole('button', { name: '예시 문장 넣기' }));
    await user.click(screen.getByRole('button', { name: '변경 내용 미리 보기' }));

    // 제안된 항목 하나를 해제하고 적용한다
    const n26Check = screen.getByRole('checkbox', { name: /받아올림 있는 \(몇\)\+\(몇\) 적용/ });
    await user.click(n26Check); // 해제
    await user.click(screen.getByRole('button', { name: '선택한 내용 적용' }));

    await waitFor(() => {
      expect(storedStates()['A']['N16_ten_complements']).toBe('emerging'); // 적용된 항목(프리셋과 같은 값)
      expect(storedStates()['A']['N26_add_single_digit_carry']).toBe('not_started'); // 해제한 항목은 그대로
    });
    expect(screen.getByText(/항목을 적용했어요/)).toBeVisible();

    // 되돌리기: 적용 전 스냅샷으로 돌아간다(받아올림 미시작 유지, 새로 바뀐 것 없음 확인)
    await user.click(screen.getByRole('button', { name: '적용 되돌리기' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '적용 되돌리기' })).toBeNull(); // 되돌리기 1회 후 소멸
    });
  });

  it('미리 보기 도중 학생을 바꾸면 다른 학생에게 적용되지 않는다', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '학생 현행수준' }));
    await user.click(screen.getByRole('button', { name: '예시 문장 넣기' }));
    await user.click(screen.getByRole('button', { name: '변경 내용 미리 보기' }));
    expect(screen.getByRole('button', { name: '선택한 내용 적용' })).toBeVisible();

    // 학생 B 로 전환 → 미리 보기가 초기화된다
    await user.click(screen.getByRole('radio', { name: '학생 B' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '선택한 내용 적용' })).toBeNull());
    // B 의 저장 데이터는 그대로다
    expect(storedStates()['B']['N16_ten_complements']).toBeUndefined();
  });

  it('긍정·부정 혼합 문장은 일괄 반영되지 않고 확인 필요로만 나온다', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '학생 현행수준' }));
    await user.type(
      screen.getByLabelText('IEP 현행수준 문장 붙여넣기'),
      '10까지 세기는 할 수 있지만 받아올림은 못함.',
    );
    await user.click(screen.getByRole('button', { name: '변경 내용 미리 보기' }));

    // 제안(적용 가능) 행이 없고, 확인 필요 목록만 있다
    expect(screen.queryByRole('button', { name: '선택한 내용 적용' })).toBeNull();
    expect(screen.getAllByText(/잘하는 표현과 못하는 표현이 섞여/).length).toBeGreaterThan(0);
    expect(storedStates()['A']['N26_add_single_digit_carry']).toBe('not_started'); // 프리셋값, 바뀌지 않음
  });
});

describe('반 일괄 검사 (§6)', () => {
  it('검사한 문제가 없으면 예시로 자동 대체하지 않고 안내만 보여준다', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '반 일괄 검사' }));

    expect(screen.getByText(/아직 검사한 문제가 없어요/)).toBeVisible();
    // 예시 문제 글이 자동으로 쓰이지 않는다
    expect(screen.queryByText(/사탕이 8개 있었는데/)).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('검사한 문제로 반 검사: 상단에 문제 글·개념이 뜨고 기록 없는 학생은 확인 필요로 구분된다', async () => {
    const user = userEvent.setup();
    render(<App />);

    // 기록이 전혀 없는 학생 D 를 추가해 둔다(미확만 있는 학생 = NEEDS_REVIEW 확인용).
    await user.click(screen.getByRole('button', { name: '학생 현행수준' }));
    await user.click(screen.getByRole('button', { name: '학생 추가' }));
    await user.click(screen.getByRole('radio', { name: '학생 A' }));
    await user.click(screen.getByRole('button', { name: '닫기' }));

    await user.click(screen.getByRole('button', { name: '받아올림 덧셈' }));
    await user.click(screen.getByRole('button', { name: '개념 확인' }));
    await user.click(screen.getByRole('button', { name: /기준으로 검사/ }));
    await waitFor(() => expect(screen.getByText('확인이 필요한 선수 개념이 있어요')).toBeVisible());

    // 결과 카드의 "반 일괄 검사" 동작 버튼(헤더 버튼은 inert 상태이므로 결과 내 버튼을 쓴다)
    const batchButtons = screen.getAllByRole('button', { name: '반 일괄 검사' });
    await user.click(batchButtons[batchButtons.length - 1]);
    await waitFor(() => expect(screen.getByText('검사한 문제', { exact: true })).toBeVisible());
    const modal = within(document.querySelector('.modal-shell') as HTMLElement);
    expect(modal.getByText(/사탕이 8개 있었는데 5개를 더 받았어요/)).toBeVisible();

    // 학생 B(기록이 드문드문)는 COLLISION 이면서 미확인 기록도 함께 표시된다
    const bRow = modal.getByRole('button', { name: '학생 B' }).closest('tr')!;
    expect(bRow.textContent).toContain('확인이 필요한 선수 개념이 있어요');
    expect(bRow.textContent).toContain('십몇 = 10과 몇'); // 미확인 기록 칩
    // 기록이 전혀 없는 학생 D 는 NEEDS_REVIEW(미확인)로 구분된다 — 준비된 것으로 세지 않는다
    const dRow = modal.getByRole('button', { name: '학생 D' }).closest('tr')!;
    expect(dRow.textContent).toContain('아직 확인하지 않은 기록이 있어요');
    // "반 전체에게 내도 된다"는 결론은 없다
    expect(document.body.textContent).not.toContain('반 전체에게 내도');
  });
});

describe('모달 키보드 포커스 (§8)', () => {
  it('모달 열기 → 포커스 이동 → Tab 순환 → Esc 닫기 → 열었던 버튼으로 복귀', async () => {
    const user = userEvent.setup();
    render(<App />);
    const opener = screen.getByRole('button', { name: '학생 현행수준' });
    opener.focus();

    await user.click(opener);
    const shell = document.querySelector('.modal-shell') as HTMLElement;
    expect(shell).not.toBeNull();
    // 모달 안으로 포커스가 이동했다
    expect(shell.contains(document.activeElement)).toBe(true);
    // 뒤 화면이 inert 다
    expect(document.querySelector('.app')!.hasAttribute('inert')).toBe(true);

    // Tab 이 모달 안에서 순환한다(많이 눌러도 모달 밖으로 나가지 않는다)
    for (let i = 0; i < 30; i++) await user.keyboard('{Tab}');
    expect(shell.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('.modal-shell')).toBeNull());
    expect(document.querySelector('.app')!.hasAttribute('inert')).toBe(false);
    // 열었던 버튼으로 포커스가 돌아온다
    await waitFor(() => expect(document.activeElement).toBe(opener), { timeout: 3000 });
  });
});

describe('저장 실패 안내 (§8)', () => {
  it('localStorage 를 못 쓰면 "이 브라우저에 저장하지 못했어요"를 표시한다', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('문제 글'), '8+5');
    expect(await screen.findByRole('alert')).toHaveTextContent('이 브라우저에 저장하지 못했어요');
    spy.mockRestore();
  });
});
