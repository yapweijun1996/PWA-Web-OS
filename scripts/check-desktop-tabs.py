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

from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


TITLE = "Synthetic desktop transfer"
ONLINE_BODY = "Created in Chrome."
CHROME_BODY = "Edited offline in Chrome."
FIREFOX_BODY = "Edited offline in Firefox."


class ReleaseFiles(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".webmanifest": "application/manifest+json"}

    def log_message(self, _format, *args):
        pass


def browser(name, profile, downloads, offline):
    if name == "chrome":
        options = webdriver.ChromeOptions()
        options.add_argument(f"--user-data-dir={profile}")
        options.add_argument("--lang=en-US")
        options.add_experimental_option("prefs", {
            "download.default_directory": str(downloads),
            "download.prompt_for_download": False,
        })
        driver = webdriver.Chrome(options=options, service=ChromeService(os.environ["CHROMEDRIVER_PATH"]))
    else:
        options = webdriver.FirefoxOptions()
        # Use this profile in place so the next process can open the same IndexedDB.
        options.add_argument("-profile")
        options.add_argument(str(profile))
        options.add_argument("-remote-allow-system-access")
        options.set_preference("intl.accept_languages", "en-US")
        driver = webdriver.Firefox(options=options, service=FirefoxService(os.environ["GECKODRIVER_PATH"]))
    try:
        if offline:
            if name == "chrome":
                driver.set_network_conditions(offline=True, latency=0, download_throughput=0, upload_throughput=0)
            else:
                with driver.context(driver.CONTEXT_CHROME):
                    driver.execute_script("Services.io.offline = true")
        return driver
    except Exception:
        driver.quit()
        raise


def exercise_session(name, phase, profile, downloads, url, build):
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
            backup = downloads / "notes-backup.json"
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

        return {"browser": name, "browserVersion": driver.capabilities["browserVersion"],
                "phase": phase, "browserOffline": offline, "networkControlHttpStatus": status,
                "buildId": build, "outcome": "PASS"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact", type=Path)
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    manifest_bytes = (args.artifact / "manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    report = {"commit": manifest["commit"], "buildId": manifest["buildId"],
              "manifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
              "startedAt": datetime.now(timezone.utc).isoformat(), "os": platform.platform(),
              "mode": "Headed desktop browser tabs in isolated profiles on one host", "sessions": [],
              "outcome": "INCOMPLETE"}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            shutil.copytree(args.artifact / "dist", root / "site" / "PWA-Web-OS")
            downloads = root / "downloads"
            downloads.mkdir()
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
                            report["sessions"].append(exercise_session(name, phase, profile, downloads, url, manifest["buildId"]))
                finally:
                    server.shutdown()
                    thread.join()
        report["outcome"] = "PASS"
    finally:
        report["finishedAt"] = datetime.now(timezone.utc).isoformat()
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
