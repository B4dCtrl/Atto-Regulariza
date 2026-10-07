#!/usr/bin/env python3
"""Gera a v2 do Reels da Ato: narração pausada + composição com tempos guiados pela fala."""
import json, math, os, re, shutil, subprocess, sys

BASE = "/home/claude/b4dctrl/atto-regulariza/brag-output-2026-10-07-105310"
VOICE = sys.argv[1]
OUT = f"{BASE}/composition-v3-{VOICE}"
SRC = open(f"{BASE}/composition/index.html", encoding="utf-8").read()

SCENES = [
    ("s1", [("a1", "Problemas com os documentos da sua casa? Calma. Que tem jeito!", 1.0)]),
    ("s2", [("b1", "Cartório!", 1.0), ("b2", "Prefeitura!", 1.0), ("b3", "E a papelada.", 1.0), ("b4", "Ninguém aguenta.", 1.0)]),
    ("s3", [("c1", "A Ato Regulariza resolve isso.", 1.0), ("c2", "Em meses, não em anos.", 1.0)]),
    ("s4", [
        ("d1", "Você nos conta o problema.", 1.0),
        ("d2", "Em até vinte e quatro horas, alguém assume o seu caso.", 1.0),
        ("d3", "Você só envia os documentos que a gente pedir.", 1.0),
        ("d4", "E acompanha tudo em tempo real.", 1.0),
        ("d5", "Aí é só esperar. A matrícula chega nas suas mãos.", 1.0),
    ]),
    ("s5", [("e1", "Cada etapa visível, com prazo e responsável.", 1.0)]),
    ("s6", [("f1", "Quer saber se o seu dá pra regularizar?", 1.0), ("f2", "Chama a gente no zap.", 1.0), ("f3", "A avaliação é de graça.", 1.0)]),
]
GAP = {"s2": 0.4, "s3": 0.3}
PAD_START, PAD_END, TAIL_S6 = 0.2, 0.35, 1.4

# ---------- projeto ----------
if os.path.exists(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
shutil.copytree(f"{BASE}/composition/assets", f"{OUT}/assets", ignore=shutil.ignore_patterns("vo"))
for f in ["hyperframes.json", "AGENTS.md", "CLAUDE.md", "package.json"]:
    shutil.copy(f"{BASE}/composition/{f}", f"{OUT}/{f}")
open(f"{OUT}/meta.json", "w").write(json.dumps({"id": "composition", "name": f"ato-reels-v3-{VOICE}", "createdAt": "2026-10-07T14:20:00.000Z"}, indent=2))
os.makedirs(f"{OUT}/assets/vo")

# ---------- narração ----------
dur = {}
for sid, segs in SCENES:
    for k, text, speed in segs:
        wav = f"{OUT}/assets/vo/{k}.wav"
        subprocess.run(["python3", "-I", "/home/claude/tools/piper_tts.py", VOICE, str(speed), text, wav],
                       check=True, stdout=subprocess.DEVNULL)
        dur[k] = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]).decode().strip())
        print(k, round(dur[k], 2), flush=True)

# ---------- linha do tempo ----------
t = 0.0
seg, scene = {}, {}
for sid, segs in SCENES:
    s0 = t
    t += PAD_START
    gap = GAP.get(sid, 0.3)
    for i, (k, _, _) in enumerate(segs):
        seg[k] = (t, dur[k])
        t += dur[k] + (gap if i < len(segs) - 1 else 0)
    t += PAD_END + (TAIL_S6 if sid == "s6" else 0)
    scene[sid] = (s0, t - s0)
TOTAL = round(t, 2)
print("TOTAL", TOTAL, flush=True)
S = lambda sid: scene[sid][0]
E = lambda sid: scene[sid][0] + scene[sid][1]
st = lambda k: seg[k][0]
dr = lambda k: seg[k][1]

# ---------- HTML ----------
style = re.search(r"<style>(.*?)</style>", SRC, re.S).group(1)
style = style.replace(
    "#lockupCard { position: absolute; left: 190px; top: 250px; width: 700px; height: 330px; border-radius: 44px; background: var(--bg); display: flex; align-items: center; justify-content: center; }",
    "#lockupCard { position: absolute; left: 140px; top: 260px; width: 800px; height: 330px; display: flex; align-items: center; justify-content: center; }")
style = style.replace("#lockupCard img { width: 560px;", "#lockupCard img { width: 720px;")

body = re.search(r"(<!-- ============ S1.*?)<!-- ============ ÁUDIO", SRC, re.S).group(1)
for sid, (a, b) in scene.items():
    body, n = re.subn(rf'(<section id="{sid}" class="clip scene" data-start=")[^"]*(" data-duration=")[^"]*"',
                      rf'\g<1>{a:.2f}\g<2>{b:.2f}"', body)
    assert n == 1, sid
for a, b in [('<div id="sem" class="serif">Em semanas,</div>', '<div id="sem" class="serif">Em meses,</div>'),
             ('<span id="meses">meses<span id="strike"></span></span>', '<span id="meses">anos<span id="strike"></span></span>')]:
    assert a in body, a
    body = body.replace(a, b)

audio = []
vol = json.dumps({"version": 1, "lanes": [{"target": "volume", "points": [
    {"t": 0, "v": 0}, {"t": 0.8, "v": 1}, {"t": round(TOTAL - 1.4, 2), "v": 1}, {"t": TOTAL, "v": 0}]}]})
audio.append(f"<audio id=\"bed\" src=\"assets/music/bed.mp3\" data-start=\"0\" data-duration=\"{TOTAL}\" data-track-index=\"10\" data-volume=\"0.16\" data-automation='{vol}'></audio>")
for k in seg:
    audio.append(f'<audio id="vo_{k}" src="assets/vo/{k}.wav" data-start="{st(k):.2f}" data-duration="{dr(k)+0.05:.2f}" data-track-index="11" data-volume="1"></audio>')
sfx_list = []
def sfx(file, at, d, v):
    sfx_list.append((file, at, d, v))
for k in ("b1", "b2", "b3"):
    sfx("drop_003", st(k) - 0.05, 0.2, 0.5)
for k in ("d1", "d2", "d3", "d4", "d5"):
    sfx("switch_004", st(k) - 0.05, 0.5, 0.45)
sfx("select_008", st("e1") + 0.45, 0.1, 0.5)
sfx("drop_002", st("f1"), 0.2, 0.55)
for i, (f, at, d, v) in enumerate(sfx_list):
    audio.append(f'<audio id="sx{i}" src="assets/sfx/{f}.ogg" data-start="{at:.2f}" data-duration="{d}" data-track-index="{12 + i % 2}" data-volume="{v}"></audio>')

# ---------- JS ----------
SLAM = '{ opacity: 1, y: 0, scale: 1, duration: 0.38, ease: "back.out(1.8)" }'
FROM = lambda y, s: "{ opacity: 0, y: %d, scale: %s }" % (y, s)
fr = lambda sel, a, b, at: 'tl.fromTo("%s", %s, %s, %.2f);' % (sel, a, b, at)
js = []
# S1
s = S("s1"); a = st("a1"); d = dr("a1")
js.append(fr(".lot", "{ strokeDasharray: 1, strokeDashoffset: 1 }", '{ strokeDashoffset: 0, duration: 0.9, ease: "power2.out", stagger: 0.05 }', s + 0.05))
js.append(fr("#lotHot", "{ opacity: 0 }", '{ opacity: 1, duration: 0.25, ease: "power2.out" }', s + 0.7))
js.append(fr("#lotTag", "{ opacity: 0, y: 24 }", '{ opacity: 1, y: 0, duration: 0.35, ease: "back.out(1.7)" }', s + 1.1))
js.append(fr("#hw1", FROM(70, 1.25), SLAM, a + 0.05))
js.append(fr("#hw2", FROM(70, 1.25), SLAM, a + 0.40 * d))
js.append(fr("#hw3", FROM(70, 1.25), SLAM, a + 0.68 * d))
# S2
for cid, k, rot0, rot1 in (("#c1", "b1", -14, -4), ("#c2", "b2", 12, 3), ("#c3", "b3", -12, -2)):
    js.append(fr(cid, "{ opacity: 0, y: -900, rotation: %d }" % rot0,
                 '{ opacity: 1, y: 0, rotation: %d, duration: 0.42, ease: "back.out(1.4)" }' % rot1, st(k) - 0.1))
js.append(fr("#nobody", FROM(60, 1.2), SLAM, st("b4")))
# S3
js.append(fr("#lockupCard", "{ opacity: 0, y: 80, scale: 0.9 }", '{ opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(1.6)" }', S("s3") + 0.1))
js.append(fr("#solve", "{ opacity: 0, y: 30 }", '{ opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }', st("c1") + 0.55 * dr("c1")))
js.append(fr("#sem", FROM(80, 1.2), SLAM, st("c2") - 0.05))
js.append(fr("#nao", FROM(80, 1.2), SLAM, st("c2") + 0.5 * dr("c2")))
js.append(fr("#strike", "{ scaleX: 0 }", '{ scaleX: 1, duration: 0.3, ease: "power3.out" }', st("c2") + 0.82 * dr("c2")))
# S4
steps = [("#p1", "d1", 1), ("#p2", "d2", 2), ("#p3", "d3", 3), ("#p4", "d4", 4), ("#p5", "d5", 5)]
for i, (pid, k, n) in enumerate(steps):
    t0 = st(k) - 0.05
    t1 = (st(steps[i + 1][1]) - 0.05) if i < 4 else E("s4")
    js.append(fr(pid, "{ opacity: 0, x: 90 }", '{ opacity: 1, x: 0, duration: 0.32, ease: "power3.out" }', t0))
    if i < 4:
        js.append('tl.to("%s", { opacity: 0, x: -90, duration: 0.22, ease: "power2.in" }, %.2f);' % (pid, t1 - 0.22))
    js.append('tl.to("#d%d", { backgroundColor: "#EA6134", borderColor: "#EA6134", color: "#FBF9F6", duration: 0.2 }, %.2f);' % (n, t0))
    js.append('tl.to("#railFill", { width: %d, duration: 0.3, ease: "power2.out" }, %.2f);' % ((n - 1) * 185, t0))
js.append(fr("#p1pill", "{ opacity: 0, scale: 0.7 }", '{ opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }', st("d1") + 0.3))
js.append('tl.to("#p1pill", { scale: 0.93, duration: 0.1, yoyo: true, repeat: 1 }, %.2f);' % (st("d1") + 0.95))
js.append(fr("#p2 .avatar", "{ opacity: 0, scale: 0.6 }", '{ opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }', st("d2") + 0.3))
js.append(fr("#p2pill", "{ opacity: 0, x: -40 }", '{ opacity: 1, x: 0, duration: 0.3, ease: "power3.out" }', st("d2") + 0.9))
for i, rid in enumerate(("#r1", "#r2", "#r3")):
    js.append(fr(rid, "{ opacity: 0, x: -50 }", '{ opacity: 1, x: 0, duration: 0.3, ease: "power3.out" }', st("d3") + 0.25 + i * 0.5))
js.append(fr("#liveDot", "{ scale: 1 }", '{ scale: 1.6, duration: 0.45, ease: "sine.inOut", yoyo: true, repeat: 3 }', st("d4") + 0.3))
js.append(fr("#p5casa", "{ opacity: 0, y: 40, scale: 0.8 }", '{ opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(1.8)" }', st("d5") + 1.1))
# S5
s5 = S("s5")
js.append(fr("#cap5", "{ opacity: 0, y: 50 }", '{ opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }', s5 + 0.1))
js.append(fr("#cap5b", "{ opacity: 0, y: 30 }", '{ opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }', s5 + 0.45))
js.append(fr("#panel", "{ opacity: 0, y: 120 }", '{ opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.4)" }', s5 + 0.05))
js.append(fr("#barFill", '{ width: "0%" }', '{ width: "68%", duration: 0.7, ease: "power2.out" }', st("e1") + 0.2))
for i, gid in enumerate(("#g1", "#g2", "#g3", "#g4", "#g5")):
    js.append(fr(gid, "{ opacity: 0, x: 40 }", '{ opacity: 1, x: 0, duration: 0.25, ease: "power3.out" }', st("e1") + 0.3 + i * 0.14))
# S6
s6 = S("s6")
js.append(fr("#casa", "{ opacity: 0, y: -80, scale: 0.7 }", '{ opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.8)" }', s6 + 0.05))
js.append(fr("#ask", FROM(90, 1.25), SLAM, st("f1")))
js.append(fr("#btnWrap", "{ opacity: 0, y: 70 }", '{ opacity: 1, y: 0, duration: 0.45, ease: "back.out(1.7)" }', st("f2")))
rem = E("s6") - (st("f2") + 0.7)
rep = max(1, int(rem / 0.5) - 1)
js.append(fr("#btn", "{ scale: 1 }", '{ scale: 1.06, duration: 0.5, ease: "sine.inOut", yoyo: true, repeat: %d }' % rep, st("f2") + 0.7))
js.append(fr("#bio", "{ opacity: 0 }", "{ opacity: 1, duration: 0.4 }", st("f3")))

html = f"""<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>Ato Regulariza — Reels v2</title>
    <script src="assets/gsap.min.js"></script>
    <style>{style}</style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="1080" data-height="1920" data-duration="{TOTAL}">
{body}
      {chr(10).join("      " + a for a in audio).strip()}
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join("      " + j for j in js)}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""
open(f"{OUT}/index.html", "w", encoding="utf-8").write(html)
json.dump({"total": TOTAL, "scene": scene, "seg": seg}, open(f"{OUT}/timing.json", "w"), indent=1)
print("OK", OUT)
