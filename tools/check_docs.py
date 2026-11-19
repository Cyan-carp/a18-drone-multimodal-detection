#!/usr/bin/env python3
"""Read-only Markdown governance checks for a configured repository.

Copy with governance-config.example.json into the target project and adapt there.
This checks local Markdown/wikilinks, not semantic truth or every Markdown extension.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import unquote


WIKI = re.compile(r"!?\[\[([^\]]+)\]\]")
MD_LINK = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
FENCE = re.compile(r"```.*?```", re.S)
INLINE = re.compile(r"`[^`\n]*`")
SCHEMES = ("http://", "https://", "mailto:", "data:", "file://", "obsidian://")


def metadata(content: str) -> dict[str, str]:
    if not content.startswith("---\n"):
        return {}
    end = content.find("\n---\n", 4)
    if end < 0:
        return {}
    result: dict[str, str] = {}
    for line in content[4:end].splitlines():
        if ":" in line and not line.startswith((" ", "\t")):
            key, value = line.split(":", 1)
            result[key.strip()] = value.strip().strip("\"'")
    return result


def local_target(raw: str) -> str:
    value = unquote(raw.strip().strip("<>")).replace("\\|", "|")
    value = value.split("|", 1)[0].split("#", 1)[0].strip()
    return value.replace("\\", "/")


def exists(source: Path, target: str, root: Path, docs: Path, stems: dict[str, list[Path]]) -> bool:
    if not target or target.lower().startswith(SCHEMES):
        return True
    path = Path(target)
    if path.is_absolute():
        return path.exists()
    if "/" not in target and path.suffix.lower() in ("", ".md"):
        matches = stems.get(path.stem.casefold(), [])
        if len(matches) == 1:
            return True
    for base in (source.parent / path, docs / path, root / path):
        for candidate in (base, Path(str(base) + ".md"), base / "README.md"):
            if candidate.exists():
                return True
    return False


def check(root: Path, config: dict, ci: bool) -> list[str]:
    docs = (root / config["docs_root"]).resolve()
    if not docs.is_dir() or not docs.is_relative_to(root.resolve()):
        return [f"invalid docs_root: {docs}"]
    files = sorted(docs.rglob("*.md"))
    errors: list[str] = []
    stems: dict[str, list[Path]] = defaultdict(list)
    for file in files:
        stems[file.stem.casefold()].append(file)
    for name, count in Counter(file.name.casefold() for file in files).items():
        if count > 1:
            errors.append(f"duplicate Markdown basename: {name}")

    index_prefix = config.get("index_prefix", "00-")
    index_min = int(config.get("index_min_notes", 2))
    for directory in (docs, *(item for item in docs.rglob("*") if item.is_dir())):
        direct = list(directory.glob("*.md"))
        if len(direct) >= index_min and not any(file.name.startswith(index_prefix) for file in direct):
            errors.append(f"missing index: {directory.relative_to(root)}")

    required = config.get("required_frontmatter", [])
    allowed_status = config.get("allowed_status", [])
    max_chars = config.get("max_chars")
    ci_skip = tuple(config.get("ci_allow_missing_prefixes", [])) if ci else ()
    for file in files:
        relative = file.relative_to(root)
        content = file.read_text(encoding="utf-8-sig")
        meta = metadata(content)
        for field in required:
            if not meta.get(field):
                errors.append(f"missing {field}: {relative}")
        if allowed_status and meta.get("status") and meta["status"] not in allowed_status:
            errors.append(f"invalid status: {relative}: {meta['status']}")
        if meta.get("updated"):
            try:
                date.fromisoformat(meta["updated"])
            except ValueError:
                errors.append(f"invalid updated date: {relative}")
        if max_chars is not None and len(content) > int(max_chars):
            errors.append(f"oversized note ({len(content)} chars): {relative}")
        body = INLINE.sub("", FENCE.sub("", content))
        for raw in WIKI.findall(body):
            target = local_target(raw)
            if not exists(file, target, root, docs, stems):
                errors.append(f"broken wikilink: {relative}: [[{raw}]]")
        for raw in MD_LINK.findall(body):
            target = local_target(raw)
            if target.startswith("#") or not target:
                continue
            if ci_skip and any(target.startswith(prefix) for prefix in ci_skip):
                continue
            if not exists(file, target, root, docs, stems):
                errors.append(f"broken Markdown link: {relative}: ({raw})")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True, help="target repository root")
    parser.add_argument("--config", type=Path, required=True, help="project-specific JSON config")
    parser.add_argument("--ci", action="store_true", help="apply configured private-evidence exceptions")
    args = parser.parse_args()
    root = args.root.resolve()
    config = json.loads(args.config.read_text(encoding="utf-8-sig"))
    errors = check(root, config, args.ci)
    if errors:
        print(f"FAIL: {len(errors)} issue(s)")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"PASS: {config['docs_root']} document checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
