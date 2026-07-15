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
const particleStage = document.querySelector("[data-particle-stage]");
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
let stageCenter = { x: viewportWidth / 2, y: viewportHeight / 2 };

const seeded = (value, offset = 0) => {
  const seed = Math.sin((value + 1) * 12.9898 + offset * 78.233) * 43758.5453;
  return seed - Math.floor(seed);
};

const sampleCover = () => {
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
  particleContext.clearRect(0, 0, viewportWidth, viewportHeight);
  particleContext.globalCompositeOperation = "lighter";

  if (particleStage) {
    const glow = 0.42 + energy.overall * 0.8;
    particleStage.style.borderColor = `rgba(75, 232, 237, ${Math.min(0.9, glow)})`;
  }

  for (const particle of particles) {
    const dx = particle.x - mouse.x;
    const dy = particle.y - mouse.y;
    const distanceSquared = dx * dx + dy * dy;
    if (mouse.active && distanceSquared < 25600 && distanceSquared > 0.1) {
      const distance = Math.sqrt(distanceSquared);
      const force = (1 - distance / 160) * (particle.kind === "artwork" ? 1.35 : 0.92);
      particle.vx += (dx / distance) * force;
      particle.vy += (dy / distance) * force;
    }

    const originX = particle.kind === "artwork" ? stageCenter.x : viewportWidth / 2;
    const originY = particle.kind === "artwork" ? stageCenter.y : viewportHeight / 2;
    const centerDx = particle.tx - originX;
    const centerDy = particle.ty - originY;
    const centerDistance = Math.max(1, Math.hypot(centerDx, centerDy));
    const musicEnergy = Math.max(0, energy.bass - 0.055);
    const beatForce = musicEnergy * (particle.kind === "artwork" ? 1.25 : 0.5);
    particle.vx += (centerDx / centerDistance) * beatForce;
    particle.vy += (centerDy / centerDistance) * beatForce;
    particle.vy += Math.sin(time * 0.0024 + particle.phase) * energy.overall * (particle.kind === "artwork" ? 0.13 : 0.07);
    const spring = particle.kind === "artwork" ? 0.028 : 0.014;
    const damping = particle.kind === "artwork" ? 0.88 : 0.92;
    particle.vx += (particle.tx - particle.x) * spring;
    particle.vy += (particle.ty - particle.y) * spring;
    particle.vx *= damping;
    particle.vy *= damping;
    particle.x += particle.vx;
    particle.y += particle.vy;

    const pulse = 1 + energy.overall * (particle.kind === "artwork" ? 1.15 : 0.7) + Math.sin(time * 0.00075 + particle.phase) * 0.045;
    const energyAlpha = particle.kind === "artwork" ? energy.overall * 1.2 : energy.overall * 0.75;
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
