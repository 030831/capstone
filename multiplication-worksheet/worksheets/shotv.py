"""새 화면(단계 목록, 단계, 한 문제)을 캡처한다. python -X utf8 shotv.py 해시 이름 [너비] [높이] [실행할JS]"""
import subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
H = Path(__file__).resolve().parent
T = H / "tmp" / "chrome5"; T.mkdir(parents=True, exist_ok=True)
CH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
h, name = sys.argv[1], sys.argv[2]
w = sys.argv[3] if len(sys.argv) > 3 else "1280"; hh = sys.argv[4] if len(sys.argv) > 4 else "1400"
js = sys.argv[5] if len(sys.argv) > 5 else ""
src = (H / "ws5_local.html").read_text(encoding="utf-8")
p = T / "v.html"
src = src.replace("<body>", "<body><script>history.replaceState(null,'','%s')</script>" % h, 1)
p.write_text(src.replace("</body>", "<script>addEventListener('load',function(){setTimeout(function(){%s},200)})</script></body>" % js), encoding="utf-8")
out = H / "shots5" / f"v_{name}.png"
subprocess.run([CH, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={T/'prof'}", "--force-device-scale-factor=1",
                f"--window-size={w},{hh}", "--virtual-time-budget=4000", f"--screenshot={out}", p.as_uri()], capture_output=True, timeout=120)
print(out)
