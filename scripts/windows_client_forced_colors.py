"""Check Notes while the disposable Windows desktop uses its contrast palette."""

from contextlib import contextmanager
import ctypes
from ctypes import wintypes
import os
import time
import winreg

from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from desktop_browser import browser


GET_CONTRAST = 0x0042
SET_CONTRAST = 0x0043
CONTRAST_ON = 0x0001
HOTKEY_AVAILABLE = 0x0040
BROADCAST_CHANGE = 0x0002


class HighContrast(ctypes.Structure):
    _fields_ = [
        ("size", wintypes.UINT), ("flags", wintypes.DWORD), ("scheme", wintypes.LPVOID),
    ]


@contextmanager
def windows_contrast():
    if os.environ.get("GITHUB_ACTIONS") != "true":
        raise RuntimeError("The native contrast check requires a disposable Actions desktop")

    user32 = ctypes.WinDLL("user32", use_last_error=True)
    params = user32.SystemParametersInfoW
    params.argtypes = (wintypes.UINT, wintypes.UINT, wintypes.LPVOID, wintypes.UINT)
    params.restype = wintypes.BOOL
    get_color = user32.GetSysColor
    get_color.argtypes = (ctypes.c_int,)
    get_color.restype = wintypes.DWORD
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Control Panel\Accessibility\HighContrast") as key:
            scheme = winreg.QueryValueEx(key, "High Contrast Scheme")[0]
    except FileNotFoundError:
        scheme = ""

    def colors():
        palette = {}
        for name, index in (("window", 5), ("windowText", 8), ("buttonFace", 15), ("buttonText", 18)):
            value = get_color(index)
            palette[name] = [value & 255, (value >> 8) & 255, (value >> 16) & 255]
        return palette

    def get():
        state = HighContrast(size=ctypes.sizeof(HighContrast))
        if not params(GET_CONTRAST, state.size, ctypes.byref(state), 0):
            raise ctypes.WinError(ctypes.get_last_error())
        return {"active": bool(state.flags & CONTRAST_ON), "flags": state.flags,
                "palette": colors()}

    def set_flags(flags):
        # Keep the scheme buffer alive through the native call.
        buffer = ctypes.create_unicode_buffer(scheme)
        state = HighContrast(ctypes.sizeof(HighContrast), flags & ~HOTKEY_AVAILABLE,
                             ctypes.cast(buffer, wintypes.LPVOID))
        if not params(SET_CONTRAST, state.size, ctypes.byref(state), BROADCAST_CHANGE):
            raise ctypes.WinError(ctypes.get_last_error())

    def wait_for_state(predicate, description):
        deadline = time.monotonic() + 8
        while True:
            state = get()
            if predicate(state):
                return state
            if time.monotonic() >= deadline:
                raise AssertionError(f"Windows did not {description}: {state}")
            time.sleep(0.25)

    print("Read the native Windows contrast setting", flush=True)
    baseline = get()
    if baseline["active"]:
        raise AssertionError("The Windows image must start with its ordinary color palette")
    observations = {"baseline": baseline, "configuredScheme": scheme}
    try:
        print("Enable Windows contrast", flush=True)
        set_flags(baseline["flags"] | CONTRAST_ON)
        observations["forced"] = wait_for_state(
            lambda state: state["active"] and state["palette"] != baseline["palette"],
            "apply a distinct contrast palette",
        )
        yield observations
    finally:
        set_flags(baseline["flags"])
        observations["restored"] = wait_for_state(
            lambda state: not state["active"] and state["palette"] == baseline["palette"],
            "restore the original contrast setting",
        )


def exercise_forced_colors(name, profile, downloads, url, build, output):
    with browser(name, profile, downloads, offline=False) as driver:
        wait = WebDriverWait(driver, 15)
        driver.set_window_size(1280, 800)
        driver.get(url)
        wait.until(lambda tab: tab.execute_script("return window.__pwaUpdate?.buildId") == build)

        def visible(selector):
            return wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, selector)))

        def is_forced():
            return driver.execute_script("return matchMedia('(forced-colors: active)').matches")

        wait.until(lambda _: is_forced(), message=f"{name} did not recognize the native Windows contrast palette")
        results = []
        for theme in ("light", "dark"):
            visible(".workspace-toggle").click()
            visible(f"input[name='theme'][value='{theme}']").click()
            wait.until(lambda tab: tab.execute_script("return document.documentElement.dataset.theme") == theme)
            visible(".workspace-toggle").click()
            if theme == "light":
                visible(".launcher-tile").click()
            action = visible(".notes-list .primary")
            action.click()
            title = f"Synthetic {theme} contrast note"
            body = "Check focus, save and reflow. Sample text: \u4e2d\u6587\u7b14\u8bb0."
            visible("#note-title").send_keys(title)
            ActionChains(driver).send_keys(Keys.TAB).perform()
            active_field = driver.switch_to.active_element
            if active_field.get_attribute("id") != "note-body":
                raise AssertionError("Tab did not reach the Notes body")
            active_field.send_keys(body)
            wait.until(lambda _: visible(".save-status").text == "Saved on this device")
            focus = driver.execute_script("""
                const field = document.activeElement;
                const style = getComputedStyle(field);
                return { visible: field.matches(':focus-visible'),
                  style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
            """)
            if not is_forced() or not focus["visible"] or focus["style"] == "none" or focus["width"] <= 0:
                raise AssertionError(f"Expected forced colors and a focus indicator on the editor: {focus}")
            ActionChains(driver).move_to_element(action).perform()
            hover = driver.execute_script("""
                const action = arguments[0];
                const sample = document.createElement('button');
                sample.hidden = true;
                sample.style.color = 'ButtonText';
                sample.style.backgroundColor = 'ButtonFace';
                action.after(sample);
                const system = getComputedStyle(sample);
                const style = getComputedStyle(action);
                const label = [...action.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
                const range = new Range();
                range.selectNode(label);
                const bounds = range.getBoundingClientRect();
                const result = {
                  matchesSystemColors: style.color === system.color && style.backgroundColor === system.backgroundColor,
                  isHovered: action.matches(':hover'),
                  text: style.color,
                  background: style.backgroundColor,
                  wallpaperHidden: getComputedStyle(document.body).backgroundImage === 'none',
                  label: {x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height},
                  devicePixelRatio: window.devicePixelRatio,
                };
                sample.remove();
                return result;
            """, action)
            if not hover["matchesSystemColors"] or not hover["isHovered"] or not hover["wallpaperHidden"]:
                raise AssertionError(f"Expected a readable hovered primary action in forced colors: {hover}")
            screenshot = output / f"{name}-{theme}-forced-colors.png"
            if not driver.save_screenshot(str(screenshot)):
                raise AssertionError(f"Failed to capture {screenshot.name}")
            driver.refresh()
            if not is_forced():
                raise AssertionError("Page reload lost the Windows forced colors media state")
            visible(".launcher-tile").click()
            exact_row = wait.until(EC.element_to_be_clickable(
                (By.XPATH, f"//li/button[.//span[normalize-space(.)='{title}']]"),
            ))
            exact_row.click()
            assert visible("#note-title").get_property("value") == title
            assert visible("#note-body").get_property("value") == body
            assert driver.execute_script("return document.documentElement.dataset.theme") == theme
            results.append({"theme": theme, "forcedColors": True, "editorFocus": focus,
                            "hoveredNewNote": hover, "savedAndReopenedExactNote": True,
                            "screenshot": screenshot.name})
        return {"browser": name, "browserVersion": driver.capabilities["browserVersion"],
                "buildId": build, "themes": results, "outcome": "PASS"}
