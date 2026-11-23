"""Exercise two installed desktop browsers using a retained Notes release and temporary profiles."""

import argparse
import hashlib
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import platform
import shutil
import tempfile
import threading
from datetime import datetime, timezone

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from desktop_browser import browser


TITLE = "Synthetic desktop transfer"
ONLINE_BODY = "Created in Chrome."
CHROME_BODY = "Edited offline in Chrome."
FIREFOX_BODY = "Edited offline in Firefox."


class ReleaseFiles(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".webmanifest": "application/manifest+json"}

    def log_message(self, _format, *args):
        pass


def exercise_session(name, phase, profile, downloads, transfer, url, build, preferences):
    offline = phase > 1
    with browser(name, profile, downloads, offline) as driver:
        wait = WebDriverWait(driver, 20)
        driver.set_window_size(1280, 800)

        def visible(selector):
            return wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, selector)))

        def click(selector):
            visible(selector).click()

        def body_is(expected):
            wait.until(lambda _: visible("#note-body").get_property("value") == expected)

        def saved():
            wait.until(lambda _: visible(".save-status").text == "Saved on this device")

        driver.get(url)
        wait.until(lambda _: build == driver.execute_script("return window.__pwaUpdate?.buildId"))
        visible(".offline-ready")
        expected_status = "Offline" if offline else "Online"
        wait.until(lambda _: visible(".network-status").text == expected_status)
        # Unknown assets bypass this app's worker. Its online 404 is a positive network control.
        status = driver.execute_async_script("""
            const done = arguments[arguments.length - 1];
            fetch('unlisted-network-control', {cache:'no-store'}).then(r => done(r.status), () => done(0));
        """)
        if status != (0 if offline else 404):
            raise AssertionError(f"Unexpected network control in {name} phase {phase}: {status}")

        if name == "firefox" and phase == 1:
            click(".workspace-toggle")
            click(".backup-menu summary")
            backup = transfer.resolve(strict=True)
            for expected_preview in ("New notes: 1", "New notes: 0"):
                driver.find_element(By.CSS_SELECTOR, ".backup-menu input[type=file]").send_keys(str(backup))
                wait.until(lambda _: expected_preview in visible("dialog[open]").text)
                click("dialog[open] .primary")
                wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "dialog[open]")))
            click(".workspace-toggle")

        click(".launcher-tile")
        if name == "chrome" and phase == 1:
            click(".notes-list .primary")
            visible("#note-title").send_keys(TITLE)
            visible("#note-body").send_keys(ONLINE_BODY)
            saved()
        else:
            rows = wait.until(lambda _: driver.find_elements(By.CSS_SELECTOR, ".note-items button"))
            if len(rows) != 1 or TITLE not in rows[0].text:
                raise AssertionError("Expected the single transferred note")
            rows[0].click()
            if name == "chrome":
                expected = CHROME_BODY if phase == 3 else ONLINE_BODY
            else:
                expected = FIREFOX_BODY if phase == 3 else CHROME_BODY
            body_is(expected)
            if phase == 2:
                field = visible("#note-body")
                field.clear()
                field.send_keys(CHROME_BODY if name == "chrome" else FIREFOX_BODY)
                saved()

        if name == "chrome" and phase == 3:
            click(".workspace-toggle")
            click(".backup-menu summary")
            click(".backup-menu .actions button:first-child")
            backup = downloads / "notes-backup.json"
            wait.until(lambda _: backup.is_file())
            data = json.loads(backup.read_text(encoding="utf-8"))
            records = [(note["title"], note["body"]) for note in data["notes"]]
            if records != [(TITLE, CHROME_BODY)]:
                raise AssertionError("The downloaded backup differs from the offline edit")
            shutil.copyfile(backup, transfer)

        checks = {}
        if preferences and phase == 2:
            from windows_client_preferences import exercise_client_preferences
            body_text = CHROME_BODY if name == "chrome" else FIREFOX_BODY
            checks["preferences"] = exercise_client_preferences(driver, TITLE, body_text)
        return {"browser": name, "browserVersion": driver.capabilities["browserVersion"],
                "phase": phase, "browserOffline": offline, "networkControlHttpStatus": status,
                "buildId": build, "outcome": "PASS", **checks}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact", type=Path)
    parser.add_argument("report", type=Path)
    parser.add_argument("--client-preferences", action="store_true")
    parser.add_argument("--client-data-safety", action="store_true")
    args = parser.parse_args()
    manifest_bytes = (args.artifact / "manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    report = {"commit": manifest["commit"], "buildId": manifest["buildId"],
              "manifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
              "startedAt": datetime.now(timezone.utc).isoformat(), "os": platform.platform(),
              "mode": "Headed desktop browser tabs in isolated profiles on one host", "sessions": [],
              "outcome": "INCOMPLETE"}
    if args.client_data_safety:
        report["dataSafety"] = []
    args.report.parent.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix="pwa-tabs-", dir=os.environ.get("RUNNER_TEMP")) as tmp:
            root = Path(tmp)
            shutil.copytree(args.artifact / "dist", root / "site" / "PWA-Web-OS")
            downloads = root / "downloads"
            downloads.mkdir()
            transfer = root / "transfer.json"
            handler = partial(ReleaseFiles, directory=root / "site")
            with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                url = f"http://127.0.0.1:{server.server_port}/PWA-Web-OS/"
                try:
                    for name in ("chrome", "firefox"):
                        profile = root / name
                        profile.mkdir()
                        for phase in range(1, 4):
                            report["sessions"].append(exercise_session(
                                name, phase, profile, downloads, transfer, url,
                                manifest["buildId"], args.client_preferences,
                            ))
                    report["transferSha256"] = hashlib.sha256(transfer.read_bytes()).hexdigest()
                    if args.client_data_safety:
                        from windows_client_data_safety import exercise_data_safety
                        for name in ("chrome", "firefox"):
                            profile = root / f"{name}-data-safety"
                            profile.mkdir()
                            report["dataSafety"].append(exercise_data_safety(
                                name, profile, downloads, url, manifest["buildId"],
                            ))
                finally:
                    server.shutdown()
                    thread.join()
        report["outcome"] = "PASS"
    finally:
        report["finishedAt"] = datetime.now(timezone.utc).isoformat()
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
