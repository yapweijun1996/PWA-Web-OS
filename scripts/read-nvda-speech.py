"""Return text from the native NVDA Speech Viewer in the disposable Windows run."""

import ctypes
import json
import sys
from ctypes import wintypes

user32 = ctypes.WinDLL("user32", use_last_error=True)
window_callback = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

user32.FindWindowW.argtypes = (wintypes.LPCWSTR, wintypes.LPCWSTR)
user32.FindWindowW.restype = wintypes.HWND
user32.EnumChildWindows.argtypes = (wintypes.HWND, window_callback, wintypes.LPARAM)
user32.GetClassNameW.argtypes = (wintypes.HWND, wintypes.LPWSTR, ctypes.c_int)
user32.SendMessageTimeoutW.argtypes = (
    wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM,
    wintypes.UINT, wintypes.UINT, ctypes.POINTER(ctypes.c_size_t),
)
user32.SendMessageTimeoutW.restype = wintypes.LPARAM


def speech_viewer():
    window = user32.FindWindowW(None, "NVDA Speech Viewer")
    if not window:
        return {"ready": False, "speech": "", "controls": []}

    edits, controls = [], []

    @window_callback
    def find_edits(child, _):
        name = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(child, name, len(name))
        controls.append(name.value)
        if "edit" in name.value.lower():
            edits.append(child)
        return True

    user32.EnumChildWindows(window, find_edits, 0)
    if len(edits) != 1:
        return {"ready": False, "speech": "", "controls": controls}

    # WM_GETTEXT retrieves the actual reader's rendered speech history without
    # activating the window or changing the clipboard.
    buffer = ctypes.create_unicode_buffer(32768)
    result = ctypes.c_size_t()
    ok = user32.SendMessageTimeoutW(edits[0], 0x000D, len(buffer), ctypes.addressof(buffer),
                                    0x0002, 1000, ctypes.byref(result))
    return {"ready": bool(ok), "speech": buffer.value, "controls": controls}


if sys.argv[1:] == ["--move-cursor"]:
    user32.SetCursorPos(0, 0)
else:
    print(json.dumps(speech_viewer()))
