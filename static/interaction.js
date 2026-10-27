export const HOLD_MS = 2000;
export const HYSTERESIS = 0.05;
export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function characters(text) {
  return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), item => item.segment);
}

export function validateText(text) {
  if (!text.trim()) return "Write something before continuing.";
  if (characters(text).length > 80) return "Please use 80 characters or fewer.";
  return "";
}

export function thresholdFor(sensitivity) {
  return 0.85 - clamp(sensitivity, 0, 100) * 0.006;
}

export function rms(samples) {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

export function relativeLevel(amplitude) {
  return clamp((amplitude - 0.003) / 0.08);
}

export function smoothLevel(current, target, dt) {
  const duration = target > current ? 0.065 : 0.18;
  return current + (target - current) * (1 - Math.exp(-dt / duration));
}

export class HoldTimer {
  constructor() { this.reset(); }
  reset() {
    this.since = null;
    this.burst = false;
    this.progress = 0;
  }
  update(level, threshold, now) {
    if (this.burst) return false;
    if (level < threshold - HYSTERESIS) {
      this.since = null;
      this.progress = 0;
    } else if (this.since === null && level >= threshold) {
      this.since = now;
    }
    if (this.since === null) return false;
    this.progress = clamp((now - this.since) / HOLD_MS);
    if (this.progress >= 1) {
      this.burst = true;
      return true;
    }
    return false;
  }
}
