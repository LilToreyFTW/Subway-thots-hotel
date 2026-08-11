from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
out = Path(__file__).resolve().parents[1] / 'build' / 'icon.ico'
out.parent.mkdir(parents=True, exist_ok=True)
size = 256
im = Image.new('RGBA', (size, size), (7, 11, 16, 255)); d = ImageDraw.Draw(im)
d.rounded_rectangle((12, 12, 244, 244), radius=48, fill=(14, 24, 31), outline=(112, 213, 223), width=8)
d.ellipse((48, 48, 208, 208), outline=(231, 187, 105), width=7)
try: font = ImageFont.truetype('DejaVuSans-Bold.ttf', 74)
except OSError: font = ImageFont.load_default()
d.text((128, 119), 'STH', font=font, anchor='mm', fill=(243, 240, 233), stroke_width=2, stroke_fill=(20, 30, 35))
im.save(out, sizes=[(256,256),(128,128),(64,64),(48,48),(32,32),(16,16)])
print(out)
