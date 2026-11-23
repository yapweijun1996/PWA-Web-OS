"""Verify locale and appearance while a genuine Windows tab is editing offline."""

import ctypes
from ctypes import wintypes
import os
import winreg

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait


THEME_KEY = r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"
THEME_SETTING = "AppsUseLightTheme"


def notify_windows_appearance():
    # Deliver the same desktop setting notification that applications use to
    # refresh the effective color scheme after a Windows preference change.
    user32 = ctypes.WinDLL("user32")
    send = user32.SendMessageTimeoutW
    send.argtypes = (wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM,
                     wintypes.UINT, wintypes.UINT, ctypes.POINTER(ctypes.c_size_t))
    send.restype = wintypes.LPARAM
    name = ctypes.create_unicode_buffer("ImmersiveColorSet")
    result = ctypes.c_size_t()
    send(0xFFFF, 0x001A, 0, ctypes.addressof(name), 0x0002, 500, ctypes.byref(result))


def windows_theme_transition(driver, wait):
    if os.environ.get("GITHUB_ACTIONS") != "true":
        raise RuntimeError("The Windows theme transition requires a disposable Actions desktop")
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, THEME_KEY, 0,
                        winreg.KEY_READ | winreg.KEY_SET_VALUE) as key:
        try:
            old = winreg.QueryValueEx(key, THEME_SETTING)
        except FileNotFoundError:
            old = None
        initial = driver.execute_script("return matchMedia('(prefers-color-scheme: dark)').matches")
        try:
            winreg.SetValueEx(key, THEME_SETTING, 0, winreg.REG_DWORD, int(initial))
            notify_windows_appearance()
            wait.until(lambda _: driver.execute_script(
                "return matchMedia('(prefers-color-scheme: dark)').matches") != initial)
            expected = "light" if initial else "dark"
            wait.until(lambda _: driver.execute_script(
                "return getComputedStyle(document.documentElement).colorScheme") == expected)
            return {"from": "dark" if initial else "light", "to": expected}
        finally:
            if old is None:
                winreg.DeleteValue(key, THEME_SETTING)
            else:
                value, kind = old
                winreg.SetValueEx(key, THEME_SETTING, 0, kind, value)
            notify_windows_appearance()


def exercise_client_preferences(driver, title_text, saved_body):
    wait = WebDriverWait(driver, 12)

    def visible(selector):
        return wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, selector)))

    title = visible("#note-title")
    body = visible("#note-body")
    oversized = "\u8349" * 100
    title.clear()
    title.send_keys(oversized)
    wait.until(lambda _: visible(".save-status").text == "Save failed. Your changes are not saved.")
    driver.execute_script("arguments[0].setSelectionRange(1, 4)", body)

    toggle = visible(".workspace-toggle")
    toggle.click()
    language = visible(".locale-control select")
    themes = []
    for locale, body_label in (("zh-Hans", "\u6b63\u6587"), ("en", "Body")):
        Select(language).select_by_value(locale)
        wait.until(lambda _: driver.find_element(By.TAG_NAME, "html").get_attribute("lang") == locale)
        assert driver.find_element(By.CSS_SELECTOR, "label[for='note-body']").get_attribute("textContent") == body_label
        for mode in ("dark", "light"):
            visible(f"input[name='theme'][value='{mode}']").click()
            wait.until(lambda _: driver.execute_script(
                "return getComputedStyle(document.documentElement).colorScheme") == mode)
            themes.append({"locale": locale, "theme": mode})
    visible("input[name='theme'][value='system']").click()
    assert driver.find_element(By.TAG_NAME, "html").get_attribute("data-theme") == "system"
    transition = windows_theme_transition(driver, wait)
    visible("input[name='theme'][value='system']").send_keys(Keys.ESCAPE)
    assert driver.switch_to.active_element == toggle

    assert title.get_property("value") == oversized
    assert body.get_property("value") == saved_body
    assert driver.execute_script("return [arguments[0].selectionStart, arguments[0].selectionEnd]", body) == [1, 4]

    title.clear()
    title.send_keys(title_text)
    retry = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space(.)='Retry']")))
    retry.click()
    wait.until(lambda _: visible(".save-status").text == "Saved on this device")
    return {"localesAndExplicitThemes": themes, "systemAppearance": transition,
            "offlineDraftAndSelection": "PASS", "retry": "PASS"}
