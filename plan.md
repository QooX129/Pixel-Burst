# Pixel Burst: Project Plan

## The idea

A local web app where your voice breaks words into pixels.
Speak louder to pull the pixels apart. Get quieter to let them return.
Stay above a volume threshold for three seconds, and the text bursts.

## How it works

1. **Write:** Enter English or Traditional Chinese text, up to 80 characters.
2. **Allow the microphone:** Click Next and grant permission.
3. **Calibrate:** Stay quiet for two seconds so the app can measure background noise.
4. **Start:** Speak comfortably and watch the text react.
5. **Let go:** Hold above the threshold for three continuous seconds to burst the text.
6. **Restart:** Enter new words and try again.

If microphone access is unavailable, use a manual mode: hold a button for
three seconds instead.

## Look and feel

- Cream-white background and black text, pixels, and controls.
- Minimal pixel-art style, designed for desktop and mobile.
- Use Traditional Chinese for Chinese interface text, instructions, and examples.
  Keep user-entered text as written; do not automatically convert it.
- Pixels move away from their original positions as volume rises and return
  as volume falls.
- Two meters show current volume and progress toward the burst.
- No sound effects, flashing, or extra colors.

## Important behavior

- Adjustable sensitivity makes the effect easier or harder to trigger.
  Users should not need to strain or shout at maximum volume.
- Dropping below the threshold resets the three-second hold. A small tolerance
  prevents tiny volume fluctuations from resetting it.
- Changing sensitivity, recalibrating, or leaving the tab resets progress.
  Interrupted sessions require Resume or a new calibration.
- After a burst, stop the microphone and show a restart button.
- Show clear errors for invalid text or microphone problems, with retry and
  manual-mode options.
- Support keyboard controls, readable status messages, and reduced motion.
- Keep all text and audio in the browser. No recording, uploads, accounts,
  analytics, or saved sessions. Refreshing clears the experience.

## Technology and startup

- **Python + Flask:** serve the app locally.
- **Browser JavaScript:** read microphone volume and manage the interaction.
- **Canvas:** draw text as moving pixel fragments.
- **uv:** manage Python and dependencies. No Node build step.

Start with:

```sh
uv run app.py
```

Open **http://127.0.0.1:5000** on the computer running the app.

## Build steps

1. **Set up the server:** Add Flask, uv dependencies, and startup settings.
2. **Build the screens:** Add text entry, instructions, controls, meters, and restart.
3. **Create the pixel effect:** Fit text to the screen, animate distortion,
   restore its shape, and add the burst.
4. **Connect the microphone:** Add permission, calibration, sensitivity,
   the three-second trigger, and manual mode.
5. **Test the experience:** Check timing, text limits, animation, errors,
   accessibility, cleanup, and mobile layouts.
6. **Write the guide:** Explain startup, controls, troubleshooting, and phone setup.

## Using a phone

A phone connects to the computer over the same local network.
Its microphone generally needs **trusted HTTPS**, not an ordinary HTTP address.

Set up a local certificate, trust its public CA certificate on the phone, and
configure the server's HTTPS settings. Keep private keys off the phone and out
of Git. The startup command stays the same after configuration.

See [README.md](./README.md) for the detailed setup. This server is for local
testing, not public internet hosting.

## What to check

- English and Traditional Chinese fit on desktop and mobile screens.
- Empty text and entries over 80 characters show helpful errors.
- Louder input separates pixels; quiet restores them.
- A burst happens once, only after three continuous seconds above the threshold.
- Releasing manual input or interrupting the session resets progress.
- Permission denial, missing microphones, and unusable input have recovery options.
- Restart and completion release microphone resources.
- Keyboard and reduced-motion modes work.
- No text or audio leaves the browser.

Automated tests can check the logic and simulated input. Real microphones and
phone HTTPS permissions still need testing on the intended devices.

## Things to keep in mind

- Microphone loudness varies by device; calibration and sensitivity are essential.
- Prefer local fonts that support Traditional Chinese; glyph appearance may
  still vary between devices.
- Short phrases are clearer than dense text.
- Limit the number of particles to keep animation smooth on phones.
