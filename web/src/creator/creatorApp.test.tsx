// @vitest-environment jsdom
// 사용 흐름 검증 (지시서 §16 시나리오 A~F). 실제 사용자 조작으로 확인한다.
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreatorApp } from './CreatorApp';
import { clearCreatorStorage, LEGACY_CHECKER_KEY, STORAGE_KEY } from './storage';

const printSpy = vi.fn();
let user: ReturnType<typeof userEvent.setup>;

beforeAll(() => {
  window.print = printSpy;
});

beforeEach(() => {
  clearCreatorStorage();
  window.localStorage.removeItem(LEGACY_CHECKER_KEY);
  user = userEvent.setup(); // 테스트별로 새 설정 — 이전 문서 참조 방지
});

afterEach(() => {
  cleanup(); // 이전 렌더 잔여 제거 (vitest globals 미사용 시 자동 정리 없음)
  clearCreatorStorage();
  window.localStorage.removeItem(LEGACY_CHECKER_KEY);
  vi.restoreAllMocks();
});

const selectElement = (el: string): void => {
  const node = document.querySelector(`[data-element="${el}"]`);
  if (!node) throw new Error(`요소를 찾을 수 없음: ${el}`);
  fireEvent.click(node);
};

const svgCount = (): number => document.querySelectorAll('.ed-center .pic-group svg').length;

const newWork = async (): Promise<void> => {
  await user.click(screen.getByRole('button', { name: '새 문제 만들기' }));
};

const addProblem = async (kind: string): Promise<void> => {
  await user.click(screen.getByRole('button', { name: '+ 문제 추가' }));
  // 형태 카드는 빈 편집 화면과 모달에 동시에 있을 수 있어 마지막(모달)을 클릭한다.
  const cards = screen.getAllByRole('button', { name: new RegExp(kind) });
  await user.click(cards[cards.length - 1]);
};

/** 현재 선택된 문제의 질문 문장(중앙 카드)을 바꾼다. */
const setQuestion = async (text: string): Promise<void> => {
  const areas = screen.getAllByLabelText('질문 문장');
  await user.clear(areas[0]);
  await user.type(areas[0], text);
};

describe('시나리오 A. 빈 작업에서 첫 문제 제작', () => {
  test('만들기 → 개수 변경 → 질문 수정 → 선택지 → 저장 → 새로고침 복원 (개념·숙달 입력 없음)', async () => {
    const { unmount } = render(<CreatorApp />);
    await newWork();
    await user.click(screen.getByRole('button', { name: /그림 수 세기/ }));

    // 실제 그림·질문·응답 영역이 나타난다 (시작 예시 4개)
    expect(svgCount()).toBe(4);
    expect(screen.getAllByLabelText('질문 문장')[0]).toHaveValue('그림은 모두 몇 개인가요?');

    // 그림 개수 4 → 7
    selectElement('pictures');
    fireEvent.change(screen.getByLabelText('그림 개수'), { target: { value: '7' } });
    await waitFor(() => expect(svgCount()).toBe(7));

    // 질문 문장 수정
    await setQuestion('사과는 모두 몇 개인가요?');

    // 답칸 → 선택지 방식
    selectElement('response');
    await user.click(screen.getByRole('radio', { name: '골라 보기' }));
    expect(screen.getAllByText('6').length).toBeGreaterThan(0);
    expect(screen.getAllByText('8').length).toBeGreaterThan(0);

    // 저장 확인 (디바운스 후 localStorage)
    await waitFor(
      () => {
        expect(window.localStorage.getItem(STORAGE_KEY)).toContain('사과는 모두 몇 개인가요?');
      },
      { timeout: 4000 },
    );

    // 새로고침 = 마운트 해제 후 다시 렌더링, 작업 다시 열기
    unmount();
    render(<CreatorApp />);
    await user.click(await screen.findByRole('button', { name: '열기' }));

    // 그림 7개·수정 문장·선택지 유지
    await waitFor(() => expect(svgCount()).toBe(7));
    expect(screen.getAllByLabelText('질문 문장')[0]).toHaveValue('사과는 모두 몇 개인가요?');
    expect(screen.getAllByText('6').length).toBeGreaterThan(0);
    expect(screen.getAllByText('8').length).toBeGreaterThan(0);
  }, 20000);
});

describe('시나리오 B. 같은 문제의 다양한 표현', () => {
  test('두 묶음: 표시 방식 전환에도 수량 유지, 수량 변경 시 화면·정답 갱신', async () => {
    render(<CreatorApp />);
    await newWork();
    await user.click(screen.getByRole('button', { name: /두 묶음 합치기/ }));
    expect(svgCount()).toBe(5); // 2+3

    selectElement('pictures');
    // 왼쪽 2 → 4
    fireEvent.change(screen.getByLabelText('왼쪽 수량'), { target: { value: '4' } });
    await waitFor(() => expect(svgCount()).toBe(7)); // 4+3

    // 그림만 보기 — 수식 사라짐
    await user.click(screen.getByRole('radio', { name: '그림만' }));
    expect(screen.queryByText('4 + 3 =')).toBeNull();
    // 수량 데이터 유지 확인: 다시 그림+수식으로
    await user.click(screen.getByRole('radio', { name: '그림+수식' }));
    expect(screen.getByText('4 + 3 =')).toBeInTheDocument();
    expect(svgCount()).toBe(7);

    // 수식만 보기 — 그림 사라져도 수량은 남는다
    await user.click(screen.getByRole('radio', { name: '수식만' }));
    expect(svgCount()).toBe(0);
    expect(screen.getByText('4 + 3 =')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '그림+수식' }));
    expect(svgCount()).toBe(7); // 다시 표시하면 같은 값
  }, 15000);
});

describe('시나리오 C. 학생별 문제 제작', () => {
  test('공통 2문제 → 학생 A·B 버전 → 각각 수정 → 전환해도 독립 유지 → 출력물 미리보기', async () => {
    render(<CreatorApp />);
    await newWork();
    await addProblem('그림 수 세기');
    await setQuestion('공통 세기 문제');
    await addProblem('수식 완성하기');
    await setQuestion('공통 수식 문제');

    // 학생 A·B 정보 입력
    const addStudent = async (name: string, goal: string): Promise<void> => {
      await user.click(screen.getByRole('button', { name: '+ 학생 추가' }));
      await user.type(screen.getByLabelText('익명 표시 이름'), name);
      await user.type(screen.getByLabelText('IEP 목표'), goal);
      await user.click(screen.getByRole('button', { name: '추가' }));
    };
    await addStudent('학생 A', '10까지 세기');
    await addStudent('학생 B', '두 수의 합');

    // 각각 학생별 버전 생성 (모달 안에 학생 A·B 두 줄이 있어 첫 줄을 클릭)
    await user.click(screen.getByRole('button', { name: '학생별 버전 만들기' }));
    await user.click(screen.getAllByRole('button', { name: /버전 만들기 \(2개 복사\)/ })[0]);
    await user.click(screen.getByRole('button', { name: '학생별 버전 만들기' }));
    await user.click(screen.getAllByRole('button', { name: /버전 만들기 \(2개 복사\)/ })[0]);

    // A 버전으로 전환한 뒤 A 수정: 첫 문제를 선택지 방식으로
    await user.click(screen.getByRole('radio', { name: /학생 A/ }));
    await user.click(screen.getByRole('button', { name: /공통 세기 문제/ }));
    selectElement('response');
    await user.click(screen.getByRole('radio', { name: '골라 보기' }));

    // 공통으로 전환 → 원본은 답칸 그대로
    await user.click(screen.getByRole('radio', { name: /^공통 문제/ }));
    await user.click(screen.getByRole('button', { name: /공통 세기 문제/ }));
    // 공통 버전의 중앙 문제 카드에는 선택지가 없다 (답칸 그대로)
    expect(document.querySelectorAll('.ed-center .choices').length).toBe(0);

    // B 버전으로 전환 → B도 답칸
    await user.click(screen.getByRole('radio', { name: /학생 B/ }));
    expect(document.querySelectorAll('.ed-center .choices').length).toBe(0);

    // 다시 A → 선택지 유지 (여러 번 전환)
    await user.click(screen.getByRole('radio', { name: /학생 A/ }));
    await user.click(screen.getByRole('radio', { name: /학생 B/ }));
    await user.click(screen.getByRole('radio', { name: /학생 A/ }));
    expect(document.querySelectorAll('.ed-center .choices').length).toBeGreaterThan(0);

    // A 학생의 출력물 미리보기 — IEP 목표가 학생용 출력에 없다
    await user.click(screen.getByRole('button', { name: '학습지 보기' }));
    const sheet = document.querySelector('.sheet') as HTMLElement;
    expect(within(sheet).getByText(/학생 A/)).toBeInTheDocument(); // 이름줄
    expect(within(sheet).queryByText('10까지 세기')).toBeNull(); // IEP 목표 제외
    expect(within(sheet).getByText('공통 세기 문제')).toBeInTheDocument();
    expect(within(sheet).queryByText('정답')).toBeNull(); // 정답 없음

    // B 출력물로 전환
    await user.click(screen.getByRole('radio', { name: '학생 B' }));
    expect(within(sheet).getByText(/학생 B/)).toBeInTheDocument();
    expect(within(sheet).queryByText(/학생 A/)).toBeNull();
  }, 25000);
});

describe('시나리오 D. 복제·삭제·취소', () => {
  test('복제 → 복사본 수정(원본 무변경) → 삭제 → 취소 복원 → 버전 전환 후 취소 격리', async () => {
    render(<CreatorApp />);
    await newWork();
    await addProblem('그림 수 세기');
    await user.click(screen.getByRole('button', { name: '복제' }));
    expect(document.querySelectorAll('.ed-center .problem-card').length).toBe(1); // 중앙엔 선택 문제 1개
    expect(screen.getAllByRole('button', { name: /복제/ }).length).toBeGreaterThan(0);

    // 복사본(자동 선택됨) 수정
    await setQuestion('복사본 문제');
    selectElement('pictures');
    fireEvent.change(screen.getByLabelText('그림 개수'), { target: { value: '9' } });

    // 원본으로 전환해 확인 — 원본 무변경
    await user.click(screen.getByRole('button', { name: /그림은 모두 몇 개인가요/ }));
    expect(screen.getAllByLabelText('질문 문장')[0]).toHaveValue('그림은 모두 몇 개인가요?');
    expect(svgCount()).toBe(4);

    // 복사본 삭제 → 취소 복원
    await user.click(screen.getByRole('button', { name: /복사본 문제/ }));
    await user.click(screen.getByRole('button', { name: '2번 문제 삭제' }));
    await user.click(screen.getByRole('button', { name: /^삭제$/ }));
    expect(screen.queryByText('복사본 문제')).toBeNull();
    await user.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(await screen.findByText('복사본 문제')).toBeInTheDocument();

    // 버전 전환 후 취소 격리: 학생 버전 생성
    await user.click(screen.getByRole('button', { name: '+ 학생 추가' }));
    await user.type(screen.getByLabelText('익명 표시 이름'), '학생 A');
    await user.click(screen.getByRole('button', { name: '추가' }));
    await user.click(screen.getByRole('button', { name: '학생별 버전 만들기' }));
    await user.click(screen.getByRole('button', { name: /^버전 만들기/ }));

    // 공통에서 편집 (원본 문제 선택 후 개수 6)
    await user.click(screen.getByRole('radio', { name: /^공통 문제/ }));
    await user.click(screen.getByRole('button', { name: /그림은 모두 몇 개인가요/ }));
    selectElement('pictures');
    fireEvent.change(screen.getByLabelText('그림 개수'), { target: { value: '6' } });
    await waitFor(() => expect(svgCount()).toBe(6));

    // 학생 A 버전: 여전히 4 (공통 편집이 버전을 덮어쓰지 않음)
    await user.click(screen.getByRole('radio', { name: /학생 A/ }));
    await waitFor(() => expect(svgCount()).toBe(4));

    // 학생 버전에서 편집 → 취소 → 공통은 6 유지
    fireEvent.change(screen.getByLabelText('그림 개수'), { target: { value: '8' } });
    await waitFor(() => expect(svgCount()).toBe(8));
    await user.click(screen.getByRole('button', { name: '실행 취소' }));
    await waitFor(() => expect(svgCount()).toBe(4));
    await user.click(screen.getByRole('radio', { name: /^공통 문제/ }));
    await waitFor(() => expect(svgCount()).toBe(6));
  }, 25000);
});

describe('시나리오 E. 출력', () => {
  test('형태별 5문제 → 순서 변경 → 미리보기 순서·내용 → 학생용에 교사 정보 없음 → 교사용 정답 별도 → 인쇄 호출', async () => {
    render(<CreatorApp />);
    await newWork();
    await addProblem('그림 수 세기');
    await setQuestion('문제1 세기');
    await addProblem('두 묶음 합치기');
    await setQuestion('문제2 합치기');
    await addProblem('수식 완성하기');
    await setQuestion('문제3 수식');
    await addProblem('비교하기');
    await setQuestion('문제4 비교');
    await addProblem('그림 수 세기');
    await setQuestion('문제5 세기');

    // 순서 변경: 2번 문제를 한 칸 위로 → 첫 문제가 된다
    await user.click(screen.getByRole('button', { name: '2번 문제 위로 이동' }));

    // 힌트 추가: 문제1(현재 2번째)에 인쇄 제외 힌트
    await user.click(screen.getByRole('button', { name: /문제1 세기/ }));
    selectElement('hint');
    await user.click(screen.getByLabelText('힌트 넣기'));
    await user.type(screen.getByLabelText('힌트 안내 문장'), '손가락으로 짚어 가며 세어 보세요');

    await user.click(screen.getByRole('button', { name: '학습지 보기' }));
    const sheet = document.querySelector('.sheet') as HTMLElement;

    // 순서 반영: 첫 문제 = 문제2
    const firstQ = sheet.querySelector('.ws-problem .q') as HTMLElement;
    expect(firstQ.textContent).toBe('문제2 합치기');

    // 그림 개수·수식·응답 영역 확인
    expect(sheet.querySelectorAll('.pic-group svg').length).toBeGreaterThan(0);
    expect(sheet.querySelector('.ans-blank')).not.toBeNull();

    // 학생용 출력에 교사 정보가 없다
    expect(within(sheet).queryByText('정답')).toBeNull();
    expect(within(sheet).queryByText('정답:')).toBeNull();
    expect(within(sheet).queryByText(/IEP/)).toBeNull();
    expect(within(sheet).queryByText(/메모/)).toBeNull();
    expect(within(sheet).queryByLabelText('질문 문장')).toBeNull(); // 편집 UI 없음
    expect(within(sheet).queryByText('손가락으로 짚어 가며 세어 보세요')).toBeNull(); // 인쇄 제외 힌트

    // 교사용 정답 보기 — 별도 확인
    await user.click(screen.getByLabelText('교사용 정답 보기'));
    expect(within(sheet).getAllByText(/정답:/).length).toBe(5);

    // 인쇄 버튼 → window.print 호출
    await user.click(screen.getByRole('button', { name: /^인쇄$/ }));
    expect(printSpy).toHaveBeenCalled();
  }, 25000);
});

describe('시나리오 F. 실패와 복구', () => {
  test('저장 실패 안내가 나온다 (조용히 실패하지 않는다)', async () => {
    render(<CreatorApp />);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    await newWork();
    await user.click(screen.getByRole('button', { name: /그림 수 세기/ }));
    await waitFor(
      () => {
        expect(screen.getByText('저장하지 못함')).toBeInTheDocument();
        expect(screen.getByText(/이 브라우저에 저장하지 못했어요/)).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
    spy.mockRestore();
  }, 15000);

  test('손상된 저장 데이터: 안내·백업·새로 시작, 확인 전에는 원본을 덮어쓰지 않는다', async () => {
    const corrupt = '{{"broken":';
    window.localStorage.setItem(STORAGE_KEY, corrupt);
    render(<CreatorApp />);

    // 앱이 멈추지 않고 새 작업 시작 가능
    expect(screen.getByText(/저장된 작업 목록을 읽을 수 없어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새 문제 만들기' })).toBeInTheDocument();

    // 원본 백업 버튼이 있다
    expect(screen.getByRole('button', { name: '원본 백업하기' })).toBeInTheDocument();

    // 확인(새로 시작) 전까지는 저장이 원본을 덮어쓰지 않는다
    await user.click(screen.getByRole('button', { name: '새 문제 만들기' }));
    await user.click(screen.getByRole('button', { name: /그림 수 세기/ }));
    await new Promise((r) => setTimeout(r, 900));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(corrupt);

    // 확인 후에는 정상 저장된다
    await user.click(screen.getByRole('button', { name: '백업했어요, 새로 시작하기' }));
    await waitFor(
      () => {
        expect(window.localStorage.getItem(STORAGE_KEY)).not.toBe(corrupt);
      },
      { timeout: 4000 },
    );
  }, 15000);
});

describe('기존 검사기 데이터 보존 (§4.2)', () => {
  test('기존 학생이 있으면 표시 이름만 가져올 수 있고, 기존 키는 그대로다', async () => {
    const legacy = JSON.stringify({ version: 2, students: [{ id: 'stu_a', name: '학생 가', states: { N01: 'mastered' } }], currentId: 'stu_a' });
    window.localStorage.setItem(LEGACY_CHECKER_KEY, legacy);

    render(<CreatorApp />);
    await newWork();
    await user.click(screen.getByRole('button', { name: '+ 학생 추가' }));
    // 불러오기 목록에 기존 학생 표시 이름이 보인다
    const modal = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(within(modal).getByText('학생 가')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '1명 전체 추가' }));

    expect(screen.getByRole('button', { name: '학생 가 정보' })).toBeInTheDocument();
    // 기존 키는 그대로
    expect(window.localStorage.getItem(LEGACY_CHECKER_KEY)).toBe(legacy);
  }, 15000);
});
