"""Generate synthetic 'in-car' test videos: a textured world panned by a camera.
Run A launches at 3.0 s, Run B creeps at 0.8-1.6 s then launches at 5.0 s and is
1.0 s slower over the first half of the course. Ground truth is printed as JSON."""
import json, subprocess, sys
import numpy as np

W, H, FPS, DUR = 640, 360, 30, 30.0
L = 3000.0  # course length in px

rng = np.random.default_rng(42)
world_w = int(L + W + 200)
base = rng.random((H // 8 + 2, world_w // 8 + 2))
# smooth upscale to get blobby, cone-ish texture
from PIL import Image
img = Image.fromarray((base * 255).astype(np.uint8)).resize((world_w, H), Image.BICUBIC)
world = np.asarray(img).astype(np.float32)
# add some vertical "cones"/posts for structure
for x in range(100, world_w, 173):
    world[H // 2:, x:x + 6] = 255

def ramp(tau, v):
    # 1 s linear acceleration to speed v, then constant
    if tau <= 0: return 0.0
    if tau < 1: return 0.5 * v * tau * tau
    return v * (tau - 0.5)

def pos_a(t):
    t0, v = 3.0, 150.0
    return min(L, ramp(t - t0, v))

def pos_b(t):
    creep = 0.0
    if 0.8 < t < 1.6: creep = (t - 0.8) / 0.8 * 30
    elif t >= 1.6: creep = 30
    t0 = 5.0
    # first half slower: reach L/2 one second later than A would
    tau = t - t0
    if tau <= 0: return creep
    # A reaches L/2 at tau_a: v*(tau-0.5)=1500 -> tau=10.5 ; B reaches at 11.5
    v1 = 1500 / 11.0  # after 1s ramp: 0.5*v1 + v1*(tau-1) = v1*(tau-0.5)
    if tau < 1: p = 0.5 * v1 * tau * tau
    elif v1 * (tau - 0.5) < 1500: p = v1 * (tau - 0.5)
    else:
        t_half = 1500 / v1 + 0.5
        p = 1500 + 150.0 * (tau - t_half)
    return creep + min(L, p)

def render(posfn, path, codec):
    args = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
            '-f', 'lavfi', '-i', f'aevalsrc=0.3*sin(2*PI*(90+60*gt(t\\,3))*t)*(0.3+0.7*gt(t\\,3)):s=44100:d={DUR}']
    if codec == 'vp9':
        args += ['-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '1500k', '-g', '30', '-c:a', 'libopus']
    else:
        args += ['-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-g', '30', '-c:a', 'aac']
    args += ['-shortest', path]
    p = subprocess.Popen(args, stdin=subprocess.PIPE)
    noise = np.random.default_rng(1)
    for i in range(int(DUR * FPS)):
        t = i / FPS
        x = posfn(t)
        x0 = int(x); fr = x - x0
        win = world[:, x0:x0 + W] * (1 - fr) + world[:, x0 + 1:x0 + 1 + W] * fr
        win = win + noise.normal(0, 3, win.shape)
        p.stdin.write(np.clip(win, 0, 255).astype(np.uint8).tobytes())
    p.stdin.close(); p.wait()

out = sys.argv[1]
render(pos_a, f'{out}/run_a.webm', 'vp9')
render(pos_b, f'{out}/run_b.webm', 'vp9')
render(pos_a, f'{out}/run_a.mp4', 'h264')
# ground truth: B's course time to reach A's position at A course time tA
def b_time_at_pos(p):
    lo, hi = 5.0, DUR
    for _ in range(60):
        mid = (lo + hi) / 2
        if pos_b(mid) < p: lo = mid  # visual match: same world position on screen
        else: hi = mid
    return lo - 5.0
truth = {tA: round(b_time_at_pos(pos_a(3.0 + tA)), 3) for tA in [2, 5, 8, 10, 12, 15, 18]}
finish_a = next(i / 100 for i in range(300, 3000) if pos_a(i / 100) >= L) - 3.0
finish_b = next(i / 100 for i in range(500, 3000) if pos_b(i / 100) - 30 >= L) - 5.0
print(json.dumps({'launchA': 3.0, 'launchB': 5.0, 'finishA': finish_a, 'finishB': finish_b, 'truth': truth}))
