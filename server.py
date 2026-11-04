import os
import io
import re
import time
import uuid
import base64
import shutil
import zipfile

from flask import Flask, request, jsonify, send_file, render_template, abort
from PIL import Image, ImageOps, ImageDraw, ImageFont, ImageColor

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "models"))
os.environ.setdefault("U2NET_HOME", MODEL_DIR)

FONT_CANDIDATES = [
    os.path.join(BASE_DIR, "static", "fonts", "NanumGothic-Bold.ttf"),
    os.path.join(BASE_DIR, "static", "fonts", "NanumGothic-Regular.ttf"),
    "C:/Windows/Fonts/malgunbd.ttf",
    "C:/Windows/Fonts/malgun.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
]


def get_font(size):
    for path in FONT_CANDIDATES:
        if os.path.isfile(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def apply_watermark(img, text, position, font_size, color_hex, opacity=100):
    if not text:
        return img
    img = img.convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = get_font(font_size)

    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    margin = max(10, font_size // 2)

    positions = {
        "top-left": (margin, margin),
        "top-right": (img.width - text_w - margin, margin),
        "bottom-left": (margin, img.height - text_h - margin),
        "bottom-right": (img.width - text_w - margin, img.height - text_h - margin),
        "center": ((img.width - text_w) // 2, (img.height - text_h) // 2),
    }
    xy = positions.get(position, positions["bottom-right"])
    xy = (max(0, xy[0]), max(0, xy[1]))

    r, g, b = ImageColor.getrgb(color_hex)
    alpha = max(0, min(255, round(255 * opacity / 100)))
    draw.text((xy[0] - bbox[0], xy[1] - bbox[1]), text, font=font, fill=(r, g, b, alpha))
    return Image.alpha_composite(img, overlay)


def apply_image_watermark(img, logo_bytes, position, scale_percent, opacity):
    img = img.convert("RGBA")
    logo = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")

    target_width = max(1, round(img.width * scale_percent / 100))
    if logo.width != target_width:
        ratio = target_width / logo.width
        new_size = (target_width, max(1, round(logo.height * ratio)))
        logo = logo.resize(new_size, Image.Resampling.LANCZOS)

    if opacity < 100:
        alpha_band = logo.split()[3]
        factor = max(0, min(100, opacity)) / 100
        alpha_band = alpha_band.point(lambda p: round(p * factor))
        logo.putalpha(alpha_band)

    margin = 16
    positions = {
        "top-left": (margin, margin),
        "top-right": (img.width - logo.width - margin, margin),
        "bottom-left": (margin, img.height - logo.height - margin),
        "bottom-right": (img.width - logo.width - margin, img.height - logo.height - margin),
        "center": ((img.width - logo.width) // 2, (img.height - logo.height) // 2),
    }
    xy = positions.get(position, positions["bottom-right"])
    xy = (max(0, xy[0]), max(0, xy[1]))

    img.paste(logo, xy, logo)
    return img

DATA_DIR = os.path.join(BASE_DIR, "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
OUTPUT_DIR = os.path.join(DATA_DIR, "outputs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff")
INVALID_CHARS = re.compile(r'[\\/:*?"<>|]')
SESSION_MAX_AGE = 6 * 3600


def cleanup_old_sessions():
    now = time.time()
    for root in (UPLOAD_DIR, OUTPUT_DIR):
        for name in os.listdir(root):
            path = os.path.join(root, name)
            try:
                if os.path.isdir(path) and now - os.path.getmtime(path) > SESSION_MAX_AGE:
                    shutil.rmtree(path, ignore_errors=True)
            except OSError:
                pass

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 300 * 1024 * 1024

_rembg_session = None


def sanitize_filename(name):
    return INVALID_CHARS.sub("", name).strip()


def unique_path(path):
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    i = 1
    while True:
        candidate = f"{base}_{i}{ext}"
        if not os.path.exists(candidate):
            return candidate
        i += 1


def resize_keep_ratio(img, max_side):
    w, h = img.size
    longest = max(w, h)
    if longest <= max_side:
        return img
    scale = max_side / longest
    new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
    return img.resize(new_size, Image.Resampling.LANCZOS)


def save_image(img, path, ext, quality):
    ext = ext.lower()
    if ext in (".jpg", ".jpeg"):
        img.convert("RGB").save(path, "JPEG", quality=quality, optimize=True)
    elif ext == ".png":
        img.save(path, "PNG", optimize=True)
    elif ext == ".webp":
        img.save(path, "WEBP", quality=quality)
    else:
        img.convert("RGB").save(path, quality=quality)


def get_rembg_session():
    global _rembg_session
    if _rembg_session is None:
        from rembg import new_session

        _rembg_session = new_session("u2net")
    return _rembg_session


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/upload", methods=["POST"])
def upload():
    cleanup_old_sessions()
    session_id = request.form.get("session_id") or uuid.uuid4().hex
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    items = []
    for f in request.files.getlist("photos"):
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in IMAGE_EXTS:
            continue

        item_id = uuid.uuid4().hex
        stored_name = f"{item_id}{ext}"
        stored_path = os.path.join(session_dir, stored_name)
        f.save(stored_path)

        thumb_data = ""
        try:
            img = Image.open(stored_path)
            img = ImageOps.exif_transpose(img)
            thumb = img.copy()
            thumb.thumbnail((200, 200))
            buf = io.BytesIO()
            thumb.convert("RGB").save(buf, "JPEG", quality=80)
            thumb_data = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
        except Exception:
            pass

        base_name = sanitize_filename(os.path.splitext(f.filename)[0]) or "photo"
        items.append(
            {
                "id": item_id,
                "stored_name": stored_name,
                "original_name": f.filename,
                "base_name": base_name,
                "ext": ext,
                "thumb": thumb_data,
            }
        )

    return jsonify({"session_id": session_id, "items": items})


@app.route("/api/process", methods=["POST"])
def process():
    payload = request.get_json(force=True)
    session_id = payload.get("session_id")
    quality = int(payload.get("quality", 85))
    max_side_raw = payload.get("max_side")
    max_side = int(max_side_raw) if max_side_raw else None
    output_format = payload.get("output_format", "auto")
    border_enabled = bool(payload.get("border_enabled"))
    border_width = int(payload.get("border_width") or 0)
    border_color = payload.get("border_color") or "#ffffff"
    watermark_enabled = bool(payload.get("watermark_enabled"))
    watermark_text = (payload.get("watermark_text") or "").strip()
    watermark_position = payload.get("watermark_position") or "bottom-right"
    watermark_size = int(payload.get("watermark_size") or 28)
    watermark_color = payload.get("watermark_color") or "#ffffff"
    watermark_opacity = int(payload.get("watermark_opacity") or 100)
    watermark_image_enabled = bool(payload.get("watermark_image_enabled"))
    watermark_image_data = payload.get("watermark_image_data") or ""
    watermark_image_position = payload.get("watermark_image_position") or "bottom-right"
    watermark_image_scale = int(payload.get("watermark_image_scale") or 15)
    watermark_image_opacity = int(payload.get("watermark_image_opacity") or 100)
    entries = payload.get("items", [])

    logo_bytes = None
    if watermark_image_enabled and watermark_image_data:
        try:
            b64data = watermark_image_data.split(",", 1)[1] if "," in watermark_image_data else watermark_image_data
            logo_bytes = base64.b64decode(b64data)
        except Exception:
            logo_bytes = None

    session_upload_dir = os.path.join(UPLOAD_DIR, session_id or "")
    if not session_id or not os.path.isdir(session_upload_dir):
        abort(400, "invalid session")

    session_output_dir = os.path.join(OUTPUT_DIR, session_id)
    if os.path.isdir(session_output_dir):
        shutil.rmtree(session_output_dir)
    os.makedirs(session_output_dir, exist_ok=True)

    need_nuki = any(e.get("nuki") for e in entries)
    session = get_rembg_session() if need_nuki else None

    results = []
    errors = []
    for entry in entries:
        stored_name = entry.get("stored_name", "")
        keyword = sanitize_filename((entry.get("keyword") or "").strip())
        base_name = sanitize_filename(entry.get("base_name") or "photo") or "photo"
        use_nuki = bool(entry.get("nuki"))

        src_path = os.path.join(session_upload_dir, stored_name)
        if not os.path.isfile(src_path):
            errors.append(f"{stored_name}: 파일을 찾을 수 없음")
            continue

        try:
            ext = os.path.splitext(stored_name)[1].lower()
            img = Image.open(src_path)
            img = ImageOps.exif_transpose(img)

            if use_nuki:
                from rembg import remove

                img = img.convert("RGBA")
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                result_bytes = remove(buf.getvalue(), session=session)
                img = Image.open(io.BytesIO(result_bytes)).convert("RGBA")
                out_ext = ".webp"
            elif output_format == "jpg":
                out_ext = ".jpg"
            elif output_format == "png":
                out_ext = ".png"
            elif output_format == "webp":
                out_ext = ".webp"
            else:
                out_ext = ext if ext in IMAGE_EXTS else ".jpg"

            if max_side:
                img = resize_keep_ratio(img, max_side)

            if watermark_enabled and watermark_text:
                img = apply_watermark(
                    img, watermark_text, watermark_position, watermark_size, watermark_color, watermark_opacity
                )

            if logo_bytes:
                img = apply_image_watermark(
                    img, logo_bytes, watermark_image_position, watermark_image_scale, watermark_image_opacity
                )

            if border_enabled and border_width > 0:
                img = ImageOps.expand(img, border=border_width, fill=border_color)

            out_name = f"{base_name}_{keyword}{out_ext}" if keyword else f"{base_name}{out_ext}"
            out_path = unique_path(os.path.join(session_output_dir, out_name))
            save_image(img, out_path, out_ext, quality)
            results.append(os.path.basename(out_path))
        except Exception as exc:
            errors.append(f"{stored_name}: {exc}")

    return jsonify({"results": results, "errors": errors, "session_id": session_id})


@app.route("/api/file/<session_id>/<path:filename>")
def get_file(session_id, filename):
    session_output_dir = os.path.realpath(os.path.join(OUTPUT_DIR, session_id))
    target = os.path.realpath(os.path.join(session_output_dir, filename))
    if not target.startswith(session_output_dir + os.sep) or not os.path.isfile(target):
        abort(404)
    return send_file(target)


@app.route("/api/download/<session_id>")
def download_zip(session_id):
    session_output_dir = os.path.join(OUTPUT_DIR, session_id)
    if not os.path.isdir(session_output_dir):
        abort(404)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in os.listdir(session_output_dir):
            zf.write(os.path.join(session_output_dir, name), name)
    buf.seek(0)
    return send_file(buf, mimetype="application/zip", as_attachment=True, download_name="photos.zip")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
