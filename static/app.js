import { characters, validateText, thresholdFor, rms, relativeLevel, smoothLevel, HoldTimer, clamp } from "./interaction.js";
import { PixelRenderer } from "./renderer.js";

const $ = id => document.getElementById(id);
const renderer = new PixelRenderer($("pixels"));
const timer = new HoldTimer();
let state = "entry";
let mode = "mic";
let text = "";
let generation = 0;
let stream = null;
let audioContext = null;
let analyser = null;
let samples = null;
let noise = 0.003;
let calibrationSamples = [];
let calibrationStart = 0;
let burstStart = 0;
let intensity = 0;
let manualPressed = false;
let manualPointer = null;
let manualKey = null;
let frame = null;
let previousTime = 0;
let composing = false;

function announce(message) { $("status").textContent = message; }

function resetHold() {
  timer.reset();
  $("hold").value = 0;
  $("hold-label").textContent = "0.0 / 3.0 s";
}

function releaseManual() {
  manualPressed = false;
  manualKey = null;
  manualPointer = null;
  $("manual-hold").setAttribute("aria-pressed", "false");
  if (state !== "bursting" && state !== "done") resetHold();
}

function clearLevels() {
  releaseManual();
  intensity = 0;
  $("volume").value = 0;
  $("volume-label").textContent = "QUIET";
  renderer.draw(0);
}

function disposeAudio() {
  if (stream) {
    for (const track of stream.getTracks()) {
      track.onended = null;
      track.onmute = null;
      track.stop();
    }
  }
  const context = audioContext;
  if (context) context.onstatechange = null;
  stream = audioContext = analyser = samples = null;
  if (context && context.state !== "closed") {
    context.close().catch(error => {
      console.error("Could not close microphone audio context:", error);
      announce("Audio cleanup failed. Reload this page to release the audio context.");
    });
  }
}

function showState(next, message) {
  state = next;
  if (message) announce(message);
  $("entry").hidden = state !== "entry";
  $("experience").hidden = state === "entry";
  $("start").hidden = !["ready", "paused"].includes(state);
  $("start").textContent = state === "paused" ? "Resume" : "Start";
  $("calibrate").hidden = mode !== "mic" || !["ready", "active", "paused"].includes(state);
  $("retry").hidden = state !== "error";
  $("switch-manual").hidden = mode !== "mic" || !["requesting", "calibrating", "ready", "paused", "error"].includes(state);
  $("manual-hold").hidden = mode !== "manual" || state !== "active";
  $("restart").hidden = state !== "done";
  $("meters").hidden = ["bursting", "done"].includes(state);
  $("sensitivity-panel").hidden = mode === "manual" || !["ready", "active", "paused"].includes(state);
  $("mode-note").textContent = mode === "manual"
    ? "MANUAL MODE / Simulated intensity, not microphone volume. Hold with a pointer, Space, or Enter."
    : "MICROPHONE / No audio is recorded or sent anywhere. Use a comfortable voice.";
  $("step-label").textContent = ["bursting", "done"].includes(state) ? "03 / LET IT GO"
    : mode === "manual" ? "02 / MANUAL MODE" : "02 / FIND YOUR LEVEL";
  if (["active", "calibrating", "bursting"].includes(state)) {
    if (frame === null) {
      previousTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  } else {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }
}

function fail(message, error) {
  if (error) console.error(message, error);
  generation++;
  disposeAudio();
  clearLevels();
  showState("error", message);
  $("status").focus();
}

function pause(message = "Paused. Select Resume when you are ready. Your hold has reset.") {
  if (!["active", "calibrating", "ready"].includes(state)) return;
  clearLevels();
  if (state === "calibrating") {
    generation++;
    disposeAudio();
    showState("error", "Calibration was interrupted. Retry the microphone when you are ready.");
  } else {
    showState("paused", message);
    if (audioContext?.state === "running") {
      audioContext.suspend().catch(error => fail("Could not pause the microphone. Please retry.", error));
    }
  }
}

function permissionMessage(error) {
  if (error.name === "NotAllowedError") return "Microphone access was denied. Allow it in browser settings, then retry, or use manual mode.";
  if (error.name === "NotFoundError") return "No microphone was found. Connect one and retry, or use manual mode.";
  if (error.name === "NotReadableError") return "The microphone could not be opened. Check whether another application is using it.";
  return `Microphone setup failed (${error.name || "unknown error"}). Retry or use manual mode.`;
}

async function beginMicrophone() {
  const request = ++generation;
  disposeAudio();
  clearLevels();
  mode = "mic";
  showState("requesting", "Allow microphone access. Then stay quiet for two seconds to measure the room.");
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    fail("Microphone access requires a supported browser on localhost or trusted HTTPS. You can use manual mode instead.");
    return;
  }
  let requestedStream;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio is not supported");
    const context = new AudioContextClass();
    audioContext = context;
    await context.resume();
    if (request !== generation) return;
    requestedStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
    if (request !== generation) {
      requestedStream.getTracks().forEach(track => track.stop());
      return;
    }
    stream = requestedStream;
    if (!stream.getAudioTracks().length) throw new Error("No audio track was returned");
    analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    context.createMediaStreamSource(stream).connect(analyser);
    samples = new Float32Array(analyser.fftSize);
    for (const track of stream.getAudioTracks()) {
      track.onended = () => fail("The microphone was disconnected. Reconnect and retry, or use manual mode.");
      track.onmute = () => fail("The microphone input was interrupted or muted. Check your input and retry.");
    }
    context.onstatechange = () => {
      if (context.state !== "running" && ["active", "calibrating"].includes(state)) {
        pause("Audio was interrupted. Select Resume to continue; your hold has reset.");
      }
    };
    calibrationSamples = [];
    calibrationStart = performance.now();
    showState("calibrating", "Calibrating for two seconds. Stay quiet and let the room settle.");
  } catch (error) {
    if (request === generation) fail(permissionMessage(error), error);
    else requestedStream?.getTracks().forEach(track => track.stop());
  }
}

function beginManual() {
  generation++;
  disposeAudio();
  clearLevels();
  mode = "manual";
  showState("ready", "Manual mode: select Start, then hold the button for three seconds. Release to restore your words.");
  $("start").focus();
}

async function start() {
  if (!["ready", "paused"].includes(state)) return;
  const request = generation;
  const wasPaused = state === "paused";
  try {
    if (mode === "mic") {
      if (!audioContext || !stream?.active) {
        fail("The microphone is no longer available. Retry to calibrate it again.");
        return;
      }
      await audioContext.resume();
      if (request !== generation || !["ready", "paused"].includes(state)) return;
      if (audioContext.state !== "running") throw new Error("Audio context did not resume");
    }
    if (document.hidden) return;
    clearLevels();
    showState("active", mode === "manual"
      ? "Hold the button for three continuous seconds to burst. Release to let the pixels settle."
      : "Use your voice to move the pixels. Hold above the threshold for three seconds to let go.");
    if (mode === "manual") $("manual-hold").focus();
    else if (wasPaused || document.activeElement === $("start")) $("status").focus();
  } catch (error) {
    if (request === generation) fail("Audio could not resume. Retry the microphone or use manual mode.", error);
  }
}

function burst(now) {
  generation++;
  disposeAudio();
  releaseManual();
  burstStart = now;
  showState("bursting", "Letting go.");
}

function tick(now) {
  frame = null;
  const elapsed = now - previousTime;
  const dt = Math.min(elapsed / 1000, .05);
  previousTime = now;
  if (elapsed > 500 && ["active", "calibrating"].includes(state)) {
    pause("Playback was interrupted. Resume when ready; your hold has reset.");
    return;
  }
  if (state === "calibrating" || (state === "active" && mode === "mic")) {
    if (!analyser || audioContext?.state !== "running") {
      pause("Audio was interrupted. Resume when ready.");
      return;
    }
    analyser.getFloatTimeDomainData(samples);
  }
  if (state === "calibrating") {
    const amplitude = rms(samples);
    calibrationSamples.push(amplitude);
    const progress = clamp((now - calibrationStart) / 2000);
    $("volume").value = amplitude;
    $("volume-label").textContent = `CALIBRATING ${Math.round(progress * 100)}%`;
    if (progress >= 1) {
      const sorted = calibrationSamples.slice().sort((a, b) => a - b);
      noise = sorted[Math.floor(sorted.length * .8)];
      if (Math.max(...sorted) < 0.0000001) {
        fail("The microphone is returning silence. Check its mute switch and input settings, then retry.");
        return;
      }
      if (noise > .12) {
        fail("The room or microphone input is too loud to calibrate. Try a quieter space or reduce input gain.");
        return;
      }
      clearLevels();
      showState("ready", "Room measured. Adjust sensitivity if needed, then select Start. A comfortable voice is enough.");
      $("start").focus();
      return;
    }
  } else if (state === "active") {
    const raw = mode === "manual" ? Number(manualPressed) : relativeLevel(rms(samples), noise);
    intensity = smoothLevel(intensity, raw, dt);
    $("volume").value = intensity;
    const threshold = mode === "manual" ? .5 : thresholdFor(Number($("sensitivity").value));
    const didBurst = timer.update(raw, threshold, now);
    $("volume-label").textContent = mode === "manual" ? "SIMULATED"
      : raw >= threshold ? "ABOVE THRESHOLD" : raw >= threshold - .05 ? "NEAR THRESHOLD" : "BELOW THRESHOLD";
    $("hold").value = timer.progress;
    $("hold-label").textContent = `${(timer.progress * 3).toFixed(1)} / 3.0 s`;
    renderer.draw(intensity);
    if (didBurst) burst(now);
  } else if (state === "bursting") {
    const progress = clamp((now - burstStart) / (renderer.motion.matches ? 150 : 1400));
    renderer.draw(intensity, progress);
    if (progress >= 1) {
      clearLevels();
      renderer.draw(0, 1);
      showState("done", "Gone. Take a breath. You can begin again whenever you like.");
      $("restart").focus();
      return;
    }
  }
  if (frame === null && ["active", "calibrating", "bursting"].includes(state)) frame = requestAnimationFrame(tick);
}

function enterSession(useMicrophone) {
  if (composing) return;
  const value = $("text-input").value;
  const error = validateText(value);
  $("input-error").textContent = error;
  $("text-input").setAttribute("aria-invalid", String(Boolean(error)));
  if (error) {
    $("text-input").focus();
    return;
  }
  text = value;
  $("experience").hidden = false;
  $("entry").hidden = true;
  $("text-equivalent").textContent = `Your words: ${text}`;
  renderer.layout(text);
  $("status").focus();
  if (useMicrophone) beginMicrophone();
  else beginManual();
}

function restart() {
  generation++;
  disposeAudio();
  clearLevels();
  renderer.clear();
  text = "";
  $("text-equivalent").textContent = "";
  $("text-input").value = "";
  $("text-count").textContent = "0 / 80";
  $("input-error").textContent = "";
  $("text-input").removeAttribute("aria-invalid");
  showState("entry");
  $("text-input").focus();
}

$("text-input").addEventListener("input", () => {
  $("text-count").textContent = `${characters($("text-input").value).length} / 80`;
  $("input-error").textContent = "";
  $("text-input").removeAttribute("aria-invalid");
});
$("text-input").addEventListener("compositionstart", () => { composing = true; });
$("text-input").addEventListener("compositionend", () => { composing = false; });
$("text-form").addEventListener("submit", event => {
  event.preventDefault();
  if (!event.isComposing) enterSession(true);
});
$("manual-entry").addEventListener("click", () => enterSession(false));
$("retry").addEventListener("click", beginMicrophone);
$("calibrate").addEventListener("click", beginMicrophone);
$("switch-manual").addEventListener("click", beginManual);
$("start").addEventListener("click", start);
$("edit").addEventListener("click", restart);
$("restart").addEventListener("click", restart);
$("sensitivity").addEventListener("input", () => {
  $("sensitivity-value").value = $("sensitivity").value;
  resetHold();
});

const holdButton = $("manual-hold");
function pressManual() {
  if (state !== "active" || mode !== "manual") return;
  manualPressed = true;
  holdButton.setAttribute("aria-pressed", "true");
}
holdButton.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0) return;
  manualPointer = event.pointerId;
  holdButton.setPointerCapture(event.pointerId);
  pressManual();
});
for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
  holdButton.addEventListener(eventName, event => {
    if (event.pointerId === manualPointer) releaseManual();
  });
}
holdButton.addEventListener("keydown", event => {
  if (![" ", "Enter"].includes(event.key) || event.repeat) return;
  event.preventDefault();
  manualKey = event.key;
  pressManual();
});
holdButton.addEventListener("keyup", event => {
  if (event.key === manualKey) {
    event.preventDefault();
    releaseManual();
  }
});
holdButton.addEventListener("contextmenu", event => event.preventDefault());
holdButton.addEventListener("blur", releaseManual);
window.addEventListener("blur", () => {
  releaseManual();
  if (state === "active") pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    releaseManual();
    if (state === "requesting") {
      generation++;
      disposeAudio();
      showState("error", "Microphone setup was interrupted. Retry when you return.");
    } else pause();
  }
});
window.addEventListener("pagehide", () => {
  generation++;
  disposeAudio();
  clearLevels();
  if (state !== "entry") showState("error", "This session ended when you left the page. Retry or start over.");
});
new ResizeObserver(() => {
  if (state !== "entry") renderer.layout(text);
}).observe($("stage"));
renderer.motion.addEventListener("change", () => renderer.draw(intensity, renderer.burstProgress));
