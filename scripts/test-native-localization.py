#!/usr/bin/env python3
"""Real CachyOS Tauri/SQLite language and OS-default verification via AT-SPI.

All data and locale overrides belong to this test's subprocesses. No machine
locale changes, mocked IPC, Roblox launching or user-library writes occur.
"""
import argparse
import importlib.util
from pathlib import Path
import sqlite3
import sys
import tempfile
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("native_settings", Path(__file__).with_name("test-native-settings.py"))
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)


def settings(app, label):
    native.click(native.element(app,label,"button"))


def language(app, label, option, value, path):
    # System-option text changes in the same DOM control after the selection.
    # Assert the actual SQLite value rather than the old localized option name.
    combo = native.element(app,label,"combo box")
    native.click(combo)
    native.click(native.element(combo,option,"menu item"))
    native.saved(path,language=value)


def run(binary):
    with tempfile.TemporaryDirectory(prefix="nova-locale-test-") as temporary:
        directory=Path(temporary)
        path=directory/"io.novalauncher.desktop"/"nova.sqlite3"
        with native.application(binary,directory,{"LC_ALL":"tr_TR.UTF-8","LANG":"tr_TR.UTF-8"}) as app:
            settings(app,"Ayarlar")
            selector=native.element(app,"Dil","combo box")
            language(app,"Dil","English","en",path)
            native.saved(path,language="en")
            assert selector == native.element(app,"Language","combo box"), "Language change replaced its control"
            native.select(app,"Color theme","Light")
            native.click(native.element(app,"Teal","radio button"))
            native.click(native.element(app,"Compact game cards","toggle button"))
            native.click(native.element(app,"Reduce motion","toggle button"))
            native.saved(path,language="en",theme="light",accent="teal",compactCards=True,reduceMotion=True)
            print("PASS real OS Turkish default, instant English override, same native control and SQLite save")
        with sqlite3.connect(path) as db:
            db.execute("INSERT INTO favorites(game_id,position) VALUES('123',0)")
            db.execute("INSERT INTO launch_requests(action,adapter,place_id,accepted_at) VALUES('launchClient','sober',NULL,1)")
        with native.application(binary,directory,{"LC_ALL":"tr_TR.UTF-8"}) as app:
            settings(app,"Settings")
            assert native.checked(native.element(app,"Teal","radio button"))
            assert native.checked(native.element(app,"Compact game cards","toggle button"))
            assert native.checked(native.element(app,"Reduce motion","toggle button"))
            language(app,"Language","System default","system",path)
            native.saved(path,language="system")
            native.element(app,"Dil","combo box")
            language(app,"Dil","Türkçe","tr",path)
            native.saved(path,language="tr")
            print("PASS native restart manual English overrides Turkish OS; System and Turkish selection update in place")
        with native.application(binary,directory,{"LC_ALL":"en_US.UTF-8","LANG":"en_US.UTF-8"}) as app:
            settings(app,"Ayarlar")
            language(app,"Dil","Sistem varsayılanı","system",path)
            native.saved(path,language="system")
            native.element(app,"Language","combo box")
            print("PASS native restart manual Turkish overrides English OS; System returns to English")
        with sqlite3.connect(path) as db:
            assert db.execute("SELECT game_id FROM favorites").fetchall()==[("123",)]
            assert db.execute("SELECT COUNT(*) FROM launch_requests").fetchone()[0]==1
            assert db.execute("PRAGMA user_version").fetchone()[0]==2
            prefs=native.preferences(path)
            assert all(prefs.get(key)==value for key,value in {"theme":"light","accent":"teal","compactCards":True,"reduceMotion":True,"language":"system","preferredAdapter":"auto","startPage":"home"}.items())
        print("PASS native language writes preserve schema v2, favorites, history and all appearance/launcher preferences")


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary",type=Path,default=Path("src-tauri/target/release/nova-launcher"))
    run(parser.parse_args().binary.resolve(strict=True))
