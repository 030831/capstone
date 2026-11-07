"""템플릿 기반 한국어 설명 생성. LLM 호출 없음.

2026-11-07 개정: 4상태(unknown/not_started/emerging/mastered)와
NEEDS_REVIEW 판정을 반영. unknown(기록 없음)과 미확보(시작 전·형성 중)를
문장에서도 구분한다. 처방 톤("~부터 다루는 것을 권장합니다")은 쓰지 않는다.
"""

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


def _unknown_sentence(unknown_hard: Sequence[str], unknown_required: Sequence[str]) -> str:
    """미확인(기록 없음) 항목 안내 문장. 선수/요구 개념을 구분한다."""
    parts: list[str] = []
    if unknown_hard:
        parts.append(f"선수 개념 {quote_labels(unknown_hard)}")
    if unknown_required:
        parts.append(f"이 문제의 개념 {quote_labels(unknown_required)}")
    return f"{' 와(과) '.join(parts)}의 기록이 아직 확인되지 않았습니다."


def explain(
    verdict: Verdict,
    *,
    requires: Sequence[str],
    gap_hard: Sequence[str],
    gap_soft: Sequence[str],
    unknown_hard: Sequence[str],
    unknown_required: Sequence[str],
    suggested_next: Sequence[str],
    unmastered_requires: Sequence[str],
) -> str:
    """판정 결과를 한국어 문장으로 설명한다. 모든 인자는 노드 *라벨*의 리스트다.

    Args:
        verdict: 판정.
        requires: 문제가 요구하는 개념 라벨.
        gap_hard: 명시적으로 미확보(시작 전·형성 중)인 hard 선수 라벨.
        gap_soft: 명시적으로 미확보인 soft 선수 라벨.
        unknown_hard: 기록이 없는(미확인) hard 선수 라벨.
        unknown_required: 기록이 없는 요구 개념 라벨.
        suggested_next: 지금 다룰 수 있는 후보 선수 개념 라벨.
        unmastered_requires: requires 중 아직 숙달로 기록되지 않은 개념 라벨.

    Returns:
        설명 문장.
    """
    req = josa(quote_labels(requires), "을/를")
    unknown_part = _unknown_sentence(unknown_hard, unknown_required)

    if verdict is Verdict.COLLISION:
        text = (
            f"이 문제는 {req} 요구하는데, 학생의 선수 개념 "
            f"{josa(quote_labels(gap_hard), '이/가')} 시작 전이거나 형성 중입니다."
        )
        if unknown_hard or unknown_required:
            text += " " + unknown_part
        if suggested_next:
            text += (
                f" {quote_labels(suggested_next)}은(는) 선수 개념이 모두 "
                "숙달로 확인된 개념입니다."
            )
        if gap_soft:
            text += (
                f" 참고로 권장 선수 개념 {josa(quote_labels(gap_soft), '이/가')} "
                "아직 시작 전이거나 형성 중입니다."
            )
        return text

    if verdict is Verdict.NEEDS_REVIEW:
        text = f"이 문제는 {req} 요구하는데, {unknown_part} 기록을 확인한 뒤 다시 검사할 수 있습니다."
        if gap_soft:
            text += (
                f" 참고로 권장 선수 개념 {josa(quote_labels(gap_soft), '이/가')} "
                "아직 시작 전이거나 형성 중입니다."
            )
        return text

    if verdict is Verdict.TOO_EASY:
        return f"이 문제가 요구하는 {josa(req, '은/는')} 학생 기록에서 모두 숙달로 확인됩니다."

    # ALIGNED
    text = (
        f"이 문제는 {req} 요구하며, 필수 선수 개념은 모두 숙달로 기록되어 있고 "
        f"{josa(quote_labels(unmastered_requires), '은/는')} 아직 숙달로 기록되지 않았습니다."
    )
    if gap_soft:
        text += (
            f" 참고로 권장 선수 개념 {josa(quote_labels(gap_soft), '이/가')} "
            "아직 시작 전이거나 형성 중입니다."
        )
    return text
