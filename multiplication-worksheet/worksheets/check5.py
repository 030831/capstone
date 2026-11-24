"""5판 활동지 전체 검사 (주 세션용). 모든 묶음 x 단(1~9) x 한 번 더를 한 번에 돈다.
  python -X utf8 claude/worksheets/check5.py  -> check5_result.json
재는 것: 쪽 높이(내용이 쪽 아래 띠를 넘지 않는가), 옆 넘침, 그림의 묶음 수 = 문항의 묶음 수, 정답 = 한 묶음의 수 x 묶음 수,
보기 4개·정답 포함·중복 없음, 정답 위치 분포, 글자 크기(학생이 읽는 글 20px 이상), 누르는 대상 44px 이상,
풀이(전부 정답 / 한 번 틀린 뒤 정답 / 두 번 틀려 도움말을 본 뒤 정답), JS 오류, 빈 그림."""
import json
import re
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
HERE = Path(__file__).resolve().parent
TMP = HERE / "tmp" / "chrome5"
TMP.mkdir(parents=True, exist_ok=True)
CHROME = next(c for c in [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                          r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"] if Path(c).exists())
JS = r"""
<script>addEventListener('load',function(){setTimeout(function(){
var E=[];addEventListener('error',function(e){E.push(String(e.message))});
var W=__ws5,R={combos:0,pages:0,minSpare:1e9,minSpareAt:'',overflowPages:[],sideOverflow:[],groupMismatch:[],ansMismatch:[],optBad:[],
 minText:1e9,minTextAt:'',minTarget:1e9,minTargetAt:'',smallTargets:0,emptyImg:0,pos:[0,0,0,0],posN:0,solve:{right:0,wrong1:0,wrong2:0,total:0,fail:[]},pagesBySet:{}};
function px(e,p){return parseFloat(getComputedStyle(e)[p]);}
function measure(tag){
 document.querySelectorAll('.sheet').forEach(function(s,i){
  R.pages++;var b=s.querySelector('.body'),f=s.querySelector('.foot'),sb=s.getBoundingClientRect();
  var spare=Math.round(f.getBoundingClientRect().top-b.lastElementChild.getBoundingClientRect().bottom);
  if(spare<R.minSpare){R.minSpare=spare;R.minSpareAt=tag+' p'+(i+1);}
  if(spare<0)R.overflowPages.push(tag+' p'+(i+1)+' '+spare);
  s.querySelectorAll('.card,.note,.open,.tbl,.look,.stage *').forEach(function(c){var q=c.getBoundingClientRect();if(q.width&&(q.right>sb.right+1||q.left<sb.left-1))R.sideOverflow.push(tag+' p'+(i+1));});
  s.querySelectorAll('.q,.instr,.eq,.opt,.bubble,.note .t p:not([style]),.look,.tbl span,.cnt').forEach(function(e){if(!e.offsetParent)return;var z=px(e,'fontSize');if(z<R.minText){R.minText=z;R.minTextAt=tag+' '+e.className;}});
  s.querySelectorAll('.opt,.okb,.snd').forEach(function(e){var q=e.getBoundingClientRect();var m=Math.min(q.width,q.height);if(m<R.minTarget){R.minTarget=Math.round(m*10)/10;R.minTargetAt=tag+' '+e.className;}if(m<44)R.smallTargets++;});
  s.querySelectorAll('img').forEach(function(im){if(!im.naturalWidth)R.emptyImg++;});
 });
 R.pagesBySet[tag]=document.querySelectorAll('.sheet').length;
 W.itemsOf(W.SETS[W.S.set]).forEach(function(it){
  var k=W.key(it),c=document.querySelector('.card[data-k="'+k+'"]');
  if(!c){R.groupMismatch.push(tag+' '+it.no+' 카드 없음');return;}
  var n=c.querySelectorAll('[data-u]').length;if(n!==it.g)R.groupMismatch.push(tag+' '+it.no+' 그림 '+n+' / 문항 '+it.g);
  var last=it.blanks[it.blanks.length-1];if(last.ans!==it.m*it.g)R.ansMismatch.push(tag+' '+it.no);
  it.blanks.forEach(function(b){var o=b.opts;if(o.length!==4||o.indexOf(b.ans)<0||new Set(o).size!==4)R.optBad.push(tag+' '+it.no);R.pos[o.indexOf(b.ans)]++;R.posN++;});
 });
}
function click(c,sel){var e=c.querySelector(sel);if(e)e.click();return !!e;}
function solveAll(tag,mode){ // mode 0 전부 정답, 1 한 번 틀림, 2 두 번 틀림
 var its=W.itemsOf(W.SETS[W.S.set]);
 its.forEach(function(it){
  var k=W.key(it),guard=0;delete W.ST[k];W.build();
  for(var b=0;b<it.blanks.length;b++){
   var bl=it.blanks[b],wrongs=bl.opts.filter(function(v){return v!==bl.ans}).slice(0,mode);
   wrongs.concat([bl.ans]).forEach(function(v){var c=document.querySelector('.card[data-k="'+k+'"]');click(c,'.opt[data-v="'+v+'"]');c=document.querySelector('.card[data-k="'+k+'"]');click(c,'[data-ok]');});
  }
  var s=W.st(it),ok=s.done&&s.wrong===mode*it.blanks.length&&(mode<2||s.helped);
  R.solve.total++;if(ok)R.solve[['right','wrong1','wrong2'][mode]]++;else R.solve.fail.push(tag+' '+it.no+' mode'+mode+' done='+s.done+' wrong='+s.wrong);
 });
}
try{
for(var si=0;si<W.SETS.length;si++){
 var id=W.SETS[si].id,dans=(id==='다'||id==='마')?[1,2,3,4,5,6,7,8,9]:[2],vars=(id==='마'||id==='다')?[0]:[0,1];
 dans.forEach(function(d){vars.forEach(function(v){
  W.go(si,d,v);var tag=id+(v?"'":'')+((id==='다'||id==='마')?'@'+d:'');R.combos++;
  measure(tag);
  for(var m=0;m<3;m++)solveAll(tag,m);
  // 다 푼 상태(알아보기·정리가 열린 상태)의 쪽 높이도 잰다
  W.solve();measure(tag+' 푼 뒤');
  Object.keys(W.ST).forEach(function(k){delete W.ST[k]});
 });});
}
}catch(err){E.push('검사 중 예외: '+err+' '+(err.stack||'').slice(0,300));}
R.errors=E;R.maxPosShare=Math.max.apply(null,R.pos)/R.posN;
var p=document.createElement('pre');p.textContent='C5'+JSON.stringify(R)+'5C';document.body.appendChild(p);
},1500)});</script>"""
src = (HERE / "ws5_local.html").read_text(encoding="utf-8")
page = TMP / "check.html"
page.write_text(src.replace("</body>", JS + "</body>"), encoding="utf-8")
dom = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={TMP / 'prof'}",
                      "--force-device-scale-factor=1", "--window-size=1280,1000", "--virtual-time-budget=60000", "--dump-dom", page.as_uri()],
                     capture_output=True, timeout=600).stdout.decode("utf-8", "replace")
m = re.findall(r"C5(.*?)5C", dom, re.S)
if not m:
    print("결과를 읽지 못함", len(dom))
    sys.exit(1)
R = json.loads(m[-1].replace("&quot;", '"').replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">"))
(HERE / "check5_result.json").write_text(json.dumps(R, ensure_ascii=False, indent=1), encoding="utf-8")
for k in ("combos", "pages", "minSpare", "minSpareAt", "minText", "minTextAt", "minTarget", "minTargetAt", "smallTargets", "emptyImg", "pos", "maxPosShare", "solve", "errors"):
    print(k, ":", json.dumps(R[k], ensure_ascii=False)[:300])
for k in ("overflowPages", "sideOverflow", "groupMismatch", "ansMismatch", "optBad"):
    v = sorted(set(R[k]))
    print(k, ":", len(v), v[:14])
print("쪽 수:", sorted(set(R["pagesBySet"].values())))
