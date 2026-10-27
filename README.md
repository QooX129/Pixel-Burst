# Pixel-Burst

Pixel-Burst is a small, browser-based experience for letting go of a thought.
Write a short message in English or Traditional Chinese, then watch its pixels
move with your voice—or use your keyboard instead.

The app is live at <https://qoox129.github.io/Pixel-Burst/>.

## Design

People carry stress in different ways. Pixel-Burst turns the impulse to shout
into a visible burst of pixels, offering a small, expressive way to let pressure
out. The manual option makes the same release gesture available without
shouting or using a microphone.

## What you can do

- Enter up to 80 characters, including Traditional Chinese and multiline text.
- Use your microphone to move the pixels. Adjust sensitivity to suit your voice.
- Choose manual mode and hold the button with a mouse, touch, Space, or Enter.
- Start over or enter new words whenever you like.

Your text and microphone audio stay in the browser. Audio is not recorded or
sent anywhere. Microphone access is requested only when you choose microphone
mode. Reduced-motion preferences are respected.

## Run locally

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and
Python 3.11 or newer. The runtime dependency is listed in
[requirements.txt](requirements.txt). From the project directory, run:

```sh
uv run --with-requirements requirements.txt app.py
```

uv installs the listed dependencies automatically, then starts the app. Open
<http://127.0.0.1:5000> in your browser. Stop the server with Ctrl+C.

## Test

Install the test browser once, then run the test suite:

```sh
uv run --group dev playwright install chromium
uv run --group dev python -m pytest -q
```

The tests use simulated microphone input; they do not record audio or require
access to a physical microphone.
