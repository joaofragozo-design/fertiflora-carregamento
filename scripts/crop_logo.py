from PIL import Image
import numpy as np

SRC = r"C:\Users\lenov\Downloads\Logotipo para Aplicativos de Organização Azul e Laranja _20260709_133357_0000.png"
DST = r"C:\Projetos\FertiFloraCarregamento\scripts\logo_cropped.png"

im = Image.open(SRC).convert("RGB")
arr = np.array(im)

# background color = top-left corner pixel
bg = arr[0, 0].astype(int)
diff = np.abs(arr.astype(int) - bg).sum(axis=2)
mask = diff > 12  # non-background pixels

ys, xs = np.where(mask)
pad = 20
x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, arr.shape[1])
y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, arr.shape[0])

cropped = im.crop((x0, y0, x1, y1))

# put on transparent background
rgba = cropped.convert("RGBA")
data = np.array(rgba)
bgmask = np.abs(data[:, :, :3].astype(int) - bg).sum(axis=2) <= 12
data[:, :, 3] = np.where(bgmask, 0, 255)
out = Image.fromarray(data, mode="RGBA")
out.save(DST)
print("bbox:", x0, y0, x1, y1, "size:", out.size)
