const stage = document.querySelector("[data-vision-stage]");
const canvas = document.querySelector("[data-vision-canvas]");
const context = canvas?.getContext("2d", { alpha: true });
const pageCanvas = document.querySelector("[data-page-particles]");
const pageContext = pageCanvas?.getContext("2d", { alpha: true });
const video = document.querySelector("[data-vision-video]");
const startButton = document.querySelector("[data-start-camera]");
const stopButton = document.querySelector("[data-stop-camera]");
const fullscreenButton = document.querySelector("[data-toggle-fullscreen]");
const cameraStatus = document.querySelector("[data-camera-status]");
const cover = document.querySelector("[data-album-cover-tilt]");

const SETTINGS = Object.freeze({
  motion: 0.67,
  memory: 0,
  intensity: 1,
  cameraSignal: 0,
  mirror: true,
  particleSpeed: 0.74,
  particleSize: 0,
  particleCount: 4200,
  particleHue: 183,
  glitch: 0.405,
});

const analysisCanvas = document.createElement("canvas");
const analysisContext = analysisCanvas.getContext("2d", { willReadFrequently: true });
analysisCanvas.width = 160;
analysisCanvas.height = 120;

let width = 1;
let height = 1;
let dpr = 1;
let frame = 0;
let particles = [];
let previousLuminance = null;
let cameraStream = null;
let sourceMode = "demo";
let animationFrame = 0;
let fallbackFullscreen = false;
let pageWidth = 1;
let pageHeight = 1;
let pageDpr = 1;
let pageParticles = [];
const pointer = { x: 0.5, y: 0.5, lastX: 0.5, lastY: 0.5, energy: 0, active: false };
const pagePointer = { x: -1000, y: -1000, active: false };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp01 = (value) => clamp(value, 0, 1);
const lerp = (from, to, amount) => from + (to - from) * amount;
const random = (min, max) => min + Math.random() * (max - min);
const PARTICLE_PALETTE = [
  { hue: 170, lightness: 52 },
  { hue: 175, lightness: 50 },
  { hue: 196, lightness: 47 },
  { hue: 203, lightness: 45 },
  { hue: 211, lightness: 47 },
];
const randomParticleColor = () => PARTICLE_PALETTE[Math.floor(Math.random() * PARTICLE_PALETTE.length)];

const initializeParticles = () => {
  particles = [];
};

const initializePageParticles = () => {
  const count = pageWidth <= 700 ? 125 : Math.min(360, Math.round((pageWidth * pageHeight) / 5200));
  pageParticles = Array.from({ length: count }, (_, index) => ({
    x: random(0, pageWidth),
    y: random(0, pageHeight),
    vx: random(-0.12, 0.12),
    vy: random(-0.1, 0.1),
    length: random(1.5, 4.6),
    width: random(0.4, 0.94),
    alpha: random(0.14, 0.42),
    hue: PARTICLE_PALETTE[index % PARTICLE_PALETTE.length].hue + random(-2, 2),
    lightness: PARTICLE_PALETTE[index % PARTICLE_PALETTE.length].lightness,
    phase: random(0, Math.PI * 2),
  }));
};

const resizePageCanvas = () => {
  if (!pageCanvas || !pageContext) return;
  pageWidth = Math.max(1, window.innerWidth);
  pageHeight = Math.max(1, window.innerHeight);
  pageDpr = Math.min(window.devicePixelRatio || 1, 1.5);
  pageCanvas.width = Math.round(pageWidth * pageDpr);
  pageCanvas.height = Math.round(pageHeight * pageDpr);
  pageContext.setTransform(pageDpr, 0, 0, pageDpr, 0, 0);
  initializePageParticles();
};

const resizeCanvas = () => {
  if (!stage || !canvas || !context) return;
  const bounds = stage.getBoundingClientRect();
  width = Math.max(1, bounds.width);
  height = Math.max(1, bounds.height);
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.fillStyle = "rgb(0, 21, 27)";
  context.fillRect(0, 0, width, height);
  initializeParticles();
};

const demoMotionPoints = () => {
  const speed = 0.006 + SETTINGS.particleSpeed * 0.006;
  const points = [];

  for (let index = 0; index < 7; index += 1) {
    const phase = index * 1.71;
    points.push({
      x: 0.5 + Math.sin(frame * speed * (0.72 + index * 0.055) + phase) * (0.14 + index * 0.017),
      y: 0.5 + Math.cos(frame * speed * (0.84 + index * 0.047) + phase * 1.31) * (0.15 + index * 0.014),
      m: 0.36 + (index % 3) * 0.13,
      b: 0.45 + (index % 4) * 0.1,
      z: index % 12,
    });
  }

  if (pointer.active && pointer.energy > 0.01) {
    points.push({ x: pointer.x, y: pointer.y, m: pointer.energy, b: 0.9, z: Math.floor(pointer.x * 12) % 12 });
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2 + frame * 0.015;
      points.push({
        x: pointer.x + Math.cos(angle) * 0.025,
        y: pointer.y + Math.sin(angle) * 0.025,
        m: pointer.energy * 0.72,
        b: 0.78,
        z: Math.floor(pointer.x * 12) % 12,
      });
    }
  }
  return {
    motionPoints: points,
    globalMotion: clamp01(0.16 + pointer.energy * 0.72),
    sampleStep: 1,
  };
};

const drawMirroredCameraFrame = () => {
  const targetWidth = analysisCanvas.width;
  const targetHeight = analysisCanvas.height;
  const videoWidth = video.videoWidth || 1280;
  const videoHeight = video.videoHeight || 720;
  const scale = Math.max(targetWidth / videoWidth, targetHeight / videoHeight);
  const sourceWidth = targetWidth / scale;
  const sourceHeight = targetHeight / scale;
  const sourceX = (videoWidth - sourceWidth) * 0.5;
  const sourceY = (videoHeight - sourceHeight) * 0.5;

  analysisContext.save();
  analysisContext.clearRect(0, 0, targetWidth, targetHeight);
  analysisContext.translate(targetWidth, 0);
  analysisContext.scale(-1, 1);
  analysisContext.drawImage(
    video,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );
  analysisContext.restore();
};

const cameraMotionPoints = () => {
  if (!video || video.readyState < 2) return { motionPoints: [], globalMotion: 0, sampleStep: 3 };
  drawMirroredCameraFrame();
  const image = analysisContext.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
  const luminance = new Float32Array(analysisCanvas.width * analysisCanvas.height);
  const motionPoints = [];
  let totalMotion = 0;
  const localThreshold = 0.02 + (1 - SETTINGS.motion) * 0.09;
  const globalThreshold = 0.016 + (1 - SETTINGS.motion) * 0.08;

  for (let y = 0; y < analysisCanvas.height; y += 1) {
    for (let x = 0; x < analysisCanvas.width; x += 1) {
      const pixelIndex = y * analysisCanvas.width + x;
      const colorIndex = pixelIndex * 4;
      const brightness = (
        image.data[colorIndex] * 0.299 +
        image.data[colorIndex + 1] * 0.587 +
        image.data[colorIndex + 2] * 0.114
      ) / 255;
      luminance[pixelIndex] = brightness;
      const motion = previousLuminance ? Math.abs(brightness - previousLuminance[pixelIndex]) : 0;
      totalMotion += motion;

      if (motion > localThreshold && Math.random() < 0.18 && motionPoints.length < 360) {
        motionPoints.push({
          x: x / analysisCanvas.width,
          y: y / analysisCanvas.height,
          m: clamp01(motion / (localThreshold * 6)),
          b: brightness,
          z: Math.min(11, Math.floor((x / analysisCanvas.width) * 12)),
        });
      }
    }
  }

  previousLuminance = luminance;
  return {
    motionPoints,
    globalMotion: clamp01((totalMotion / luminance.length) / globalThreshold),
    sampleStep: 3,
  };
};

const spawnParticle = (x, y, options = {}) => {
  const color = randomParticleColor();
  particles.push({
    x: x * width,
    y: y * height,
    vx: random(-0.55, 0.55) * (options.speed || 1),
    vy: random(-0.55, 0.55) * (options.speed || 1),
    life: options.life || random(90, 260),
    maxLife: options.life || 260,
    size: options.size || random(1.2, 4.6),
    hue: options.hue ?? color.hue + random(-2, 2),
    lightness: options.lightness ?? color.lightness,
  });
  if (particles.length > 2600) particles.splice(0, particles.length - 2600);
};

const updateParticles = (gravity = 0, drag = 0.992, movementScale = 1) => {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.life -= 1;
    particle.vx *= drag;
    particle.vy = particle.vy * drag + gravity * movementScale;
    particle.x += particle.vx * movementScale;
    particle.y += particle.vy * movementScale;
    if (
      particle.life <= 0 ||
      particle.x < -80 ||
      particle.y < -80 ||
      particle.x > width + 80 ||
      particle.y > height + 80
    ) particles.splice(index, 1);
  }
};

const drawLineParticles = (intensity = 1) => {
  context.save();
  context.globalCompositeOperation = "source-over";
  for (const particle of particles) {
    const life = clamp01(particle.life / particle.maxLife);
    const alpha = life * 0.62 * intensity;
    context.strokeStyle = `hsla(${particle.hue}, 100%, ${particle.lightness + life * 4}%, ${alpha})`;
    context.lineWidth = particle.size * 0.48;
    context.beginPath();
    context.moveTo(particle.x, particle.y);
    context.lineTo(particle.x - particle.vx * 12, particle.y - particle.vy * 12);
    context.stroke();
  }
  context.restore();
};

const drawAttaqMotion = (analysis) => {
  const moving = analysis.globalMotion;
  context.fillStyle = `rgba(0, 15, 21, ${0.075 - SETTINGS.memory * 0.028 + moving * 0.12})`;
  context.fillRect(0, 0, width, height);

  for (const point of analysis.motionPoints) {
    if (Math.random() < 0.18 + moving * 0.58) {
      const isContour = point.kind === "contour";
      const isInterior = point.kind === "interior";
      const sizeMultiplier = isContour ? 0.72 : isInterior ? 0.56 : 1;
      const speedMultiplier = isContour ? 0.48 : isInterior ? 0.32 : 1;
      spawnParticle(point.x, point.y, {
        size: random(1.4, 5.4) * (0.8 + point.m * 0.9) * (0.55 + SETTINGS.particleSize * 1.5) * 0.88 * sizeMultiplier,
        life: isContour ? random(95, 210) : isInterior ? random(70, 150) : random(55, 170),
        speed: (0.8 + point.m * 3.2) * (0.35 + SETTINGS.particleSpeed * 1.25) * speedMultiplier,
      });
    }
  }

  const threshold = 0.08 + (1 - SETTINGS.motion) * 0.07;
  if (moving > threshold || moving > 0.1) drawGlitch(1.5 + moving * 3.2);
  updateParticles(-0.004, 0.982, 0.85 + SETTINGS.particleSpeed * 0.65);
  drawLineParticles(1.05 + moving * 1.25);
};

const drawPageParticles = () => {
  if (!pageContext) return;
  pageContext.clearRect(0, 0, pageWidth, pageHeight);
  pageContext.save();
  pageContext.globalCompositeOperation = "source-over";

  for (const particle of pageParticles) {
    particle.vx += Math.sin(frame * 0.006 + particle.phase) * 0.0014;
    particle.vy += Math.cos(frame * 0.005 + particle.phase) * 0.0011;

    if (pagePointer.active) {
      const deltaX = particle.x - pagePointer.x;
      const deltaY = particle.y - pagePointer.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance > 0.1 && distance < 135) {
        const force = Math.pow(1 - distance / 135, 1.8) * 0.34;
        particle.vx += (deltaX / distance) * force;
        particle.vy += (deltaY / distance) * force;
      }
    }

    particle.vx *= 0.985;
    particle.vy *= 0.985;
    const speed = Math.hypot(particle.vx, particle.vy);
    if (speed > 1.45) {
      particle.vx = (particle.vx / speed) * 1.45;
      particle.vy = (particle.vy / speed) * 1.45;
    }
    particle.x += particle.vx;
    particle.y += particle.vy;
    if (particle.x < -12) particle.x = pageWidth + 12;
    if (particle.x > pageWidth + 12) particle.x = -12;
    if (particle.y < -12) particle.y = pageHeight + 12;
    if (particle.y > pageHeight + 12) particle.y = -12;

    const angle = Math.atan2(particle.vy, particle.vx) + Math.sin(frame * 0.004 + particle.phase) * 0.45;
    const shimmer = 0.72 + (Math.sin(frame * 0.018 + particle.phase) * 0.5 + 0.5) * 0.28;
    pageContext.strokeStyle = `hsla(${particle.hue}, 100%, ${particle.lightness}%, ${particle.alpha * shimmer})`;
    pageContext.lineWidth = particle.width;
    pageContext.beginPath();
    pageContext.moveTo(particle.x, particle.y);
    pageContext.lineTo(
      particle.x - Math.cos(angle) * particle.length,
      particle.y - Math.sin(angle) * particle.length,
    );
    pageContext.stroke();
  }
  pageContext.restore();
};

const drawGlitch = (strength = 0.55) => {
  const amount = SETTINGS.glitch * strength;
  if (amount <= 0.015) return;
  context.save();
  context.globalCompositeOperation = "source-over";
  const slices = Math.floor(4 + amount * 18);
  for (let index = 0; index < slices; index += 1) {
    const y = random(0, height);
    const sliceHeight = random(2, 10 + amount * 70);
    const offsetX = random(-30, 30) * amount * (1.3 + strength);
    context.globalAlpha = 0.18 + amount * 0.2;
    context.drawImage(
      canvas,
      0,
      y * dpr,
      canvas.width,
      sliceHeight * dpr,
      offsetX,
      y,
      width,
      sliceHeight,
    );
  }
  const blocks = Math.floor(2 + amount * 12);
  for (let index = 0; index < blocks; index += 1) {
    const sourceX = random(0, width * 0.8);
    const sourceY = random(0, height * 0.9);
    const blockWidth = random(18, 120);
    const blockHeight = random(4, 24);
    context.globalAlpha = 0.1 + amount * 0.14;
    context.drawImage(
      canvas,
      sourceX * dpr,
      sourceY * dpr,
      blockWidth * dpr,
      blockHeight * dpr,
      sourceX + random(-36, 36) * amount,
      sourceY + random(-8, 8) * amount,
      blockWidth,
      blockHeight,
    );
  }
  context.restore();
};

const render = () => {
  frame += 1;
  pointer.energy *= 0.9;
  drawPageParticles();
  const analysis = sourceMode === "camera" ? cameraMotionPoints() : demoMotionPoints();
  drawAttaqMotion(analysis);
  if (Math.random() < SETTINGS.glitch * 0.12) drawGlitch();
  animationFrame = requestAnimationFrame(render);
};

const updateCameraInterface = (cameraActive) => {
  startButton.hidden = cameraActive;
  stopButton.hidden = !cameraActive;
  startButton.disabled = false;
  const label = startButton.querySelector("strong");
  if (label) label.textContent = "Start camera";
};

const stopCamera = () => {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  if (video) video.srcObject = null;
  sourceMode = "demo";
  previousLuminance = null;
  pointer.active = false;
  cameraStatus.textContent = "";
  updateCameraInterface(false);
};

const updateFullscreenInterface = () => {
  const active = document.fullscreenElement === stage || fallbackFullscreen;
  fullscreenButton.textContent = active ? "Exit fullscreen" : "Fullscreen";
  document.body.classList.toggle("vision-fullscreen-lock", active);
  window.setTimeout(resizeCanvas, 80);
};

const toggleFullscreen = async () => {
  if (document.fullscreenElement === stage) {
    await document.exitFullscreen();
    return;
  }
  if (fallbackFullscreen) {
    fallbackFullscreen = false;
    stage.classList.remove("is-fallback-fullscreen");
    updateFullscreenInterface();
    return;
  }

  try {
    if (!stage.requestFullscreen) throw new Error("Fullscreen API unavailable");
    await stage.requestFullscreen();
  } catch {
    fallbackFullscreen = true;
    stage.classList.add("is-fallback-fullscreen");
    updateFullscreenInterface();
  }
};

const startCamera = async () => {
  cameraStatus.textContent = "";
  startButton.disabled = true;
  const label = startButton.querySelector("strong");
  if (label) label.textContent = "Starting...";

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access requires HTTPS or localhost in a supported browser.");
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = cameraStream;
    await video.play();
    sourceMode = "camera";
    previousLuminance = null;
    pointer.active = false;
    cameraStatus.textContent = "";
    updateCameraInterface(true);
  } catch (error) {
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    sourceMode = "demo";
    startButton.disabled = false;
    if (label) label.textContent = "Start camera";
    cameraStatus.textContent = error?.message || "Camera access was not granted.";
  }
};

const onPointerMove = (event) => {
  if (sourceMode !== "demo") return;
  const bounds = stage.getBoundingClientRect();
  const nextX = clamp01((event.clientX - bounds.left) / bounds.width);
  const nextY = clamp01((event.clientY - bounds.top) / bounds.height);
  const distance = Math.hypot(nextX - pointer.lastX, nextY - pointer.lastY);
  pointer.x = nextX;
  pointer.y = nextY;
  pointer.lastX = nextX;
  pointer.lastY = nextY;
  pointer.energy = clamp01(Math.max(0.38, distance * 18));
  pointer.active = true;
};

const onCoverMove = (event) => {
  const bounds = cover.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - 0.5;
  const y = (event.clientY - bounds.top) / bounds.height - 0.5;
  cover.style.setProperty("--cover-tilt-x", `${y * -12}deg`);
  cover.style.setProperty("--cover-tilt-y", `${x * 12}deg`);
  cover.style.setProperty("--cover-shadow-x", `${x * -28}px`);
  cover.style.setProperty("--cover-shadow-y", `${20 + y * 18}px`);
  cover.style.setProperty("--cover-foil-x", `${50 + x * 62}%`);
  cover.style.setProperty("--cover-foil-y", `${50 + y * 62}%`);
  cover.style.setProperty("--cover-foil-angle", `${112 + x * 16 - y * 12}deg`);
};

cover?.addEventListener("pointermove", onCoverMove);
cover?.addEventListener("pointerleave", () => {
  cover.style.setProperty("--cover-tilt-x", "0deg");
  cover.style.setProperty("--cover-tilt-y", "0deg");
  cover.style.setProperty("--cover-shadow-x", "0px");
  cover.style.setProperty("--cover-shadow-y", "18px");
  cover.style.setProperty("--cover-foil-x", "50%");
  cover.style.setProperty("--cover-foil-y", "50%");
});

stage?.addEventListener("pointermove", onPointerMove, { passive: true });
stage?.addEventListener("pointerleave", () => { pointer.active = false; });
window.addEventListener("pointermove", (event) => {
  pagePointer.x = event.clientX;
  pagePointer.y = event.clientY;
  pagePointer.active = true;
}, { passive: true });
document.documentElement.addEventListener("pointerleave", () => { pagePointer.active = false; });
window.addEventListener("blur", () => { pagePointer.active = false; });
startButton?.addEventListener("click", startCamera);
stopButton?.addEventListener("click", stopCamera);
fullscreenButton?.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", updateFullscreenInterface);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && fallbackFullscreen) toggleFullscreen();
});
window.addEventListener("pagehide", () => {
  cameraStream?.getTracks().forEach((track) => track.stop());
});

document.querySelector("[data-current-year]").textContent = new Date().getFullYear();
window.addEventListener("load", () => {
  resizePageCanvas();
  resizeCanvas();
  animationFrame = requestAnimationFrame(render);
}, { once: true });

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resizePageCanvas();
    resizeCanvas();
  }, 120);
});

window.addEventListener("beforeunload", () => cancelAnimationFrame(animationFrame));
