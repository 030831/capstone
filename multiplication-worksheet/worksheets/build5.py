"""곱셈 활동지 5판 빌드 (주 세션이 직접 만듦).
  python -X utf8 claude/worksheets/build5.py
  -> ws5.html (아티팩트용 본문), ws5_local.html (PC에서 바로 여는 파일)
문제 데이터는 4판의 v4/mult_items.json을 그대로 쓰고(수·순서·보기·도움말), 그림은 art/v5/selected/를 쓴다.
selected에 없는 그림은 Fluent Emoji Flat 세트(art/sets/fluent_flat)로 임시 대체한다."""
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SEL = HERE / "art" / "v5" / "selected"
FLU = HERE / "art" / "sets" / "fluent_flat"

# 표시 너비(px)의 2배 이상으로 넣는다. (이름: 넣을 최대 너비)
SIZES = {"scene": 1408, "surface": 1408, "unit": 300, "single": 160, "mascot": 300, "box": 420, "shelf": 1408}


def webp_uri(path, max_w, q=88):
    im = Image.open(path)
    im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, "WEBP", quality=q)
    return "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode(), im.width, im.height


def load_art():
    art = {}
    man = json.loads((SEL / "manifest.json").read_text(encoding="utf-8"))
    for name, it in man["items"].items():
        p = SEL / f"{name}.png"
        if not p.exists():
            continue
        uri, w, h = webp_uri(p, SIZES.get(it["kind"], 300))
        art[name] = {"u": uri, "w": w, "h": h, "k": it["kind"], "n": it.get("count")}
    # 탁자 그림에서 윗면과 앞 가장자리만 잘라 "계산대 띠"를 만든다(문항 그림의 바닥).
    # table_wood(1344x576)에서 잰 값: 벽 0~200, 윗면 205~450, 앞 가장자리와 옆판 452~520.
    tw = SEL / "table_wood.png"
    if tw.exists():
        im = Image.open(tw).convert("RGB")
        W = im.width
        crop = im.crop((round(W * 0.2), 198, round(W * 0.8), 522))
        b = io.BytesIO()
        crop.save(b, "WEBP", quality=88)
        art["counter"] = {"u": "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode(),
                          "w": crop.width, "h": crop.height, "k": "surface", "n": None}
    fall = {}
    fm = json.loads((FLU / "manifest.json").read_text(encoding="utf-8"))
    for name, it in fm["objects"].items():
        svg = (FLU / it["file"]).read_text(encoding="utf-8")
        fall[name] = {"u": "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode(),
                      "w": it["width"], "h": it["height"]}
    return art, fall


def load_items():
    items = json.loads((HERE / "v4" / "mult_items.json").read_text(encoding="utf-8"))
    out = []
    for i in items:
        d = {k: i[k] for k in ("set", "no", "variant", "dan", "kind", "form", "pic", "obj", "ans", "blanks", "handle",
                               "role", "chg", "after", "text", "distractor", "help")}
        d["m"], d["g"] = i["perGroup"], i["groups"]
        # 라 7번: 학생 그림을 쓰지 않는다. 물건만 삼각김밥으로 바꾼다(수와 구조는 그대로).
        if d["obj"] == "student":
            d["obj"] = "kimbap"
            d["text"] = "삼각김밥이 5개씩 6줄 놓여 있습니다. 손님은 2명입니다."
            d["distractor"] = "2명"
            d["help"] = ["글에서 몇 개씩인지 찾아봅시다.", "글에서 몇 줄인지 찾아봅시다.", "한 줄씩 눌러 세어 봅시다."]
        d["blanks"] = [{"ans": b["ans"], "opts": b["opts"]} for b in d["blanks"]]
        out.append(d)
    return out


def load_icons():
    """Lucide 아이콘(ISC)의 SVG 안쪽 내용만 뽑는다."""
    import re
    d = HERE.parent / "refs" / "design" / "lucide"
    out = {}
    for f in d.glob("*.svg"):
        t = re.sub(r"<!--.*?-->", "", f.read_text(encoding="utf-8"), flags=re.S)
        inner = re.search(r"<svg[^>]*>(.*)</svg>", t, flags=re.S).group(1)
        out[f.stem] = " ".join(inner.split())
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    art, fall = load_art()
    icons = load_icons()
    items = load_items()
    src = (HERE / "ws5.src.html").read_text(encoding="utf-8")
    data = "const ART=" + json.dumps(art, ensure_ascii=False) + ";\nconst FALL=" + json.dumps(fall, ensure_ascii=False) + \
           ";\nconst ITEMS=" + json.dumps(items, ensure_ascii=False) + ";\nconst ICON=" + json.dumps(icons, ensure_ascii=False) + ";"
    body = src.replace("/*DATA*/", data)
    (HERE / "ws5.html").write_text(body, encoding="utf-8")
    (HERE / "ws5_local.html").write_text(
        '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>'
        + body + "</body></html>", encoding="utf-8")
    print("그림", len(art), "임시 그림", len(fall), "문항", len(items), "크기", len(body) // 1024, "KB")
    print("selected에 있는 이름:", ", ".join(sorted(art)))


if __name__ == "__main__":
    main()
