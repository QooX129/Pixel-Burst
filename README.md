# Pixel Burst

A local, two-color pixel-text experience for SD5913. Write something in English
or Traditional Chinese, then use your voice to pull its pixels apart. Quiet lets them return.
Hold above your calibrated threshold for **three continuous seconds** to burst
the text and let it go.

Cream-white background. Black foreground. No sound playback.

## Start

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then run
from this directory:

```sh
uv run app.py
```

Open **http://127.0.0.1:5000** in a current Chrome, Edge, Firefox, or Safari browser.
Python 3.11+ is required; uv manages the project environment and dependencies
using `pyproject.toml` and `uv.lock`. The first run may need internet access to
download Python/dependencies. The application itself makes no external requests.
There is no Node installation or frontend build step.

Stop the server with Ctrl+C. If port 5000 is already in use (for example, by
macOS AirPlay Receiver), choose another:

```sh
APP_PORT=8000 uv run app.py
```

This is a local development/installation prototype, **not a public deployment
server**. Debug mode and the automatic reloader are disabled.

## Experience

1. Enter up to **80 user-perceived characters**. English, Traditional Chinese, multiline
   input, and composed characters are supported. Empty or over-limit entries
   show an error; nothing is silently truncated.
2. Select **Next / use microphone** and allow microphone permission.
3. Stay quiet for **two seconds** while the app measures background noise.
4. Select **Start**, then speak comfortably. Higher relative volume pulls pixel
   fragments apart; quiet brings them home.
5. Raise **Sensitivity** if reaching the threshold is difficult. The volume
   meter reports whether you are above it. The separate hold meter fills over
   three seconds.
6. After the burst, select **Enter new words** to begin again.

You never need to shout at maximum volume. Take breaks and adjust sensitivity
instead of straining your voice. The meters show **relative signal levels**,
not physical decibels or calibrated sound-pressure measurements.

### Threshold behavior

The burst threshold ranges from 0.85 at sensitivity 0 to 0.25 at sensitivity 100
on the normalized 0–1 loudness scale. The default is 0.55. Once the hold starts,
a 0.05 hysteresis margin prevents tiny fluctuations from resetting it: at the
default, falling below 0.50 resets the hold. It cannot start in that margin.

Calibration uses the 80th percentile of ambient RMS samples. The noise gate is
`max(ambient × 1.8, 0.003)`, and the active range is
`max(0.08, noise gate × 4)`. These are device-relative amplitude values. A
nonzero floor avoids amplifying near-silence. Completely silent input and an
excessively loud calibration produce explicit retry messages.

Animation uses attack/release smoothing independently from the hold timer, so
the visual easing cannot keep a hold alive after the input drops. Sensitivity
changes and recalibration reset progress. Leaving the tab, losing window focus,
or an audio interruption also resets progress and requires deliberate resume
or a new calibration. A long animation interruption cannot count as a hold.

### Without a microphone

Select **Try without a microphone** (or **Use manual mode** after an error).
Select Start, then hold the on-screen button with a mouse, touch, **Space**, or
**Enter**. This is explicitly simulated intensity, not measured volume.
Releasing, cancelling a touch, or leaving the button's keyboard focus resets
the hold. The same three-second burst rule applies.

Controls support keyboard focus. Status updates are announced without narrating
every frame. The canvas has an accessible text equivalent. The system's
**reduced-motion** preference reduces displacement and replaces dispersal with
a brief completion transition.

## Privacy

- Text and audio processing stay in browser memory. No recordings, uploads,
  storage, cookies, analytics, or external fonts are used.
- Python serves HTML, JavaScript, and CSS only; it has no text/audio API.
- Microphone access is requested only through an explicit user action.
- Tracks and audio contexts are released on burst, restart, errors, or leaving
  the page. Pausing suspends analysis until you resume.
- Refreshing starts a new experience; restarting clears the previous words.
- Like any local development server, Flask logs asset request paths to the
  terminal, not the entered text or microphone samples.

## Phones on a local network: trusted HTTPS

The UI is responsive, but microphone access requires a **secure context**.
Desktop `localhost` is an exception that permits HTTP. A phone opening
`http://YOUR_COMPUTER_IP:5000` generally cannot use its microphone.
`localhost` on a phone refers to the phone, not your computer.

Use a locally trusted certificate on a trusted private network. This is a
**one-time manual trust setup**; the app does not change certificate trust or
install certificates for you.

### 1. Create a local certificate

For example, install [mkcert](https://github.com/FiloSottile/mkcert) following its
instructions. On macOS, a typical setup is:

```sh
brew install mkcert
mkcert -install
mkdir -p .certs
```

Find your computer's current LAN IPv4 address in its network settings. Replace
`192.168.1.20` below with that address:

```sh
mkcert -cert-file .certs/local.pem -key-file .certs/local-key.pem \
  localhost 127.0.0.1 ::1 192.168.1.20
mkcert -CAROOT
```

If your LAN address changes, generate a new certificate containing the new
address. Certificates and keys are ignored by Git. Never commit them.

### 2. Trust the public CA certificate on the phone

From the directory printed by `mkcert -CAROOT`, transfer **only `rootCA.pem`**
to your own test device using a trusted method.
**Never transfer `rootCA-key.pem` or the server private key.**

- **iOS/iPadOS:** install the public CA certificate profile in Settings, then
  enable full trust for that CA under **Settings → General → About →
  Certificate Trust Settings**. The exact profile-install location can vary by
  OS version. Use Safari for the initial test.
- **Android:** install the public CA certificate through the device's
  security/encryption credentials settings as a CA certificate. Menu names and
  managed-device restrictions vary. Chrome normally honors user-installed CAs;
  embedded webviews or managed browsers may not.

Trusting a CA is a security-sensitive device setting: use only your own local
CA on devices you control. Remove the test CA/profile when no longer needed.
If a managed device prohibits this, use desktop localhost/manual mode rather
than bypassing its policy.

### 3. Configure and run

On macOS/Linux, set these environment variables in your terminal:

```sh
export APP_HOST=0.0.0.0
export APP_PORT=8443
export APP_CERT="$PWD/.certs/local.pem"
export APP_KEY="$PWD/.certs/local-key.pem"
uv run app.py
```

On subsequent runs in that configured shell, the launch command is still just
`uv run app.py`. New shells need the environment settings again; `.env` files
are **not** loaded automatically. In PowerShell, use `$env:APP_HOST = "0.0.0.0"`
and equivalent assignments for the other settings.

Connect the phone to the same trusted network, allow Python through the
computer's firewall for that network, then open **https://192.168.1.20:8443**
(using your actual address). Allow microphone access on the phone. Guest Wi-Fi,
client isolation, VPNs, and firewalls can prevent devices reaching one another.
Do not forward the port to the internet.

The browser should show a valid, trusted HTTPS connection. Merely clicking
through a certificate warning is not a reliable substitute for trust and may
still block the microphone. Supplying only one TLS path, missing files, invalid
certificates, or invalid ports causes an explicit startup failure, never a silent
HTTP fallback.

To return to desktop-only defaults:

```sh
unset APP_HOST APP_PORT APP_CERT APP_KEY
uv run app.py
```

## Troubleshooting and limits

- **Permission denied:** enable microphone access in the browser's site settings
  and OS privacy settings, then Retry. Manual mode remains available.
- **No device/input:** check microphone connection, selected OS input, mute
  switches, gain, and whether another app is using the device.
- **Calibration too loud:** stay quiet, move to a quieter space, or reduce input
  gain, then retry. Recalibrate after changing hardware or location.
- **Too hard/easy to burst:** adjust sensitivity. Browser/device automatic gain
  and noise processing vary, even when the app requests them disabled.
- **Mobile interruption:** switching apps, locking the screen, or another audio
  session may suspend microphone analysis. Resume explicitly or retry.
- **Chinese appearance:** the interface and pixel renderer prefer local
  Traditional Chinese fonts (PingFang TC, Microsoft JhengHei, and Noto Sans TC /
  CJK TC). Glyphs differ between devices. User-entered text is never automatically
  converted between Simplified and Traditional Chinese. Dense text or many lines
  become smaller; short phrases produce the clearest effect.
- **Performance:** the renderer caps canvas resolution and samples to at most
  6,500 cells; it does not allocate a particle for every device-resolution pixel.
  Exact smoothness depends on the device.
- Use a current browser with Canvas 2D, Web Audio, `getUserMedia`,
  `Intl.Segmenter`, and JavaScript modules. Legacy browsers are not targeted.

## Tests

Development dependencies are declared separately. Install the test browser once:

```sh
uv run --group dev playwright install chromium
uv run --group dev pytest -q
```

The tests start and stop their own loopback server. They cover server routes and
configuration, the exact three-second boundary/hysteresis, Unicode/IME input,
pixel restoration and budgets, responsive/reduced-motion rendering, manual
interaction, calibration, permission/device errors, stale permission results,
microphone cleanup, and background-tab resets.

Audio tests inject deterministic browser-side microphone samples and lifecycle
events: they do not record or require your microphone. These and mobile viewport
emulation **do not certify physical microphone gain, real iOS/Android permission
behavior, or device CA trust**. Test those manually on your intended hardware:

1. Follow the trusted-HTTPS setup on a real phone.
2. Calibrate in quiet, then try comfortable quiet/loud/quiet speech.
3. Confirm return to the original text, progress reset below threshold, and a
   burst only after a continuous hold.
4. Rotate, background/resume, revoke permission, disconnect/reconnect input,
   restart repeatedly, and check that microphone use stops after completion.