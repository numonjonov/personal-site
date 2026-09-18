#!/usr/bin/env python3
"""
Генератор картинки для превью ссылки (og.png, 1200x630).

В системе нет ни Pillow, ни конвертеров SVG, поэтому PNG собирается
вручную: пиксели в буфер, zlib для сжатия, заголовки чанков по спецификации.
Шрифт — своя точечная матрица 5x7, как и весь дизайн сайта.

Цвета — те же --paper / --ink, что в styles.css: чёрные буквы на светлом
листе, а не терминал v1. Правите палитру сайта — поправьте и здесь.

Перерисовать после правок:  python3 og.py
"""

import zlib
import struct

W, H = 1200, 630          # итоговый размер
SS = 2                    # рисуем вдвое крупнее и уменьшаем — так сглаживаются диагонали
BW, BH = W * SS, H * SS

BG      = (232, 232, 230)   # --paper
INK     = (10, 10, 10)      # --ink
DIM     = (95, 95, 92)
GREY    = (140, 140, 136)

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
    'c': ("....." "....." ".###." "#...." "#...." "#...." ".###."),
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

# --- линейка с делениями по верхнему и нижнему краю, как на сайте ---
def ruler(y, up):
    step = 24 * SS
    for i, x in enumerate(range(0, BW + step, step)):
        tall = (i % 5 == 0)
        h = (18 if tall else 9) * SS
        y1 = y - h if up else y + h
        line(x, y, x, y1, INK, 0.5 if tall else 0.28, 1 * SS)


ruler(14 * SS, up=False)
ruler((H - 14) * SS, up=True)

# --- текст: имя во весь кадр, тем же кеглем, что и заголовок сайта ---
draw_text('Pahlavon',   600 * SS, 236 * SS, 8 * SS, 10 * SS, 12 * SS, INK)
draw_text('Numonjonov', 600 * SS, 326 * SS, 8 * SS, 10 * SS, 12 * SS, INK)

draw_text('pahlavon@numonjonov.com', 600 * SS, 430 * SS, 3 * SS, 4 * SS, 6 * SS, DIM)
draw_text('numonjonov.com',          600 * SS, 466 * SS, 3 * SS, 4 * SS, 6 * SS, GREY)

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
