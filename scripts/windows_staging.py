"""Serve two retained project-site releases on one test-only loopback origin."""

from contextlib import contextmanager
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import shutil
import threading


class ReleaseFiles(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".webmanifest": "application/manifest+json"}

    def __init__(self, request, address, server):
        super().__init__(request, address, server, directory=server.release_directory)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, _format, *args):
        pass


def release_identity(directory):
    raw = (directory / "manifest.json").read_bytes()
    manifest = json.loads(raw)
    return {"buildId": manifest["buildId"], "commit": manifest["commit"],
            "manifestSha256": hashlib.sha256(raw).hexdigest()}


@contextmanager
def staged_releases(root, a, b):
    directories = (root / "a", root / "b")
    for source, target in zip((a, b), directories):
        shutil.copytree(source / "dist", target / "PWA-Web-OS")
    with ThreadingHTTPServer(("127.0.0.1", 0), ReleaseFiles) as server:
        server.release_directory = directories[0]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield server, directories
        finally:
            server.shutdown()
            thread.join()
