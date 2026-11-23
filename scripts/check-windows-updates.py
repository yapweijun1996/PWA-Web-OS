"""Test a deferred update, a rejected save and recovery in retail Windows tabs."""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import platform
import tempfile

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from windows_browser import browser
from windows_staging import release_identity, staged_releases


def exercise(name, root, server, a, b, artifacts):
    with browser(name, root / name, root, False) as driver:
        wait = WebDriverWait(driver, 25)
        driver.set_window_size(1280, 800)

        def visible(selector):
            return wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, selector)))

        def current_build():
            return driver.execute_script("return window.__pwaUpdate?.buildId")

        def saved():
            wait.until(lambda _: visible(".save-status").text == "Saved on this device")

        original = "Previously saved synthetic note."
        deferred = "Edited and saved while the update was waiting."
        draft = "Pending edit recovered after the rejected update."
        title = "Synthetic Windows update"

        server.release_directory = artifacts[0]
        driver.get(f"http://127.0.0.1:{server.server_port}/PWA-Web-OS/")
        wait.until(lambda _: current_build() == a["buildId"])
        wait.until(lambda _: driver.execute_script("return navigator.serviceWorker.controller?.state") == "activated")
        visible(".launcher-tile").click()
        visible(".notes-list .primary").click()
        visible("#note-title").send_keys(title)
        body = visible("#note-body")
        body.send_keys(original)
        saved()

        server.release_directory = artifacts[1]
        error = driver.execute_async_script("""
            const done = arguments[arguments.length - 1];
            navigator.serviceWorker.getRegistration().then(reg => reg.update()).then(() => done(null), e => done(String(e)));
        """)
        assert error is None, error
        wait.until(lambda _: visible(".update-notice h2").text == "Update available")
        body.clear()
        body.send_keys(deferred)
        saved()
        assert current_build() == a["buildId"]
        assert visible(".update-notice h2").text == "Update available"

        driver.execute_script("""
            const store = IDBObjectStore.prototype;
            const nativePut = store.put;
            window.restoreSyntheticWrite = () => { store.put = nativePut; };
            store.put = function (...args) {
              const request = nativePut.apply(this, args);
              if (this.name === 'notes') request.addEventListener('success', () => this.transaction.abort(), { once: true });
              return request;
            };
        """)
        try:
            body.clear()
            body.send_keys(draft)
            visible(".update-notice button").click()
            wait.until(lambda _: visible(".update-notice h2").text == "Update paused")
            assert current_build() == a["buildId"]
            assert body.get_property("value") == draft
            saved_body = driver.execute_async_script("""
                const done = arguments[arguments.length - 1];
                const request = indexedDB.open('pwa-web-os-notes');
                request.onerror = () => done(null);
                request.onsuccess = () => {
                  const db = request.result;
                  const transaction = db.transaction('notes', 'readonly');
                  const notes = transaction.objectStore('notes').getAll();
                  transaction.oncomplete = () => { db.close(); done(notes.result.map(note => note.body)); };
                  transaction.onabort = () => { db.close(); done(null); };
                };
            """)
            assert saved_body == [deferred], saved_body
        finally:
            driver.execute_script("window.restoreSyntheticWrite(); delete window.restoreSyntheticWrite;")

        retry = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space(.)='Retry update']")))
        retry.click()
        wait.until(lambda _: current_build() == b["buildId"])
        visible(".launcher-tile").click()
        visible(".note-items button").click()
        assert visible("#note-title").get_property("value") == title
        assert visible("#note-body").get_property("value") == draft
        saved()
        return {"browser": name, "version": driver.capabilities["browserVersion"], "outcome": "PASS",
                "deferredSave": "PASS", "updatePause": "PASS", "preservedDraftAndCommit": "PASS", "retryIntoB": "PASS"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("a", type=Path)
    parser.add_argument("b", type=Path)
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    a, b = map(release_identity, (args.a, args.b))
    assert a["buildId"] != b["buildId"] and a["commit"] != b["commit"]
    report = {"a": a, "b": b, "os": platform.platform(), "sessions": [],
              "startedAt": datetime.now(timezone.utc).isoformat(), "outcome": "INCOMPLETE"}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix="pwa-client-update-") as directory:
            root = Path(directory)
            with staged_releases(root, args.a, args.b) as (server, release_dirs):
                for name in ("chrome", "firefox"):
                    print(f"Checking deferred update and retry in {name}", flush=True)
                    (root / name).mkdir()
                    report["sessions"].append(exercise(name, root, server, a, b, release_dirs))
        report["outcome"] = "PASS"
    finally:
        report["finishedAt"] = datetime.now(timezone.utc).isoformat()
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
