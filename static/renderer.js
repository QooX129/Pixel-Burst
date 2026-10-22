import { characters, clamp } from "./interaction.js";

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
    for (; size >= 1; size--) {
      ctx.font = `bold ${size}px ${fontFamily}`;
      lines = [""];
      for (const glyph of glyphs) {
        if (glyph === "\n" || glyph === "\r\n") {
          lines.push("");
        } else {
          const last = lines.length - 1;
          if (lines[last] && ctx.measureText(lines[last] + glyph).width > maxWidth) lines.push(glyph);
          else lines[last] += glyph;
        }
      }
      if (lines.length * size * 1.3 <= maxHeight &&
          lines.every(line => ctx.measureText(line).width <= maxWidth)) break;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#000";
    const lineHeight = size * 1.3;
    lines.forEach((line, index) => {
      ctx.fillText(line, this.width / 2, this.height / 2 + (index - (lines.length - 1) / 2) * lineHeight);
    });
    const image = ctx.getImageData(0, 0, this.width, this.height);
    let step = Math.max(2, Math.ceil(Math.sqrt(this.width * this.height / 6500)));
    while (Math.ceil(this.width / step) * Math.ceil(this.height / step) > 6500) step++;
    this.particles = [];
    for (let y = 0; y < this.height; y += step) {
      for (let x = 0; x < this.width; x += step) {
        let ink = false;
        for (let dy = 0; dy < step && y + dy < this.height && !ink; dy++) {
          for (let dx = 0; dx < step && x + dx < this.width; dx++) {
            if (image.data[((y + dy) * this.width + x + dx) * 4 + 3] > 100) {
              ink = true;
              break;
            }
          }
        }
        if (ink) {
          const angle = Math.random() * Math.PI * 2;
          const distance = 25 + Math.random() * Math.min(this.width, this.height) * .5;
          this.particles.push({
            x, y, dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance,
            speed: .7 + Math.random() * .6, size: Math.max(1, step - 1),
          });
        }
      }
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
    for (const p of this.particles) {
      const expansion = reduced ? intensity * .03 : intensity ** 1.5;
      const burst = reduced ? 0 : burstProgress * 14;
      const x = p.x + p.dx * (expansion + burst * p.speed);
      const y = p.y + p.dy * (expansion + burst * p.speed) + burst ** 2 * 2;
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
