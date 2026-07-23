const cleanPath = window.location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
if (cleanPath !== window.location.pathname) {
  window.history.replaceState(null, "", `${cleanPath}${window.location.search}${window.location.hash}`);
}

const tracks = [
  ["Into the Deep", "01. Into the Deep.ogg"],
  ["Event Horizon", "02. Event Horizon.ogg"],
  ["Ocean", "03. Ocean.ogg"],
  ["Digital Emotions", "04. Digital Emotions.ogg"],
  ["Drama", "05. Drama.ogg"],
  ["Cosmos", "06. Cosmos.ogg"],
  ["Emptiness Around", "07. Emptiness Around.ogg"],
  ["Beyond the Earth", "08. Beyond the Earth.ogg"],
  ["Nixie", "09. Nixie.ogg"],
].map(([title, file]) => ({
  title,
  src: encodeURI(`../assets/music/spaceistheocean/${file}`),
}));

const audio = document.querySelector("[data-audio]");
const playButton = document.querySelector("[data-play]");
const playIcon = document.querySelector("[data-play-icon]");
const previousButton = document.querySelector("[data-previous]");
const nextButton = document.querySelector("[data-next]");
const seek = document.querySelector("[data-seek]");
const currentTimeNode = document.querySelector("[data-current-time]");
const durationNode = document.querySelector("[data-duration]");
const titleNode = document.querySelector("[data-track-title]");
const trackList = document.querySelector("[data-track-list]");
const year = document.querySelector("[data-current-year]");

let currentTrack = 0;
let audioContext;
let analyser;
let frequencyData;
let analysisSource;
let capturedStream;
const localFileMode = window.location.protocol === "file:";


if (year) year.textContent = new Date().getFullYear();

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
};

const updatePlayButton = () => {
  const playing = !audio.paused;
  playButton.classList.toggle("is-playing", playing);
  playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
  playIcon.textContent = playing ? "" : "▶";
};

const initAudioAnalysis = () => {
  if (audioContext) {
    audioContext.resume();
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.82;
  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  if (localFileMode) {
    const capture = audio.captureStream || audio.mozCaptureStream;
    if (!capture) {
      analyser = undefined;
      frequencyData = undefined;
      return;
    }
    try {
      capturedStream = capture.call(audio);
      analysisSource = audioContext.createMediaStreamSource(capturedStream);
      analysisSource.connect(analyser);
    } catch (error) {
      console.warn("Live audio analysis is unavailable in this browser", error);
      analyser = undefined;
      frequencyData = undefined;
    }
  } else {
    analysisSource = audioContext.createMediaElementSource(audio);
    analysisSource.connect(analyser);
    analyser.connect(audioContext.destination);
  }
  audioContext.resume();
};

const playAudio = () => {
  audio.play()
    .then(() => initAudioAnalysis())
    .catch((error) => {
      console.error("Unable to play the selected track", error);
      updatePlayButton();
    });
};

const setTrack = (index, autoplay = false) => {
  currentTrack = (index + tracks.length) % tracks.length;
  const track = tracks[currentTrack];
  audio.src = track.src;
  titleNode.textContent = track.title;
  seek.value = 0;
  seek.style.setProperty("--progress", "0%");
  currentTimeNode.textContent = "0:00";
  durationNode.textContent = "0:00";
  document.querySelectorAll("[data-track-index]").forEach((button) => {
    const active = Number(button.dataset.trackIndex) === currentTrack;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "true" : "false");
  });
  document.querySelector(".panel-kicker span:first-child").textContent = `${String(currentTrack + 1).padStart(2, "0")} / ${String(tracks.length).padStart(2, "0")}`;
  if (autoplay) {
    playAudio();
  }
};

tracks.forEach((track, index) => {
  const item = document.createElement("li");
  item.innerHTML = `
    <button class="track-button" type="button" data-track-index="${index}">
      <span class="track-button__number">${String(index + 1).padStart(2, "0")}</span>
      <span class="track-button__title">${track.title}</span>
      <span class="track-button__duration" data-track-duration>—:——</span>
    </button>`;
  const button = item.querySelector("button");
  button.addEventListener("click", () => setTrack(index, true));
  trackList.append(item);

  const probe = new Audio();
  probe.preload = "metadata";
  probe.src = track.src;
  probe.addEventListener("loadedmetadata", () => {
    item.querySelector("[data-track-duration]").textContent = formatTime(probe.duration);
  }, { once: true });
});

playButton.addEventListener("click", () => {
  if (audio.paused) playAudio(); else audio.pause();
});

previousButton.addEventListener("click", () => setTrack(currentTrack - 1, true));
nextButton.addEventListener("click", () => setTrack(currentTrack + 1, true));
audio.addEventListener("play", updatePlayButton);
audio.addEventListener("playing", initAudioAnalysis);
audio.addEventListener("pause", updatePlayButton);
audio.addEventListener("ended", () => setTrack(currentTrack + 1, true));
audio.addEventListener("loadedmetadata", () => { durationNode.textContent = formatTime(audio.duration); });
audio.addEventListener("timeupdate", () => {
  const progress = audio.duration ? audio.currentTime / audio.duration : 0;
  seek.value = Math.round(progress * 1000);
  seek.style.setProperty("--progress", `${progress * 100}%`);
  currentTimeNode.textContent = formatTime(audio.currentTime);
});

seek.addEventListener("input", () => {
  if (audio.duration) audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
});

setTrack(0);

const albumCover = document.querySelector("[data-album-cover-tilt]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (albumCover && !reducedMotion.matches) {
  let coverFrame;
  albumCover.addEventListener("pointermove", (event) => {
    const rect = albumCover.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    cancelAnimationFrame(coverFrame);
    coverFrame = requestAnimationFrame(() => {
      albumCover.style.setProperty("--cover-tilt-x", `${y * -12}deg`);
      albumCover.style.setProperty("--cover-tilt-y", `${x * 12}deg`);
      albumCover.style.setProperty("--cover-shadow-x", `${x * -28}px`);
      albumCover.style.setProperty("--cover-shadow-y", `${20 + y * 18}px`);
      albumCover.style.setProperty("--cover-foil-x", `${50 + x * 62}%`);
      albumCover.style.setProperty("--cover-foil-y", `${50 + y * 62}%`);
      albumCover.style.setProperty("--cover-foil-angle", `${112 + x * 16 - y * 12}deg`);
    });
  });
  albumCover.addEventListener("pointerleave", () => {
    cancelAnimationFrame(coverFrame);
    albumCover.style.setProperty("--cover-tilt-x", "0deg");
    albumCover.style.setProperty("--cover-tilt-y", "0deg");
    albumCover.style.setProperty("--cover-shadow-x", "0px");
    albumCover.style.setProperty("--cover-shadow-y", "18px");
    albumCover.style.setProperty("--cover-foil-x", "50%");
    albumCover.style.setProperty("--cover-foil-y", "50%");
    albumCover.style.setProperty("--cover-foil-angle", "112deg");
  });
}

const particleCanvas = document.querySelector("[data-particle-ocean]");
const particleContext = particleCanvas.getContext("2d", { alpha: true });
const spectrumCanvas = document.querySelector("[data-spectrum]");
const spectrumContext = spectrumCanvas.getContext("2d");
const centerCanvas = document.querySelector("[data-center-visualizer]");
const centerContext = centerCanvas.getContext("2d", { alpha: true });
const syntheticSpectrum = new Float32Array(54);
const centerOffsetX = new Float32Array(2500);
const centerOffsetY = new Float32Array(2500);
const centerVelocityX = new Float32Array(2500);
const centerVelocityY = new Float32Array(2500);
const PARTICLE_DENSITY = 0.8;
const PLANET_PARTICLE_COUNT = 1600;
const MOON_PARTICLE_COUNT = 80;
const particleMap = window.SPACE_OCEAN_PARTICLE_MAP;
const particlePixels = particleMap
  ? Uint8Array.from(atob(particleMap.pixels), (character) => character.charCodeAt(0))
  : null;

let particles = [];
let deviceScale = Math.min(window.devicePixelRatio || 1, 1.6);
let mouse = { x: -1000, y: -1000, active: false };
let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;
let previousFrameTime = performance.now();

const seeded = (value, offset = 0) => {
  const seed = Math.sin((value + 1) * 12.9898 + offset * 78.233) * 43758.5453;
  return seed - Math.floor(seed);
};

const updateCenterParticle = (index, baseX, baseY, rect, influence) => {
  const x = baseX + centerOffsetX[index];
  const y = baseY + centerOffsetY[index];
  if (mouse.active) {
    const dx = x - (mouse.x - rect.left);
    const dy = y - (mouse.y - rect.top);
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 0.1 && distance < influence) {
      const force = (1 - distance / influence) * 1.45;
      centerVelocityX[index] += (dx / distance) * force;
      centerVelocityY[index] += (dy / distance) * force;
    }
  }
  centerVelocityX[index] += -centerOffsetX[index] * 0.012;
  centerVelocityY[index] += -centerOffsetY[index] * 0.012;
  centerVelocityX[index] *= 0.92;
  centerVelocityY[index] *= 0.92;
  centerOffsetX[index] += centerVelocityX[index];
  centerOffsetY[index] += centerVelocityY[index];
};

const sampleCoverLegacy = () => {
  if (!particleMap || !particlePixels || !particleStage) return;
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  deviceScale = Math.min(window.devicePixelRatio || 1, 1.6);
  particleCanvas.width = Math.floor(viewportWidth * deviceScale);
  particleCanvas.height = Math.floor(viewportHeight * deviceScale);
  particleCanvas.style.width = `${viewportWidth}px`;
  particleCanvas.style.height = `${viewportHeight}px`;
  particleContext.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);

  const stageRect = particleStage.getBoundingClientRect();
  stageCenter = {
    x: stageRect.left + stageRect.width / 2,
    y: stageRect.top + stageRect.height / 2,
  };
  const sampleWidth = Math.min(particleMap.width, Math.max(64, Math.floor(stageRect.width / 4.6)));
  const sampleHeight = Math.min(particleMap.height, Math.max(64, Math.floor(stageRect.height / 4.6)));
  const artworkParticles = [];
  for (let sy = 0; sy < sampleHeight; sy += 1) {
    for (let sx = 0; sx < sampleWidth; sx += 1) {
      const mapX = Math.min(particleMap.width - 1, Math.floor((sx / Math.max(1, sampleWidth - 1)) * (particleMap.width - 1)));
      const mapY = Math.min(particleMap.height - 1, Math.floor((sy / Math.max(1, sampleHeight - 1)) * (particleMap.height - 1)));
      const pixel = (mapY * particleMap.width + mapX) * 3;
      const r = particlePixels[pixel];
      const g = particlePixels[pixel + 1];
      const b = particlePixels[pixel + 2];
      const brightness = (r + g + b) / 3;
      const density = 0.28 + (brightness / 255) * 0.58;
      const selector = ((sx * 37 + sy * 61) % 101) / 100;
      if (brightness < 7 || selector > density) continue;
      const targetX = stageRect.left + (sx / Math.max(1, sampleWidth - 1)) * stageRect.width;
      const targetY = stageRect.top + (sy / Math.max(1, sampleHeight - 1)) * stageRect.height;
      const random = seeded(sx + sy * sampleWidth, 1);
      artworkParticles.push({
        kind: "artwork",
        x: targetX + (random - 0.5) * 34,
        y: targetY + (seeded(sx + sy * sampleWidth, 2) - 0.5) * 34,
        tx: targetX,
        ty: targetY,
        vx: 0,
        vy: 0,
        r,
        g,
        b,
        alpha: Math.min(0.94, 0.24 + brightness / 300),
        size: 0.72 + random * 1.45,
        phase: random * Math.PI * 2,
      });
    }
  }

  const ambientParticles = [];
  const ambientCount = Math.min(1450, Math.max(520, Math.floor((viewportWidth * viewportHeight) / 1700)));
  for (let index = 0; index < ambientCount; index += 1) {
    const targetX = seeded(index, 3) * viewportWidth;
    const targetY = seeded(index, 4) * viewportHeight;
    const insideStage = targetX > stageRect.left - 18
      && targetX < stageRect.right + 18
      && targetY > stageRect.top - 18
      && targetY < stageRect.bottom + 18;
    if (insideStage) continue;
    const mapX = Math.floor(seeded(index, 5) * particleMap.width);
    const mapY = Math.floor(seeded(index, 6) * particleMap.height);
    const pixel = (mapY * particleMap.width + mapX) * 3;
    const r = particlePixels[pixel];
    const g = particlePixels[pixel + 1];
    const b = particlePixels[pixel + 2];
    const brightness = (r + g + b) / 3;
    if (brightness < 9) continue;
    const random = seeded(index, 7);
    ambientParticles.push({
      kind: "ambient",
      x: targetX + (random - 0.5) * 60,
      y: targetY + (seeded(index, 8) - 0.5) * 60,
      tx: targetX,
      ty: targetY,
      vx: 0,
      vy: 0,
      r,
      g,
      b,
      alpha: Math.min(0.38, 0.09 + brightness / 1050),
      size: 0.4 + random * 0.9,
      phase: random * Math.PI * 2,
      twinkle: seeded(index, 9) > 0.94,
      twinkleOffset: seeded(index, 10) * 16000,
      twinkleInterval: 2667 + seeded(index, 11) * 3333,
    });
  }
  particles = [...ambientParticles, ...artworkParticles];
};

const sampleCover = () => {
  if (!particleMap || !particlePixels) return;
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  deviceScale = Math.min(window.devicePixelRatio || 1, 1.6);
  particleCanvas.width = Math.floor(viewportWidth * deviceScale);
  particleCanvas.height = Math.floor(viewportHeight * deviceScale);
  particleCanvas.style.width = `${viewportWidth}px`;
  particleCanvas.style.height = `${viewportHeight}px`;
  particleContext.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);

  const ambient = [];
  const count = Math.floor(
    Math.min(1800, Math.max(760, Math.floor((viewportWidth * viewportHeight) / 1450))) * PARTICLE_DENSITY,
  );
  for (let index = 0; index < count; index += 1) {
    const targetX = seeded(index, 11) * viewportWidth;
    const targetY = seeded(index, 12) * viewportHeight;
    const mapX = Math.floor(seeded(index, 13) * particleMap.width);
    const mapY = Math.floor(seeded(index, 14) * particleMap.height);
    const pixel = (mapY * particleMap.width + mapX) * 3;
    const sourceR = particlePixels[pixel];
    const sourceG = particlePixels[pixel + 1];
    const sourceB = particlePixels[pixel + 2];
    const pink = seeded(index, 15) > 0.84;
    const r = pink ? Math.max(150, sourceR) : Math.min(105, sourceR + 18);
    const g = pink ? Math.min(155, sourceG) : Math.max(145, sourceG);
    const b = pink ? Math.max(155, sourceB) : Math.max(175, sourceB);
    const random = seeded(index, 16);
    ambient.push({
      kind: "ambient",
      x: targetX + (random - 0.5) * 26,
      y: targetY + (seeded(index, 17) - 0.5) * 26,
      tx: targetX,
      ty: targetY,
      baseTx: targetX,
      baseTy: targetY,
      vx: 0,
      vy: 0,
      r,
      g,
      b,
      alpha: 0.08 + random * 0.2,
      size: 0.48 + random * 0.78,
      phase: random * Math.PI * 2,
      twinkle: seeded(index, 18) > 0.94,
      twinkleOffset: seeded(index, 19) * 16000,
      twinkleInterval: 2667 + seeded(index, 20) * 3333,
    });
  }
  particles = ambient;
};

const getAudioEnergy = () => {
  if (audio.paused) return { bass: 0, overall: 0 };
  if (!analyser || !frequencyData) {
    const beat = Math.max(0, Math.sin(audio.currentTime * Math.PI * 3.2));
    const pulse = beat ** 10;
    return { bass: 0.06 + pulse * 0.08, overall: 0.035 + pulse * 0.035 };
  }
  analyser.getByteFrequencyData(frequencyData);
  let bass = 0;
  let overall = 0;
  const bassBins = Math.min(14, frequencyData.length);
  for (let index = 0; index < frequencyData.length; index += 1) {
    overall += frequencyData[index];
    if (index < bassBins) bass += frequencyData[index];
  }
  return {
    bass: bass / bassBins / 255,
    overall: overall / frequencyData.length / 255,
  };
};

const drawSpectrum = (energy, time) => {
  const rect = spectrumCanvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 1.5);
  if (spectrumCanvas.width !== Math.floor(rect.width * scale) || spectrumCanvas.height !== Math.floor(rect.height * scale)) {
    spectrumCanvas.width = Math.floor(rect.width * scale);
    spectrumCanvas.height = Math.floor(rect.height * scale);
  }
  spectrumContext.setTransform(scale, 0, 0, scale, 0, 0);
  spectrumContext.clearRect(0, 0, rect.width, rect.height);
  const bars = 54;
  const gap = 3;
  const width = rect.width / bars - gap;
  for (let index = 0; index < bars; index += 1) {
    const frequency = audio.paused
      ? 0
      : frequencyData?.[Math.floor((index / bars) * (frequencyData.length * 0.68))] / 255 || 0;
    const idle = 0.025 + Math.sin(time * 0.0012 + index * 0.42) * 0.015;
    const spectrumFrame = Math.floor(audio.currentTime * 11);
    const frequencyShape = 0.38 + Math.exp(-index / 18) * 0.62;
    const target = audio.paused ? 0 : (0.035 + seeded(spectrumFrame, index + 70) * 0.15)
      * frequencyShape * (0.72 + energy.bass * 2.7 + energy.overall * 1.9);
    syntheticSpectrum[index] += (target - syntheticSpectrum[index]) * 0.2;
    const fallback = syntheticSpectrum[index];
    const value = Math.max(idle, frequency, fallback);
    const height = Math.max(2, value * rect.height * 0.84);
    const gradient = spectrumContext.createLinearGradient(0, rect.height - height, 0, rect.height);
    gradient.addColorStop(0, `rgba(255, 101, 157, ${0.2 + value * 0.55})`);
    gradient.addColorStop(0.48, `rgba(47, 211, 240, ${0.12 + value * 0.35})`);
    gradient.addColorStop(1, "rgba(22, 97, 146, 0.025)");
    spectrumContext.fillStyle = gradient;
    spectrumContext.fillRect(index * (width + gap), rect.height - height, Math.max(1, width), height);
  }
};

const drawCenterVisualizer = (energy, time) => {
  if (!centerCanvas || !centerContext) return;
  const rect = centerCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const scale = Math.min(window.devicePixelRatio || 1, 1.5);
  const targetWidth = Math.floor(rect.width * scale);
  const targetHeight = Math.floor(rect.height * scale);
  if (centerCanvas.width !== targetWidth || centerCanvas.height !== targetHeight) {
    centerCanvas.width = targetWidth;
    centerCanvas.height = targetHeight;
  }
  centerContext.setTransform(scale, 0, 0, scale, 0, 0);
  centerContext.clearRect(0, 0, rect.width, rect.height);

  const headerBottom = document.querySelector(".album-header")?.getBoundingClientRect().bottom || 0;
  const footerTop = document.querySelector(".album-footer")?.getBoundingClientRect().top || window.innerHeight;
  const cx = window.innerWidth / 2 - rect.left;
  const cy = headerBottom + (footerTop - headerBottom) / 2 - rect.top;
  const radius = Math.min(rect.width, rect.height) * 0.145;
  const rotation = time * 0.000035;
  const glow = centerContext.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.7);
  glow.addColorStop(0, "rgba(47, 211, 240, 0.075)");
  glow.addColorStop(0.55, "rgba(255, 101, 157, 0.04)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  centerContext.fillStyle = glow;
  centerContext.fillRect(cx - radius * 1.8, cy - radius * 1.8, radius * 3.6, radius * 3.6);
  centerContext.globalCompositeOperation = "lighter";

  centerContext.save();
  centerContext.translate(cx, cy);
  centerContext.rotate(-0.16);
  const detailsRect = document.querySelector(".album-details")?.getBoundingClientRect();
  const playerRect = document.querySelector(".player-panel")?.getBoundingClientRect();
  const leftBoundary = detailsRect ? detailsRect.right + 32 : rect.left + rect.width * 0.27;
  const rightBoundary = playerRect ? playerRect.left - 32 : rect.left + rect.width * 0.73;
  const corridorHalfWidth = Math.max(radius * 1.8, Math.min(cx - leftBoundary, rightBoundary - cx));
  const ringMax = Math.min(2.75, corridorHalfWidth / radius);
  for (let orbit = 0; orbit < 5; orbit += 1) {
    const rx = radius * (1.45 + (ringMax - 1.45) * (orbit / 4));
    const ry = radius * (0.42 + orbit * 0.14);
    centerContext.beginPath();
    centerContext.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    centerContext.strokeStyle = orbit % 3 === 1
      ? "rgba(255, 101, 157, 0.4)"
      : "rgba(47, 211, 240, 0.34)";
    centerContext.lineWidth = 0.86;
    centerContext.shadowColor = orbit % 3 === 1 ? "rgba(255, 101, 157, 0.4)" : "rgba(47, 211, 240, 0.38)";
    centerContext.shadowBlur = 5;
    centerContext.stroke();
  }
  centerContext.shadowBlur = 0;
  centerContext.restore();

  for (let index = 0; index < PLANET_PARTICLE_COUNT; index += 1) {
    const angle = index * 2.399963 + rotation;
    const radial = radius * Math.sqrt(seeded(index, 31));
    const depth = Math.sin(angle) * 0.5 + 0.5;
    let x = cx + Math.cos(angle) * radial;
    let y = cy + Math.sin(angle) * radial * 0.82;
    updateCenterParticle(index, x, y, rect, radius * 1.15);
    x += centerOffsetX[index];
    y += centerOffsetY[index];
    const pink = seeded(index, 32) > 0.77;
    const alpha = Math.min(0.98, 0.34 + depth * 0.48);
    centerContext.fillStyle = pink
      ? `rgba(255, 101, 157, ${alpha})`
      : `rgba(79, 221, 242, ${alpha})`;
    centerContext.beginPath();
    centerContext.arc(x, y, 0.5 + seeded(index, 33) * 0.72, 0, Math.PI * 2);
    centerContext.fill();
  }

  const moons = [
    { spread: 0.12, speed: -0.00005, phase: 0, pink: true },
    { spread: 0.34, speed: 0.000047, phase: 1.257, pink: false },
    { spread: 0.56, speed: -0.000043, phase: 2.514, pink: true },
    { spread: 0.78, speed: 0.000039, phase: 3.77, pink: false },
    { spread: 1, speed: -0.000035, phase: 5.027, pink: true },
  ];
  const maxMoonOrbit = Math.max(3, (rect.width / 2 - 22) / radius);
  moons.forEach((moon, moonIndex) => {
    const angle = time * moon.speed + moon.phase;
    const moonOrbit = 2 + (maxMoonOrbit - 2) * moon.spread;
    const mx = cx + Math.cos(angle) * radius * moonOrbit;
    const my = cy + Math.sin(angle) * radius * moonOrbit * 0.36;
    for (let index = 0; index < MOON_PARTICLE_COUNT; index += 1) {
      const dotAngle = index * 2.399963;
      const dotRadius = Math.sqrt(seeded(index, 40 + moonIndex)) * radius * 0.11;
      const particleIndex = 2000 + moonIndex * 100 + index;
      let moonX = mx + Math.cos(dotAngle) * dotRadius;
      let moonY = my + Math.sin(dotAngle) * dotRadius;
      updateCenterParticle(particleIndex, moonX, moonY, rect, radius * 0.72);
      moonX += centerOffsetX[particleIndex];
      moonY += centerOffsetY[particleIndex];
      centerContext.fillStyle = moon.pink
        ? "rgba(255, 126, 171, 0.48)"
        : "rgba(112, 232, 244, 0.45)";
      centerContext.beginPath();
      centerContext.arc(moonX, moonY, 0.35 + seeded(index, 44) * 0.42, 0, Math.PI * 2);
      centerContext.fill();
    }
  });
  centerContext.globalCompositeOperation = "source-over";
};

const animate = (time) => {
  const energy = getAudioEnergy();
  const delta = Math.min(32, Math.max(0, time - previousFrameTime || 16));
  previousFrameTime = time;
  particleContext.clearRect(0, 0, viewportWidth, viewportHeight);
  particleContext.globalCompositeOperation = "lighter";

  for (const particle of particles) {
    particle.tx = particle.baseTx;
    particle.ty = particle.baseTy;

    const dx = particle.x - mouse.x;
    const dy = particle.y - mouse.y;
    const distanceSquared = dx * dx + dy * dy;
    if (mouse.active && distanceSquared < 25600 && distanceSquared > 0.1) {
      const distance = Math.sqrt(distanceSquared);
      const force = (1 - distance / 160) * 1.15;
      particle.vx += (dx / distance) * force;
      particle.vy += (dy / distance) * force;
    }

    const spring = 0.0073;
    const damping = 0.93;
    particle.vx += (particle.tx - particle.x) * spring;
    particle.vy += (particle.ty - particle.y) * spring;
    particle.vx *= damping;
    particle.vy *= damping;
    particle.x += particle.vx;
    particle.y += particle.vy;

    const twinkleTime = particle.twinkle ? (time + particle.twinkleOffset) % particle.twinkleInterval : 1000;
    const twinkle = twinkleTime < 500 ? Math.sin((twinkleTime / 500) * Math.PI) : 0;
    const pulse = 1 + twinkle * 0.65;
    const alpha = Math.min(1, particle.alpha * 0.74 + twinkle * 0.58);
    particleContext.fillStyle = `rgba(${particle.r}, ${particle.g}, ${particle.b}, ${alpha})`;
    particleContext.beginPath();
    particleContext.arc(particle.x, particle.y, particle.size * pulse, 0, Math.PI * 2);
    particleContext.fill();
  }

  particleContext.globalCompositeOperation = "source-over";
  drawSpectrum(energy, time);
  drawCenterVisualizer(energy, time);
  requestAnimationFrame(animate);
};

window.addEventListener("pointermove", (event) => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
  mouse.active = true;
}, { passive: true });

document.documentElement.addEventListener("pointerleave", () => { mouse.active = false; });
window.addEventListener("blur", () => { mouse.active = false; });

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(sampleCover, 160);
});

sampleCover();
requestAnimationFrame(animate);
