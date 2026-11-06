"""템플릿 기반 한국어 설명 생성. LLM 호출 없음."""

from __future__ import annotations

from collections.abc import Sequence

from checker.models import Verdict

# 받침이 있는 한글 숫자 읽기: 영·일·삼·육·칠·팔
_DIGIT_BATCHIM = set("013678")


def _has_batchim(word: str) -> bool:
    """단어 끝소리에 받침이 있는지 판단한다(한글·숫자만 판단, 기호는 건너뜀)."""
    for ch in reversed(word):
        if "가" <= ch <= "힣":
            return (ord(ch) - ord("가")) % 28 != 0
        if ch.isdigit():
            return ch in _DIGIT_BATCHIM
        if ch.isalpha():
            return False
    return False


def josa(word: str, pair: str) -> str:
    """받침 유무에 따라 조사를 붙인다.

    Args:
        word: 조사 앞의 단어.
        pair: ``"을/를"``, ``"이/가"``, ``"은/는"`` 처럼 (받침 있을 때/없을 때) 쌍.

    Returns:
        ``word`` 뒤에 알맞은 조사를 붙인 문자열.
    """
    with_b, without_b = pair.split("/")
    return word + (with_b if _has_batchim(word) else without_b)


def quote_labels(labels: Sequence[str]) -> str:
    """라벨들을 ``'A', 'B'`` 형태로 이어 붙인다."""
    return ", ".join(f"'{x}'" for x in labels)


def explain(
    verdict: Verdict,
    requires: Sequence[str],
    gap_hard: Sequence[str],
    gap_soft: Sequence[str],
    suggested_next: Sequence[str],
    unmastered_requires: Sequence[str],
) -> str:
    """판정 결과를 한국어 문장으로 설명한다. 모든 인자는 노드 *라벨*의 리스트다.

    Args:
        verdict: 판정.
        requires: 문제가 요구하는 개념 라벨.
        gap_hard: 미도달 hard 선수 라벨.
        gap_soft: 미도달 soft 선수 라벨.
        suggested_next: 제안할 다음 개념 라벨.
        unmastered_requires: requires 중 학생이 아직 mastered 가 아닌 개념 라벨.

    Returns:
        설명 문장.
    """
    req = quote_labels(requires)
    if verdict is Verdict.COLLISION:
        return (
            f"이 문제는 {josa(req, '을/를')} 요구하는데, "
            f"학생은 선수 개념 {josa(quote_labels(gap_hard), '이/가')} 미도달입니다. "
            f"{quote_labels(suggested_next)}은(는) 지금 바로 다룰 수 있는 선수 개념입니다."
        )
    if verdict is Verdict.TOO_EASY:
        return (
            f"이 문제가 요구하는 {josa(req, '은/는')} 학생이 이미 숙달한 개념이어서 "
            "새로운 학습 기회가 되기 어렵습니다."
        )
    text = (
        f"이 문제는 {josa(req, '을/를')} 요구하며, 학생은 필요한 선수 개념을 모두 갖추었고 "
        f"{josa(quote_labels(unmastered_requires), '은/는')} 아직 숙달 전이므로 "
        "지금 도전하기에 적절합니다."
    )
    if gap_soft:
        text += (
            f" 다만 권장 선수 개념 {josa(quote_labels(gap_soft), '이/가')} "
            "미도달이므로 함께 살펴보면 좋습니다."
        )
    return text
