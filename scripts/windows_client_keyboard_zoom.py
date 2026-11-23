"""Check actual page zoom and keyboard navigation in a headed Windows browser."""

import json
from zipfile import ZipFile

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait

from desktop_browser import browser


def set_browser_zoom(driver, name, profile, url):
    if name == "chrome":
        driver.get("chrome://settings/appearance")
        zoom_setting = driver.execute_async_script("""
            const done = arguments[0];
            chrome.settingsPrivate.setDefaultZoom(2, success => {
              if (!success) { done(null); return; }
              chrome.settingsPrivate.getDefaultZoom(done);
            });
        """)
        if zoom_setting != 2:
            raise AssertionError(f"Chrome page zoom setting was {zoom_setting!r}")
        driver.get(url)
        return "Chrome default page zoom setting"

    # Firefox supports installing a temporary add-on for the public per-tab zoom API.
    archive = profile.with_suffix(".xpi")
    with ZipFile(archive, "w") as extension:
        extension.writestr("manifest.json", json.dumps({
            "manifest_version": 3, "name": "Notes QA page zoom", "version": "1.0",
            "browser_specific_settings": {"gecko": {"id": "qa-page-zoom@pwa-web-os.invalid"}},
            "background": {"scripts": ["zoom.js"]},
        }))
        extension.writestr("zoom.js", "browser.tabs.setZoom(2);")
    driver.install_addon(str(archive), temporary=True)
    return "Firefox tabs.setZoom in a temporary add-on"


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
        try:
            node = wait.until(
                lambda browser: browser.execute_script("""
                    const node = document.activeElement;
                    return node.matches(arguments[0]) ? node : null;
                """, selector),
            )
        except TimeoutException as error:
            actual = driver.execute_script("""
                const node = document.activeElement;
                return [node.tagName, node.id, node.className, node.getAttribute('aria-label')];
            """)
            raise AssertionError(f"Expected keyboard focus on {label}, found {actual}") from error
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

    def tab_to(selector, label, scroll_stop=None):
        press(Keys.TAB)
        # Browsers can give overflowing containers one Tab stop for keyboard scrolling.
        if scroll_stop and driver.execute_script("""
            const node = document.activeElement;
            return node.matches(arguments[0]) && node.scrollHeight > node.clientHeight &&
              ['auto', 'scroll'].includes(getComputedStyle(node).overflowY);
        """, scroll_stop):
            focused(scroll_stop, f"Scrollable area before {label}")
            press(Keys.TAB)
        return focused(selector, label)

    def open_notes():
        driver.get(url)
        wait.until(lambda browser: browser.execute_script("return window.__pwaUpdate?.buildId") == build)
        if abs(viewport(driver)["dpr"] - expected_dpr) > 0.01:
            raise AssertionError("Browser did not retain page zoom across navigation")
        toggle = tab_to(".workspace-toggle", "Workspace")
        press(Keys.ENTER)
        wait.until(lambda _: toggle.get_attribute("aria-expanded") == "true", message="Workspace did not open")
        tab_to('input[type="radio"]:checked', "System appearance", scroll_stop=".workspace-menu")
        tab_to("select", "Language")
        tab_to(".backup-menu summary", "Backup")
        press(Keys.ESCAPE)
        if focused(".workspace-toggle", "Workspace").get_attribute("aria-expanded") != "false":
            raise AssertionError("Escape did not close the workspace menu")
        tab_to(".launcher-tile", "Notes launcher")
        press(Keys.ENTER)
        focused(".window-bar h2", "Notes heading")
        if driver.execute_script("return matchMedia('(max-width: 600px)').matches"):
            tab_to(".launcher-back", "Back to workspace", scroll_stop=".notes-list")
        else:
            for label in ("Minimize", "Maximize", "Close"):
                tab_to(f'.window-controls button[aria-label="{label}"]', label)
        tab_to(".notes-list .primary", "New note", scroll_stop=".notes-list")

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
        zoom_method = set_browser_zoom(driver, name, profile, url)
        zoomed = WebDriverWait(driver, 10).until(
            lambda active: sample if (sample := viewport(active))["dpr"] > baseline["dpr"] else False,
            message=f"{name} page zoom did not increase the device pixel ratio",
        )
        ratio = zoomed["dpr"] / baseline["dpr"]
        if abs(ratio - 2) > 0.02 or abs(zoomed["width"] * 2 - baseline["width"]) > 30 or zoomed["visualScale"] != 1:
            raise AssertionError(f"Expected 200% browser page zoom: {baseline} -> {zoomed}")
        enlarged = exercise_at_zoom(
            driver, url, build, zoomed["dpr"], "Synthetic keyboard 200", "Saved at enlarged zoom.",
        )
        return {
            "browser": name, "browserVersion": driver.capabilities["browserVersion"],
            "zoomMethod": zoom_method, "pageZoomRatio": ratio,
            "normal": normal, "enlarged": enlarged, "outcome": "PASS",
        }
