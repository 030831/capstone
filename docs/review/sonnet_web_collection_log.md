# 교육과정 1차 자료 수집 – 초등 저학년 수학 '수와 연산'

- 접근 일자: 2026-11-06
- 원칙: WebFetch로 실제 확인한 텍스트만 인용. 기억으로 쓴 성취기준 코드/문장은 하나도 없음.
- **핵심 결과: A(특수교육 기본교육과정)와 B(2022 개정 공통교육과정) 성취기준 원문은 확보하지 못함(미확인).** C는 레벨 이름은 1차 확인, 한 줄 설명은 일부만 확인.

---

## A. 2022 개정 특수교육 기본교육과정 수학과 '수와 연산' (교육부 고시 제2022-34호 별책)

**확인 상태: 미확인** (성취기준 코드·문장 0건 확보)

### 시도한 경로와 결과
| # | 경로 | 결과 |
|---|---|---|
| 1 | ncic.go.kr (`/mobile.dwn.ogf.inventoryList.do`) WebFetch | `robots_disallowed`, 가져오기 거부 |
| 2 | ncic.re.kr (동일 경로) WebFetch | `robots_disallowed`, 가져오기 거부 |
| 3 | nise.go.kr 대상 검색 (한국어 2회) | 교육과정 원문 PDF 링크가 검색 결과에 나오지 않음 |
| 4 | `[2기본수01-01]`, `"2기본수01"` 등 코드 직접 검색 (한국어 3회) | 원문 게시 페이지 없음. 논문 서지 페이지만 나옴 |
| 5 | KCI/KoreaScience 논문 본문 (아래 표) | 성취기준 원문 미수록 |
| 6 | kocw.net 강의계획서 PDF | 성취기준 없음(강의계획서) |
| 7 | 샌드박스에서 curl 직접 다운로드 시도 (vivasam PDF) | 프록시 정책으로 403. 우회하지 않음 |

### 확인된 서지·메타 정보(성취기준 원문 아님, 2차 자료)
- 백수진, 「2022 개정 특수교육 기본 교육과정 수학과 성취기준 분석: Bloom의 신교육목표분류학에 기초하여」, 학습자중심교과교육연구 24(19), 219–237, 2024.10, DOI 10.22251/jlcci.2024.24.19.219
  - URL: https://scholar.kyobobook.co.kr/article/detail/4010069975618 (초록 페이지만 열람)
  - 초록 내용: 2022 개정 특수교육 기본교육과정 수학과 성취기준 **182개**를 5개 학년군 x 5개 영역으로 분석. 상태: `2차 자료에서 확인(1차 미접근)`.
  - 주의: 해당 페이지의 백분율과 개수가 일부 불일치(예: 28개=87.5%). 인용 전 원문 대조 필요.
- 그 외 검색에서 제목만 확인(미열람): "특수교육 기본 교육과정 변천에 따른 초등학교 수학과 성취기준 유형 분석: 수와 연산 영역을 중심으로" (https://scholar.kyobobook.co.kr/article/detail/4050028865534), "2022 개정 특수교육 기본교육과정 수학과 현장 적용에 대한 특수교사의 인식 분석" (https://scholar.kyobobook.co.kr/article/detail/4050069934839). 이 논문들의 본문에 코드/문장이 인용돼 있을 가능성은 있으나 확인하지 못함.

### 대체(2015 개정 기본교육과정, 고시 제2015-81호)
- 시도하지 않음/확보하지 못함. 위 경로 제약(ncic robots 차단, nise 원문 미노출)이 2015판에도 동일하게 적용된다고 판단. 대체 자료 없음.

### 내용 체계표(지식·이해/과정·기능/가치·태도)
- 확보하지 못함.

---

## B. 2022 개정 공통교육과정 수학과 (교육부 고시 제2022-33호 별책 8)

**확인 상태: 미확인** (1~2학년군, 3~4학년군 성취기준 모두 원문 미확보)

### 시도한 경로와 결과
| # | URL | 결과 |
|---|---|---|
| 1 | https://dn22.vivasam.com/VS/ES/MAT/106393/promo_library/ref_common/2022 개정 초등 수학과 교육과정.pdf (비상 vivasam 게시본, 사실상 교육부 원문 PDF로 보임) | WebFetch가 `[binary data]`만 반환, 텍스트 추출 실패. curl 직접 다운로드는 프록시 403 |
| 2 | https://dn22.vivasam.com/VS/ES/MAT/106395/promo_library/ref_common/초등학교 3~4학년군 수학 성취기준.pdf | 동일하게 binary data |
| 3 | vivasam 교사용 지도서 총론 PDF, `(2-1-1)지도서_110~119.pdf` | SERVER_ERROR |
| 4 | ncic.go.kr / ncic.re.kr | robots 차단 |
| 5 | KoreaScience 논문 7편 (아래) | 성취기준 전체 목록 미수록 |
| 6 | localnaeil.com 기사 2건 | 성취기준 없음 |
| 7 | learner.net 'Korea Grade 1' | 페이지 스스로 "AI 생성/비공식"이라고 밝힘. 의역 요약이며 성취기준 아님. **사용 금지** |

**권장 후속 조치:** vivasam PDF(위 1번 URL)가 가장 유력한 1차 사본이므로, 사람이 직접 내려받아 텍스트를 붙여주거나 PDF를 이 환경에 올려주는 것이 가장 빠른 해결책. `pdftotext`는 환경에 있음.

### 2022 개정 성취기준 중 우연히 원문 인용이 확인된 것 (2차 자료 내 인용, 영역 '수와 연산'이나 저학년 자료 아님)
논문 본문에서 2022 개정 성취기준으로 인용되어 있었음. 상태: `2차 자료에서 확인(1차 미접근)`. 저학년 범위 밖이라 참고용.
- `[6수01-02]` "실생활과 연결하여 이상, 이하, 초과, 미만의 의미와 쓰임을 알고, 이를 활용하여 수의 범위를 나타낼 수 있다."
- `[6수01-03]` "어림값을 구하기 위한 방법으로 올림, 버림, 반올림의 의미와 필요성을 알고, 이를 실생활에 활용함으로써 수학의 유용성을 인식할 수 있다."
  - 출처: 강윤지(2024), 『초등수학교육』 27(3), 247–260. https://koreascience.kr/article/JAKO202424074487665.pdf
- `[4수 01-10]` "단위분수, 진분수, 가분수, 대분수를 알고, 그 관계를 이해한다."
  - 출처: 이화영(2023), 『초등수학교육』 26(4), 369–385. https://koreascience.kr/article/JAKO202332559658413.pdf
  - 주의: 코드가 `4수 01-10`처럼 공백이 있는 표기로 인용됨. 이 논문은 2022 개정 분석 논문이나, 이 문장이 2015판과 동일한 문구인지는 별도 확인 필요.

### 내용 체계 관련 부분 확인 (2차 자료)
- 김성준·김은경·권미선(2024), 『수학교육 논문집』 38(2), 167–186. https://koreascience.kr/article/JAKO202422660673962.pdf
  - 표 II-1에 '수와 연산' 내용 체계 3범주가 있다는 서술과, 지식·이해 범주에 "두 자리 수 범위의 덧셈과 뺄셈"이라는 내용 요소가 있다는 언급만 확인. 표 전체는 가져오지 못함. 성취기준 코드 없음.

### 열람했으나 성취기준 원문이 없던 논문(재방문 불필요)
- https://koreascience.kr/article/JAKO202329361003090.pdf (박수민, 수리 소양)
- https://koreascience.kr/article/JAKO202304743299706.pdf (박지현·성지현, 2015 개정 분석. `[4수01-01]` 등 2015 개정 성취기준만 인용)
- https://koreascience.kr/article/JAKO202408737653442.pdf (이대현 외, 어휘 적정성)
- https://koreascience.kr/article/JAKO202414343273692.pub (권점례, 교사 인식)
- https://koreascience.kr/article/JAKO202320955390123.pub?lang=ko (권점례 외, 2015 기준 수행동사 비교)
- https://koreascience.kr/article/JAKO202332559647390.pub (방정숙 외, 지도서 분석틀)

---

## C. Clements & Sarama 학습궤적 (Learning Trajectories)

**확인 상태:**
- 레벨 이름(순서 포함): `원문 확인` (learningtrajectories.org 공식 사이트 WebFetch)
- 레벨별 한 줄 설명: 대부분 **미확인**. 확인된 것은 아래에 출처별로 표시.
- 해당 사이트의 목록 페이지/Counting 페이지는 레벨 이름만 제공하고 설명·연령은 반환하지 않았음(WebFetch가 요약한 결과라 페이지에 설명이 있는데 누락됐을 가능성은 있음).

### C-0. 1차 출처 URL
- https://www.learningtrajectories.org/math/learning-trajectories (5개 궤적 레벨 이름 전체)
- https://www.learningtrajectories.org/math/learning-trajectories/counting (Counting 19개 레벨, 목록 페이지와 일치)

### C-1. Counting (수 세기) — 19 levels, `원문 확인`(이름)
순서대로:
1. Number Word Sayer: Foundations (수 단어 말하기: 기초)
2. Reciter (암송자)
3. Reciter (10) (10까지 암송)
4. Corresponder (일대일 대응자)
5. Counter (Small Numbers) (작은 수 세기)
6. Counter (10) (10까지 세기)
7. Producer (Small Numbers) (작은 수 만들어 내기)
8. Counter and Producer (10+) (10 이상 세기·만들기)
9. Counter Backward from 10 (10에서 거꾸로 세기)
10. Counter from N (N + 1, N - 1) (N에서 이어 세기)
11. Skip Counter by 10s to 100 (100까지 10씩 뛰어 세기)
12. Counter to 100 (100까지 세기)
13. Counter On Using Patterns (패턴을 이용한 이어 세기)
14. Skip Counter (뛰어 세기)
15. Counter On Keeping Track (추적하며 이어 세기)
16. Counter of Quantitative Units/Place Value (양적 단위/자릿값 세기)
17. Counter Beyond 100 (100 넘어 세기)
18. Number Conserver (수 보존 이해)
19. Counter Forward and Back (10s and 1s) (10과 1 단위로 앞뒤 세기)

한국어 번역은 내가 붙인 임시 번역이며 공식 번역이 아님.

**설명 확인된 일부(2차 자료, Building Blocks 핸드아웃의 구형 버전 궤적, 이름이 현행 사이트와 일부 다름):**
출처: https://oldsite.earlychildhoodwebinars.com/wp-content/uploads/2013/11/Building-Blocks-Learning-Trajectories-handout-Clements-Sarama.pdf (상태: 2차 자료에서 확인, 저자 핸드아웃이지만 구판)
- Goal: "Accurate, confident object counting"
- Precounter: "Says number words, not sequence: 'one, two, four…'."
- Chanter: "Says in sequence but may run together"
- Reciter: "Verbal counting to 5, then 10"
- Corresponder: "Counts correctly using 1-1 correspondence, at least up to 5 objects in a line."
- Counter (Small Numbers): "Counts 1-5 objects in a line meaningfully (i.e., employ the cardinal rule)"
- Producer (Small Numbers): "Counts out a collection up to 5"
- Counter (10): "Counts collections up to 10"
- Counter and Producer (10+): "and keeps track of unorganized collections" (원문 조각)
- 이후 레벨은 설명 없음. 현행 사이트의 Precounter/Chanter는 'Number Word Sayer: Foundations'로 개칭된 것으로 보이나 확인한 사실은 아님.

### C-2. Subitizing — 12 levels, `원문 확인`(이름)
1. Number Senser: Foundations
2. Very Small Number Recognizer
3. Maker of Small Collections
4. Small Collection Namer
5. Perceptual Subitizer to 4
6. Perceptual Subitizer to 5
7. Conceptual Subitizer to 5
8. Conceptual Subitizer to 7
9. Conceptual Subitizer to 10
10. Conceptual Subitizer to 20
11. Conceptual Subitizer with Place Value
12. Conceptual Subitizer with Multiplicative Thinking

참고(2차 자료, 연령 정보, 구판 10레벨): AMTE 문서 https://amte.net/node/2301 의 Figure 4.1이 아래 순서로 제시한다고 WebFetch가 보고함. 현행 사이트와 레벨 구성이 다름(구판은 Pre-Explicit Number, Small-Collection Namer 등).
- Pre-Explicit Number (0–1세), Small-Collection Namer (1–2), Maker of Small Collections (3), Perceptual Subitizer to 4 (4), Perceptual Subitizer to 5 (5), Conceptual Subitizer to 5 (5), Conceptual Subitizer to 10 (5), Conceptual Subitizer to 20 (6), Conceptual Subitizer With Place Value and Skip Counting (7), Conceptual Subitizer with Place Value and Multiplication (8)

한 줄 설명: 미확인(위 AMTE 페이지에서도 설명은 못 얻음).

### C-3. Comparing and Ordering Number (수 비교) — 23 levels, `원문 확인`(이름)
1. Comparison Senser: Foundations
2. Early Comparison Corresponder
3. Perceptual Comparer
4. First-Second Ordinal Counter
5. Early Comparer of Similar Items
6. Early Comparer of Dissimilar Items
7. Matching Comparer
8. Counting Comparer (Same Size)
9. Spatial Extent Estimator—Small/Big
10. Counting Comparer (5)
11. Mental Number Line to 5
12. Serial Orderer to 5 (Comparing Number)
13. Ordinal Counter
14. Counting Comparer (10)
15. Mental Number Line to 10
16. Serial Orderer to 6+ (Comparing Number)
17. Spatial Extent Estimator
18. Place Value Comparer
19. Mental Number Line to 100
20. Scanning with Intuitive Quantification Estimator
21. Mental Number Line to 1000
22. Benchmarks Estimator
23. Composition Estimator

한 줄 설명: 미확인. (AMTE는 이 궤적 제목을 "Comparing, Ordering, and Estimating Numbers"로 표기)

### C-4. Composing Numbers (수 합성·분해) — 11 levels, `원문 확인`(이름)
1. Actor on Parts: Foundations
2. Parts Combiner
3. Parts - Whole Recognizer
4. Composer to 4, then 5
5. Composer to 7
6. Composer to 10
7. Composer to 20
8. Composer with Tens and Ones
9. Deriver +/- (Composing Numbers)
10. Problem Solver +/- (Composing Numbers)
11. Multidigit +/- (Composing Numbers)

한 줄 설명: 미확인.

### C-5. Adding / Subtracting (덧셈·뺄셈) — 12 levels, `원문 확인`(이름)
1. Arithmetic Senser: Foundations
2. Preverbal +/-
3. Small Number +/-
4. Find Result +/-
5. Make It N
6. Find Change +/-
7. Counting Strategies +/-
8. Part-Whole +/-
9. Numbers-in-Numbers +/-
10. Deriver +/- (Adding/Subtracting)
11. Problem Solver +/- (Adding/Subtracting)
12. Multidigit +/- (Adding/Subtracting)

**설명 확인된 일부 (2차 자료):** 아래 8개 레벨은 구판 레벨 구성(8단계, 번호 포함)으로 현행 사이트의 12단계와 이름·번호가 다름(Preverbal, Make It N, Foundations, Multidigit이 없음).
출처: Clements 등 논문 "Efficacy of a Learning Trajectory Approach Compared to a Teach-to-Target Approach for Addition and Subtraction", https://files.eric.ed.gov/fulltext/ED619220.pdf , Figure 1 p.9-12 ("Relevant Levels from the Learning Trajectory for Adding/Subtracting (adapted from Sarama & Clements, 2009)"). 각 인용은 "Level and Strategies" 열의 발췌. 상태: `2차 자료에서 확인`(논문 자체는 저자 1차 연구물이나, 궤적 사이트 원문은 아님).

| 구판 레벨 | 설명 발췌(영어 원문) | 한국어 번역(임시) |
|---|---|---|
| 1–Small Number +/- | "Finds sums for Add-To problems up to 3 + 2 and finds difference for Take-From problems up to 3 - 2" | 3+2까지의 더하기 문제와 3-2까지의 덜어내기 문제의 합과 차를 찾는다 |
| 2–Find Result +/- | "Finds sums for Add-To problems with sums to 10 or more and differences for "Take-From"" | 합이 10 이상인 더하기 문제와 덜어내기 문제의 결과를 찾는다 |
| 3–Find Change +/- | "Finds the missing addend (e.g., 5 + _ = 7) by adding on or separating from objects" | 이어 더하거나 물체에서 분리하여 빠진 수를 찾는다 |
| 4–Counting Strategies +/- | "Finds sums for Add-To, Take-From, and Part-Part-Whole" | 세기 전략으로 더하기, 덜어내기, 부분-부분-전체 문제를 푼다 |
| 5–Part-Whole +/- | "Has initial part-whole understanding." / "Solves all previous problem types using flexible strategies" | 초보적 부분-전체 이해. 이전 유형 모두를 유연한 전략으로 해결 |
| 6–Numbers-in-Numbers +/- | "Can solve "Start Unknown" problems with counting strategies." / "Recognizes when numbers are part of a whole and can keep parts and whole in mind simultaneously" | 시작 미지수 문제를 세기 전략으로 풀 수 있다. 수가 전체의 부분임을 알고 부분과 전체를 동시에 생각한다 |
| 7–Deriver +/- | "Solves all types of problems using flexible strategies and derived combinations" | 유연한 전략과 유도된 조합으로 모든 유형 해결 |
| 8–Problem Solver +/- | "Solves all types of problems, with flexible strategies and known combinations." | 유연한 전략과 알고 있는 조합으로 모든 유형 해결 |

한국어 번역은 임시이며, 구판 이름이 현행과 다르다는 점에 유의.

---

## 수집 요약

### 확인 상태 한눈에
| 대상 | 상태 | 비고 |
|---|---|---|
| A. 2022 특수교육 기본교육과정 '수와 연산' 성취기준 | **미확인** | 코드·문장 0건. 2015판 대체도 확보 못 함 |
| A. 내용 체계표 | **미확인** | |
| B. 2022 공통교육과정 1~2학년군 '수와 연산' | **미확인** | 유력 사본(vivasam PDF)이 있으나 텍스트 추출 실패 |
| B. 3~4학년군 자연수 +,-,x | **미확인** | 위와 동일 |
| C. 5개 궤적 레벨 이름·순서 | **원문 확인** | learningtrajectories.org |
| C. 레벨별 한 줄 설명 | **일부만(2차 자료)** | Counting 9개(구판 핸드아웃), Adding/Subtracting 8개(구판, ERIC 논문). 나머지 미확인 |

### 못 찾은 것
- A와 B의 성취기준 코드·문장 전체. 이 상태로는 노드/엣지 설계에 쓸 수 있는 교육과정 원문이 없음.
- Subitizing, Comparing, Composing 궤적의 레벨 설명. Counting의 후반 레벨(Counter Backward from 10 이후) 설명.

### 차단·실패 원인
- ncic.go.kr, ncic.re.kr: robots.txt로 WebFetch 거부.
- vivasam 사본 PDF 2건: WebFetch가 binary data로 반환(PDF 파싱 실패). curl 직접 다운로드는 프록시에서 403(host 정책). 우회하지 않음.
- 검색 엔진이 성취기준 코드 문자열(`[2수01-01]`, `[2기본수01-01]`) 검색에서 실질적 결과를 주지 못함.
- nise.go.kr 원문 페이지는 검색에 노출되지 않아 WebFetch 시도 불가(URL을 추측해서 열지 않음).
- 사용한 호출: WebSearch 17회, WebFetch 약 29회(한도 내).

### 대체한 것·의심스러운 것
- 대체: 없음(A→2015판 대체 실패).
- 의심: (1) 백수진(2024) 초록의 백분율/개수 불일치. (2) `[4수 01-10]`이 공백 포함 표기로 인용됨. 코드 형식은 원문 대조 필요. (3) Clements 구판(핸드아웃·ERIC 논문)과 현행 사이트의 레벨 이름이 다르므로 섞어 쓰면 안 됨. 노드는 현행 사이트 이름 기준 권장. (4) 한국어 번역은 모두 임시. (5) WebFetch는 요약 모델을 거치므로 '페이지에 설명이 없다'는 보고가 사이트의 실제 부재를 뜻하는지는 미검증.
- learner.net 페이지는 AI 생성 비공식 자료로 사용하지 않음.

### 권장 다음 단계
1. 사람이 https://dn22.vivasam.com/VS/ES/MAT/106393/promo_library/ref_common/2022 개정 초등 수학과 교육과정.pdf 를 브라우저로 내려받아 업로드하면 `pdftotext`로 B를 바로 확정 가능.
2. A는 국가교육과정정보센터(ncic.kr)의 '2022 개정 특수교육 기본교육과정 수학' PDF를 사람이 내려받아 올리는 것이 유일하게 확실한 경로.
3. 위 두 파일이 오기 전에는 성취기준 기반 노드를 만들지 말고, C의 궤적 레벨 이름만으로 선수관계 골격을 잡을 것.
