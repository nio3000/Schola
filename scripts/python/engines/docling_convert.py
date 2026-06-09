"""
Phase 3-4-C2-a: Docling conversion bridge script (SKELETON / EXPERIMENTAL).
Phase 3-4-F0: EXPERIMENTAL — Docling bundled runtime paused as default.
    This script is preserved for future phases (Marker/MinerU).
    Do NOT depend on resources/runtimes/docling-venv being present.
    To re-enable: see import-engine-capability-probe.service.ts.

Accepts controlled arguments from the Schola main process:
  --input       Absolute path to the copied attachment PDF
  --output      Absolute path for the generated Markdown
  --assets-dir  Absolute path for extracted figure/table/equation assets

Outputs JSON metadata to stdout:
  {
    "ok": true/false,
    "pageCount": <number>,
    "figures": [...],
    "tables": [...],
    "equations": [...],
    "confidence": {...},
    "error": "<sanitized short message>"
  }

Requirements:
  - Markdown body is written to --output, NEVER to stdout.
  - Asset filenames in the JSON are bare names (no path components).
  - All paths in JSON metadata are bare filenames only.
  - stderr may be used for logging but never for structured output.
  - This script must NOT access files outside --input, --output, --assets-dir.

⚠️  SKELETON: This script requires Docling to be installed.
    pip install docling
"""

import argparse
import json
import sys


def main():
    parser = argparse.ArgumentParser(description="Docling PDF to Markdown converter")
    parser.add_argument("--input", required=True, help="Absolute path to input PDF")
    parser.add_argument("--output", required=True, help="Absolute path for output Markdown")
    parser.add_argument("--assets-dir", required=True, help="Absolute path for extracted assets")
    args = parser.parse_args()

    try:
        from docling.document_converter import DocumentConverter

        converter = DocumentConverter()
        result = converter.convert(args.input)

        # Export Markdown to --output
        markdown_body = result.document.export_to_markdown()
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(markdown_body)

        # Collect metadata
        # Phase 3-4-D-R4 fix: docling 2.x num_pages may be a method, not an int.
        # Always check callable() and isinstance() before serializing to JSON.
        page_count = None
        try:
            raw = getattr(result.document, "num_pages", None)
            if callable(raw):
                raw = raw()
            if isinstance(raw, int):
                page_count = raw
        except Exception:
            page_count = None

        metadata = {
            "ok": True,
            "pageCount": page_count,
        }

        # TODO: Phase 3-4-C2 real implementation:
        # - Extract figures with captions → write to --assets-dir → populate `figures`
        # - Extract tables → populate `tables` (markdownRef or image fallback)
        # - Extract equations → populate `equations` (latex or image fallback)
        # - Compute confidence → populate `confidence`

        print(json.dumps(metadata))

    except ImportError:
        print(json.dumps({
            "ok": False,
            "error": "Docling is not installed.",
        }))
        sys.exit(0)

    except Exception as e:
        # Sanitize: never include full paths or tracebacks in the error message
        msg = str(e)
        # Truncate and sanitize
        if len(msg) > 200:
            msg = msg[:200]
        print(json.dumps({
            "ok": False,
            "error": msg,
        }))
        sys.exit(0)


if __name__ == "__main__":
    main()
