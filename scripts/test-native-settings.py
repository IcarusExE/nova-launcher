#!/usr/bin/env python3
"""Exercise the built Linux Tauri app through AT-SPI and its real SQLite IPC.

Requires a graphical session, python-gobject, and the Atspi 2.0 typelib. Uses only
an isolated temporary XDG_DATA_HOME. Never opens Roblox/Sober or a browser.
"""

import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import time

import gi

gi.require_version("Atspi", "2.0")
from gi.repository import Atspi  # noqa: E402


def wait_for(check, description, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = check()
        if result:
            return result
        time.sleep(0.05)
    raise AssertionError(f"Timed out: {description}")


def walk(node):
    yield node
    for index in range(node.get_child_count()):
        child = node.get_child_at_index(index)
        if child:
            yield from walk(child)


def find(root, name=None, role=None):
    return next(
        (
            node
            for node in walk(root)
            if (name is None or node.get_name() == name)
            and (role is None or node.get_role_name() == role)
        ),
        None,
    )


def element(app, name, role):
    return wait_for(lambda: find(app, name, role), f"{role}: {name}")


def click(node):
    assert node.get_action_iface().do_action(0), node.get_name()


def checked(node):
    return node.get_state_set().contains(Atspi.StateType.CHECKED)


def select(app, name, option):
    combo = element(app, name, "combo box")
    click(combo)
    click(element(combo, option, "menu item"))
    wait_for(
        lambda: element(combo, option, "menu item").get_state_set().contains(
            Atspi.StateType.SELECTED
        ),
        f"{option} selected",
    )


def preferences(path):
    with sqlite3.connect(path) as db:
        row = db.execute("SELECT value FROM preferences WHERE id=1").fetchone()
        return json.loads(row[0]) if row else None


def saved(path, **expected):
    return wait_for(
        lambda: (value := preferences(path))
        and all(value.get(key) == item for key, item in expected.items()),
        f"SQLite preferences {expected}",
    )


@contextmanager
def application(binary, directory):
    with tempfile.TemporaryFile(mode="w+") as log:
        process = subprocess.Popen(
            [str(binary)],
            env={**os.environ, "XDG_DATA_HOME": str(directory), "NO_AT_BRIDGE": "0"},
            stdout=log,
            stderr=log,
        )
        try:
            desktop = Atspi.get_desktop(0)

            def locate():
                assert process.poll() is None, "Nova exited during startup"
                return next(
                    (
                        desktop.get_child_at_index(i)
                        for i in range(desktop.get_child_count())
                        if desktop.get_child_at_index(i).get_process_id() == process.pid
                    ),
                    None,
                )

            app = wait_for(locate, "native accessibility application")
            frame = wait_for(lambda: find(app, role="frame"), "native window")
            wait_for(
                lambda: frame.get_state_set().contains(Atspi.StateType.SHOWING),
                "hydrated native window becomes visible",
            )
            yield app
            click(element(app, "Close window", "button"))
            process.wait(timeout=10)
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)
            log.seek(0)
            messages = log.read().strip()
            if messages:
                print(f"Native diagnostics:\n{messages}")


def appearance(app):
    click(element(app, "Settings", "button"))
    return element(app, "Compact game cards", "toggle button")


def game_button(app):
    return wait_for(lambda: next((node for node in walk(app) if node.get_role_name() == "button" and node.get_name().startswith("View ")), None), "experience card", timeout=30)


def seed_metadata(directory):
    # Test-only cache snapshot. Never shipped as production content or claimed live.
    target = directory / "io.novalauncher.desktop"
    target.mkdir(parents=True, exist_ok=True)
    game = {"id":"2753915549", "universeId":"994732206", "name":"Native appearance test snapshot", "description":"Isolated native test metadata", "creator":"Test", "creatorId":"1", "creatorType":"User", "category":"RPG", "iconUrl":None, "thumbnailUrl":None, "players":None, "upVotes":None, "downVotes":None, "observedAt":1700000000000, "cached":True}
    with sqlite3.connect(target / "roblox-cache.sqlite3") as db:
        db.execute("CREATE TABLE metadata(place_id TEXT PRIMARY KEY, universe_id TEXT NOT NULL, value TEXT NOT NULL, observed_at INTEGER NOT NULL)")
        db.execute("INSERT INTO metadata VALUES(?,?,?,?)", (game["id"], game["universeId"], json.dumps(game), game["observedAt"]))


def run(binary):
    with tempfile.TemporaryDirectory(prefix="nova-settings-test-") as temporary:
        directory = Path(temporary)
        path = directory / "io.novalauncher.desktop" / "nova.sqlite3"
        seed_metadata(directory)
        with application(binary, directory) as app:
            normal_height = game_button(app).get_component_iface().get_extents(Atspi.CoordType.WINDOW).height
            compact = appearance(app)
            select(app, "Color theme", "Light")
            saved(path, theme="light")
            click(element(app, "Teal", "radio button"))
            saved(path, accent="teal")
            for _ in range(7):
                click(compact)
                assert compact.get_state_set().contains(Atspi.StateType.ENABLED)
            motion = element(app, "Reduce motion", "toggle button")
            for _ in range(5):
                click(motion)
            saved(path, compactCards=True, reduceMotion=True)
            wait_for(lambda: checked(compact) and checked(motion), "native switch states")
            click(element(app, "Home", "button"))
            compact_height = game_button(app).get_component_iface().get_extents(Atspi.CoordType.WINDOW).height
            assert compact_height < normal_height, (compact_height, normal_height)
            compact = appearance(app)
            # A real SQLite transaction rejection must roll the optimistic UI back.
            with sqlite3.connect(path) as db:
                db.execute("CREATE TRIGGER reject_settings BEFORE UPDATE ON preferences BEGIN SELECT RAISE(ABORT, 'Native test storage failure'); END")
            click(compact)
            wait_for(lambda: find(app, role="notification"), "SQLite error shown in native UI")
            wait_for(lambda: checked(compact), "failed switch rolls back")
            assert preferences(path)["compactCards"] is True
            with sqlite3.connect(path) as db:
                db.execute("DROP TRIGGER reject_settings")
            click(compact)
            saved(path, compactCards=False)
            click(compact)
            saved(path, compactCards=True)
            assert find(app, role="notification") is None
            print("PASS native theme/accent changes, rapid switches, SQLite failure and recovery")

        # Seed isolated history/favorites to verify appearance writes preserve them.
        with sqlite3.connect(path) as db:
            db.execute("INSERT INTO favorites(game_id,position) VALUES('123',0)")
            db.execute("INSERT INTO launch_requests(action,adapter,place_id,accepted_at) VALUES('launchClient','sober',NULL,1)")
        with application(binary, directory) as app:
            compact = appearance(app)
            wait_for(lambda: checked(compact), "restored compact switch")
            wait_for(lambda: checked(element(app, "Reduce motion", "toggle button")), "restored motion switch")
            wait_for(lambda: checked(element(app, "Teal", "radio button")), "restored accent")
            wait_for(lambda: element(app, "Color theme", "combo box").get_child_at_index(0).get_selection_iface().get_selected_child(0).get_name() == "Light", "restored light theme")
            for label, value in [("Nova Dark", "dark"), ("System", "system"), ("Light", "light")]:
                select(app, "Color theme", label)
                saved(path, theme=value)
            print("PASS native restart restores theme, accent, density and motion")
        with sqlite3.connect(path) as db:
            assert db.execute("SELECT game_id FROM favorites").fetchall() == [("123",)]
            assert db.execute("SELECT COUNT(*) FROM launch_requests").fetchone()[0] == 1
            assert db.execute("PRAGMA user_version").fetchone()[0] == 2
            before = preferences(path)
            db.execute("UPDATE preferences SET value='invalid-json' WHERE id=1")
        with application(binary, directory) as app:
            compact = appearance(app)
            assert find(app, role="notification") is not None
            assert not compact.get_state_set().contains(Atspi.StateType.ENABLED)
            with sqlite3.connect(path) as db:
                assert db.execute("SELECT value FROM preferences").fetchone()[0] == "invalid-json"
            print("PASS native corrupt-preference startup remains visible and preserves data")
        assert before["theme"] == "light"
        print("PASS existing favorites/history and schema version preserved")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=Path("src-tauri/target/release/nova-launcher"))
    run(parser.parse_args().binary.resolve(strict=True))
