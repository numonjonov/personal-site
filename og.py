#!/usr/bin/env python3
"""
Генератор картинки для превью ссылки (og.png, 1200x630).

В системе нет ни Pillow, ни конвертеров SVG, поэтому PNG собирается
вручную: пиксели в буфер, zlib для сжатия, заголовки чанков по спецификации.
Шрифт — своя точечная матрица 5x7, как и весь дизайн сайта.

Перерисовать после правок:  python3 og.py
"""

import zlib
import struct

W, H = 1200, 630          # итоговый размер
SS = 2                    # рисуем вдвое крупнее и уменьшаем — так сглаживаются диагонали
BW, BH = W * SS, H * SS

BG      = (0, 0, 0)
INK     = (236, 234, 231)
DIM     = (139, 139, 134)
GREY    = (107, 103, 98)
ACCENT  = (255, 64, 64)

buf = bytearray(BW * BH * 3)


def blend(px, py, color, alpha):
    """Кладём цвет поверх того, что уже есть, с прозрачностью."""
    if px < 0 or py < 0 or px >= BW or py >= BH or alpha <= 0:
        return
    if alpha > 1:
        alpha = 1.0
    i = (py * BW + px) * 3
    for k in range(3):
        buf[i + k] = int(buf[i + k] * (1 - alpha) + color[k] * alpha)


def fill_rect(x0, y0, x1, y1, color, alpha=1.0):
    for py in range(max(0, int(y0)), min(BH, int(y1))):
        for px in range(max(0, int(x0)), min(BW, int(x1))):
            blend(px, py, color, alpha)


def line(x0, y0, x1, y1, color, alpha, width=1):
    """Линия по Брезенхэму — толщина в пикселях увеличенного холста."""
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy

    while True:
        for ox in range(width):
            for oy in range(width):
                blend(x0 + ox, y0 + oy, color, alpha)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


# =========================================================
#  Точечный шрифт 5x7 — только те знаки, что нужны картинке
# =========================================================
FONT = {
    ' ': ("....." "....." "....." "....." "....." "....." "....."),
    'P': ("####." "#...#" "#...#" "####." "#...." "#...." "#...."),
    'N': ("#...#" "##..#" "#.#.#" "#.#.#" "#..##" "#...#" "#...#"),
    'a': ("....." "....." ".###." "....#" ".####" "#...#" ".####"),
    'h': ("#...." "#...." "#.##." "##..#" "#...#" "#...#" "#...#"),
    'l': (".##.." "..#.." "..#.." "..#.." "..#.." "..#.." ".###."),
    'v': ("....." "....." "#...#" "#...#" "#...#" ".#.#." "..#.."),
    'o': ("....." "....." ".###." "#...#" "#...#" "#...#" ".###."),
    'n': ("....." "....." "#.##." "##..#" "#...#" "#...#" "#...#"),
    'u': ("....." "....." "#...#" "#...#" "#...#" "#..##" ".##.#"),
    'm': ("....." "....." "##.#." "#.#.#" "#.#.#" "#.#.#" "#.#.#"),
    'j': ("...#." "....." "...#." "...#." "...#." "#..#." ".##.."),
    'w': ("....." "....." "#...#" "#...#" "#.#.#" "#.#.#" ".#.#."),
    'i': ("..#.." "....." ".##.." "..#.." "..#.." "..#.." ".###."),
    'p': ("....." "....." "####." "#...#" "####." "#...." "#...."),
    'z': ("....." "....." "#####" "...#." "..#.." ".#..." "#####"),
    '@': (".###." "#...#" "#.###" "#.#.#" "#.###" "#...." ".###."),
    '.': ("....." "....." "....." "....." "....." "....." "..#.."),
    '$': ("..#.." ".####" "#.#.." ".###." "..#.#" "####." "..#.."),
}


def text_width(s, dot, pitch, space):
    return len(s) * (5 * pitch + space) - space if s else 0


def draw_text(s, cx, top, dot, pitch, space, color, alpha=1.0):
    """Пишем строку точками. cx — центр по горизонтали, top — верх строки."""
    total = text_width(s, dot, pitch, space)
    x = cx - total / 2

    for ch in s:
        glyph = FONT.get(ch, FONT[' '])
        for row in range(7):
            for col in range(5):
                if glyph[row * 5 + col] == '#':
                    px = x + col * pitch
                    py = top + row * pitch
                    fill_rect(px, py, px + dot, py + dot, color, alpha)
        x += 5 * pitch + space


# =========================================================
#  Рисуем
# =========================================================
fill_rect(0, 0, BW, BH, BG)

# --- коридор: та же математика, что и на сайте ---
cx, cy = BW / 2, BH / 2
FAR, N, HALF, FOCAL = 8.0, 16, 1.0, 2.6
scale = BW * 0.62
CORNERS = [(-1, -1), (1, -1), (1, 1), (-1, 1)]

prev = None
for i in range(N - 1, -1, -1):
    z = (i / N) * FAR
    persp = FOCAL / (FOCAL + z)
    depth = 1 - z / FAR
    alpha = 0.07 + depth * 0.45
    accent = (i % 5 == 0)
    color = ACCENT if accent else INK
    width = 3 if accent else 2

    pts = [(cx + kx * HALF * persp * scale,
            cy + ky * HALF * persp * scale * 0.55) for kx, ky in CORNERS]

    for k in range(4):
        a, b = pts[k], pts[(k + 1) % 4]
        line(a[0], a[1], b[0], b[1], color, alpha, width)

    if prev:
        for k in range(4):
            line(prev[k][0], prev[k][1], pts[k][0], pts[k][1], INK, alpha * 0.5, 2)

    prev = pts

# --- затемнение под текстом, с мягкими краями чтобы не было шва ---
def dark_band(top, bottom, feather, alpha):
    top, bottom, feather = top * SS, bottom * SS, feather * SS
    for py in range(int(top - feather), int(bottom + feather)):
        if py < top:
            k = (py - (top - feather)) / feather
        elif py > bottom:
            k = ((bottom + feather) - py) / feather
        else:
            k = 1.0
        fill_rect(0, py, BW, py + 1, BG, alpha * max(0.0, min(1.0, k)))


dark_band(196, 528, 42, 0.84)

# --- текст ---
draw_text('$', (600 - 92) * SS, 214 * SS, 3 * SS, 4 * SS, 6 * SS, ACCENT)
draw_text('whoami', (600 + 22) * SS, 214 * SS, 3 * SS, 4 * SS, 6 * SS, DIM)

draw_text('Pahlavon',   600 * SS, 262 * SS, 8 * SS, 10 * SS, 12 * SS, INK)
draw_text('Numonjonov', 600 * SS, 352 * SS, 8 * SS, 10 * SS, 12 * SS, INK)

draw_text('pahlavon@numon.uz', 600 * SS, 470 * SS, 3 * SS, 4 * SS, 6 * SS, GREY)

# =========================================================
#  Уменьшаем в SS раз (усреднение) и пишем PNG
# =========================================================
out = bytearray()
for y in range(H):
    out.append(0)                                   # тип фильтра строки
    for x in range(W):
        r = g = b = 0
        for oy in range(SS):
            for ox in range(SS):
                i = ((y * SS + oy) * BW + (x * SS + ox)) * 3
                r += buf[i]; g += buf[i + 1]; b += buf[i + 2]
        n = SS * SS
        out += bytes((r // n, g // n, b // n))


def chunk(tag, data):
    return (struct.pack('>I', len(data)) + tag + data +
            struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))


png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(bytes(out), 9))
png += chunk(b'IEND', b'')

with open('og.png', 'wb') as f:
    f.write(png)

print('og.png готов: %dx%d, %d КБ' % (W, H, len(png) // 1024))
