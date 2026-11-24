"""5판 활동지를 PDF로 인쇄해 쪽 수를 세고, 쪽을 그림으로 뽑는다 (주 세션용).
  python -X utf8 claude/worksheets/print5.py [묶음번호] [단] [변형]
  -> print5/s<묶음>.pdf, print5/s<묶음>_p<쪽>.png"""
import subprocess
import sys
from pathlib import Path

import pymupdf

sys.stdout.reconfigure(encoding="utf-8")
HERE = Path(__file__).resolve().parent
OUT = HERE / "print5"
OUT.mkdir(exist_ok=True)
TMP = HERE / "tmp" / "chrome5"
TMP.mkdir(parents=True, exist_ok=True)
CHROME = next(c for c in [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                          r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"] if Path(c).exists())
si = int(sys.argv[1]) if len(sys.argv) > 1 else 0
dan = int(sys.argv[2]) if len(sys.argv) > 2 else 2
var = int(sys.argv[3]) if len(sys.argv) > 3 else 0
src = (HERE / "ws5_local.html").read_text(encoding="utf-8")
inject = "<script>addEventListener('load',function(){__ws5.go(%d,%d,%d);});</script>" % (si, dan, var)
page = TMP / "print.html"
page.write_text(src.replace("</body>", inject + "</body>"), encoding="utf-8")
pdf = OUT / f"s{si}{'v' if var else ''}.pdf"
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={TMP / 'prof'}",
                "--no-pdf-header-footer", "--virtual-time-budget=4000", f"--print-to-pdf={pdf}", page.as_uri()],
               capture_output=True, timeout=180)
d = pymupdf.open(str(pdf))
print("쪽 수", d.page_count, "쪽 크기(pt)", [round(x) for x in d[0].rect[2:]])
for i in range(d.page_count):
    d[i].get_pixmap(dpi=72).save(str(OUT / f"{pdf.stem}_p{i + 1}.png"))
    txt = d[i].get_text()
    print(" ", i + 1, "쪽 글자 수", len(txt.strip()), "| 화면 전용 글이 찍혔는가:", any(w in txt for w in ("확인\n", "풀면 알아보기가", "모두 풀면 정리가")))
