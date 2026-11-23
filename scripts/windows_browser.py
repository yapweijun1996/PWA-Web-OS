"""Start a retail browser with the test profile and selected network controls."""

import os

from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.firefox.service import Service as FirefoxService


def browser(name, profile, downloads, offline, relaunch=(), proxy_port=None):
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
        for argument in relaunch:
            options.add_argument(argument)
        if proxy_port:
            options.set_preference("network.proxy.type", 1)
            options.set_preference("network.proxy.ssl", "127.0.0.1")
            options.set_preference("network.proxy.ssl_port", proxy_port)
        options.enable_bidi = True
        options.set_preference("intl.accept_languages", "en-US")
        driver = webdriver.Firefox(options=options, service=FirefoxService(os.environ["GECKODRIVER_PATH"]))
    try:
        if offline:
            if name == "chrome":
                driver.set_network_conditions(offline=True, latency=0, download_throughput=0, upload_throughput=0)
            else:
                driver.emulation.set_network_conditions(offline=True)
        return driver
    except Exception:
        driver.quit()
        raise
