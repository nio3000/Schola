# schola_marker_bridge.py — Phase 4-0-C-IMP-4
# Minimal Marker conversion bridge for Schola.
# Reads JSON from stdin, writes JSON to stdout, errors to stderr.
#
# Usage: python3 schola_marker_bridge.py < input.json > output.json
#
# Security: no shell=True, no os.system, no network, vault paths only.

import json
import sys
import os
from pathlib import Path


def main():
    # Prevent auto model download
    os.environ.setdefault('HF_HUB_OFFLINE', '1')
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            fail("EMPTY_INPUT", "No input received on stdin.")

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            fail("INVALID_JSON", f"Failed to parse input JSON: {e}")

        # Validate required fields
        attachment_path = data.get("attachment_path")
        output_dir = data.get("output_dir")
        if not attachment_path or not output_dir:
            fail("MISSING_FIELDS", "attachment_path and output_dir are required.")

        options = data.get("options", {})

        # Run Marker conversion
        try:
            from marker.convert import convert_single_pdf
            from marker.models import load_all_models
        except ImportError:
            fail("MARKER_NOT_INSTALLED", "marker-pdf package not installed. Run: pip install marker-pdf")

        src = Path(attachment_path)
        if not src.exists():
            fail("FILE_NOT_FOUND", f"Attachment not found.")
        if not src.is_file():
            fail("NOT_A_FILE", "Attachment path is not a file.")

        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        # Load models (offline only — HF_HUB_OFFLINE=1 set above)
        try:
            model_lst = load_all_models()
        except Exception as e:
            fail("MODELS_NOT_FOUND", "ML models not found. Download models first by running Marker once with network access, then retry.")

        full_text, images, out_meta = convert_single_pdf(
            src,
            model_lst,
            max_pages=options.get("max_pages"),
            langs=options.get("languages"),
        )

        # Write markdown output
        md_path = out / "output.md"
        md_path.write_text(full_text, encoding="utf-8")

        # Write images
        img_dir = out / "images"
        img_dir.mkdir(exist_ok=True)
        image_names = []
        for i, img_data in enumerate(images):
            name = f"image_{i + 1}.png"
            (img_dir / name).write_bytes(img_data)
            image_names.append(name)

        success({
            "ok": True,
            "markdown_path": str(md_path),
            "images_dir": str(img_dir),
            "page_count": out_meta.get("page_count", 0) if out_meta else 0,
            "warnings": [],
            "metadata": {
                "language_detected": out_meta.get("language", "unknown") if out_meta else "unknown",
            },
        })

    except Exception as e:
        # Sanitize traceback: only return error message, no paths
        msg = str(e)
        fail("CONVERSION_FAILED", sanitize_error(msg))


def success(data: dict):
    json.dump(data, sys.stdout, ensure_ascii=False)
    sys.stdout.flush()
    sys.exit(0)


def fail(code: str, message: str):
    json.dump({"ok": False, "error_code": code, "error_message": sanitize_error(message)}, sys.stdout, ensure_ascii=False)
    sys.stdout.flush()
    # Write sanitized traceback to stderr (not exposed to renderer)
    sys.stderr.write(f"[BRIDGE_ERROR] {code}: {sanitize_error(message)}\n")
    sys.stderr.flush()
    sys.exit(1)


def sanitize_error(msg: str) -> str:
    """Remove absolute paths and limit output size."""
    msg = msg[:500]
    # Remove common path patterns
    import re
    msg = re.sub(r'[A-Za-z]:\\[^\s,;]+', '<path>', msg)  # Windows paths
    msg = re.sub(r'/[^\s,;]{3,}/', '<path>/', msg)          # Unix paths
    return msg


if __name__ == "__main__":
    main()
