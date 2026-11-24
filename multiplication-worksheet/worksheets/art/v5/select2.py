"""주 세션이 대조 시트를 직접 보고 고른 2차 그림을 selected/에 넣고 manifest를 갱신한다.
  python -X utf8 select2.py   (cut/에 오려 낸 파일이 생긴 것만 넣고, 없는 것은 알려 준다)"""
import glob, json, shutil, sys
from pathlib import Path
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
H = Path(__file__).resolve().parent
SEL = {  # 이름: (후보, 폴더, 종류, 눈으로 센 개수, 설명)
 "pencil":          ("N0-1", "cut", "single", 1, "노란 연필 한 자루"),
 "pencil_bundle_3": ("N1-4", "cut", "unit", 3, "연필 3자루 묶음"),
 "pencil_bundle_4": ("N2-1", "cut", "unit", 4, "연필 4자루 묶음"),
 "pencil_bundle_5": ("N3-1", "cut", "unit", 5, "연필 5자루 묶음"),
 "donut":           ("P1-1", "cut", "single", 1, "도넛 한 개(위에서 본 모습)"),
 "box_square":      ("P2-1", "cut", "box", None, "빈 도넛 상자, 정사각형"),
 "box_wide":        ("P3e-3", "cut", "box", None, "빈 도넛 상자, 가로로 긴 것"),
 "box_long":        ("P4-3", "cut", "box", None, "빈 도넛 상자, 길쭉한 것(2:1)"),
 "box_long3":       ("P4e-2", "cut", "box", None, "빈 도넛 상자, 길쭉한 것(3:1)"),
 "juice":           ("R1-4", "cut", "single", 1, "음료수 팩 한 개"),
 "juice_pack_4":    ("R2-1", "cut", "unit", 4, "음료수 팩 4개 묶음"),
 "juice_pack_3":    ("R3-3", "cut", "unit", 3, "음료수 팩 3개 묶음"),
 "kimbap":          ("R4-3", "cut", "single", 1, "삼각김밥 한 개"),
 "cupnoodle":       ("R5-3", "cut", "single", 1, "컵라면 한 개"),
 "ball":            ("R7-2", "cut", "single", 1, "공 한 개"),
 "shelf":           ("R8-2", "cut", "shelf", None, "나무 선반 판"),
 "egg_carton_6":    ("M1-1", "cut", "unit", 6, "달걀 6개가 든 달걀판"),
 "chair":           ("M2-2", "cut", "single", 1, "나무 의자 한 개"),
 "mascot_cheer":    ("D4-3", "cut", "mascot", None, "늘봄 캐릭터, 두 팔 들기"),
 "mascot_ask":      ("D5-1", "cut", "mascot", None, "늘봄 캐릭터, 갸웃하기"),
 "scene_stationery": ("S1-3", "raw", "scene", None, "문구점 안, 앞쪽에 빈 계산대"),
 "scene_bakery":    ("S2-3", "raw", "scene", None, "빵집 안, 앞쪽에 빈 계산대"),
 "scene_store":     ("S3b-4", "raw", "scene", None, "편의점 안, 앞쪽에 빈 계산대"),
 "cupnoodle_pack_3": ("R6b-2", "cut", "unit", 3, "컵라면 3개 묶음"),
}
mp = H / "selected" / "manifest.json"
man = json.loads(mp.read_text(encoding="utf-8"))
missing = []
for name, (cand, folder, kind, count, desc) in SEL.items():
    f = glob.glob(str(H / folder / f"{cand}_s*.png"))
    if not f:
        missing.append(f"{name}({cand})"); continue
    dst = H / "selected" / f"{name}.png"
    shutil.copyfile(f[0], dst)
    w, h = Image.open(dst).size
    man["items"][name] = {"file": f"selected/{name}.png", "candidate": cand, "kind": kind, "count": count, "desc": desc,
                          "width": w, "height": h, "source": "Qwen-Image 2.1 (ComfyUI, 이 PC에서 생성)"}
mp.write_text(json.dumps(man, ensure_ascii=False, indent=1), encoding="utf-8")
print("넣은 것", len(man["items"]), "/ 아직 없는 것:", ", ".join(missing) or "없음")
