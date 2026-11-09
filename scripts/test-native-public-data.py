#!/usr/bin/env python3
"""Real-network Linux Tauri/WebKit/SQLite public-data verification through AT-SPI.

Uses isolated app data, real native HTTP/IPC and real Roblox metadata. No mock IPC,
credentials, client/browser launch or changes to the user's library. Text-entry
automation is intentionally left to browser tests: WebKit exposes no EditableText
interface on this host and synthesized input did not reach the fields.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import tempfile

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    "native_settings", Path(__file__).with_name("test-native-settings.py")
)
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)


def cached(path):
    if not path.exists():
        return []
    try:
        with sqlite3.connect(path) as db:
            return [json.loads(row[0]) for row in db.execute("SELECT value FROM metadata")]
    except sqlite3.OperationalError:
        return []


def run(binary):
    with tempfile.TemporaryDirectory(prefix="nova-public-data-test-") as temporary:
        directory = Path(temporary)
        data_dir = directory / "io.novalauncher.desktop"
        path = data_dir / "roblox-cache.sqlite3"
        library = data_dir / "nova.sqlite3"
        with native.application(binary, directory) as app:
            games = native.wait_for(
                lambda: (data := cached(path)) and len(data) == 4 and data,
                "four real experiences persisted", timeout=60,
            )
            assert all(
                g["universeId"] != g["id"] and g["iconUrl"] and g["thumbnailUrl"]
                and g["players"] is not None and g["upVotes"] is not None
                for g in games
            )
            first = games[0]
            native.click(native.element(app, f"View {first['name']}", "button"))
            native.element(app, "Close game details", "button")
            link = native.element(app, "View on Roblox", "link")
            assert link.get_hyperlink().get_uri(0) == f"https://www.roblox.com/games/{first['id']}"
            native.click(native.element(app, "Close game details", "button"))
            native.click(native.element(app, "Settings", "button"))
            native.select(app, "Color theme", "Light")
            native.click(native.element(app, "Blue", "radio button"))
            native.saved(library, theme="light", accent="blue")
            print("PASS real Tauri HTTP/IPC: four Roblox experiences, metadata/artwork URLs/votes, SQLite cache and verified Place/Universe mapping and official UI link")
        with sqlite3.connect(library) as db:
            assert db.execute("SELECT COUNT(*) FROM favorites").fetchone()[0] == 0
            assert db.execute("SELECT COUNT(*) FROM launch_requests").fetchone()[0] == 0
            assert db.execute("PRAGMA user_version").fetchone()[0] == 2
            # Explicit isolated legacy records test compatibility, never live data.
            db.executemany(
                "INSERT INTO favorites(game_id,position) VALUES(?,?)",
                [(first["id"], 0), ("123", 1)],
            )
        with native.application(binary, directory) as app:
            native.click(native.element(app, "Library", "button"))
            native.element(app, f"View {first['name']}", "button")
            native.wait_for(
                lambda: any(node.get_name() == "Place 123" for node in native.walk(app)),
                "legacy unknown favorite remains visible",
            )
            native.appearance(app)
            native.wait_for(
                lambda: native.checked(native.element(app, "Blue", "radio button")),
                "appearance preserved after live data and restart",
            )
            native.click(native.element(app, "Reduce motion", "toggle button"))
            native.saved(library, reduceMotion=True)
            print("PASS native restart: real cached metadata, unknown Place favorite, appearance and SQLite compatibility")
        with sqlite3.connect(library) as db:
            assert db.execute("SELECT game_id FROM favorites ORDER BY position").fetchall() == [(first["id"],), ("123",)]
            assert db.execute("SELECT COUNT(*) FROM launch_requests").fetchone()[0] == 0
            assert db.execute("PRAGMA user_version").fetchone()[0] == 2
        print("PASS no fabricated launch requests or silently rewritten favorite IDs")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=Path("src-tauri/target/release/nova-launcher"))
    run(parser.parse_args().binary.resolve(strict=True))
