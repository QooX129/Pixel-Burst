"""Local asset server. Text and microphone samples never leave the browser."""

import os
import ssl
from collections.abc import Mapping
from pathlib import Path

from flask import Flask, Response, render_template

app = Flask(__name__)


@app.get("/")
def index() -> str:
    return render_template("index.html")


@app.after_request
def private_response(response: Response) -> Response:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Permissions-Policy"] = "microphone=(self)"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
        "connect-src 'none'; object-src 'none'; base-uri 'none'; "
        "frame-ancestors 'none'; form-action 'none'"
    )
    return response


def server_options(environ: Mapping[str, str]) -> tuple[str, int, ssl.SSLContext | None]:
    host = environ.get("APP_HOST", "127.0.0.1").strip()
    if not host:
        raise ValueError("APP_HOST must not be empty.")
    try:
        port = int(environ.get("APP_PORT", "5000"))
    except ValueError as error:
        raise ValueError("APP_PORT must be an integer from 1 to 65535.") from error
    if not 1 <= port <= 65535:
        raise ValueError("APP_PORT must be an integer from 1 to 65535.")

    cert = environ.get("APP_CERT", "").strip()
    key = environ.get("APP_KEY", "").strip()
    if bool(cert) != bool(key):
        raise ValueError("Set both APP_CERT and APP_KEY to enable HTTPS.")
    context = None
    if cert and key:
        cert_path, key_path = Path(cert).expanduser(), Path(key).expanduser()
        if not cert_path.is_file() or not key_path.is_file():
            raise ValueError("APP_CERT and APP_KEY must point to existing files.")
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cert_path, key_path)
    return host, port, context


if __name__ == "__main__":
    try:
        host, port, context = server_options(os.environ)
    except (ValueError, OSError, ssl.SSLError) as error:
        raise SystemExit(f"Startup configuration error: {error}") from error
    app.run(host=host, port=port, ssl_context=context, debug=False, use_reloader=False)
