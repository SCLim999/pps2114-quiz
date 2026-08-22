#!/usr/bin/env python3
"""Inline Git Quest into one self-contained HTML file.

    python3 tools/build-standalone.py [out.html] [--keep-report] [--artifact]

The result needs no server and no network: styles and scripts are inlined, so
it can be e-mailed to students, dropped on a USB stick, or published as a
single page. The "report to lecturer" panel is dropped by default because it
POSTs to Google Apps Script, which sandboxed hosts block; pass --keep-report
to keep it for a normal web host.

--artifact emits the same page as a fragment (no <html>/<head>/<body> wrapper)
for hosts that supply their own document skeleton, such as Claude Artifacts.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ["js/git-engine.js", "js/git-viz.js", "js/git-levels.js", "js/git-portal.js"]


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    keep_report = "--keep-report" in sys.argv
    artifact = "--artifact" in sys.argv
    out = Path(args[0]) if args else ROOT / "git-quest-standalone.html"

    page = (ROOT / "git-game.html").read_text(encoding="utf-8")
    body = re.search(r"<body[^>]*>(.*)</body>", page, re.S).group(1)
    body = re.sub(r'\s*<script src="[^"]+"></script>', "", body)

    if not keep_report:
        body = re.sub(r'\s*<section class="gq-panel gq-report">.*?</section>', "", body, flags=re.S)

    css = (ROOT / "css/git-game.css").read_text(encoding="utf-8")
    js = "\n\n".join((ROOT / s).read_text(encoding="utf-8") for s in SCRIPTS)

    if artifact:
        # The host writes <body> for us, so claim the theme from script, and
        # point the footer at the repo instead of the local assessment page.
        body = body.replace(
            '<a href="index.html">back to the C++ assessment</a>',
            '<a href="https://github.com/SCLim999/pps2114-quiz">source on GitHub</a>')
        out.write_text(
            "<title>Git Quest</title>\n"
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2'
            '?family=JetBrains+Mono:wght@400;700&display=swap">\n'
            "<style>\n" + css + "\n</style>\n" + body.strip() +
            "\n<script>\ndocument.body.classList.add('gq');\n" + js + "\n</script>\n",
            encoding="utf-8")
        print(f"wrote {out} (artifact fragment)")
        return 0

    html = (
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n"
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        "<title>Git Quest</title>\n<style>\n" + css + "\n</style>\n</head>\n"
        '<body class="gq">\n' + body.strip() + "\n<script>\n" + js + "\n</script>\n</body>\n</html>\n"
    )
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out} ({len(html) / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
