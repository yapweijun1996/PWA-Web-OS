"""Test OS-registered Chrome and Firefox web app launches on a disposable Windows runner."""

import argparse
from contextlib import contextmanager
import ctypes
from ctypes import wintypes
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import tempfile
import threading

from selenium import webdriver
from selenium.common.exceptions import NoSuchWindowException, TimeoutException, WebDriverException
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from windows_browser import browser


TITLE = "PWA Web OS"
NOTE_TITLE = "Synthetic installed app note"
ORIGINAL = "Saved in the installed window before disconnecting."
OFFLINE = "Saved after a cold launch in the installed window."


class RejectProxy(BaseHTTPRequestHandler):
    def do_CONNECT(self):
        self.send_error(502, "Offline browser test")

    do_GET = do_CONNECT

    def log_message(self, _format, *args):
        pass


def native_control(*arguments):
    command = ["powershell.exe", "-NoProfile", "-NonInteractive", "-File",
               str(Path(__file__).with_name("inspect-windows-browser.ps1")), *arguments]
    return json.loads(subprocess.check_output(command, encoding="utf-8", timeout=12))


def command_arguments(arguments):
    shell32 = ctypes.WinDLL("shell32")
    shell32.CommandLineToArgvW.argtypes = (wintypes.LPCWSTR, ctypes.POINTER(ctypes.c_int))
    shell32.CommandLineToArgvW.restype = ctypes.POINTER(wintypes.LPWSTR)
    kernel32 = ctypes.WinDLL("kernel32")
    kernel32.LocalFree.argtypes = (wintypes.HLOCAL,)
    count = ctypes.c_int()
    pointer = shell32.CommandLineToArgvW("app.exe " + arguments, ctypes.byref(count))
    if not pointer:
        raise ctypes.WinError()
    try:
        return [pointer[i] for i in range(1, count.value)]
    finally:
        kernel32.LocalFree(ctypes.cast(pointer, ctypes.c_void_p))


def shortcut_wait(name, profile):
    programs = Path(os.environ["APPDATA"]) / "Microsoft/Windows/Start Menu/Programs"
    targets = {"chrome.exe", "chrome_proxy.exe"} if name == "chrome" else {"firefox.exe"}

    def owned_link(_):
        for link in programs.rglob(TITLE + "*.lnk"):
            properties = native_control("-Shortcut", str(link))
            if Path(properties["target"]).name.lower() not in targets:
                continue
            args = command_arguments(properties["arguments"])
            if name == "firefox" and "-profile" in args and Path(args[args.index("-profile") + 1]) == profile:
                return link, Path(properties["target"]), args
            if name == "chrome" and any(arg.startswith("--app-id=") for arg in args):
                return link, Path(properties["target"]), args
        return None

    return WebDriverWait(None, 20, poll_frequency=1).until(owned_link, "The browser app Start menu shortcut was not found")


def install(driver, name):
    if name == "firefox":
        pid = str(driver.capabilities["moz:processID"])
        native_control("-BrowserProcess", pid, "-Label", "Add tab to taskbar", "-Invoke")
        return

    pid = str(driver.capabilities["goog:processID"])
    native_control("-BrowserProcess", pid, "-Label", "Install PWA Web OS", "-Invoke")
    wait = WebDriverWait(driver, 20)

    def dialog_action(_):
        for action in ("Install", "Next"):
            found = native_control("-BrowserProcess", pid, "-Label", action)
            if found["matches"] == 1:
                return action
        return False

    action = wait.until(dialog_action, "Chrome's native install dialog was unavailable")
    native_control("-BrowserProcess", pid, "-Label", action, "-Invoke")
    if action == "Next":
        wait.until(lambda _: native_control("-BrowserProcess", pid, "-Label", "Install")["matches"] == 1)
        native_control("-BrowserProcess", pid, "-Label", "Install", "-Invoke")


def select_app_window(driver, name, url):
    def installed(_):
        for handle in driver.window_handles:
            try:
                driver.switch_to.window(handle)
                if driver.current_url != url:
                    continue
                if name == "chrome":
                    if driver.execute_script("return matchMedia('(display-mode: standalone)').matches"):
                        return True
                else:
                    pid = str(driver.capabilities["moz:processID"])
                    native = native_control("-BrowserProcess", pid, "-Label", "Remove tab from taskbar")
                    if " in Mozilla Firefox" in driver.title or native["matches"] > 0:
                        return True
            except NoSuchWindowException:
                continue
        return False

    try:
        WebDriverWait(driver, 22).until(installed, f"{name} did not expose a genuine installed app window")
    except TimeoutException:
        windows = []
        for handle in driver.window_handles:
            driver.switch_to.window(handle)
            windows.append({
                "url": driver.current_url,
                "standalone": driver.execute_script("return matchMedia('(display-mode: standalone)').matches"),
            })
        print(f"{name} launched these windows: {json.dumps(windows)}", flush=True)
        raise



@contextmanager
def chrome_registered_app(launcher, profile, relaunch, proxy_port):
    # Start the real Chrome process using the installed ID and profile. Attach the
    # test driver after startup so it cannot introduce a normal initial tab.
    port_file = profile / "DevToolsActivePort"
    port_file.unlink(missing_ok=True)
    chrome = launcher.with_name("chrome.exe")
    command = [
        str(chrome), f"--user-data-dir={profile}", *relaunch,
        "--lang=en-US", "--no-first-run", "--no-default-browser-check",
        "--disable-background-mode", "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=0",
    ]
    if proxy_port:
        command.append(f"--proxy-server=http://127.0.0.1:{proxy_port}")
    process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def debugger(_):
        if process.poll() is not None:
            raise RuntimeError(f"Chrome exited during app launch ({process.returncode})")
        try:
            port = port_file.read_text(encoding="ascii").partition("\n")[0].strip()
        except FileNotFoundError:
            return None
        return f"127.0.0.1:{port}" if port.isdecimal() and 1 <= int(port) <= 65535 else None

    try:
        options = webdriver.ChromeOptions()
        options.debugger_address = WebDriverWait(None, 20).until(debugger)
        with webdriver.Chrome(options=options, service=ChromeService(os.environ["CHROMEDRIVER_PATH"])) as driver:
            try:
                yield driver
            finally:
                try:
                    driver.execute_cdp_cmd("Browser.close", {})
                except WebDriverException:
                    # Browser.close can close the debugger connection before replying.
                    pass
        process.wait(timeout=15)
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=10)


def exercise(driver, name, url, build, phase):
    wait = WebDriverWait(driver, 20)
    select_app_window(driver, name, url)
    wait.until(lambda _: driver.execute_script("return window.__pwaUpdate?.buildId") == build)
    wait.until(lambda _: driver.execute_script("return navigator.serviceWorker.controller?.state") == "activated")
    status = driver.execute_async_script("""
        const done = arguments[arguments.length - 1];
        fetch('unlisted-network-control', {cache:'no-store'}).then(r => done(r.status), () => done(0));
    """)
    assert status == (404 if phase == 1 else 0), (name, phase, status)
    wait.until(lambda _: driver.find_element(By.CSS_SELECTOR, ".network-status").text ==
               ("Online" if phase == 1 else "Site unreachable"))

    def visible(selector):
        return wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, selector)))

    visible(".launcher-tile").click()
    if phase == 1:
        visible(".notes-list .primary").click()
        visible("#note-title").send_keys(NOTE_TITLE)
        visible("#note-body").send_keys(ORIGINAL)
    else:
        visible(".note-items button").click()
        assert visible("#note-title").get_property("value") == NOTE_TITLE
        assert visible("#note-body").get_property("value") == (ORIGINAL if phase == 2 else OFFLINE)
        if phase == 2:
            field = visible("#note-body")
            field.clear()
            field.send_keys(OFFLINE)
    wait.until(lambda _: visible(".save-status").text == "Saved on this device")
    return {
        "browser": name, "version": driver.capabilities["browserVersion"], "phase": phase,
        "networkControlHttpStatus": status, "buildId": build, "outcome": "PASS",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("browser", choices=("chrome", "firefox"))
    parser.add_argument("url")
    parser.add_argument("manifest", type=Path)
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    if os.environ.get("GITHUB_ACTIONS") != "true":
        raise RuntimeError("Installed-window checks require a disposable Actions desktop")
    raw = args.manifest.read_bytes()
    manifest = json.loads(raw)
    report = {"buildId": manifest["buildId"], "commit": manifest["commit"],
              "manifestSha256": hashlib.sha256(raw).hexdigest(), "os": platform.platform(),
              "startedAt": datetime.now(timezone.utc).isoformat(), "sessions": [], "outcome": "INCOMPLETE"}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix="pwa-apps-", dir=os.environ.get("RUNNER_TEMP")) as directory:
            root = Path(directory)
            with ThreadingHTTPServer(("127.0.0.1", 0), RejectProxy) as proxy:
                thread = threading.Thread(target=proxy.serve_forever, daemon=True)
                thread.start()
                try:
                    name = args.browser
                    profile = root / name
                    profile.mkdir()
                    shortcut = None
                    try:
                        print(f"{name}: install native web app", flush=True)
                        with browser(name, profile, root, False) as driver:
                            driver.get(args.url)
                            WebDriverWait(driver, 20).until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".offline-ready")))
                            install(driver, name)
                            shortcut, launcher, registered_args = shortcut_wait(name, profile)
                            report["registration"] = {
                                "shortcut": shortcut.name, "launcher": launcher.name,
                            }
                            if name == "chrome":
                                relaunch = [option for option in registered_args
                                            if re.fullmatch(r"--app-id=[a-p]{32}", option)]
                                assert len(relaunch) == 1
                            else:
                                index = registered_args.index("-taskbar-tab")
                                assert registered_args[registered_args.index("-new-window") + 1] == args.url
                                relaunch = registered_args[index:index+2] + ["-new-window", args.url]
                                report["sessions"].append(exercise(driver, name, args.url, manifest["buildId"], 1))
                        phases = (1, 2, 3) if name == "chrome" else (2, 3)
                        for phase in phases:
                            print(f"{name}: cold launch phase {phase}", flush=True)
                            port = proxy.server_port if phase > 1 else None
                            if name == "chrome":
                                session = chrome_registered_app(launcher, profile, relaunch, port)
                            else:
                                session = browser(name, profile, root, False, relaunch, port)
                            with session as driver:
                                report["sessions"].append(exercise(driver, name, args.url, manifest["buildId"], phase))
                    finally:
                        if shortcut:
                            shortcut.unlink(missing_ok=True)
                finally:
                    proxy.shutdown()
                    thread.join()
        report["outcome"] = "PASS"
    finally:
        report["finishedAt"] = datetime.now(timezone.utc).isoformat()
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
