import pytest
from playwright.sync_api import expect


def enter_manual(page, text="Let it out / 放下"):
    page.locator("#text-input").fill(text)
    page.locator("#manual-entry").click()
    page.locator("#start").click()


def test_traditional_chinese_ui_fonts_and_unchanged_input(page):
    expect(page.locator("#text-input")).to_have_attribute(
        "placeholder", "Type something here / 在這裡寫下"
    )
    expect(page.locator("#text-help")).to_contain_text("Traditional Chinese")
    font_family = page.locator("#pixels").evaluate(
        "canvas => getComputedStyle(canvas).fontFamily"
    )
    assert "PingFang TC" in font_family
    assert "Microsoft JhengHei" in font_family
    assert "PingFang SC" not in font_family
    assert "Microsoft YaHei" not in font_family
    text = "讓文字釋放 / 让文字释放"
    enter_manual(page, text)
    expect(page.locator("#text-equivalent")).to_have_text(f"Your words: {text}")
    assert page.locator("#text-input").input_value() == text
    assert page.evaluate("""async () => {
      const { PixelRenderer } = await import('/static/renderer.js');
      const renderer = new PixelRenderer(document.querySelector('#pixels'));
      renderer.layout('讓文字釋放');
      return renderer.particles.length;
    }""") > 0


def test_threshold_exact_timing_and_hysteresis(page):
    result = page.evaluate("""async () => {
      const { HoldTimer } = await import('/static/interaction.js');
      const t = new HoldTimer();
      const hits = [t.update(.7, .6, 100), t.update(.7, .6, 3099),
                    t.update(.56, .6, 3100), t.update(1, .6, 4000)];
      t.reset();
      t.update(1, .6, 0);
      t.update(.54, .6, 2999);
      const reset = t.progress;
      const low = t.update(.58, .6, 9000);
      t.update(.7, .6, 10000);
      const before = t.update(.7, .6, 12999);
      const after = t.update(.7, .6, 13000);
      t.reset();
      const afterPause = t.update(.7, .6, 30000);
      return { hits, reset, low, before, after, afterPause, progress: t.progress };
    }""")
    assert result == {
        "hits": [False, False, True, False],
        "reset": 0, "low": False, "before": False, "after": True,
        "afterPause": False, "progress": 0,
    }


def test_unicode_limits_and_ime(page):
    page.locator("#manual-entry").click()
    expect(page.locator("#input-error")).to_have_text("Write something before continuing.")
    page.locator("#text-input").fill(" \n ")
    page.locator("#manual-entry").click()
    expect(page.locator("#entry")).to_be_visible()
    page.locator("#text-input").fill("中" * 81)
    expect(page.locator("#text-count")).to_have_text("81 / 80")
    page.locator("#manual-entry").click()
    expect(page.locator("#input-error")).to_contain_text("80 characters")
    page.locator("#text-input").fill("中" * 80)
    page.locator("#text-input").dispatch_event("compositionstart")
    page.locator("#manual-entry").click()
    expect(page.locator("#entry")).to_be_visible()
    page.locator("#text-input").dispatch_event("compositionend")
    page.locator("#manual-entry").click()
    expect(page.locator("#experience")).to_be_visible()
    assert page.evaluate("""async () => {
      const { characters } = await import('/static/interaction.js');
      return characters('👨‍👩‍👧‍👦é中').length;
    }""") == 3


def test_manual_release_reset_and_burst(page):
    enter_manual(page)
    hold = page.locator("#manual-hold")
    hold.focus()
    page.keyboard.down("Space")
    page.wait_for_function("() => document.querySelector('#hold').value > .1")
    page.keyboard.up("Space")
    expect(page.locator("#hold")).to_have_js_property("value", 0)
    page.wait_for_function("() => document.querySelector('#volume').value < .01")
    page.keyboard.down("Space")
    expect(page.locator("#restart")).to_be_visible(timeout=6500)
    page.keyboard.up("Space")
    expect(page.locator("#status")).to_contain_text("Gone")
    page.locator("#restart").click()
    expect(page.locator("#text-input")).to_have_value("")
    expect(page.locator("#text-input")).to_be_focused()
    enter_manual(page, "Again")
    expect(page.locator("#manual-hold")).to_be_visible()


def test_focus_loss_and_pointer_cancellation(page):
    enter_manual(page)
    hold = page.locator("#manual-hold")
    hold.focus()
    page.keyboard.down("Enter")
    page.wait_for_function("() => document.querySelector('#hold').value > 0")
    page.locator("#edit").focus()
    page.keyboard.up("Enter")
    expect(page.locator("#hold")).to_have_js_property("value", 0)
    hold.hover()
    page.mouse.down()
    hold.dispatch_event("pointercancel", {"pointerId": 1})
    page.mouse.up()
    expect(hold).to_have_attribute("aria-pressed", "false")


def test_mobile_layout_reduced_motion_and_render_restore(page):
    page.set_viewport_size({"width": 375, "height": 720})
    page.emulate_media(reduced_motion="reduce")
    enter_manual(page, "中文像素\nLet it go")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    result = page.evaluate("""async () => {
      const { PixelRenderer } = await import('/static/renderer.js');
      const canvas = document.querySelector('#pixels');
      const r = new PixelRenderer(canvas);
      r.layout('中文像素\\nLet it go');
      const pixels = () => Array.from(r.context.getImageData(0, 0, canvas.width, canvas.height).data);
      const home = pixels();
      r.draw(1);
      r.draw(0);
      const restored = pixels();
      const bounded = r.particles.every(p => p.x >= 0 && p.y >= 0 &&
        p.x < r.width && p.y < r.height);
      r.draw(0, 1);
      const empty = pixels().every(v => v === 0);
      return { count: r.particles.length, bounded, empty,
               restored: home.every((value, i) => value === restored[i]) };
    }""")
    assert 0 < result["count"] <= 6500
    assert result["bounded"] and result["empty"] and result["restored"]
    page.locator("#manual-hold").focus()
    page.keyboard.down("Space")
    expect(page.locator("#restart")).to_be_visible(timeout=5000)
    page.keyboard.up("Space")


def test_permission_error_and_manual_recovery(microphone_page):
    page = microphone_page
    page.evaluate("window.testAudio.reject = 'NotAllowedError'")
    page.locator("#text-input").fill("No permission")
    page.locator("button[type=submit]").click()
    expect(page.locator("#status")).to_contain_text("denied", timeout=10000)
    page.locator("#switch-manual").click()
    page.locator("#start").click()
    expect(page.locator("#manual-hold")).to_be_visible()


def calibrate(page):
    page.locator("#text-input").fill("Breathe / 呼吸")
    page.locator("button[type=submit]").click()
    expect(page.locator("#start")).to_be_visible(timeout=5000)
    expect(page.locator("#status")).to_contain_text("Room measured")


def test_microphone_calibration_sensitivity_restore_burst_and_cleanup(microphone_page):
    page = microphone_page
    requests = []
    page.on("request", lambda request: requests.append(request))
    calibrate(page)
    page.locator("#start").click()
    expect(page.locator("#hold")).to_have_js_property("value", 0)
    page.evaluate("testAudio.amplitude = .2")
    page.wait_for_function("() => document.querySelector('#hold').value > .1")
    page.locator("#sensitivity").fill("90")
    expect(page.locator("#sensitivity-value")).to_have_text("90")
    page.evaluate("testAudio.amplitude = .004")
    page.wait_for_function("() => document.querySelector('#hold').value === 0")
    page.wait_for_function("() => document.querySelector('#volume').value < .01")
    page.evaluate("testAudio.amplitude = .2")
    expect(page.locator("#restart")).to_be_visible(timeout=6500)
    assert page.evaluate("testAudio.stopped") == 1
    assert page.evaluate("testAudio.closed") == 1
    assert all(request.method == "GET" for request in requests)
    assert all(request.url.startswith(page.url) for request in requests)
    page.locator("#restart").click()
    assert page.evaluate("testAudio.stopped") == 1


def test_hidden_page_resets_hold_and_requires_resume(microphone_page):
    page = microphone_page
    calibrate(page)
    page.locator("#start").click()
    page.evaluate("testAudio.amplitude = .2")
    page.wait_for_function("() => document.querySelector('#hold').value > .1")
    page.evaluate("""() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }""")
    expect(page.locator("#hold")).to_have_js_property("value", 0)
    expect(page.locator("#start")).to_have_text("Resume")
    page.wait_for_timeout(3100)
    expect(page.locator("#restart")).to_be_hidden()
    page.evaluate("Object.defineProperty(document, 'hidden', { configurable: true, value: false })")
    page.locator("#start").click()
    expect(page.locator("#hold")).to_have_js_property("value", 0)
    page.wait_for_function("() => document.querySelector('#hold').value > .05")
    page.locator("#calibrate").click()
    expect(page.locator("#hold")).to_have_js_property("value", 0)
    page.locator("#edit").click()
    assert page.evaluate("testAudio.stopped") == 2
    assert page.evaluate("testAudio.closed") == 2


@pytest.mark.parametrize("event_name", ["onended", "onmute"])
def test_microphone_interruption(microphone_page, event_name):
    page = microphone_page
    calibrate(page)
    page.locator("#start").click()
    page.evaluate(f"testAudio.track.{event_name}()")
    expect(page.locator("#retry")).to_be_visible()
    expect(page.locator("#hold")).to_have_js_property("value", 0)
    assert page.evaluate("testAudio.stopped") == 1
    assert page.evaluate("testAudio.closed") == 1


@pytest.mark.parametrize(
    "amplitude, message",
    [(0, "returning silence"), (.5, "too loud")],
)
def test_unusable_calibration(microphone_page, amplitude, message):
    page = microphone_page
    page.evaluate("(value) => { testAudio.amplitude = value; }", amplitude)
    page.locator("#text-input").fill("Testing")
    page.locator("button[type=submit]").click()
    expect(page.locator("#status")).to_contain_text(message, timeout=5000)
    expect(page.locator("#retry")).to_be_visible()
    assert page.evaluate("testAudio.stopped") == 1


@pytest.mark.parametrize("error", ["NotFoundError", "NotReadableError"])
def test_device_errors(microphone_page, error):
    page = microphone_page
    page.evaluate("(value) => { testAudio.reject = value; }", error)
    page.locator("#text-input").fill("Testing")
    page.locator("button[type=submit]").click()
    expect(page.locator("#retry")).to_be_visible()
    assert page.evaluate("testAudio.closed") == 1


def test_insecure_context_and_cancelled_permission(microphone_page):
    page = microphone_page
    page.evaluate("Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })")
    page.locator("#text-input").fill("Testing")
    page.locator("button[type=submit]").click()
    expect(page.locator("#status")).to_contain_text("trusted HTTPS")
    page.evaluate("""() => {
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
      const original = navigator.mediaDevices.getUserMedia;
      navigator.mediaDevices.getUserMedia = () => new Promise(resolve => {
        window.resolvePermission = async () => resolve(await original());
      });
    }""")
    page.locator("#retry").click()
    page.wait_for_function("() => typeof resolvePermission === 'function'")
    page.locator("#switch-manual").click()
    page.evaluate("resolvePermission()")
    page.wait_for_function("() => testAudio.stopped === 1")
    expect(page.locator("#status")).to_contain_text("Manual mode")
    assert page.evaluate("testAudio.closed") == 1


def test_normal_motion_particle_budget_and_long_text_fit(page):
    enter_manual(page)
    result = page.evaluate("""async () => {
      const { PixelRenderer } = await import('/static/renderer.js');
      const canvas = document.querySelector('#pixels');
      const r = new PixelRenderer(canvas);
      r.layout('字'.repeat(80));
      const home = canvas.toDataURL();
      r.draw(1);
      const moved = home !== canvas.toDataURL();
      r.draw(0);
      const restored = home === canvas.toDataURL();
      let bounded = r.particles.every(p => p.x >= 10 && p.y >= 10 &&
        p.x < r.width - 10 && p.y < r.height - 10);
      const count = r.particles.length;
      for (let i = 0; i < 180; i++) r.draw((i % 60) / 60);
      r.layout('中文\\n\\nEnglish');
      bounded &&= r.particles.every(p => p.y > 10 && p.y < r.height - 10);
      return { moved, restored, bounded, count };
    }""")
    assert result["moved"] and result["restored"] and result["bounded"]
    assert 0 < result["count"] <= 6500
    page.set_viewport_size({"width": 390, "height": 844})
    expect(page.locator("#hold")).to_have_js_property("value", 0)
    expect(page.locator("#manual-hold")).to_be_visible()
