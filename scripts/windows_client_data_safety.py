"""Verify two-tab note recovery and atomic backup rejection in a retail browser."""

import json
from uuid import uuid4

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from desktop_browser import browser


ORIGINAL_TITLE = "Synthetic shared note"
COPY_TITLE = "Synthetic recovered draft"
ORIGINAL_BODY = "Original saved text."
NEWER_BODY = "Newer committed text.\n  Retain the spaces. "
DRAFT_BODY = "Stale draft text.\n  Recover a separate copy. "


def exercise_data_safety(name, profile, downloads, url, build):
    with browser(name, profile, downloads, offline=False) as driver:
        wait = WebDriverWait(driver, 20)
        driver.set_window_size(1280, 800)

        def visible(selector):
            return wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, selector)))

        def click(selector):
            visible(selector).click()

        def open_notes():
            driver.get(url)
            wait.until(lambda _: driver.execute_script("return window.__pwaUpdate?.buildId") == build)
            click(".launcher-tile")

        def fill(selector, text):
            field = visible(selector)
            field.clear()
            field.send_keys(text)

        def saved():
            wait.until(lambda _: visible(".save-status").text == "Saved on this device")

        def notes():
            rows = wait.until(EC.visibility_of_all_elements_located((By.CSS_SELECTOR, ".note-items button")))
            by_title = {row.find_element(By.CSS_SELECTOR, ".note-row-title").text: row for row in rows}
            if len(by_title) != len(rows):
                raise AssertionError(f"Duplicate note rows in {name}")
            return by_title

        def expect_value(selector, text):
            wait.until(lambda _: visible(selector).get_property("value") == text)

        def verify_saved_notes(expected):
            open_notes()
            actual = notes()
            if set(actual) != set(expected):
                raise AssertionError(f"Unexpected saved notes in {name}: {list(actual)}")
            for title, (note_id, body) in expected.items():
                row = notes()[title]
                if row.get_dom_attribute("data-note-id") != note_id:
                    raise AssertionError(f"Note ID changed in {name}: {title}")
                row.click()
                expect_value("#note-title", title)
                expect_value("#note-body", body)

        open_notes()
        click(".notes-list .primary")
        fill("#note-title", ORIGINAL_TITLE)
        fill("#note-body", ORIGINAL_BODY)
        saved()
        original_id = notes()[ORIGINAL_TITLE].get_dom_attribute("data-note-id")
        first_tab = driver.current_window_handle
        driver.switch_to.new_window("tab")
        second_tab = driver.current_window_handle
        open_notes()
        notes()[ORIGINAL_TITLE].click()
        expect_value("#note-body", ORIGINAL_BODY)

        driver.switch_to.window(first_tab)
        fill("#note-body", NEWER_BODY)
        saved()
        driver.switch_to.window(second_tab)
        fill("#note-body", DRAFT_BODY)
        fill("#note-title", COPY_TITLE)
        wait.until(EC.visibility_of_element_located((By.XPATH,
            '//*[normalize-space(.)="A newer version of this note is already saved. Your draft has not been saved."]')))
        expect_value("#note-body", DRAFT_BODY)
        expect_value("#note-title", COPY_TITLE)
        wait.until(EC.element_to_be_clickable((By.XPATH, '//button[normalize-space(.)="Save as new"]'))).click()
        saved()
        copy_id = notes()[COPY_TITLE].get_dom_attribute("data-note-id")
        if not original_id or not copy_id or original_id == copy_id:
            raise AssertionError("The original note and recovered copy must have distinct IDs")
        expected = {ORIGINAL_TITLE: (original_id, NEWER_BODY), COPY_TITLE: (copy_id, DRAFT_BODY)}
        verify_saved_notes(expected)

        malformed = profile / "malformed.json"
        malformed.write_text('{"format":', encoding="utf-8")
        conflict = profile / "conflict.json"
        conflict.write_text(json.dumps({
            "format": "pwa-web-os.notes", "version": 1,
            "notes": [
                {"id": str(uuid4()), "title": "Synthetic incoming note", "body": "No partial import.",
                 "updatedAt": 1_700_000_000_000},
                {"id": original_id, "title": ORIGINAL_TITLE, "body": "Conflicting body.",
                 "updatedAt": 1_700_000_000_000},
            ],
        }), encoding="utf-8")
        for file, message in (
            (malformed, "This file is not a valid Notes backup. Choose a Notes backup file."),
            (conflict, "This backup contains a note that conflicts with a saved note. No notes were restored."),
        ):
            click(".workspace-toggle")
            click(".backup-menu summary")
            driver.find_element(By.CSS_SELECTOR, ".backup-menu input[type=file]").send_keys(str(file))
            wait.until(lambda _: visible(".backup-menu .feedback.error").text == message)
            if driver.find_elements(By.CSS_SELECTOR, "dialog[open]"):
                raise AssertionError("A rejected backup opened a confirmation dialog")
            verify_saved_notes(expected)

        return {
            "browser": name, "browserVersion": driver.capabilities["browserVersion"], "buildId": build,
            "staleWriteRejected": True, "separateDraftRecovered": True, "invalidBackupRejected": True,
            "conflictingBatchRejected": True, "reloadedExactTitlesBodiesAndIds": True,
        }
