const tracks = [
  ["Dreamer", "01. Dreamer.ogg"],
  ["Time", "02. Time.ogg"],
  ["New Hope", "03. New Hope.ogg"],
  ["Close Your Eyes", "04. Close Your Eyes.ogg"],
  ["Feeling of Spring", "05. Feeling of Spring.ogg"],
].map(([title, file]) => ({
  title,
  src: encodeURI(`../assets/music/dreamer/${file}`),
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
  if (autoplay) playAudio();
};

tracks.forEach((track, index) => {
  const item = document.createElement("li");
  item.innerHTML = `
    <button class="track-button" type="button" data-track-index="${index}">
      <span class="track-button__number">${String(index + 1).padStart(2, "0")}</span>
      <span class="track-button__title">${track.title}</span>
      <span class="track-button__duration" data-track-duration>—:——</span>
    </button>`;
  item.querySelector("button").addEventListener("click", () => setTrack(index, true));
  trackList.append(item);
  const probe = new Audio();
  probe.preload = "metadata";
  probe.src = track.src;
  probe.addEventListener("loadedmetadata", () => {
    item.querySelector("[data-track-duration]").textContent = formatTime(probe.duration);
  }, { once: true });
});

playButton.addEventListener("click", () => { if (audio.paused) playAudio(); else audio.pause(); });
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
  const resetCover = () => {
    cancelAnimationFrame(coverFrame);
    albumCover.style.setProperty("--cover-tilt-x", "0deg");
    albumCover.style.setProperty("--cover-tilt-y", "0deg");
    albumCover.style.setProperty("--cover-shadow-x", "0px");
    albumCover.style.setProperty("--cover-shadow-y", "18px");
    albumCover.style.setProperty("--cover-foil-x", "50%");
    albumCover.style.setProperty("--cover-foil-y", "50%");
    albumCover.style.setProperty("--cover-foil-angle", "112deg");
  };
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
  albumCover.addEventListener("pointerleave", resetCover);
}

const canvas = document.querySelector("[data-dreamer-particles]");
const context = canvas.getContext("2d", { alpha: true });
const spectrumCanvas = document.querySelector("[data-spectrum]");
const spectrumContext = spectrumCanvas.getContext("2d");
const syntheticSpectrum = new Float32Array(48);
let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;
let scale = Math.min(window.devicePixelRatio || 1, 1.5);
let ambientParticles = [];
let dragons = [];
let cloudParticles = [];
let mouse = { x: -1000, y: -1000, active: false };

const seeded = (value, offset = 0) => {
  const seed = Math.sin((value + 1) * 12.9898 + offset * 78.233) * 43758.5453;
  return seed - Math.floor(seed);
};

const resizeCanvas = () => {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  scale = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.floor(viewportWidth * scale);
  canvas.height = Math.floor(viewportHeight * scale);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  const count = Math.min(1200, Math.max(620, Math.floor((viewportWidth * viewportHeight) / 2100)));
  ambientParticles = Array.from({ length: count }, (_, index) => {
    const orange = seeded(index, 2) > 0.72;
    return {
      x: seeded(index, 3) * viewportWidth,
      y: seeded(index, 4) * viewportHeight,
      tx: seeded(index, 3) * viewportWidth,
      ty: seeded(index, 4) * viewportHeight,
      vx: 0,
      vy: 0,
      phase: seeded(index, 5) * Math.PI * 2,
      size: 0.42 + seeded(index, 6) * 0.72,
      color: orange ? [244, 101, 42] : [54, 194, 207],
      alpha: 0.08 + seeded(index, 7) * 0.19,
    };
  });
  dragons.forEach((dragon) => {
    dragon.motion = null;
    dragon.hasStarted = false;
  });
};

const dragonPalettes = [
  [[247, 103, 35], [255, 188, 69]],
];

const buildDragons = () => {
  let particleId = 0;
  dragons = dragonPalettes.map((palette, dragonIndex) => {
    const particles = [];
    for (let segment = 0; segment < 178; segment += 1) {
      const t = segment / 177;
      for (let copy = 0; copy < 4; copy += 1) {
        const index = dragonIndex * 1000 + segment * 4 + copy;
        particles.push({
          id: particleId++,
          t,
          side: (seeded(index, 11) - 0.5) * 2,
          jitter: (seeded(index, 12) - 0.5) * 8,
          ox: 0,
          oy: 0,
          vx: 0,
          vy: 0,
          size: 0.52 + seeded(index, 13) * 0.82,
          color: seeded(index, 14) > 0.28 ? palette[0] : palette[1],
          alpha: 0.43 + seeded(index, 15) * 0.34,
        });
      }
    }
    return {
      index: dragonIndex,
      particles,
      routeIndex: dragonIndex * 2,
      motion: null,
      lastTime: 0,
      phase: dragonIndex * 2.17,
      hasStarted: false,
    };
  });
};

const routeFor = (routeIndex, dragonLength) => {
  const margin = dragonLength * 0.5 + 45;
  const routes = [
    [-margin, viewportHeight * 0.34, viewportWidth + margin, viewportHeight * 0.34],
    [viewportWidth * 0.72, -margin, viewportWidth * 0.32, viewportHeight + margin],
    [viewportWidth + margin, viewportHeight * 0.24, -margin, viewportHeight * 0.72],
    [viewportWidth * 0.28, viewportHeight + margin, viewportWidth * 0.28, -margin],
    [-margin, viewportHeight * 0.72, viewportWidth + margin, viewportHeight * 0.28],
    [viewportWidth + margin, viewportHeight * 0.64, -margin, viewportHeight * 0.64],
  ];
  return routes[routeIndex % routes.length];
};

const beginDragonRoute = (dragon, dragonLength) => {
  const [startX, startY, endX, endY] = routeFor(dragon.routeIndex, dragonLength);
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const speed = 48 + dragon.index * 5;
  const initialProgress = dragon.hasStarted ? 0 : 0.2 + dragon.index * 0.14;
  dragon.motion = {
    x: startX + dx * initialProgress,
    y: startY + dy * initialProgress,
    targetX: endX,
    targetY: endY,
    vx: (dx / distance) * speed,
    vy: (dy / distance) * speed,
  };
  dragon.hasStarted = true;
  dragon.lastTime = 0;
};

const buildCloud = () => {
  const lobes = [
    { x: 0, y: 0.02, rx: 0.48, ry: 0.44 },
    { x: -0.34, y: 0.07, rx: 0.34, ry: 0.32 },
    { x: 0.32, y: 0.08, rx: 0.35, ry: 0.33 },
    { x: -0.17, y: -0.28, rx: 0.32, ry: 0.35 },
    { x: 0.16, y: -0.31, rx: 0.35, ry: 0.38 },
    { x: 0, y: 0.3, rx: 0.5, ry: 0.24 },
  ];
  cloudParticles = Array.from({ length: 860 }, (_, index) => {
    const lobe = lobes[index % lobes.length];
    const angle = seeded(index, 81) * Math.PI * 2;
    const radial = Math.sqrt(seeded(index, 82));
    const paletteRoll = seeded(index, 83);
    const sizeRoll = seeded(index, 85);
    return {
      nx: lobe.x + Math.cos(angle) * radial * lobe.rx,
      ny: lobe.y + Math.sin(angle) * radial * lobe.ry,
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
      phase: seeded(index, 84) * Math.PI * 2,
      size: 0.42 + Math.pow(sizeRoll, 3) * 3.5,
      color: paletteRoll > 0.82 ? [113, 224, 230]
        : paletteRoll > 0.18 ? [242, 249, 239] : [255, 195, 112],
      alpha: 0.42 + seeded(index, 86) * 0.42,
    };
  });
};

const getAudioEnergy = () => {
  if (audio.paused) return { bass: 0, overall: 0 };
  if (!analyser || !frequencyData) {
    const pulse = Math.max(0, Math.sin(audio.currentTime * Math.PI * 2.5)) ** 8;
    return { bass: 0.055 + pulse * 0.07, overall: 0.035 + pulse * 0.03 };
  }
  analyser.getByteFrequencyData(frequencyData);
  let bass = 0;
  let overall = 0;
  const bassBins = Math.min(14, frequencyData.length);
  for (let index = 0; index < frequencyData.length; index += 1) {
    overall += frequencyData[index];
    if (index < bassBins) bass += frequencyData[index];
  }
  return { bass: bass / bassBins / 255, overall: overall / frequencyData.length / 255 };
};

const drawSpectrum = (energy, time) => {
  const rect = spectrumCanvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  if (spectrumCanvas.width !== Math.floor(rect.width * dpr) || spectrumCanvas.height !== Math.floor(rect.height * dpr)) {
    spectrumCanvas.width = Math.floor(rect.width * dpr);
    spectrumCanvas.height = Math.floor(rect.height * dpr);
  }
  spectrumContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  spectrumContext.clearRect(0, 0, rect.width, rect.height);
  const bars = syntheticSpectrum.length;
  const gap = 3;
  const width = rect.width / bars - gap;
  const frame = Math.floor(audio.currentTime * 11);
  for (let index = 0; index < bars; index += 1) {
    const actual = audio.paused ? 0 : frequencyData?.[Math.floor((index / bars) * frequencyData.length * 0.68)] / 255 || 0;
    const target = audio.paused ? 0 : (0.035 + seeded(frame, index + 70) * 0.15)
      * (0.38 + Math.exp(-index / 16) * 0.62) * (0.72 + energy.bass * 2.7 + energy.overall * 1.9);
    syntheticSpectrum[index] += (target - syntheticSpectrum[index]) * 0.2;
    const idle = 0.022 + Math.sin(time * 0.0011 + index * 0.43) * 0.012;
    const value = Math.max(idle, actual, syntheticSpectrum[index]);
    const height = Math.max(2, value * rect.height * 0.82);
    const gradient = spectrumContext.createLinearGradient(0, rect.height - height, 0, rect.height);
    gradient.addColorStop(0, `rgba(255, 113, 45, ${0.23 + value * 0.56})`);
    gradient.addColorStop(0.5, `rgba(53, 201, 210, ${0.12 + value * 0.38})`);
    gradient.addColorStop(1, "rgba(20, 91, 100, 0.02)");
    spectrumContext.fillStyle = gradient;
    spectrumContext.fillRect(index * (width + gap), rect.height - height, Math.max(1, width), height);
  }
};

const applyCursorPhysics = (particle, x, y, influence = 135) => {
  const currentX = x + particle.ox;
  const currentY = y + particle.oy;
  if (mouse.active) {
    const dx = currentX - mouse.x;
    const dy = currentY - mouse.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 0.1 && distance < influence) {
      const force = (1 - distance / influence) * 1.9;
      particle.vx += (dx / distance) * force;
      particle.vy += (dy / distance) * force;
    }
  }
  particle.vx += -particle.ox * 0.007;
  particle.vy += -particle.oy * 0.007;
  particle.vx *= 0.93;
  particle.vy *= 0.93;
  particle.ox += particle.vx;
  particle.oy += particle.vy;
};

const animate = (time) => {
  const energy = getAudioEnergy();
  context.clearRect(0, 0, viewportWidth, viewportHeight);
  context.globalCompositeOperation = "lighter";

  for (const particle of ambientParticles) {
    const dx = particle.x - mouse.x;
    const dy = particle.y - mouse.y;
    const distanceSquared = dx * dx + dy * dy;
    if (mouse.active && distanceSquared < 22500 && distanceSquared > 0.1) {
      const distance = Math.sqrt(distanceSquared);
      const force = (1 - distance / 150) * 0.95;
      particle.vx += (dx / distance) * force;
      particle.vy += (dy / distance) * force;
    }
    particle.vx += (particle.tx - particle.x) * 0.008;
    particle.vy += (particle.ty - particle.y) * 0.008;
    particle.vx *= 0.93;
    particle.vy *= 0.93;
    particle.x += particle.vx;
    particle.y += particle.vy;
    const [r, g, b] = particle.color;
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.72, particle.alpha)})`;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
  }

  const dragonLength = Math.min(570, Math.max(330, viewportWidth * 0.32));
  const wave = 36;
  const frameParticles = [];

  for (const dragon of dragons) {
    if (!dragon.motion) beginDragonRoute(dragon, dragonLength);
    const delta = dragon.lastTime ? Math.min(0.04, (time - dragon.lastTime) / 1000) : 0;
    dragon.lastTime = time;
    dragon.motion.x += dragon.motion.vx * delta;
    dragon.motion.y += dragon.motion.vy * delta;

    const remainingX = dragon.motion.targetX - dragon.motion.x;
    const remainingY = dragon.motion.targetY - dragon.motion.y;
    if (remainingX * dragon.motion.vx + remainingY * dragon.motion.vy <= 0) {
      dragon.routeIndex = (dragon.routeIndex + 1) % 6;
      beginDragonRoute(dragon, dragonLength);
    }

    const speed = Math.sqrt(dragon.motion.vx ** 2 + dragon.motion.vy ** 2) || 1;
    const dirX = dragon.motion.vx / speed;
    const dirY = dragon.motion.vy / speed;
    const normalX = -dirY;
    const normalY = dirX;
    const waveDirection = dragon.index % 2 === 0 ? 1 : -1;

    for (const particle of dragon.particles) {
      const t = particle.t;
      const phase = t * 10.5 - time * 0.0019 * waveDirection + dragon.phase;
      const along = (0.5 - t) * dragonLength;
      const thickness = 3 + Math.sin(t * Math.PI) * 14;
      const perpendicular = Math.sin(phase) * wave
        + Math.sin(t * 3.4 + time * 0.00075 + dragon.phase) * 13
        + particle.side * thickness + particle.jitter;
      const baseX = dragon.motion.x + dirX * along + normalX * perpendicular;
      const baseY = dragon.motion.y + dirY * along + normalY * perpendicular;
      applyCursorPhysics(particle, baseX, baseY, 132);
      frameParticles.push({ particle, dragonIndex: dragon.index, baseX, baseY });
    }
  }

  const collisionRadius = 165;
  const collisionGrid = new Map();
  for (const item of frameParticles) {
    const x = item.baseX + item.particle.ox;
    const y = item.baseY + item.particle.oy;
    const cellX = Math.floor(x / collisionRadius);
    const cellY = Math.floor(y / collisionRadius);
    item.cellX = cellX;
    item.cellY = cellY;
    const key = `${cellX},${cellY}`;
    if (!collisionGrid.has(key)) collisionGrid.set(key, []);
    collisionGrid.get(key).push(item);
  }

  const headerBottom = document.querySelector(".album-header")?.getBoundingClientRect().bottom || 68;
  const footerTop = document.querySelector(".album-footer")?.getBoundingClientRect().top || viewportHeight;
  const cloudCenterX = viewportWidth * 0.5;
  const cloudCenterY = headerBottom + (footerTop - headerBottom) * 0.48;
  const cloudWidth = Math.min(500, Math.max(320, viewportWidth * 0.27));
  const cloudHeight = cloudWidth * 0.92;
  const cloudPulse = 1 + Math.sin(time * 0.00135) * 0.024;
  const cloudFrame = [];
  const dragonMotion = dragons[0]?.motion;
  const dragonSpeed = dragonMotion ? Math.sqrt(dragonMotion.vx ** 2 + dragonMotion.vy ** 2) || 1 : 1;
  const dragonDirX = dragonMotion ? dragonMotion.vx / dragonSpeed : 1;
  const dragonDirY = dragonMotion ? dragonMotion.vy / dragonSpeed : 0;

  for (const particle of cloudParticles) {
    const baseX = cloudCenterX + particle.nx * cloudWidth * cloudPulse;
    const baseY = cloudCenterY + particle.ny * cloudHeight * cloudPulse;
    particle.vx += -particle.ox * 0.0045;
    particle.vy += -particle.oy * 0.0045;
    particle.vx *= 0.95;
    particle.vy *= 0.95;
    particle.ox += particle.vx;
    particle.oy += particle.vy;

    const currentX = baseX + particle.ox;
    const currentY = baseY + particle.oy;
    if (mouse.active) {
      const mouseDx = currentX - mouse.x;
      const mouseDy = currentY - mouse.y;
      const mouseDistance = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);
      if (mouseDistance > 0.1 && mouseDistance < 165) {
        const mouseForce = (1 - mouseDistance / 165) * 2.25;
        const pushX = (mouseDx / mouseDistance) * mouseForce;
        const pushY = (mouseDy / mouseDistance) * mouseForce;
        particle.vx += pushX;
        particle.vy += pushY;
        particle.ox += pushX * 0.65;
        particle.oy += pushY * 0.65;
      }
    }
    const cellX = Math.floor(currentX / collisionRadius);
    const cellY = Math.floor(currentY / collisionRadius);
    let closest = null;
    let closestDistance = collisionRadius;

    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const neighbours = collisionGrid.get(`${cellX + offsetX},${cellY + offsetY}`) || [];
        for (const dragonParticle of neighbours) {
          const dragonX = dragonParticle.baseX + dragonParticle.particle.ox;
          const dragonY = dragonParticle.baseY + dragonParticle.particle.oy;
          const dx = currentX - dragonX;
          const dy = currentY - dragonY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < closestDistance) {
            closestDistance = distance;
            closest = { dx, dy, id: dragonParticle.particle.id };
          }
        }
      }
    }

    if (closest) {
      let { dx, dy } = closest;
      let distance = closestDistance;
      if (distance < 0.1) {
        const angle = seeded(closest.id, Math.round(particle.phase * 100)) * Math.PI * 2;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        distance = 1;
      }
      const proximity = 1 - distance / collisionRadius;
      const innerZone = Math.max(0, 1 - distance / 14);
      const attraction = proximity * 0.82;
      const repulsion = Math.pow(innerZone, 1.4) * 0.62;
      const radialForce = repulsion - attraction;
      const normalX = dx / distance;
      const normalY = dy / distance;
      const spinDirection = Math.sin(particle.phase * 2.7) > 0 ? 1 : -1;
      const swirl = Math.sin(proximity * Math.PI) * 1.05 * spinDirection;
      const turbulence = Math.sin(particle.phase * 3.1 + time * 0.0032) * proximity * 0.58;
      const pushX = normalX * radialForce - normalY * swirl
        + dragonDirX * proximity * 0.82 - dragonDirY * turbulence;
      const pushY = normalY * radialForce + normalX * swirl
        + dragonDirY * proximity * 0.82 + dragonDirX * turbulence;
      particle.vx += pushX * 0.15625;
      particle.vy += pushY * 0.15625;
      particle.ox += pushX * 0.10625;
      particle.oy += pushY * 0.10625;
    }
    cloudFrame.push({ particle, baseX, baseY });
  }

  for (const item of frameParticles) {
    const currentX = item.baseX + item.particle.ox;
    const currentY = item.baseY + item.particle.oy;
    const normalizedX = (currentX - cloudCenterX) / (cloudWidth * 0.66);
    const normalizedY = (currentY - cloudCenterY) / (cloudHeight * 0.66);
    const cloudDistance = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
    if (cloudDistance >= 1) continue;
    const mix = 1 - cloudDistance;
    const angle = item.particle.id * 1.73 + time * 0.0024;
    const mixX = (Math.cos(angle) * 0.42 - dragonDirY * 0.34) * mix;
    const mixY = (Math.sin(angle) * 0.42 + dragonDirX * 0.34) * mix;
    item.particle.vx += mixX * 0.15625;
    item.particle.vy += mixY * 0.15625;
    item.particle.ox += mixX * 0.0375;
    item.particle.oy += mixY * 0.0375;
  }

  for (const item of cloudFrame) {
    const { particle, baseX, baseY } = item;
    const [r, g, b] = particle.color;
    const shimmer = 0.05 * Math.sin(time * 0.0017 + particle.phase);
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.96, particle.alpha + shimmer)})`;
    context.beginPath();
    context.arc(baseX + particle.ox, baseY + particle.oy, particle.size, 0, Math.PI * 2);
    context.fill();
  }

  for (const item of frameParticles) {
    const { particle, baseX, baseY } = item;
    const [r, g, b] = particle.color;
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, particle.alpha)})`;
    context.beginPath();
    context.arc(baseX + particle.ox, baseY + particle.oy, particle.size, 0, Math.PI * 2);
    context.fill();
  }

  context.globalCompositeOperation = "source-over";
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
  resizeTimer = setTimeout(resizeCanvas, 140);
});

resizeCanvas();
buildDragons();
buildCloud();
requestAnimationFrame(animate);
