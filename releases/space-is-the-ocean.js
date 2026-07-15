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
  playIcon.textContent = playing ? "Ⅱ" : "▶";
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
      albumCover.style.setProperty("--cover-tilt-x", `${y * -7}deg`);
      albumCover.style.setProperty("--cover-tilt-y", `${x * 7}deg`);
      albumCover.style.setProperty("--cover-shadow-x", `${x * -16}px`);
      albumCover.style.setProperty("--cover-foil-x", `${50 + x * 62}%`);
      albumCover.style.setProperty("--cover-foil-y", `${50 + y * 62}%`);
    });
  });
  albumCover.addEventListener("pointerleave", () => {
    cancelAnimationFrame(coverFrame);
    albumCover.style.setProperty("--cover-tilt-x", "0deg");
    albumCover.style.setProperty("--cover-tilt-y", "0deg");
    albumCover.style.setProperty("--cover-shadow-x", "0px");
    albumCover.style.setProperty("--cover-foil-x", "50%");
    albumCover.style.setProperty("--cover-foil-y", "50%");
  });
}

const particleCanvas = document.querySelector("[data-particle-ocean]");
const particleContext = particleCanvas.getContext("2d", { alpha: true });
const spectrumCanvas = document.querySelector("[data-spectrum]");
const spectrumContext = spectrumCanvas.getContext("2d");
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

  const headerBottom = document.querySelector(".album-header")?.getBoundingClientRect().bottom || 68;
  const footerTop = document.querySelector(".album-footer")?.getBoundingClientRect().top || viewportHeight;
  const atmosphereHeight = Math.max(300, footerTop - headerBottom);
  const horizon = headerBottom + atmosphereHeight * 0.38;
  const clouds = [];
  const water = [];

  const cloudColumns = Math.min(particleMap.width, Math.max(100, Math.floor(viewportWidth / 9)));
  const cloudRows = 30;
  for (let sy = 0; sy < cloudRows; sy += 1) {
    for (let sx = 0; sx < cloudColumns; sx += 1) {
      const mapX = Math.min(particleMap.width - 1, Math.floor((sx / Math.max(1, cloudColumns - 1)) * (particleMap.width - 1)));
      const mapY = Math.min(48, Math.floor((sy / Math.max(1, cloudRows - 1)) * 48));
      const pixel = (mapY * particleMap.width + mapX) * 3;
      const r = particlePixels[pixel];
      const g = particlePixels[pixel + 1];
      const b = particlePixels[pixel + 2];
      const brightness = (r + g + b) / 3;
      const selector = ((sx * 43 + sy * 29) % 103) / 102;
      if (brightness < 28 || selector > 0.12 + brightness / 390) continue;
      const index = sx + sy * cloudColumns;
      const random = seeded(index, 11);
      const targetX = (sx / Math.max(1, cloudColumns - 1)) * viewportWidth;
      const targetY = headerBottom + 14 + (sy / Math.max(1, cloudRows - 1)) * Math.max(80, horizon - headerBottom - 28);
      clouds.push({
        kind: "cloud",
        x: targetX + (random - 0.5) * 36,
        y: targetY + (seeded(index, 12) - 0.5) * 24,
        tx: targetX,
        ty: targetY,
        baseTy: targetY,
        vx: 0,
        vy: 0,
        speed: 0.008 + random * 0.018,
        r,
        g,
        b,
        alpha: Math.min(0.42, 0.08 + brightness / 820),
        size: 0.38 + random * 0.68,
        phase: random * Math.PI * 2,
      });
    }
  }

  const waterColumns = Math.min(particleMap.width, Math.max(110, Math.floor(viewportWidth / 8)));
  const waterRows = Math.min(68, Math.max(44, Math.floor((footerTop - horizon) / 8)));
  for (let sy = 0; sy < waterRows; sy += 1) {
    for (let sx = 0; sx < waterColumns; sx += 1) {
      const mapX = Math.min(particleMap.width - 1, Math.floor((sx / Math.max(1, waterColumns - 1)) * (particleMap.width - 1)));
      const mapY = 44 + Math.floor((sy / Math.max(1, waterRows - 1)) * (particleMap.height - 45));
      const pixel = (mapY * particleMap.width + mapX) * 3;
      const r = particlePixels[pixel];
      const g = particlePixels[pixel + 1];
      const b = particlePixels[pixel + 2];
      const brightness = (r + g + b) / 3;
      const selector = ((sx * 31 + sy * 67) % 107) / 106;
      if (brightness < 9 || selector > 0.16 + brightness / 430) continue;
      const index = sx + sy * waterColumns;
      const random = seeded(index, 13);
      const targetX = (sx / Math.max(1, waterColumns - 1)) * viewportWidth;
      const targetY = horizon + (sy / Math.max(1, waterRows - 1)) * Math.max(120, footerTop - horizon);
      water.push({
        kind: "water",
        x: targetX + (random - 0.5) * 30,
        y: targetY + (seeded(index, 14) - 0.5) * 30,
        tx: targetX,
        ty: targetY,
        baseTx: targetX,
        baseTy: targetY,
        vx: 0,
        vy: 0,
        r,
        g,
        b,
        alpha: Math.min(0.5, 0.09 + brightness / 720),
        size: 0.34 + random * 0.72,
        phase: random * Math.PI * 2,
      });
    }
  }

  particles = [...clouds, ...water];
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
    const frequency = frequencyData?.[Math.floor((index / bars) * (frequencyData.length * 0.68))] / 255 || 0;
    const idle = 0.025 + Math.sin(time * 0.0012 + index * 0.42) * 0.015;
    const value = Math.max(idle, frequency);
    const height = Math.max(2, value * rect.height * 0.72);
    const gradient = spectrumContext.createLinearGradient(0, rect.height - height, 0, rect.height);
    gradient.addColorStop(0, `rgba(255, 101, 157, ${0.2 + value * 0.55})`);
    gradient.addColorStop(0.48, `rgba(47, 211, 240, ${0.12 + value * 0.35})`);
    gradient.addColorStop(1, "rgba(22, 97, 146, 0.025)");
    spectrumContext.fillStyle = gradient;
    spectrumContext.fillRect(index * (width + gap), rect.height - height, Math.max(1, width), height);
  }
};

const animate = (time) => {
  const energy = getAudioEnergy();
  const delta = Math.min(32, Math.max(0, time - previousFrameTime || 16));
  previousFrameTime = time;
  particleContext.clearRect(0, 0, viewportWidth, viewportHeight);
  particleContext.globalCompositeOperation = "lighter";

  for (const particle of particles) {
    if (particle.kind === "cloud") {
      particle.tx -= particle.speed * delta * (1 + energy.overall * 3.2);
      if (particle.tx < -26) {
        particle.tx += viewportWidth + 52;
        particle.x += viewportWidth + 52;
      }
      particle.ty = particle.baseTy + Math.sin(time * 0.00045 + particle.phase) * (1.2 + energy.overall * 3.5);
    } else {
      const waveAmplitude = 3.2 + energy.bass * 12 + energy.overall * 5;
      particle.tx = particle.baseTx + Math.sin(time * 0.0007 + particle.phase) * (1.2 + energy.overall * 2.2);
      particle.ty = particle.baseTy
        + Math.sin(particle.baseTx * 0.017 + time * 0.00125 + particle.phase) * waveAmplitude
        + Math.sin(particle.baseTx * 0.007 - time * 0.00075) * 1.8;
    }

    const dx = particle.x - mouse.x;
    const dy = particle.y - mouse.y;
    const distanceSquared = dx * dx + dy * dy;
    if (mouse.active && distanceSquared < 32400 && distanceSquared > 0.1) {
      const distance = Math.sqrt(distanceSquared);
      const radialX = dx / distance;
      const radialY = dy / distance;
      const tangentX = -radialY;
      const tangentY = radialX;
      const chaosA = Math.sin(time * 0.012 + particle.phase * 17.3);
      const chaosB = Math.cos(time * 0.009 + particle.phase * 23.7);
      const force = (1 - distance / 180) * 2.15;
      particle.vx += (radialX * 0.48 + tangentX * chaosA * 1.18 + chaosB * 0.58) * force;
      particle.vy += (radialY * 0.48 + tangentY * chaosB * 1.18 + chaosA * 0.58) * force;
    }

    if (particle.kind === "water") {
      particle.vx += Math.cos(time * 0.002 + particle.phase) * energy.overall * 0.12;
      particle.vy += Math.sin(time * 0.0026 + particle.phase) * energy.bass * 0.22;
    } else {
      particle.vx -= energy.overall * 0.035;
      particle.vy += Math.sin(time * 0.0018 + particle.phase) * energy.bass * 0.12;
    }

    const spring = particle.kind === "water" ? 0.026 : 0.017;
    const damping = particle.kind === "water" ? 0.89 : 0.92;
    particle.vx += (particle.tx - particle.x) * spring;
    particle.vy += (particle.ty - particle.y) * spring;
    particle.vx *= damping;
    particle.vy *= damping;
    particle.x += particle.vx;
    particle.y += particle.vy;

    const pulse = 1 + Math.min(0.38, energy.overall * 0.5 + energy.bass * 0.18);
    const energyAlpha = energy.overall * 1.05 + energy.bass * 0.32;
    particleContext.fillStyle = `rgba(${particle.r}, ${particle.g}, ${particle.b}, ${Math.min(1, particle.alpha * (0.74 + energyAlpha))})`;
    particleContext.beginPath();
    particleContext.arc(particle.x, particle.y, particle.size * pulse, 0, Math.PI * 2);
    particleContext.fill();
  }

  particleContext.globalCompositeOperation = "source-over";
  drawSpectrum(energy, time);
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
