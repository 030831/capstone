"""
활동지 삽화 1차 시안(v5): 화풍을 정하기 위한 후보를 Qwen-Image 2.1(ComfyUI)로 만든다. 고르는 것은 사람이 한다.

  python -X utf8 claude/worksheets/gen_art_v5.py probe                 ComfyUI를 켜서 노드 입력 확인 + edit/bgremove 시험 1장씩 → 끈다
  python -X utf8 claude/worksheets/gen_art_v5.py stage1 [--n 4]        A(물건) C(장면) D1(캐릭터) t2i 생성 → 끈다
  python -X utf8 claude/worksheets/gen_art_v5.py stage2 --a2 A2-2 --d1 D1-3 [--n 4] [--nd 3]
                                                                       B(귤 수 바꾸기)·D2·D3 참조 편집 생성 → 끈다
  python -X utf8 claude/worksheets/gen_art_v5.py cut [--method bgremove|white]
                                                                       A·B·D 원본의 배경을 제거해 cut/에 투명 PNG로 저장(ComfyUI를 켜서 쓸 수 있음)
  python -X utf8 claude/worksheets/gen_art_v5.py sheets                GPU 없이: 대조 시트와 log.csv 정리

산출물(모두 claude/worksheets/art/v5/ 아래)
  raw/    원본(그대로)         cut/    배경 제거 + 투명 여백 자른 PNG
  sheets/ 대조 시트             log.csv 기록
ComfyUI는 이 스크립트가 켜고, 끝나거나 실패하면 반드시 끈다(프로세스 트리 종료 + 포트 닫힘 + nvidia-smi 기록).
켜기 전에 다른 프로세스가 GPU 메모리를 1GB 넘게 쓰면 켜지 않고 끝낸다.
"""
import argparse
import csv
import hashlib
import json
import subprocess
import sys
import time
import urllib.request
from collections import deque
from contextlib import contextmanager
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
CLAUDE = HERE.parent
KIT = CLAUDE.parent / "자료" / "키트"
sys.path.insert(0, str(KIT / "scripts"))
import generate as G  # noqa: E402

OUT = HERE / "art" / "v5"
RAW, CUT, SHEETS = OUT / "raw", OUT / "cut", OUT / "sheets"
SEL = OUT / "selected"
LOGCSV = OUT / "log.csv"
RUNLOG = OUT / "raw" / "_run.log"
COMFY_DIR = Path(r"C:\ComfyUI_windows_portable")
COMFY_PY = COMFY_DIR / "python_embeded" / "python.exe"
SERVER = "http://127.0.0.1:8188"

# ------------------------------------------------------------------ 프롬프트
STYLE = ("Children's math textbook illustration, hand-drawn look with clean thin dark-brown outlines, flat warm pastel colors "
         "with simple soft cel shading, friendly and tidy, no gradients, no photorealism, no text, no letters, no numbers, "
         "no logos, no watermark.")
OBJ = "The subject is shown whole and centered on a plain pure white background, soft small contact shadow, nothing else in the frame."
BAG = "a clear transparent plastic bag tied closed at the top with a small knot"
BASKET = "a low shallow red plastic fruit basket (the kind used in Korean fruit shops), seen diagonally from above"
TANG = "tangerines (small orange mandarins, each with a tiny green leaf)"

ITEMS = {
    "A1": dict(kind="obj", size=(1024, 1024), what="귤 1개",
               p=f"One single tangerine with one green leaf. {OBJ}"),
    "A2": dict(kind="obj", size=(1024, 1024), what="봉지 귤 2개",
               p=f"{BAG[0].upper() + BAG[1:]}, containing exactly two {TANG}, both fully visible, not overlapping much. {OBJ}"),
    "A3": dict(kind="obj", size=(1024, 1024), what="봉지 귤 5개",
               p=f"{BAG[0].upper() + BAG[1:]}, containing exactly five {TANG}, all five fully visible. {OBJ}"),
    "A4": dict(kind="obj", size=(1024, 1024), what="소쿠리 귤 5개",
               p=f"{BASKET[0].upper() + BASKET[1:]}, holding exactly five {TANG} neatly placed, all five fully visible. {OBJ}"),
    "A5": dict(kind="obj", size=(1024, 1024), what="빈 소쿠리",
               p=f"The same kind of {BASKET}, completely empty, nothing inside, the inside of the basket is visible. {OBJ}"),
    "C1": dict(kind="scene", size=(1344, 576), what="가게 안(사람 없음)",
               p=("Scene: the inside of a small fruit shop, wide landscape view, no people. In the foreground a wide, empty, bare wooden counter top "
                  "fills the lower 45 percent of the picture, nothing on it. Behind the counter are shelves with crates of fruit.")),
    "C2": dict(kind="scene", size=(1344, 576), what="가게 안 + 주인",
               p=("Scene: the inside of a small fruit shop, wide landscape view. In the foreground a wide, empty, bare wooden counter top "
                  "fills the lower 45 percent of the picture. Behind the counter, at the far left side, stands one friendly cartoon adult shopkeeper "
                  "wearing an apron, smiling. The center of the counter is empty. Behind are shelves with crates of fruit.")),
    "C3": dict(kind="scene", size=(1344, 576), what="빈 나무 탁자",
               p=("Scene: a long horizontal wooden table top only, seen from the front and slightly from above, filling the lower part of the picture, "
                  "with a plain pale wall above it. Completely empty, no objects on the table, nothing else.")),
    "D1": dict(kind="obj", size=(1024, 1024), what="늘봄 손 흔들기",
               p=("A friendly sprout mascot character named Neulbom, not a human: a round light-green sprout fairy with two green leaves on top of its head, "
                  "a simple face with dot eyes and a small smile, short stubby arms and legs, waving one hand. "
                  f"{OBJ}")),
}
EDIT_B = {"B1": 3, "B2": 4, "B3": 5}
NUMW = {3: "three", 4: "four", 5: "five"}
EDIT_B_TPL = (STYLE + " Keep the exact illustration style, line quality, colors, camera angle, framing, white background and the shape of the "
              "transparent knotted plastic bag of <image1>, but change the number of tangerines inside the bag so that it contains exactly {w} "
              "tangerines, all {w} fully visible, not hidden. Do not add any other object.")
EDIT_D = {"D2": ("D2 한 손으로 옆 가리키기", "the character points to its side with one outstretched hand while the other arm rests down, still smiling"),
          "D3": ("D3 생각하는 자세", "the character is thinking, one hand touching its chin, head slightly tilted")}
EDIT_D_TPL = (STYLE + " Keep exactly the same character, same style, same colors, same outlines and same white background as <image1>, "
              "but change the pose: {pose}. Same size, centered, whole body visible. Not a human.")
BGREMOVE = "Remove the background, and output a PNG image"


def prompt_t2i(item):
    d = ITEMS[item]
    return STYLE + " " + d["p"]


def seed_for(item, k):
    return int(hashlib.sha256(f"v5|{item}|{k}".encode()).hexdigest()[:12], 16)


# ------------------------------------------------------------------ 기록
LOG_FIELDS = ["항목", "후보", "방식", "시드", "프롬프트", "걸린시간(초)", "원본파일", "오려낸파일", "배경제거방법", "보고센개수", "문제", "비고"]


def read_log():
    if not LOGCSV.exists():
        return {}
    with open(LOGCSV, encoding="utf-8-sig", newline="") as f:
        return {r["원본파일"]: r for r in csv.DictReader(f)}


def write_log(rows):
    OUT.mkdir(parents=True, exist_ok=True)
    order = sorted(rows.values(), key=lambda r: (r["항목"], int(r["후보"])))
    with open(LOGCSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=LOG_FIELDS)
        w.writeheader()
        for r in order:
            w.writerow({k: r.get(k, "") for k in LOG_FIELDS})


def upsert(**kw):
    rows = read_log()
    r = rows.get(kw["원본파일"], {})
    r.update(kw)
    rows[kw["원본파일"]] = r
    write_log(rows)


def say(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    RAW.mkdir(parents=True, exist_ok=True)
    with open(RUNLOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


# ------------------------------------------------------------------ ComfyUI 켜고 끄기 (run_gpu_steps.py와 같은 방식)
def smi():
    tot = subprocess.run(["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"],
                         capture_output=True, text=True).stdout.strip()
    apps = subprocess.run(["nvidia-smi", "--query-compute-apps=pid,process_name,used_memory", "--format=csv,noheader,nounits"],
                          capture_output=True, text=True).stdout.strip().splitlines()
    procs = []
    for a in apps:
        parts = [x.strip() for x in a.split(",")]
        if len(parts) >= 3 and parts[2].isdigit():
            procs.append((parts[0], parts[1], int(parts[2])))
    return int(tot.split(",")[0]), tot, procs


def gpu_free(tag):
    used, tot, procs = smi()
    big = [p for p in procs if p[2] >= 1024]
    say(f"nvidia-smi {tag}: 사용/전체 {tot} MiB, 숫자가 나온 프로세스 {procs}")
    if big or used >= 2048:
        say(f"다른 프로세스가 GPU를 쓰는 중으로 보임({big}, 전체 {used}MiB). 시작하지 않습니다.")
        return False
    return True


def comfy_up():
    try:
        urllib.request.urlopen(SERVER + "/system_stats", timeout=3)
        return True
    except Exception:
        return False


@contextmanager
def comfy_session():
    if comfy_up():
        raise SystemExit("ComfyUI가 이미 켜져 있습니다(다른 세션일 수 있음). 건드리지 않습니다.")
    if not gpu_free("시작 전"):
        raise SystemExit("GPU 사용 중이라 시작하지 않음")
    out = open(RAW / "_comfy.log", "a", encoding="utf-8")
    p = subprocess.Popen([str(COMFY_PY), "-s", r"ComfyUI\main.py", "--windows-standalone-build", "--disable-auto-launch"],
                         cwd=str(COMFY_DIR), stdout=out, stderr=subprocess.STDOUT, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    try:
        for _ in range(200):
            if comfy_up():
                say(f"ComfyUI 켜짐 (PID {p.pid})")
                break
            if p.poll() is not None:
                raise RuntimeError("ComfyUI 프로세스가 끝났습니다. _comfy.log 확인")
            time.sleep(3)
        else:
            raise RuntimeError("ComfyUI가 켜지지 않았습니다")
        yield G.Comfy(SERVER)
    finally:
        subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
        for _ in range(30):
            if not comfy_up():
                break
            time.sleep(1)
        say(f"ComfyUI 종료 확인: 포트 8188 {'열려 있음(확인 필요)' if comfy_up() else '닫힘'}")
        time.sleep(4)
        say(f"nvidia-smi 종료 후: 사용/전체 {smi()[1]} MiB")


# ------------------------------------------------------------------ 그래프
class Args:
    texture_vae = False
    turbo_lora = False
    size = 1024
    steps = 25
    cfg = 1.0


def load_wf(name):
    return json.loads((KIT / "workflows" / "api" / name).read_text(encoding="utf-8"))


CFG = G.load_config(KIT / "config.json")


def run_graph(comfy, g, timeout=1800):
    t0 = time.time()
    pid = comfy.queue(g)
    hist = comfy.wait(pid, max_wait=timeout)
    st = hist.get("status", {})
    if st.get("status_str") == "error":
        msgs = [m for m in st.get("messages", []) if m and m[0] == "execution_error"]
        raise RuntimeError(f"실행 오류: {json.dumps(msgs, ensure_ascii=False)[:1500]}")
    out = hist.get("outputs", {})
    imgs = []
    for node, o in out.items():
        imgs += o.get("images", [])
    if not imgs:
        raise RuntimeError(f"출력 이미지 없음: {json.dumps(out)[:500]}")
    return comfy.download(imgs[0]), round(time.time() - t0, 1)


def t2i(comfy, base, prompt, seed, w, h):
    g = G.make_graph(base, CFG, Args, prompt, seed, "quiz/v5/t2i")
    g["6"]["inputs"]["width"], g["6"]["inputs"]["height"] = w, h
    return run_graph(comfy, g)


def edit(comfy, base, prompt, seed, ref_name, prefix="quiz/v5/edit"):
    g = G.make_graph(base, CFG, Args, prompt, seed, prefix, ref_name)
    return run_graph(comfy, g)


# ------------------------------------------------------------------ probe
def cmd_probe(a):
    RAW.mkdir(parents=True, exist_ok=True)
    with comfy_session() as comfy:
        for n in ["TextEncodeQwenImage21", "QwenImage21Cache", "LoadImage", "SaveImage", "KSampler"]:
            info = comfy.get_json(f"/object_info/{n}")[n]
            say(f"{n}: input={json.dumps(info['input'], ensure_ascii=False)[:900]} output={info.get('output')} names={info.get('output_name')}")
        allnodes = comfy.get_json("/object_info")
        keys = [k for k in allnodes if any(s in k.lower() for s in ("alpha", "background", "rembg", "mask", "qwen"))]
        say(f"관련 노드: {keys}")
        pdir = RAW / "_probe"
        pdir.mkdir(exist_ok=True)
        ref = KIT.parent.parent / "claude" / "worksheets" / "art" / "gen" / "icon_tangerine_1_1.png"
        refname = comfy.upload(ref)
        base = load_wf("qwen21_edit.json")
        for tag, prompt in (("edit", EDIT_B_TPL.format(w="three")), ("bgremove", BGREMOVE)):
            try:
                data, sec = edit(comfy, base, prompt, 123, refname, f"quiz/v5/probe_{tag}")
                (pdir / f"{tag}.png").write_bytes(data)
                im = Image.open(pdir / f"{tag}.png")
                say(f"probe {tag}: {sec}초 크기 {im.size} 모드 {im.mode}")
            except Exception as e:
                say(f"probe {tag} 실패: {e}")


# ------------------------------------------------------------------ stage1 / stage2
def gen_items(comfy, base, jobs):
    """jobs: (item, k, method, prompt, seed, w, h, ref_name_or_None). 이미 있는 파일은 건너뛴다."""
    for item, k, method, prompt, seed, w, h, ref in jobs:
        dest = RAW / f"{item}-{k}_s{seed}.png"
        if dest.exists():
            continue
        try:
            if method == "t2i":
                data, sec = t2i(comfy, base["t2i"], prompt, seed, w, h)
            else:
                data, sec = edit(comfy, base["edit"], prompt, seed, ref)
        except Exception as e:
            say(f"✗ {item}-{k} 실패: {e}")
            continue
        dest.write_bytes(data)
        im = Image.open(dest)
        upsert(항목=item, 후보=str(k), 방식=method, 시드=str(seed), 프롬프트=prompt, **{"걸린시간(초)": str(sec)},
               원본파일=dest.name, 비고=f"{im.size[0]}x{im.size[1]}")
        say(f"✓ {item}-{k} {method} {sec}초 {im.size}")


# ------------------------------------------------------------------ 2차: 나머지 묶음 (문구점·빵집·편의점·섞어 풀기·장면·캐릭터)
LABEL = {}
ANG = "seen diagonally from slightly above, resting on a table"
NOTXT = "Plain, with no printing, no text, no letters, no numbers, no brand names, no logos anywhere, including on any packaging."
SCENE2 = ("Scene: {place}, wide landscape view, no people. In the foreground a wide, empty, bare wooden counter top fills the lower 45 percent of the "
          "picture, nothing on it. Behind the counter {shelf}. No writing on anything.")
ITEMS.update({
    "N0": dict(kind="obj", size=(1024, 1024), what="연필 한 자루",
               p=f"One single yellow hexagonal pencil standing upright, sharpened tip with a dark graphite point pointing up, pink eraser at the bottom end. {NOTXT} {OBJ}"),
    "N1": dict(kind="obj", size=(1024, 1024), what="연필 3자루 다발",
               p=f"A bundle of exactly three yellow pencils tied together with one red rubber band, standing upright side by side with the sharpened tips pointing up, "
                 f"all three pencils clearly visible and separate. {NOTXT} {OBJ}"),
    "P1": dict(kind="obj", size=(1024, 1024), what="도넛 위에서",
               p=f"One single round ring doughnut with pink glaze and small colorful sprinkles, seen straight from directly above (top-down view), a complete ring with a clear hole in the middle. {OBJ}"),
    "P2": dict(kind="obj", size=(1024, 1024), what="빈 정사각 도넛 상자",
               p=f"An empty open square paper doughnut box seen straight from directly above (top-down view), perfectly square, the inside floor of the box is a light cream color, "
                 f"flat, wide and completely empty, the lid is folded back upward and only a little of it is visible. Nothing inside the box. {NOTXT} {OBJ}"),
    "P3": dict(kind="obj", size=(1024, 1024), what="빈 상자 3:2",
               p=f"An empty open paper doughnut box seen straight from directly above (top-down view), a wide horizontal rectangle with width to height ratio 3 to 2, "
                 f"the inside floor is a light cream color, flat, wide and completely empty, the lid is folded back upward and only a little of it is visible. Nothing inside. {NOTXT} {OBJ}"),
    "P4": dict(kind="obj", size=(1024, 1024), what="빈 상자 3:1",
               p=f"An empty open paper doughnut box seen straight from directly above (top-down view), a very long narrow horizontal rectangle with width to height ratio 3 to 1, "
                 f"the inside floor is a light cream color, flat, wide and completely empty, the lid is folded back upward and only a little of it is visible. Nothing inside. {NOTXT} {OBJ}"),
    "R1": dict(kind="obj", size=(1024, 1024), what="빨대 음료 팩",
               p=f"One small juice carton pack with a plastic drinking straw attached, pastel colored carton decorated with one simple orange fruit picture, {ANG}. {NOTXT} {OBJ}"),
    "R2": dict(kind="obj", size=(1024, 1024), what="음료 팩 4개 묶음",
               p=f"A bundle of exactly four small juice carton packs with straws, standing in one row side by side, held together by one plain paper band, "
                 f"each carton decorated with one simple fruit picture, all four clearly visible, {ANG}. {NOTXT} {OBJ}"),
    "R4": dict(kind="obj", size=(1024, 1024), what="삼각김밥",
               p=f"One triangular Korean rice ball (samgak kimbap) wrapped in clear transparent plastic film with black seaweed visible, {ANG}. {NOTXT} {OBJ}"),
    "R5": dict(kind="obj", size=(1024, 1024), what="컵라면",
               p=f"One instant cup noodle container with the lid closed, plain red and white pattern only, {ANG}. {NOTXT} {OBJ}"),
    "R6": dict(kind="obj", size=(1024, 1024), what="컵라면 3개 묶음",
               p=f"A bundle of exactly three instant cup noodle containers with closed lids, wrapped together in clear plastic wrap, standing side by side, plain red and white pattern only, "
                 f"all three clearly visible, {ANG}. {NOTXT} {OBJ}"),
    "R7": dict(kind="obj", size=(1024, 1024), what="작은 고무공",
               p=f"One small rubber ball, solid red color with one white stripe around it. {NOTXT} {OBJ}"),
    "R8": dict(kind="obj", size=(1344, 576), what="빈 나무 선반 판",
               p=("One single empty wooden shelf board, a long thin horizontal plank seen from the front and slightly from above so that its flat top surface is visible, "
                  "completely empty, nothing on it and no supports or brackets, shown whole and centered on a plain pure white background, soft small contact shadow.")),
    "M1": dict(kind="obj", size=(1024, 1024), what="달걀판 달걀 6개",
               p=f"An open paper egg carton with two rows of three cups holding exactly six white eggs, all six eggs clearly visible, {ANG}. {NOTXT} {OBJ}"),
    "M2": dict(kind="obj", size=(1024, 1024), what="나무 학교 의자",
               p=f"One simple wooden school chair with a backrest and four legs, front three-quarter view. {OBJ}"),
    "S1": dict(kind="scene", size=(1344, 576), what="문구점",
               p=SCENE2.format(place="the inside of a small stationery shop", shelf="are shelves with notebooks, a pencil holder, packs of colored paper and pencil cases")),
    "S2": dict(kind="scene", size=(1344, 576), what="빵집",
               p=SCENE2.format(place="the inside of a small bakery", shelf="is a display with bread loaves, doughnuts and cakes")),
    "S3": dict(kind="scene", size=(1344, 576), what="편의점",
               p=SCENE2.format(place="the inside of a small convenience store", shelf="are shelves lined with drink bottles, snack bags and cup noodles, all packaging plain without any printing")),
})
T2I_2 = ["N0", "N1", "P1", "P2", "P3", "P4", "R1", "R2", "R4", "R5", "R6", "R7", "R8", "M1", "M2", "S1", "S2", "S3"]
EDIT_COUNT_TPL = (STYLE + " Keep the exact illustration style, line quality, colors, camera angle, framing, white background and the arrangement of <image1>, "
                  "but change the number of {noun} so that there are exactly {w} {noun}, all {w} fully visible and clearly separate. Do not add any other object. No text, no logos.")
EDIT_BOX_TPL = (STYLE + " Keep the exact illustration style, line quality, colors, top-down camera angle, lid, white background and the empty light cream inside floor of the box of <image1>, "
                "but change the shape of the box to {shape}. The box stays completely empty. No text, no logos.")
EDIT_D2 = {"D4": "the character raises both arms high up in the air above its head, a joyful happy open smile, cheering",
           "D5": "the character faces the front, one hand beside its chin, head tilted to one side, a puzzled questioning look"}
LABEL.update({"N0": "연필 1자루", "N1": "연필 3자루 묶음", "N2": "편집: 연필 4자루", "N3": "편집: 연필 5자루",
              "P1": "도넛(위에서)", "P2": "빈 상자 정사각", "P3": "빈 상자 3:2(t2i)", "P4": "빈 상자 3:1(t2i)", "P3e": "빈 상자 3:2(편집)", "P4e": "빈 상자 3:1(편집)",
              "R1": "음료 팩", "R2": "음료 팩 4개", "R3": "편집: 팩 3개", "R4": "삼각김밥", "R5": "컵라면", "R6": "컵라면 3개", "R7": "고무공", "R8": "빈 선반 판",
              "M1": "달걀판 6개", "M2": "나무 의자", "D4": "편집: 두 팔 번쩍", "D5": "편집: 갸웃(물음)"})


def run_jobs2(comfy, jobs):
    gen_items(comfy, {"t2i": load_wf("qwen21_t2i.json"), "edit": load_wf("qwen21_edit.json")}, jobs)


def cmd_gen2(a):
    """t2i 항목 생성: gen2 --items N0,N1 --k0 1 --n 4 (k0을 5나 9로 하면 시드를 바꿔 더 만든다). 항목을 안 주면 2차 t2i 전부."""
    RAW.mkdir(parents=True, exist_ok=True)
    items = [x for x in a.items.split(",") if x] or T2I_2
    t0 = time.time()
    jobs = []
    for it in items:
        w, h = ITEMS[it]["size"]
        for k in range(a.k0, a.k0 + a.n):
            jobs.append((it, k, "t2i", prompt_t2i(it), seed_for(it, k), w, h, None))
    with comfy_session() as comfy:
        run_jobs2(comfy, jobs)
    say(f"gen2 끝: {round(time.time() - t0)}초")


def cmd_edit2(a):
    """편집: edit2 --n1 N1-2 --r2 R2-1 --p2 P2-3 --d1 D1-1 [--k0 1 --n 4]"""
    t0 = time.time()
    with comfy_session() as comfy:
        up = lambda tok: comfy.upload(latest_raw(tok))
        jobs = []
        if a.n1:
            ref = up(a.n1)
            for it, wd in (("N2", "four"), ("N3", "five")):
                for k in range(a.k0, a.k0 + a.n):
                    jobs.append((it, k, "edit", EDIT_COUNT_TPL.format(noun="pencils in the bundle", w=wd), seed_for(it, k), 0, 0, ref))
        if a.r2:
            ref = up(a.r2)
            for k in range(a.k0, a.k0 + a.n):
                jobs.append(("R3", k, "edit", EDIT_COUNT_TPL.format(noun="juice carton packs in the bundle", w="three"), seed_for("R3", k), 0, 0, ref))
        if a.p2:
            ref = up(a.p2)
            for it, shape in (("P3e", "a wide horizontal rectangle with width to height ratio 3 to 2"),
                              ("P4e", "a very long narrow horizontal rectangle with width to height ratio 3 to 1")):
                for k in range(a.k0, a.k0 + a.n):
                    jobs.append((it, k, "edit", EDIT_BOX_TPL.format(shape=shape), seed_for(it, k), 0, 0, ref))
        if a.d1:
            ref = up(a.d1)
            for it, pose in EDIT_D2.items():
                for k in range(a.k0, a.k0 + a.nd):
                    jobs.append((it, k, "edit", EDIT_D_TPL.format(pose=pose), seed_for(it, k), 0, 0, ref))
        run_jobs2(comfy, jobs)
    say(f"edit2 끝: {round(time.time() - t0)}초")


def cmd_stage1(a):
    RAW.mkdir(parents=True, exist_ok=True)
    jobs = []
    t0 = time.time()
    for item in ["A1", "A2", "A3", "A4", "A5", "C1", "C2", "C3", "D1"]:
        n = a.n
        w, h = ITEMS[item]["size"]
        for k in range(1, n + 1):
            jobs.append((item, k, "t2i", prompt_t2i(item), seed_for(item, k), w, h, None))
    with comfy_session() as comfy:
        gen_items(comfy, {"t2i": load_wf("qwen21_t2i.json")}, jobs)
    say(f"stage1 끝: {round(time.time() - t0)}초")


def latest_raw(token):
    """'A2-2' 형태 → raw 파일 경로"""
    item, k = token.split("-")
    c = sorted(RAW.glob(f"{item}-{k}_s*.png"))
    if not c:
        raise SystemExit(f"원본 없음: {token}")
    return c[0]


def cmd_stage2(a):
    t0 = time.time()
    ref_a2, ref_d1 = latest_raw(a.a2), latest_raw(a.d1)
    say(f"기준 그림: B ← {ref_a2.name}, D2·D3 ← {ref_d1.name}")
    with comfy_session() as comfy:
        base = {"edit": load_wf("qwen21_edit.json")}
        ra = comfy.upload(ref_a2)
        rd = comfy.upload(ref_d1)
        jobs = []
        for item, n_t in EDIT_B.items():
            for k in range(1, a.n + 1):
                jobs.append((item, k, "edit", EDIT_B_TPL.format(w=NUMW[n_t]), seed_for(item, k), 0, 0, ra))
        gen_items(comfy, base, jobs)
        jobs = []
        for item, (what, pose) in EDIT_D.items():
            for k in range(1, a.nd + 1):
                jobs.append((item, k, "edit", EDIT_D_TPL.format(pose=pose), seed_for(item, k), 0, 0, rd))
        gen_items(comfy, base, jobs)
    say(f"stage2 끝: {round(time.time() - t0)}초")


# ------------------------------------------------------------------ 배경 제거
def cut_white(src, tol=28):
    """테두리에서 이어진 흰색만 투명하게(물체 안쪽의 흰 부분은 남김). 크기는 그대로 둔다."""
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    lim = 255 - tol
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        p = px[x, y]
        if not (p[0] > lim and p[1] > lim and p[2] > lim):
            continue
        px[x, y] = (255, 255, 255, 0)
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    # 투명 영역에 맞닿은 밝은 테를 한 번 걷어 낸다
    a = im.getchannel("A")
    near = a.point(lambda v: 255 if v < 20 else 0).filter(ImageFilter.MaxFilter(3))
    npx = near.load()
    for y in range(h):
        for x in range(w):
            r, g, b, al = px[x, y]
            if al and npx[x, y] and min(r, g, b) > 215 and max(r, g, b) - min(r, g, b) < 30:
                px[x, y] = (255, 255, 255, 0)
    return im


def trim(im, margin=0.02):
    bbox = im.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    if not bbox:
        return im
    im = im.crop(bbox)
    m = max(2, round(min(im.size) * margin))
    c = Image.new("RGBA", (im.size[0] + 2 * m, im.size[1] + 2 * m), (255, 255, 255, 0))
    c.paste(im, (m, m), im)
    return c


def cmd_cut(a):
    CUT.mkdir(parents=True, exist_ok=True)
    files = []
    for item in (a.items.split(",") if a.items else ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "D1", "D2", "D3"]):
        files += sorted(RAW.glob(f"{item}-*_s*.png"))
    todo = [f for f in files if not (CUT / (f.stem + ".png")).exists() or a.redo]
    say(f"오려 낼 것 {len(todo)}개, 방법 {a.method}")
    rows = read_log()
    if a.method == "white":
        for f in todo:
            t0 = time.time()
            im = trim(cut_white(f))
            im.save(CUT / f.name)
            rows[f.name]["오려낸파일"] = f.name
            rows[f.name]["배경제거방법"] = "white(흰 배경 flood fill)"
        write_log(rows)
        return
    with comfy_session() as comfy:
        base = load_wf("qwen21_edit.json")
        for f in todo:
            try:
                name = comfy.upload(f)
                data, sec = edit(comfy, base, BGREMOVE, 1, name, "quiz/v5/bgremove")
            except Exception as e:
                say(f"✗ bgremove {f.name}: {e}")
                continue
            tmp = CUT / (f.stem + ".bg.png")
            tmp.write_bytes(data)
            im = Image.open(tmp)
            say(f"bgremove {f.name}: {sec}초 {im.size} {im.mode}")
            im.convert("RGBA")
            trim(im.convert("RGBA")).save(CUT / f.name)
            tmp.unlink()
            rows[f.name]["오려낸파일"] = f.name
            rows[f.name]["배경제거방법"] = f"bgremove(모델, {sec}초)"
            write_log(rows)


def do_bgremove(comfy, files):
    """모델 배경 제거(키트의 bgremove)로 files를 cut/에 저장한다."""
    base = load_wf("qwen21_edit.json")
    rows = read_log()
    for f in files:
        if (CUT / f.name).exists():
            continue
        try:
            name = comfy.upload(f)
            data, sec = edit(comfy, base, BGREMOVE, 1, name, "quiz/v5/bgremove")
        except Exception as e:
            say(f"✗ bgremove {f.name}: {e}")
            continue
        tmp = CUT / (f.stem + ".bg.png")
        tmp.write_bytes(data)
        im = Image.open(tmp)
        say(f"bgremove {f.name}: {sec}초 {im.size} {im.mode}")
        trim(im.convert("RGBA")).save(CUT / f.name)
        tmp.unlink()
        rows[f.name]["오려낸파일"] = f.name
        rows[f.name]["배경제거방법"] = f"bgremove(모델, {sec}초)"
        write_log(rows)


# 3차(마무리): 주 세션이 고른 19장 배경 제거 + 편의점 장면 다시 + 컵라면 묶음 다시
PICK19 = "N1-4 N2-1 N3-1 P1-1 P2-1 P3e-3 P4-3 P4e-2 R1-4 R2-1 R3-3 R4-3 R5-3 R7-2 R8-2 M1-1 M2-2 D4-3 D5-1".split()
ITEMS["S3b"] = dict(kind="scene", size=(1344, 576), what="편의점(색 선명)",
                    p=("Scene: the inside of a small convenience store, wide landscape view, no people. In the foreground a wide, empty, bare wooden counter top "
                       "fills the lower 45 percent of the picture, nothing on it. Behind the counter are shelves lined with many brightly colored drink bottles in red, blue, green "
                       "and yellow, colorful snack bags, and cup noodles, all packaging in solid colors with simple patterns and no writing. "
                       "Fully colored with clear flat warm pastel fills as rich as a colorful bakery picture, not pale, not line art."))
LABEL.update({"S3b": "편의점 다시(색 선명)", "R6b": "편집: 컵라면 3개 한 줄 묶음"})
EDIT_R6B = (STYLE + " Keep the exact illustration style, line quality, colors, camera angle, framing, white background and the row arrangement and the plain paper band of <image1>, "
            "but replace the four juice cartons with exactly three plain instant cup noodle cups with closed lids, standing upright side by side in one row, "
            "all three clearly visible from the front, tied together by the same paper band. The cups have only a plain red and white pattern, no text, no letters, no logos.")


def cmd_final(a):
    t0 = time.time()
    files = [latest_raw(t) for t in PICK19]
    with comfy_session() as comfy:
        do_bgremove(comfy, files)
        say(f"19장 배경 제거 끝: {round(time.time() - t0)}초")
        jobs = [("S3b", k, "t2i", prompt_t2i("S3b"), seed_for("S3b", k), 1344, 576, None) for k in range(1, 5)]
        ref = comfy.upload(latest_raw("R2-1"))
        jobs += [("R6b", k, "edit", EDIT_R6B, seed_for("R6b", k), 0, 0, ref) for k in range(1, 5)]
        run_jobs2(comfy, jobs)
    say(f"final 끝: {round(time.time() - t0)}초")


def cmd_cutfiles(a):
    with comfy_session() as comfy:
        do_bgremove(comfy, [latest_raw(t) for t in a.tokens.split(",")])


# ------------------------------------------------------------------ 직접 보고 센 결과 (아래 REVIEW에 적는다)
REVIEW = {   # 직접 열어 보고 센 결과: "항목-후보": (센 개수, 문제). 빈 칸은 해당 없음.
    "A1-1": ("1", ""), "A1-2": ("1", ""), "A1-3": ("1", ""), "A1-4": ("1", "윤곽선이 거의 없음(기준보다 약함)"),
    "A2-1": ("2", "봉지 윤곽선이 매우 옅음"), "A2-2": ("2", ""), "A2-3": ("2", "묶음 끈이 풀린 듯 늘어짐"), "A2-4": ("2", "봉지가 넓고 그림자가 큼"),
    "A3-1": ("6", "개수 틀림(6개)"), "A3-2": ("6", "개수 틀림(6개, 뒤쪽 1개가 가려짐)"), "A3-3": ("5", "귤끼리 많이 겹침"), "A3-4": ("5", ""),
    "A4-1": ("5", ""), "A4-2": ("6", "개수 틀림(6개)"), "A4-3": ("6", "개수 틀림(6개 이상, 가려진 귤)"), "A4-4": ("6", "개수 틀림(6개)"),
    "A5-1": ("0", ""), "A5-2": ("0", "각도가 더 높음"), "A5-3": ("0", "각도가 더 낮음"), "A5-4": ("0", ""),
    "B1-1": ("3", ""), "B1-2": ("3", ""), "B1-3": ("4", "개수 틀림(4개)"), "B1-4": ("4", "개수 틀림(4개)"),
    "B2-1": ("4", ""), "B2-2": ("5", "개수 틀림(5개, 1개가 뒤에 가려짐)"), "B2-3": ("5", "개수 틀림(5개)"), "B2-4": ("5", "개수 틀림(5개)"),
    "B3-1": ("5", ""), "B3-2": ("5", ""), "B3-3": ("5", "귤이 겹쳐 있고 한 개는 반쯤 가려짐"), "B3-4": ("5", ""),
    "C1-1": ("", "사람 없음, 글자 없음. 계산대 윗면 약 50%, 오른쪽 아래에 유리 진열 상자가 걸쳐 있음"),
    "C1-2": ("", "사람 없음, 글자 없음. 계산대 약 45%, 왼쪽에 창문, 옅은 채색"),
    "C1-3": ("", "사람 없음, 글자 없음. 계산대 약 56%(요구보다 넓음), 선반·상자가 가장 또렷"),
    "C1-4": ("", "사람 없음, 글자 없음. 계산대 약 42%, 창·소쿠리·화분 등 물건이 많아 복잡"),
    "C2-1": ("", "주인 1명, 앞치마·웃음. 계산대 뒤가 아니라 안쪽 작은 선반 옆에 서 있고 작음"),
    "C2-2": ("", "주인 1명, 앞치마·웃음, 크기 적당. 색이 매우 옅어 기준 화풍보다 바랜 느낌"),
    "C2-3": ("", "주인 1명이 왼쪽 가장자리에 몸 일부 잘림. 빈 가격표 팻말(글자 없음)"),
    "C2-4": ("", "화풍 다름(채색 없는 옅은 선화). 주인이 가장자리, 왼쪽 소쿠리가 잘림"),
    "C3-1": ("", "탁자 전체와 다리가 작게 보임, 윗면이 얇음(약 20%)"),
    "C3-2": ("", "탁자 윗면이 얇고 작음, 위쪽 벽 면적이 큼"),
    "C3-3": ("", "윗면이 크고 가로 전체가 보임, 다리는 아래에서 잘림"),
    "C3-4": ("", "윗면이 가장 크고 좌우·아래가 잘림(바탕용으로 좋음)"),
    "D1-1": ("1", ""), "D1-2": ("1", "손이 올라가고 다리가 길어 비율이 다름"), "D1-3": ("1", "몸이 갸름하고 다리가 김"), "D1-4": ("1", "윤곽선이 약함"),
    "D2-1": ("1", "윤곽선이 기준(D1-1)보다 굵고 진함"), "D2-2": ("1", "윤곽선이 기준보다 굵고 진함"), "D2-3": ("1", "윤곽선이 기준보다 굵고 진함, 팔이 약간 어색"),
    "D3-1": ("1", "윤곽선이 기준보다 굵음, 손이 턱에 닿음"), "D3-2": ("1", "윤곽선이 기준보다 굵음, 손이 턱에 닿음"), "D3-3": ("1", "윤곽선이 기준보다 굵음, 손이 턱에 닿음"),
}


REVIEW2 = {   # 2차 결과(직접 열어 보고 센 값)
    "N0-1": ("1", ""), "N0-2": ("1", "지우개에 은색 띠가 큼"), "N0-3": ("1", ""), "N0-4": ("1", ""),
    "N1-1": ("3", "세 자루가 서로 많이 겹침"), "N1-2": ("3", ""), "N1-3": ("3", "고무줄 두 줄"), "N1-4": ("3", ""),
    "P1-1": ("1", ""), "P1-2": ("1", "그림이 칸을 거의 채움(여백 적음)"), "P1-3": ("1", ""), "P1-4": ("1", ""),
    "P2-1": ("0", "정사각이 아님(세로가 조금 김), 뚜껑이 거의 안 보임"), "P2-2": ("0", "뚜껑이 그림 위로 잘림"), "P2-3": ("0", ""), "P2-4": ("0", "윤곽선이 이중으로 겹침"),
    "P3-1": ("0", "비율이 약 5:4(3:2 아님), 뚜껑 없음"), "P3-2": ("0", "거의 정사각(3:2 아님)"), "P3-3": ("0", "거의 정사각(3:2 아님)"), "P3-4": ("0", ""),
    "P4-1": ("0", "너무 가늘어 바닥이 좁음(비율 약 4.5:1)"), "P4-2": ("0", ""), "P4-3": ("0", "비율 약 2.3:1(3:1보다 짧음)"), "P4-4": ("0", "비율 약 2.2:1(3:1보다 짧음)"),
    "R1-1": ("1", "바코드와 글자 모양 줄이 있음"), "R1-2": ("1", "바코드와 글자 모양 줄이 있음"), "R1-3": ("1", ""), "R1-4": ("1", ""),
    "R2-1": ("4", ""), "R2-2": ("4", "팩이 겹치고 띠가 세로"), "R2-3": ("4", "바코드 모양이 있음"), "R2-4": ("4", "바코드 모양이 있음"),
    "R4-1": ("1", "포장지가 퍼져 모양이 비뚤"), "R4-2": ("1", ""), "R4-3": ("1", ""), "R4-4": ("1", ""),
    "R5-1": ("1", "뚜껑이 열린 모양(닫힘 아님)"), "R5-2": ("1", ""), "R5-3": ("1", "뚜껑 가장자리에 주둥이 모양"), "R5-4": ("1", "뚜껑이 어긋남"),
    "R6-1": ("4", "개수 틀림(4개)"), "R6-2": ("3", "라면 면발 그림이 복잡함"), "R6-3": ("4", "개수 틀림(4개)"), "R6-4": ("3", ""),
    "R7-1": ("1", ""), "R7-2": ("1", ""), "R7-3": ("1", ""), "R7-4": ("1", ""),
    "R8-1": ("0", "판이 얇아 윗면이 거의 안 보임, 그림자가 큼"), "R8-2": ("0", "판이 얇아 윗면이 좁음"), "R8-3": ("0", ""), "R8-4": ("0", "왼쪽 끝 모양이 일그러짐"),
    "M1-1": ("6", ""), "M1-2": ("6", "달걀판이 옅고 그림자가 큼"), "M1-3": ("6", ""), "M1-4": ("6", "달걀판 질감이 사실적"),
    "M2-1": ("1", ""), "M2-2": ("1", ""), "M2-3": ("1", ""), "M2-4": ("1", "작게 그려짐"),
    "S1-1": ("", "사람·글자 없음. 계산대 약 55%"), "S1-2": ("", "사람·글자 없음. 계산대 약 61%, 왼쪽 벽에 종이판"), "S1-3": ("", "사람·글자 없음. 계산대 약 55%, 색이 또렷"), "S1-4": ("", "사람·글자 없음. 계산대 약 58%, 선반 물건이 적음"),
    "S2-1": ("", "사람·글자 없음. 계산대 약 52%, 진열이 왼쪽에 치우침"), "S2-2": ("", "사람·글자 없음. 계산대 약 60%, 왼쪽에 금전기 모양"), "S2-3": ("", "사람·글자 없음. 계산대 약 47%, 빵·도넛·케이크 진열"), "S2-4": ("", "사람·글자 없음. 계산대 약 55%"),
    "S3-1": ("", "사람·글자 없음. 계산대 약 56%, 포장이 옅음, 왼쪽에 노란 병"), "S3-2": ("", "사람·글자 없음. 계산대 약 47%, 색이 매우 옅음"), "S3-3": ("", "사람·글자 없음. 계산대 약 55%, 색이 옅음"), "S3-4": ("", "사람·글자 없음. 계산대 약 52%, 색이 옅고 복잡"),
}


REVIEW2.update({
    "N2-1": ("4", ""), "N2-2": ("4", "고무줄이 사라짐"), "N2-3": ("4", ""), "N2-4": ("4", "고무줄이 사라짐"),
    "N3-1": ("5", ""), "N3-2": ("5", "왼쪽 두 자루 끝이 겹쳐 일그러짐"), "N3-3": ("5", "고무줄이 사라짐"), "N3-4": ("5", ""),
    "R3-1": ("3", ""), "R3-2": ("3", ""), "R3-3": ("3", ""), "R3-4": ("3", ""),
    "P3e-1": ("0", "비율 약 1.15:1(3:2 아님), 뚜껑이 위로 젖혀짐"), "P3e-2": ("0", "비율 약 1.3:1"), "P3e-3": ("0", "비율 약 1.4:1"), "P3e-4": ("0", "비율 약 1.35:1"),
    "P4e-1": ("0", "비율 약 3.2:1, 뚜껑이 젖혀짐"), "P4e-2": ("0", "비율 약 3:1"), "P4e-3": ("0", "비율 약 3:1"), "P4e-4": ("0", "비율 약 3.3:1"),
    "D4-1": ("1", "입을 크게 벌림"), "D4-2": ("1", "눈 감고 웃음"), "D4-3": ("1", ""),
    "D5-1": ("1", "웃는 얼굴(물음 표정 아님), 고개 기울기 약함"), "D5-2": ("1", "웃는 얼굴, 고개 기울기 약함"), "D5-3": ("1", "물음 표정, 고개 기울임"),
    "S3b-1": ("", "사람·글자 없음. 계산대 약 51%, 색 선명"), "S3b-2": ("", "사람·글자 없음. 계산대 약 58%, 색 선명"),
    "S3b-3": ("", "사람·글자 없음. 계산대 약 51%, 색 선명"), "S3b-4": ("", "사람·글자 없음. 계산대 약 47%, 색 선명, 포장은 그림 무늬만"),
    "R6b-1": ("3", "뚜껑 윤곽이 약함"), "R6b-2": ("3", ""), "R6b-3": ("3", "빨강·흰 무늬가 불규칙"), "R6b-4": ("3", "뚜껑이 겹쳐 보임"),
})


def apply_review():
    rows = read_log()
    allrev = {**REVIEW, **REVIEW2}
    for r in rows.values():
        key = f"{r['항목']}-{r['후보']}"
        if key in allrev:
            r["보고센개수"], r["문제"] = allrev[key]
    write_log(rows)


# ------------------------------------------------------------------ 시트
FONT = None


def font(size):
    for p in (r"C:\Windows\Fonts\malgun.ttf", r"C:\Windows\Fonts\arial.ttf"):
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()


def checker(w, h, s=16):
    im = Image.new("RGB", (w, h), (238, 238, 238))
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2:
                d.rectangle([x, y, x + s - 1, y + s - 1], fill=(222, 222, 222))
    return im


def seed_of(path):
    return path.stem.split("_s")[-1]


def cell(path_cut, cell_px=256):
    bg = checker(cell_px, cell_px)
    if path_cut.exists():
        im = Image.open(path_cut).convert("RGBA")
        s = (cell_px - 16) / max(im.size)
        im = im.resize((max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s))), Image.LANCZOS)
        bg.paste(im, ((cell_px - im.size[0]) // 2, (cell_px - im.size[1]) // 2), im)
    return bg


LABEL.update({"A1": "귤 1개", "A2": "봉지 귤 2개", "A3": "봉지 귤 5개", "A4": "소쿠리 귤 5개", "A5": "빈 소쿠리",
         "B1": "편집: 귤 3개", "B2": "편집: 귤 4개", "B3": "편집: 귤 5개",
         "D1": "늘봄 손 흔들기", "D2": "편집: 옆 가리키기", "D3": "편집: 생각하기"})


def sheet_rows(name, items):
    cp, lab_h, left = 256, 40, 120
    rows = [(it, sorted(RAW.glob(f"{it}-*_s*.png"))) for it in items]
    rows = [(it, fs) for it, fs in rows if fs]
    ncol = max(len(fs) for _, fs in rows)
    W, H = left + ncol * (cp + 6), len(rows) * (cp + lab_h + 8)
    sheet = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(sheet)
    f1, f2 = font(15), font(13)
    for r, (it, fs) in enumerate(rows):
        y = r * (cp + lab_h + 8)
        d.text((6, y + 8), it, fill=(0, 0, 0), font=font(22))
        d.text((6, y + 40), LABEL.get(it, ""), fill=(60, 60, 60), font=f2)
        for c, f in enumerate(fs):
            x = left + c * (cp + 6)
            sheet.paste(cell(CUT / f.name, cp), (x, y))
            k = f.name.split("_s")[0]
            d.text((x + 2, y + cp + 2), k, fill=(0, 0, 0), font=f1)
            d.text((x + 2, y + cp + 20), "seed " + seed_of(f), fill=(90, 90, 90), font=f2)
    SHEETS.mkdir(parents=True, exist_ok=True)
    sheet.save(SHEETS / name)
    return sheet.size


def sheet_rows2(name, items, per_row=6):
    """2차용: 후보가 많아도 한 줄 6칸에서 줄을 바꿔 쌓는다. 항목-후보와 시드, 직접 센 개수·문제를 함께 적는다."""
    cp, lab_h, left = 256, 78, 120
    allrev = {**REVIEW, **REVIEW2}
    blocks = []
    for it in items:
        fs = sorted(RAW.glob(f"{it}-*_s*.png"), key=lambda f: int(f.name.split("-")[1].split("_")[0]))
        if fs:
            blocks.append((it, fs))
    nlines = sum((len(fs) + per_row - 1) // per_row for _, fs in blocks)
    W, H = left + per_row * (cp + 6), nlines * (cp + lab_h + 8)
    sheet = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(sheet)
    f1, f2 = font(15), font(12)
    line = 0
    for it, fs in blocks:
        y0 = line * (cp + lab_h + 8)
        d.text((6, y0 + 8), it, fill=(0, 0, 0), font=font(22))
        d.text((6, y0 + 40), LABEL.get(it, ""), fill=(60, 60, 60), font=f2)
        for c, f in enumerate(fs):
            y = (line + c // per_row) * (cp + lab_h + 8)
            x = left + (c % per_row) * (cp + 6)
            sheet.paste(cell(CUT / f.name, cp), (x, y))
            k = f.name.split("_s")[0]
            cnt, prob = allrev.get(k, ("", ""))
            d.text((x + 2, y + cp + 2), k + (f"   센 개수 {cnt}" if cnt != "" else ""), fill=(0, 0, 0), font=f1)
            d.text((x + 2, y + cp + 22), "seed " + seed_of(f), fill=(90, 90, 90), font=f2)
            if prob:
                d.text((x + 2, y + cp + 38), prob[:22], fill=(180, 30, 30), font=f2)
                if len(prob) > 22:
                    d.text((x + 2, y + cp + 54), prob[22:44], fill=(180, 30, 30), font=f2)
        line += (len(fs) + per_row - 1) // per_row
    SHEETS.mkdir(parents=True, exist_ok=True)
    sheet.save(SHEETS / name)
    return sheet.size


def sheet_wide(name, item, use_cut=False, w=900, max_side=2000):
    """1344x576 그림 후보를 세로로(너비 900). 긴 변이 2000px을 넘으면 name에 _2, _3을 붙여 나눈다."""
    allrev = {**REVIEW, **REVIEW2}
    fs = sorted(RAW.glob(f"{item}-*_s*.png"), key=lambda f: int(f.name.split("-")[1].split("_")[0]))
    ims = []
    for f in fs:
        if use_cut:
            im = Image.open(CUT / f.name).convert("RGBA")
            bg = checker(im.size[0], im.size[1], 24).convert("RGBA")
            bg.alpha_composite(im)
            im = bg.convert("RGB")
        else:
            im = Image.open(f).convert("RGB")
        ims.append((f, im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)))
    per = max(1, max_side // (ims[0][1].size[1] + 44))
    out = []
    for part in range(0, len(ims), per):
        chunk = ims[part:part + per]
        sh = Image.new("RGB", (w, sum(im.size[1] + 44 for _, im in chunk)), "white")
        d = ImageDraw.Draw(sh)
        y = 0
        for f, im in chunk:
            k = f.name.split("_s")[0]
            cnt, prob = allrev.get(k, ("", ""))
            d.text((4, y + 3), f"{k}   seed {seed_of(f)}" + (f"   센 개수 {cnt}" if cnt != "" else ""), fill=(0, 0, 0), font=font(15))
            d.text((4, y + 22), prob[:90], fill=(180, 30, 30), font=font(12))
            sh.paste(im, (0, y + 44))
            y += im.size[1] + 44
        nm = name if part == 0 else name.replace(".png", f"_{part // per + 1}.png")
        sh.save(SHEETS / nm)
        out.append((nm, sh.size))
    return out


def sheet_C():
    fs = []
    for it in ("C1", "C2", "C3"):
        fs += sorted(RAW.glob(f"{it}-*_s*.png"))
    w = 900
    ims = []
    for f in fs:
        im = Image.open(f).convert("RGB")
        im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
        ims.append((f, im))
    # 세로로 쌓되 긴 변이 2000px 이하가 되게 두 묶음으로 나눈다
    per_sheet = max(1, 2000 // (ims[0][1].size[1] + 28)) if ims else 1
    sizes = []
    for part in range(0, len(ims), per_sheet):
        chunk = ims[part:part + per_sheet]
        H = sum(im.size[1] + 28 for _, im in chunk)
        sh = Image.new("RGB", (w, H), "white")
        d = ImageDraw.Draw(sh)
        y = 0
        for f, im in chunk:
            d.text((4, y + 4), f.name.split("_s")[0] + "   seed " + seed_of(f), fill=(0, 0, 0), font=font(16))
            sh.paste(im, (0, y + 28))
            y += im.size[1] + 28
        name = "sheet_C.png" if part == 0 else f"sheet_C_{part // per_sheet + 1}.png"
        sh.save(SHEETS / name)
        sizes.append((name, sh.size))
    return sizes


def best_cut(item, key):
    return CUT / (sorted(RAW.glob(f"{key}_s*.png"))[0].name)


def sheet_mock(table_key, bag_key, b3_key):
    """합성 시험: C3 탁자를 760x300으로 잘라 바탕에 깔고, 그 위에 A2 봉지 4개(윗줄), 아래 줄에 같은 탁자 위 B3(귤 5개) 봉지 3개."""
    tf = sorted(RAW.glob(f"{table_key}_s*.png"))[0]
    table = Image.open(tf).convert("RGB")
    W, H = 760, 300
    s = W / table.size[0]
    table = table.resize((W, round(table.size[1] * s)), Image.LANCZOS)
    table = table.crop((0, table.size[1] - H, W, table.size[1])).convert("RGBA")   # 아래쪽 300px(탁자 윗면이 보이는 부분)
    panels = []
    for key, n in ((bag_key, 4), (b3_key, 3)):
        bag = Image.open(CUT / sorted(RAW.glob(f"{key}_s*.png"))[0].name).convert("RGBA")
        panel = table.copy()
        bh = 190
        bw = round(bag.size[0] * bh / bag.size[1])
        b = bag.resize((bw, bh), Image.LANCZOS)
        gap = 20
        x0 = (W - (n * bw + (n - 1) * gap)) // 2
        y0 = 235 - bh   # 봉지 바닥이 탁자 윗면 위에 오도록
        for j in range(n):
            x = x0 + j * (bw + gap)
            shadow = Image.new("RGBA", panel.size, (0, 0, 0, 0))
            ImageDraw.Draw(shadow).ellipse([x + 4, y0 + bh - 12, x + bw - 4, y0 + bh + 6], fill=(90, 60, 30, 90))
            panel = Image.alpha_composite(panel, shadow.filter(ImageFilter.GaussianBlur(3)))
            panel.alpha_composite(b, (x, y0))
        panels.append(panel.convert("RGB"))
    lab = 22
    sheet = Image.new("RGB", (W, 2 * (H + lab)), "white")
    d = ImageDraw.Draw(sheet)
    for i, (panel, label) in enumerate(zip(panels, (f"위: {bag_key} 봉지 x4 / 바탕 {table_key}", f"아래: {b3_key} (귤 5개 봉지) x3"))):
        sheet.paste(panel, (0, i * (H + lab) + lab))
        d.text((4, i * (H + lab) + 3), label, fill=(0, 0, 0), font=font(15))
    sheet.save(SHEETS / "sheet_mock.png")
    return sheet.size


def cmd_sheets(a):
    apply_review()
    SHEETS.mkdir(parents=True, exist_ok=True)
    print("sheet_A", sheet_rows("sheet_A.png", ["A1", "A2", "A3", "A4", "A5"]))
    print("sheet_B", sheet_rows("sheet_B.png", ["B1", "B2", "B3"]))
    print("sheet_D", sheet_rows("sheet_D.png", ["D1", "D2", "D3"]))
    print("sheet_C", sheet_C())
    if a.table and a.bag and a.b3:
        print("sheet_mock", sheet_mock(a.table, a.bag, a.b3))


# 합성 시험 2: 도넛 상자 바닥(안쪽 평평한 면)의 위치. 오려 낸 그림에서의 비율 (x0, y0, x1, y1). 직접 보고 정한 값.
FLOOR = {}


def _fit(im, w=None, h=None):
    if w is not None:
        return im.resize((w, max(1, round(im.size[1] * w / im.size[0]))), Image.LANCZOS)
    return im.resize((max(1, round(im.size[0] * h / im.size[1])), h), Image.LANCZOS)


def _cut(key):
    return Image.open(CUT / sorted(RAW.glob(f"{key}_s*.png"))[0].name).convert("RGBA")


def _shadow(panel, x, y, w, h, alpha=80, blur=3):
    sh = Image.new("RGBA", panel.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([x, y, x + w, y + h], fill=(90, 60, 30, alpha))
    return Image.alpha_composite(panel, sh.filter(ImageFilter.GaussianBlur(blur)))


def box_with_donuts(box_key, donut_key, rows, cols, box_w):
    box = _fit(_cut(box_key), w=box_w)
    fx0, fy0, fx1, fy1 = FLOOR[box_key]
    W, H = box.size
    x0, y0, x1, y1 = fx0 * W, fy0 * H, fx1 * W, fy1 * H
    cw, ch = (x1 - x0) / cols, (y1 - y0) / rows
    d = int(min(cw, ch) * 0.92)
    donut = _fit(_cut(donut_key), w=d)
    canvas = Image.new("RGBA", box.size, (0, 0, 0, 0))
    canvas.alpha_composite(box)
    for r in range(rows):
        for c in range(cols):
            cx, cy = x0 + (c + 0.5) * cw, y0 + (r + 0.5) * ch
            canvas.alpha_composite(donut, (round(cx - donut.size[0] / 2), round(cy - donut.size[1] / 2)))
    return canvas


def sheet_mock2(keys):
    """keys: table, pencil, box_sq, box_32, box_31, donut, shelf, drink"""
    W = 760
    lab = 22
    panels = []
    # 1) 탁자 위 연필 다발 4개
    table = Image.open(SEL / "table_wood.png").convert("RGBA")
    table = _fit(table, w=W)
    table = table.crop((0, table.size[1] - 300, W, table.size[1]))
    pen = _fit(_cut(keys["pencil"]), h=190)
    gap = 40
    x0 = (W - (4 * pen.size[0] + 3 * gap)) // 2
    for j in range(4):
        x = x0 + j * (pen.size[0] + gap)
        table = _shadow(table, x - 4, 205, pen.size[0] + 8, 26)
        table.alpha_composite(pen, (x, 222 - pen.size[1] + 8))
    panels.append(("1) 탁자 위 연필 3자루 다발 x4 (" + keys["pencil"] + ")", table.convert("RGB")))
    # 2) 도넛 상자
    bg = "#fff8ec"
    p2 = Image.new("RGBA", (W, 560), bg)
    bw = 215
    for j in range(3):
        b = box_with_donuts(keys["box_sq"], keys["donut"], 2, 2, bw)
        p2.alpha_composite(b, (20 + j * (bw + 18), 14))
    yb = 14 + b.size[1] + 24
    b32 = box_with_donuts(keys["box_32"], keys["donut"], 2, 3, 330)
    p2.alpha_composite(b32, (20, yb))
    b31 = box_with_donuts(keys["box_31"], keys["donut"], 1, 3, 360)
    p2.alpha_composite(b31, (20 + 330 + 20, yb + 30))
    p2 = p2.crop((0, 0, W, min(560, yb + max(b32.size[1], b31.size[1] + 30) + 14)))
    panels.append(("2) 위: " + keys["box_sq"] + " 도넛 2x2 x3 / 아래: " + keys["box_32"] + " 도넛 2x3, " + keys["box_31"] + " 도넛 1x3 (도넛 " + keys["donut"] + ")", p2.convert("RGB")))
    # 3) 선반 판 3줄 x 음료 팩 4개
    p3 = Image.new("RGBA", (W, 3 * 150 + 10), bg)
    shelf = _fit(_cut(keys["shelf"]), w=680)
    drink = _fit(_cut(keys["drink"]), h=108)
    dg = 34
    for r in range(3):
        y = 12 + r * 150 + 60
        p3.alpha_composite(shelf, ((W - shelf.size[0]) // 2, y))
        surf_y = y + int(shelf.size[1] * 0.40)
        dx0 = (W - (4 * drink.size[0] + 3 * dg)) // 2
        for j in range(4):
            x = dx0 + j * (drink.size[0] + dg)
            p3 = _shadow(p3, x, surf_y - 8, drink.size[0], 14, 70, 2)
            p3.alpha_composite(drink, (x, surf_y - drink.size[1] + 4))
    panels.append(("3) 선반 판(" + keys["shelf"] + ") 3줄, 줄마다 음료 팩(" + keys["drink"] + ") 4개", p3.convert("RGB")))
    # 4) 과일 가게 계산대 위 귤 봉지 2개 + 늘봄
    sc = Image.open(SEL / "scene_fruit.png").convert("RGBA")
    bag = _fit(Image.open(SEL / "bag_tangerine_2.png").convert("RGBA"), h=235)
    for x in (470, 760):
        sc = _shadow(sc, x + 10, 408, bag.size[0] - 20, 28, 90, 4)
        sc.alpha_composite(bag, (x, 425 - bag.size[1] + 8))
    mas = _fit(Image.open(SEL / "mascot_wave.png").convert("RGBA"), h=270)
    sc = _shadow(sc, 1120, 540, mas.size[0] - 40, 24, 70, 4)
    sc.alpha_composite(mas, (1100, 570 - mas.size[1]))
    panels.append(("4) scene_fruit 계산대 위 귤 봉지(2) x2 + 늘봄(손 흔들기)", _fit(sc, w=W).convert("RGB")))
    H = sum(p.size[1] + lab for _, p in panels)
    sheet = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(sheet)
    y = 0
    for label, p in panels:
        d.text((4, y + 3), label, fill=(0, 0, 0), font=font(14))
        sheet.paste(p, (0, y + lab))
        y += p.size[1] + lab
    sheet.save(SHEETS / "sheet_mock2.png")
    return sheet.size


def cmd_sheets2(a):
    apply_review()
    print("sheet_N", sheet_rows2("sheet_N.png", ["N0", "N1", "N2", "N3"]))
    print("sheet_P", sheet_rows2("sheet_P.png", ["P1", "P2", "P3", "P4", "P3e", "P4e"]))
    print("sheet_R", sheet_rows2("sheet_R.png", ["R1", "R2", "R3", "R4", "R5", "R6", "R7"]))
    print("sheet_R8", sheet_wide("sheet_R8.png", "R8", use_cut=True))
    print("sheet_M", sheet_rows2("sheet_M.png", ["M1", "M2"]))
    for i in (1, 2, 3):
        print(f"sheet_S_{i}", sheet_wide(f"sheet_S_{i}.png", f"S{i}"))
    print("sheet_D2", sheet_rows2("sheet_D2.png", ["D4", "D5"]))
    if a.mock:
        print("sheet_mock2", sheet_mock2(json.loads(a.mock)))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("probe")
    s1 = sub.add_parser("stage1"); s1.add_argument("--n", type=int, default=4)
    s2 = sub.add_parser("stage2")
    s2.add_argument("--a2", required=True); s2.add_argument("--d1", required=True)
    s2.add_argument("--n", type=int, default=4); s2.add_argument("--nd", type=int, default=3)
    c = sub.add_parser("cut"); c.add_argument("--method", choices=["bgremove", "white"], default="bgremove"); c.add_argument("--redo", action="store_true"); c.add_argument("--items", default="")
    g2 = sub.add_parser("gen2"); g2.add_argument("--items", default=""); g2.add_argument("--k0", type=int, default=1); g2.add_argument("--n", type=int, default=4)
    e2 = sub.add_parser("edit2")
    for nm in ("n1", "r2", "p2", "d1"):
        e2.add_argument("--" + nm, default="")
    e2.add_argument("--k0", type=int, default=1); e2.add_argument("--n", type=int, default=4); e2.add_argument("--nd", type=int, default=3)
    sub.add_parser("final")
    cf = sub.add_parser("cutfiles"); cf.add_argument("--tokens", required=True)
    s3 = sub.add_parser("sheets2"); s3.add_argument("--mock", default="")
    sh = sub.add_parser("sheets")
    sh.add_argument("--table", default=""); sh.add_argument("--bag", default=""); sh.add_argument("--b3", default="")
    a = p.parse_args()
    {"probe": cmd_probe, "stage1": cmd_stage1, "stage2": cmd_stage2, "cut": cmd_cut, "sheets": cmd_sheets,
     "gen2": cmd_gen2, "final": cmd_final, "cutfiles": cmd_cutfiles, "edit2": cmd_edit2, "sheets2": lambda a: cmd_sheets2(a)}[a.cmd](a)


if __name__ == "__main__":
    main()
