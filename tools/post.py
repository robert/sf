"""Watercolour finishing pass: pigment-density model with uneven washes,
granulation, edge darkening, wet bleeding, back-runs and cold-press paper."""
import sys
import numpy as np
from PIL import Image

rng = np.random.default_rng(3)


def box(a, r):
    if r < 1:
        return a
    pad = [(r, r), (0, 0)] + [(0, 0)] * (a.ndim - 2)
    p = np.pad(a, pad, mode='edge')
    c = np.cumsum(p, axis=0)
    c = np.concatenate([np.zeros_like(c[:1]), c], axis=0)
    out = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)
    p = np.pad(out, [(0, 0), (r, r)] + [(0, 0)] * (a.ndim - 2), mode='edge')
    c = np.cumsum(p, axis=1)
    c = np.concatenate([np.zeros_like(c[:, :1]), c], axis=1)
    return (c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)


def blur(a, r):
    r = max(1, int(r / 1.7))
    for _ in range(3):
        a = box(a, r)
    return a


def noise(h, w, cell, octaves=4, persistence=0.55):
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gh, gw = max(2, int(h / cell) + 2), max(2, int(w / cell) + 2)
        g = rng.random((gh, gw)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += amp * (np.asarray(im, np.float32) / 255.0)
        tot += amp
        amp *= persistence
        cell /= 2.0
    return out / tot


def process(src, dst, strength=1.0):
    img = np.asarray(Image.open(src).convert('RGB'), np.float32) / 255.0
    h, w, _ = img.shape
    paper = np.array([0.985, 0.972, 0.94], np.float32)

    # 1. pigment density relative to paper
    D = -np.log(np.clip(img / paper, 0.02, 1.0))

    # 2. wet bleed: blend density with a blurred copy in patches
    wet = np.clip((noise(h, w, 260, 3) - 0.45) * 3.0, 0, 1)[..., None]
    D = D * (1 - 0.55 * wet) + blur(D, 9) * 0.55 * wet

    # 3. edge darkening: pigment collects where a wash dries
    Db = blur(D, 5)
    edge = np.clip(D - Db, 0, None)
    D = D + 1.25 * edge * strength

    # 4. uneven wash (low-frequency density variation)
    low = noise(h, w, 180, 4)
    D = D * (0.78 + 0.44 * low[..., None])

    # 5. back-runs / cauliflower blooms: lighter rings in mid-density areas
    bl = noise(h, w, 70, 3)
    ring = np.exp(-((bl - 0.62) ** 2) / 0.0018)
    D = D * (1 - 0.16 * ring[..., None] * np.clip(D.mean(-1, keepdims=True) * 3, 0, 1))

    # 6. granulation: fine pigment speckle, stronger in dense areas
    gran = noise(h, w, 2.5, 2, 0.6)
    D = D * (0.9 + 0.2 * gran[..., None])

    # 7. cold-press paper: embossed tooth and fibres
    tooth = noise(h, w, 5, 2, 0.5)
    gy, gx = np.gradient(blur(tooth, 2))
    shade = np.clip(1 + (gx - gy) * 0.9, 0.992, 1.008)
    out = paper * np.exp(-D)
    # pigment settles in paper valleys
    out = out * (1 - 0.012 * (tooth[..., None] - 0.5))
    out = out * shade[..., None]
    out = np.clip(out, 0, 1)
    Image.fromarray((out * 255).astype(np.uint8)).save(dst, quality=82, optimize=True, progressive=True)


if __name__ == '__main__':
    process(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 1.0)
