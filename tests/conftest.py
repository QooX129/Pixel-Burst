from threading import Thread

import pytest
from playwright.sync_api import sync_playwright
from werkzeug.serving import make_server

from app import app


@pytest.fixture(scope="session")
def base_url():
    server = make_server("127.0.0.1", 0, app, threaded=True)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    thread.join()
    server.server_close()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        yield browser
        browser.close()


@pytest.fixture
def page(browser, base_url):
    context = browser.new_context()
    page = context.new_page()
    page.errors = []
    page.on("pageerror", lambda error: page.errors.append(str(error)))
    page.goto(base_url)
    yield page
    errors = page.errors[:]
    context.close()
    assert not errors, f"Browser errors: {errors}"


@pytest.fixture
def microphone_page(page):
    page.add_init_script("""
      window.testAudio = { amplitude: .004, reject: null, stopped: 0, closed: 0 };
      class TestAudioContext {
        constructor() { this.state = 'suspended'; }
        async resume() { this.state = 'running'; this.onstatechange?.(); }
        async suspend() { this.state = 'suspended'; this.onstatechange?.(); }
        async close() { this.state = 'closed'; window.testAudio.closed++; this.onstatechange?.(); }
        createMediaStreamSource() { return { connect() {} }; }
        createAnalyser() {
          return { fftSize: 2048, getFloatTimeDomainData(buffer) {
            buffer.forEach((_, i) => { buffer[i] = Math.sin(i * .2) * window.testAudio.amplitude; });
          }};
        }
      }
      window.AudioContext = TestAudioContext;
      navigator.mediaDevices.getUserMedia = async () => {
        if (window.testAudio.reject) throw new DOMException('Test input error', window.testAudio.reject);
        const track = { readyState: 'live', onended: null, onmute: null,
          stop() { this.readyState = 'ended'; window.testAudio.stopped++; } };
        window.testAudio.track = track;
        return { get active() { return track.readyState === 'live'; },
                 getTracks() { return [track]; }, getAudioTracks() { return [track]; } };
      };
    """)
    page.reload()
    return page
