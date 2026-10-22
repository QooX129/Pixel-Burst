import ssl

import pytest

from app import app, server_options


def test_local_defaults():
    assert server_options({}) == ("127.0.0.1", 5000, None)


@pytest.mark.parametrize(
    "environment, message",
    [
        ({"APP_HOST": " "}, "APP_HOST"),
        ({"APP_PORT": "no"}, "APP_PORT"),
        ({"APP_PORT": "0"}, "APP_PORT"),
        ({"APP_PORT": "65536"}, "APP_PORT"),
        ({"APP_CERT": "cert.pem"}, "both"),
        ({"APP_KEY": "key.pem"}, "both"),
        ({"APP_CERT": "missing", "APP_KEY": "missing"}, "existing"),
    ],
)
def test_invalid_configuration(environment, message):
    with pytest.raises(ValueError, match=message):
        server_options(environment)


def test_invalid_certificate_is_not_http_fallback(tmp_path):
    cert = tmp_path / "cert.pem"
    key = tmp_path / "key.pem"
    cert.write_text("invalid certificate")
    key.write_text("invalid key")
    with pytest.raises(ssl.SSLError):
        server_options({"APP_CERT": str(cert), "APP_KEY": str(key)})


def test_explicit_host_and_port():
    assert server_options({"APP_HOST": "0.0.0.0", "APP_PORT": "8443"}) == (
        "0.0.0.0", 8443, None
    )


@pytest.mark.parametrize(
    "path",
    ["/", "/static/styles.css", "/static/app.js", "/static/interaction.js", "/static/renderer.js"],
)
def test_page_and_assets(path):
    response = app.test_client().get(path)
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert "connect-src 'none'" in response.headers["Content-Security-Policy"]
    assert response.headers["Permissions-Policy"] == "microphone=(self)"


def test_no_text_or_audio_submission_endpoint():
    assert app.test_client().post("/", json={"text": "private"}).status_code == 405
