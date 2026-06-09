#!/usr/bin/env python3
"""
PyMuPDF4LLM import bridge — Phase 3-4-I-ENG-2.

Converts a PDF to Markdown using pymupdf4llm.to_markdown().
Outputs a single JSON line to stdout; writes Markdown and images to
main-process-provided safe absolute paths.

Usage:
  python pymupdf4llm_convert.py \
    --input-pdf <absPath> \
    --output-md <absPath> \
    --assets-dir <absPath> \
    --job-id <jobId>

Stdout: a single JSON object (see contract below).
Stderr: only fatal errors — NOT parsed by the main process.

Contract (success):
  {"ok":true,"pageCount":12,"markdownBytes":45678,"imageCount":5,"tableCount":3,"warnings":[]}

Contract (failure):
  {"ok":false,"errorCode":"PYMUPDF4LLM_NOT_AVAILABLE","message":"PyMuPDF4LLM not installed."}
"""

import argparse
import json
import os
import sys
import traceback

# ── Helpers ────────────────────────────────────────

def _fail(error_code: str, message: str) -> None:
    """Print a failure JSON and exit 0 (not an OS error)."""
    json.dump({"ok": False, "errorCode": error_code, "message": message}, sys.stdout)
    sys.stdout.flush()
    sys.exit(0)


def _success(page_count, markdown_bytes, image_count, table_count, warnings):
    """Print a success JSON and exit 0."""
    json.dump({
        "ok": True,
        "pageCount": page_count,
        "markdownBytes": markdown_bytes,
        "imageCount": image_count,
        "tableCount": table_count,
        "warnings": warnings or [],
    }, sys.stdout)
    sys.stdout.flush()


# ── Main ────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="PyMuPDF4LLM PDF-to-Markdown converter")
    parser.add_argument("--input-pdf", required=True)
    parser.add_argument("--output-md", required=True)
    parser.add_argument("--assets-dir", required=True)
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--image-format", default="png")
    parser.add_argument("--dpi", type=int, default=150)
    args = parser.parse_args()

    input_pdf = args.input_pdf
    output_md = args.output_md
    assets_dir = args.assets_dir
    job_id = args.job_id

    # ── Guard: ensure assets dir exists ──
    os.makedirs(assets_dir, exist_ok=True)

    # ── Import pymupdf4llm ──
    try:
        import pymupdf4llm  # noqa: F401
    except ImportError:
        _fail("PYMUPDF4LLM_NOT_AVAILABLE", "PyMuPDF4LLM not installed.")

    # ── Open PDF ──
    try:
        import fitz  # pymupdf
        doc = fitz.open(input_pdf)
        page_count = doc.page_count
    except Exception:
        _fail("CONVERSION_FAILED", "Cannot open PDF file.")

    # ── Convert to Markdown ──
    try:
        md_text = pymupdf4llm.to_markdown(
            doc=input_pdf,
            page_chunks=True,
            write_images=True,
            image_path=assets_dir,
            image_format=args.image_format,
            dpi=args.dpi,
            force_text=True,
            table_strategy="lines_strict",
            show_progress=False,
        )
    except Exception as e:
        # Do not leak traceback to stdout
        _fail("CONVERSION_FAILED", "PDF conversion failed.")

    if not md_text:
        _fail("INVALID_OUTPUT", "Conversion produced empty output.")

    # ── Collect statistics from page_chunks ──
    markdown_lines = []
    total_images = 0
    total_tables = 0
    all_warnings = []

    if isinstance(md_text, list):
        # page_chunks=True returns list[dict]
        for chunk in md_text:
            if isinstance(chunk, dict):
                text = chunk.get("text", "")
                if text:
                    markdown_lines.append(str(text))
                images = chunk.get("images", [])
                if isinstance(images, list):
                    total_images += len(images)
                tables = chunk.get("tables", [])
                if isinstance(tables, list):
                    total_tables += len(tables)
    else:
        # Fallback: plain string
        markdown_lines.append(str(md_text))

    combined_md = "\n\n".join(markdown_lines)

    # ── Rename images to img_{seq:03d}.png ──
    renamed = {}
    image_exts = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
    files = sorted(os.listdir(assets_dir))
    seq = 1
    for fname in files:
        _, ext = os.path.splitext(fname)
        if ext.lower() in image_exts:
            new_name = f"img_{seq:03d}{ext.lower()}"
            new_path = os.path.join(assets_dir, new_name)
            old_path = os.path.join(assets_dir, fname)
            if old_path != new_path:
                os.rename(old_path, new_path)
            renamed[fname] = new_name
            seq += 1

    # ── Rewrite Markdown image links ──
    # Replace PyMuPDF4LLM-generated image paths (absolute or relative)
    # with ./assets/{jobId}/img_NNN.png
    import re
    for old_name, new_name in renamed.items():
        # Escape for regex
        escaped = re.escape(old_name)
        replacement = f"./assets/{job_id}/{new_name}"
        combined_md = re.sub(escaped, replacement, combined_md)

    # Additional: strip any absolute paths to assets
    # (defense-in-depth — PyMuPDF4LLM may write full paths in some versions)
    abs_assets = os.path.abspath(assets_dir).replace("\\", "/")
    combined_md = combined_md.replace(abs_assets + "/", f"./assets/{job_id}/")
    combined_md = combined_md.replace(abs_assets + "\\", f"./assets/{job_id}/")

    # ── Write Markdown ──
    with open(output_md, "w", encoding="utf-8") as f:
        f.write(combined_md)

    markdown_bytes = len(combined_md.encode("utf-8"))

    _success(page_count, markdown_bytes, total_images, total_tables, all_warnings)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Last-resort catch: return safe failure only
        # traceback.print_exc() goes to stderr (not parsed by main process)
        _fail("CONVERSION_FAILED", "PDF conversion failed.")
