"""5판 활동지의 쪽을 캡처하고 쪽 높이를 잰다 (주 세션용).
  python -X utf8 claude/worksheets/shot5.py [묶음번호 0~4] [단] [변형 0/1] [solve 0/1]
  -> shots5/s<묶음>_p<쪽>.png, 그리고 쪽마다 내용이 1075px 안에 들어가는지 출력"""
import json
import re
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
HERE = Path(__file__).resolve().parent
OUT = HERE / "shots5"
OUT.mkdir(exist_ok=True)
TMP = HERE / "tmp" / "chrome5"
TMP.mkdir(parents=True, exist_ok=True)
CHROME = next(c for c in [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                          r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"] if Path(c).exists())
si = int(sys.argv[1]) if len(sys.argv) > 1 else 0
dan = int(sys.argv[2]) if len(sys.argv) > 2 else 2
var = int(sys.argv[3]) if len(sys.argv) > 3 else 0
solve = int(sys.argv[4]) if len(sys.argv) > 4 else 0

src = (HERE / "ws5_local.html").read_text(encoding="utf-8")
# 활동지만 남기고(머리말·도구 줄 숨김) 쪽을 세로로 붙여 찍는다. 높이 검사 결과는 DOM에 적는다.
inject = """<style>.site-header,.page-heading,.toolbar,.teacher,.site-footer{display:none!important}main{padding:0!important;max-width:none!important}
.sheet-wrap{padding:10px!important;background:#888!important;border-radius:0!important}.outer{margin:0 0 10px!important}</style>
<script>addEventListener('load',function(){setTimeout(function(){
 var E=[];addEventListener('error',function(e){E.push(String(e.message))});
 try{__ws5.go(%d,%d,%d);%s}catch(e){E.push(String(e))}
 var r=[];document.querySelectorAll('.sheet').forEach(function(s,i){
   var body=s.querySelector('.body'),foot=s.querySelector('.foot');
   var last=body.lastElementChild,lb=last.getBoundingClientRect().bottom,ft=foot.getBoundingClientRect().top,sb=s.getBoundingClientRect();
   var over=0;s.querySelectorAll('.card,.note,.open,.tbl,.look').forEach(function(c){var b=c.getBoundingClientRect();if(b.right>sb.right+1||b.left<sb.left-1)over++;
     c.querySelectorAll('*').forEach(function(x){var q=x.getBoundingClientRect();if(q.width&&(q.right>b.right+2||q.left<b.left-2))over++;});});
   r.push({page:i+1,contentBottom:Math.round(lb-sb.top),footTop:Math.round(ft-sb.top),spare:Math.round(ft-lb),sideOverflow:over});});
 var p=document.createElement('pre');p.id='R';p.textContent='R5'+JSON.stringify({pages:r,errors:E,n:document.querySelectorAll('.card').length})+'5R';document.body.appendChild(p);
},1500)});</script>""" % (si, dan, var, "__ws5.solve();" if solve == 1 else ("__ws5.itemsOf(__ws5.SETS[__ws5.S.set]).forEach(function(i){var s=__ws5.st(i);for(var k=0;k<Math.min(3,i.g);k++)s.tapped[k]=++s.taps;});__ws5.build();" if solve == 2 else ""))
page = TMP / "page.html"
page.write_text(src.replace("</body>", inject + "</body>"), encoding="utf-8")
name = "s%d%s%s" % (si, "v" if var else "", {0: "", 1: "_done", 2: "_tap"}[solve])
common = [CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", f"--user-data-dir={TMP / 'prof'}",
          "--force-device-scale-factor=1", "--virtual-time-budget=6000"]
dom = subprocess.run(common + ["--window-size=780,3400", "--dump-dom", page.as_uri()], capture_output=True, timeout=120).stdout.decode("utf-8", "replace")
m = re.findall(r"R5(.*?)5R", dom, re.S)
info = json.loads(m[-1].replace("&quot;", '"').replace("&amp;", "&")) if m else None
print(json.dumps(info, ensure_ascii=False))
n = len(info["pages"]) if info else 3
full = OUT / f"{name}_all.png"
subprocess.run(common + [f"--window-size=780,{n * 1085 + 20}", f"--screenshot={full}", page.as_uri()], capture_output=True, timeout=120)
from PIL import Image
im = Image.open(full)
for i in range(n):
    im.crop((10, 10 + i * 1085, 770, 10 + i * 1085 + 1075)).save(OUT / f"{name}_p{i + 1}.png")
print("saved", name, n, "pages")
