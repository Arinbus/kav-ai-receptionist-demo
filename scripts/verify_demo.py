#!/usr/bin/env python3
"""Static smoke checks for the self-contained KAV receptionist demo."""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"

REQUIRED_IDS = {
    "pitchForm",
    "businessName",
    "cityName",
    "demo",
    "chatLog",
    "quickReplies",
    "chatForm",
    "chatInput",
    "ownerView",
    "resetDemo",
    "copyOffer",
    "offer",
}
REQUIRED_TEXT = {
    "WhatsApp",
    "Telegram",
    "₪2,500–5,000",
    "₪600–2,000",
    "Human handoff",
    "ДЕМО-ДАННЫЕ",
    "נתוני דמו",
    "window.__KAV_DEMO__",
    "profileOverrides.clinic = profileOverrides.dental;",
    "profileOverrides.realestate",
    "dentalFlows",
    "realEstateFlows",
    '["dental", "clinic", "realestate"].includes(requestedProfile)',
    "медицинских советов я не даю",
    "איני נותנת ייעוץ רפואי",
    "https://t.me/Liraagi",
    "telegramContact",
}


class DemoParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: set[str] = set()
        self.duplicate_ids: set[str] = set()
        self.inline_scripts: list[str] = []
        self.external_resources: list[str] = []
        self._script_chunks: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        element_id = attr.get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicate_ids.add(element_id)
            self.ids.add(element_id)

        if tag == "script":
            src = attr.get("src")
            if src:
                self.external_resources.append(src)
            else:
                self._script_chunks = []
        elif tag == "link":
            href = attr.get("href") or ""
            if href.startswith(("http://", "https://", "//")):
                self.external_resources.append(href)

    def handle_data(self, data: str) -> None:
        if self._script_chunks is not None:
            self._script_chunks.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._script_chunks is not None:
            self.inline_scripts.append("".join(self._script_chunks))
            self._script_chunks = None


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if not HTML_PATH.is_file():
        fail(f"missing {HTML_PATH}")

    source = HTML_PATH.read_text(encoding="utf-8")
    parser = DemoParser()
    parser.feed(source)
    parser.close()

    missing_ids = sorted(REQUIRED_IDS - parser.ids)
    if missing_ids:
        fail(f"missing required element IDs: {', '.join(missing_ids)}")
    if parser.duplicate_ids:
        fail(f"duplicate element IDs: {', '.join(sorted(parser.duplicate_ids))}")
    if parser.external_resources:
        fail(f"external resources found: {', '.join(parser.external_resources)}")

    missing_text = sorted(text for text in REQUIRED_TEXT if text not in source)
    if missing_text:
        fail(f"missing required product copy: {', '.join(missing_text)}")

    if len(parser.inline_scripts) != 1:
        fail(f"expected one inline script, found {len(parser.inline_scripts)}")

    node = shutil.which("node")
    if not node:
        fail("node is required for JavaScript syntax validation")
    assert node is not None

    with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8") as handle:
        handle.write(parser.inline_scripts[0])
        handle.flush()
        checked = subprocess.run(
            [node, "--check", handle.name],
            text=True,
            capture_output=True,
            check=False,
        )
    if checked.returncode != 0:
        fail(f"JavaScript syntax error:\n{checked.stderr.strip()}")

    print("PASS: index.html is self-contained")
    print(f"PASS: {len(parser.ids)} unique element IDs; required UI anchors present")
    print("PASS: RU/HE salon, clinic/dental, and real-estate copy, both channels, pricing, handoff, and test API markers present")
    print("PASS: inline JavaScript passes node --check")


if __name__ == "__main__":
    main()
