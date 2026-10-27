import { characters, clamp } from "./interaction.js";

export const MAX_PARTICLES = 14000;

export class PixelRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.text = "";
    this.particles = [];
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.intensity = 0;
    this.burstProgress = 0;
  }

  layout(text = this.text) {
    this.text = text;
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, Math.min(960, Math.round(rect.width)));
    this.height = Math.max(1, Math.min(420, Math.round(rect.height)));
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const mask = document.createElement("canvas");
    mask.width = this.width;
    mask.height = this.height;
    const ctx = mask.getContext("2d", { willReadFrequently: true });
    const glyphs = characters(text.trim());
    const maxWidth = this.width - 40;
    const maxHeight = this.height - 40;
    let lines = [];
    let size = Math.min(96, Math.floor(this.height / 2));
    const fontFamily = getComputedStyle(this.canvas).fontFamily;
    let spacing = 0;
    const lineWidth = line => line.reduce((width, glyph) => width + ctx.measureText(glyph).width, 0)
      + Math.max(0, line.length - 1) * spacing;
    for (; size >= 1; size--) {
      ctx.font = `normal ${size}px ${fontFamily}`;
      spacing = Math.max(2, size * .08);
      lines = [[]];
      for (const glyph of glyphs) {
        if (glyph === "\n" || glyph === "\r\n") {
          lines.push([]);
        } else {
          const last = lines.length - 1;
          if (lines[last].length && lineWidth([...lines[last], glyph]) > maxWidth) lines.push([glyph]);
          else lines[last].push(glyph);
        }
      }
      if (lines.length * size * 1.3 <= maxHeight &&
          lines.every(line => lineWidth(line) <= maxWidth)) break;
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#000";
    const lineHeight = size * 1.3;
    lines.forEach((line, index) => {
      let x = (this.width - lineWidth(line)) / 2;
      const y = this.height / 2 + (index - (lines.length - 1) / 2) * lineHeight;
      for (const glyph of line) {
        ctx.fillText(glyph, x, y);
        x += ctx.measureText(glyph).width + spacing;
      }
    });
    const image = ctx.getImageData(0, 0, this.width, this.height);
    let step = size < 16 ? 1 : 2;
    // Sample cell centers instead of filling any cell touched by ink, which thickens strokes.
    for (;;) {
      this.particles = [];
      for (let y = 0; y < this.height; y += step) {
        for (let x = 0; x < this.width; x += step) {
          const sampleX = Math.min(this.width - 1, x + Math.floor(step / 2));
          const sampleY = Math.min(this.height - 1, y + Math.floor(step / 2));
          if (image.data[(sampleY * this.width + sampleX) * 4 + 3] <= 127) continue;
          const angle = Math.random() * Math.PI * 2;
          const distance = 25 + Math.random() * Math.min(this.width, this.height) * .5;
          this.particles.push({
            x, y, dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance,
            speed: .7 + Math.random() * .6, size: step,
          });
        }
      }
      if (this.particles.length <= MAX_PARTICLES) break;
      step++;
    }
    this.draw(this.intensity, this.burstProgress);
  }

  draw(intensity = 0, burstProgress = 0) {
    this.intensity = intensity;
    this.burstProgress = burstProgress;
    const ctx = this.context;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#000";
    const reduced = this.motion.matches;
    if (burstProgress >= 1 || (reduced && burstProgress > 0)) return;
    // Smoothed intensity approaches 1 asymptotically, so treat its top 2% as maximum.
    const shake = reduced || burstProgress > 0 ? 0 : clamp((intensity - .98) / .02) * 1;
    for (const p of this.particles) {
      const expansion = reduced ? intensity * .03 : intensity ** 1.5;
      const burst = reduced ? 0 : burstProgress * 14;
      const x = p.x + p.dx * (expansion + burst * p.speed)
        + (shake ? (Math.random() * 2 - 1) * shake : 0);
      const y = p.y + p.dy * (expansion + burst * p.speed) + burst ** 2 * 2
        + (shake ? (Math.random() * 2 - 1) * shake : 0);
      const cell = Math.max(1, p.size * (1 - clamp(burstProgress)));
      ctx.fillRect(Math.round(x), Math.round(y), cell, cell);
    }
  }

  clear() {
    this.text = "";
    this.particles = [];
    this.draw();
  }
}
