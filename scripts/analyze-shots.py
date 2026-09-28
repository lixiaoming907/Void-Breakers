from PIL import Image, ImageStat, ImageFilter

for name in ['show-active.png', 'show-smoke.png']:
    path = rf'E:\XiaomiMiMoProjects\2026-09-28\new-chat-2\voidbreakers\artifacts\{name}'
    im = Image.open(path).convert('RGB')
    w, h = im.size
    print('====', name, im.size)
    for gy in range(3):
        row = []
        for gx in range(4):
            box = (gx * w // 4, gy * h // 3, (gx + 1) * w // 4, (gy + 1) * h // 3)
            crop = im.crop(box)
            st = ImageStat.Stat(crop)
            mean = tuple(round(x, 1) for x in st.mean)
            edges = crop.convert('L').filter(ImageFilter.FIND_EDGES)
            est = ImageStat.Stat(edges)
            row.append(f'{mean}/e{est.mean[0]:.1f}')
        print(' | '.join(row))
    px = im.load()
    bright = cyan = magenta = amber = 0
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            r, g, b = px[x, y]
            if r + g + b > 420:
                bright += 1
            if b > 140 and g > 120 and r < 120:
                cyan += 1
            if r > 140 and b > 100 and g < 100:
                magenta += 1
            if r > 160 and g > 120 and b < 90:
                amber += 1
    print('bright', bright, 'cyan', cyan, 'magenta', magenta, 'amber', amber)
