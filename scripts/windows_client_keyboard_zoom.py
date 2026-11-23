"""Check actual page zoom and keyboard navigation in a headed Windows browser."""

import ctypes
from ctypes import wintypes

from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait

from desktop_browser import browser


def send_zoom_in(pid):
    """Send Ctrl+Numpad Plus only while the test browser owns the foreground."""
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    user32.GetForegroundWindow.restype = wintypes.HWND
    user32.GetWindowThreadProcessId.argtypes = (wintypes.HWND, ctypes.POINTER(wintypes.DWORD))
    owner = wintypes.DWORD()
    user32.GetWindowThreadProcessId(user32.GetForegroundWindow(), ctypes.byref(owner))
    if owner.value != pid:
        raise AssertionError(f"Foreground process is {owner.value}, expected test browser {pid}")

    class KeyboardInput(ctypes.Structure):
        _fields_ = [
            ("key", wintypes.WORD), ("scan", wintypes.WORD), ("flags", wintypes.DWORD),
            ("time", wintypes.DWORD), ("extra", ctypes.c_size_t),
        ]

    # The native INPUT union must also fit its largest member, MOUSEINPUT.
    class MouseInput(ctypes.Structure):
        _fields_ = [
            ("x", wintypes.LONG), ("y", wintypes.LONG), ("data", wintypes.DWORD),
            ("flags", wintypes.DWORD), ("time", wintypes.DWORD), ("extra", ctypes.c_size_t),
        ]

    class InputData(ctypes.Union):
        _fields_ = [("keyboard", KeyboardInput), ("mouse", MouseInput)]

    class Input(ctypes.Structure):
        _fields_ = [("type", wintypes.DWORD), ("data", InputData)]

    ctrl, add, release = 0x11, 0x6B, 0x0002
    keys = ((ctrl, 0), (add, 0), (add, release), (ctrl, release))
    events = (Input * len(keys))(*(
        Input(1, InputData(keyboard=KeyboardInput(key=key, flags=flags))) for key, flags in keys
    ))
    user32.SendInput.argtypes = (wintypes.UINT, ctypes.POINTER(Input), ctypes.c_int)
    user32.SendInput.restype = wintypes.UINT
    if user32.SendInput(len(events), events, ctypes.sizeof(Input)) != len(events):
        raise OSError(ctypes.get_last_error(), "SendInput did not send the entire zoom shortcut")


def viewport(driver):
    return driver.execute_script("""
        const root = document.documentElement;
        return {
          dpr: window.devicePixelRatio,
          width: root.clientWidth,
          height: root.clientHeight,
          scrollWidth: root.scrollWidth,
          visualScale: window.visualViewport.scale,
        };
    """)


def exercise_at_zoom(driver, url, build, expected_dpr, title, body):
    wait = WebDriverWait(driver, 12)
    focus_path = []

    def press(key):
        ActionChains(driver).send_keys(key).perform()

    def focused(selector, label):
        node = wait.until(
            lambda browser: browser.execute_script("""
                const node = document.activeElement;
                return node.matches(arguments[0]) ? node : null;
            """, selector),
            message=f"Expected keyboard focus on {label}",
        )
        if not driver.execute_script("""
            const node = arguments[0];
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            const width = document.documentElement.clientWidth;
            const hasRing = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0)
              || style.boxShadow !== 'none';
            return hasRing && node.matches(':focus-visible') &&
              rect.width > 0 && rect.left >= -1 && rect.right <= width + 1;
        """, node):
            raise AssertionError(f"Expected an in-view focus indicator on {label}")
        focus_path.append(label)
        return node

    def tab_to(selector, label):
        press(Keys.TAB)
        return focused(selector, label)

    def open_notes():
        driver.get(url)
        wait.until(lambda browser: browser.execute_script("return window.__pwaUpdate?.buildId") == build)
        if abs(viewport(driver)["dpr"] - expected_dpr) > 0.01:
            raise AssertionError("Browser did not retain page zoom across navigation")
        tab_to(".workspace-toggle", "Workspace")
        press(Keys.ENTER)
        tab_to('input[type="radio"]:checked', "System appearance")
        tab_to("select", "Language")
        tab_to(".backup-menu summary", "Backup")
        press(Keys.ESCAPE)
        if focused(".workspace-toggle", "Workspace").get_attribute("aria-expanded") != "false":
            raise AssertionError("Escape did not close the workspace menu")
        tab_to(".launcher-tile", "Notes launcher")
        press(Keys.ENTER)
        focused(".window-bar h2", "Notes heading")
        if driver.execute_script("return matchMedia('(max-width: 600px)').matches"):
            tab_to(".launcher-back", "Back to workspace")
        else:
            for label in ("Minimize", "Maximize", "Close"):
                tab_to(f'.window-controls button[aria-label="{label}"]', label)
        tab_to(".notes-list .primary", "New note")

    open_notes()
    press(Keys.ENTER)
    focused("#note-title", "Title")
    press(title)
    tab_to("#note-body", "Body")
    press(body)
    wait.until(lambda browser: browser.find_element(By.CSS_SELECTOR, ".save-status").text == "Saved on this device")
    editor_viewport = viewport(driver)
    if editor_viewport["scrollWidth"] > editor_viewport["width"] + 1:
        raise AssertionError(f"Horizontal page overflow at keyboard editor: {editor_viewport}")

    open_notes()
    row = tab_to(".note-items button", "Saved note")
    if title not in row.text:
        raise AssertionError(f"Expected newest note {title!r}, received {row.text!r}")
    press(Keys.ENTER)
    wait.until(lambda browser: browser.find_element(By.ID, "note-title").get_property("value") == title)
    wait.until(lambda browser: browser.find_element(By.ID, "note-body").get_property("value") == body)
    return {"editorViewport": editor_viewport, "visibleFocusPath": focus_path, "exactNoteReopened": True}


def exercise_keyboard_zoom(name, profile, downloads, url, build):
    with browser(name, profile, downloads, offline=False) as driver:
        driver.set_window_size(1180, 800)
        driver.get(url)
        baseline = viewport(driver)
        normal = exercise_at_zoom(
            driver, url, build, baseline["dpr"], "Synthetic keyboard 100", "Saved at normal zoom.",
        )
        dpr_steps = [baseline["dpr"]]
        process_capability = {"chrome": "goog:processID", "firefox": "moz:processID"}[name]
        for _ in range(8):
            send_zoom_in(driver.capabilities[process_capability])
            previous = dpr_steps[-1]
            zoomed = WebDriverWait(driver, 5).until(
                lambda active: sample if (sample := viewport(active))["dpr"] > previous else False,
                message="Native zoom shortcut did not increase the device pixel ratio",
            )
            ratio = zoomed["dpr"] / baseline["dpr"]
            dpr_steps.append(zoomed["dpr"])
            if ratio >= 1.98:
                break
        if abs(ratio - 2) > 0.02 or abs(zoomed["width"] * 2 - baseline["width"]) > 30 or zoomed["visualScale"] != 1:
            raise AssertionError(f"Expected 200% browser page zoom after {dpr_steps}: {baseline} -> {zoomed}")
        enlarged = exercise_at_zoom(
            driver, url, build, zoomed["dpr"], "Synthetic keyboard 200", "Saved at enlarged zoom.",
        )
        return {
            "browser": name, "browserVersion": driver.capabilities["browserVersion"],
            "nativeZoomDprSteps": dpr_steps, "pageZoomRatio": ratio,
            "normal": normal, "enlarged": enlarged, "outcome": "PASS",
        }
