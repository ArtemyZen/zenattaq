const canvas = document.querySelector("[data-coming-soon]");
const context = canvas.getContext("2d", { alpha: true });
const cover = document.querySelector("[data-album-cover-tilt]");
let width = window.innerWidth;
let height = window.innerHeight;
let messageParticles = [];
let pointer = { x: -1000, y: -1000, active: false };

const seeded = (value, offset = 0) => {
  const seed = Math.sin((value + 1) * 12.9898 + offset * 78.233) * 43758.5453;
  return seed - Math.floor(seed);
};

const renderComingSoon = () => {
  width = window.innerWidth;
  height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  messageParticles = [];

  const details = document.querySelector(".album-details")?.getBoundingClientRect();
  const player = document.querySelector(".player-panel")?.getBoundingClientRect();
  const header = document.querySelector(".album-header")?.getBoundingClientRect();
  const footer = document.querySelector(".album-footer")?.getBoundingClientRect();
  const left = (details?.right || 0) + 24;
  const right = (player?.left || width) - 24;
  if (right - left < 220 || width <= 920) return;

  const centerX = (left + right) * 0.5;
  const centerY = (header?.bottom || 68) + ((footer?.top || height) - (header?.bottom || 68)) * 0.48;
  const fontSize = Math.min(68, Math.max(34, (right - left) * 0.105));
  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const maskContext = mask.getContext("2d");
  maskContext.fillStyle = "#fff";
  maskContext.textAlign = "center";
  maskContext.textBaseline = "middle";
  maskContext.font = `700 ${fontSize}px Arial, sans-serif`;
  maskContext.fillText("COMING SOON", centerX, centerY);
  const pixels = maskContext.getImageData(0, 0, width, height).data;
  const step = 5;
  let index = 0;

  for (let y = Math.max(0, centerY - fontSize); y < Math.min(height, centerY + fontSize); y += step) {
    for (let x = Math.max(0, left); x < Math.min(width, right); x += step) {
      const alpha = pixels[(Math.floor(y) * width + Math.floor(x)) * 4 + 3];
      if (alpha < 100 || seeded(index++, 4) < 0.12) continue;
      const cyan = seeded(index, 5) > 0.72;
      messageParticles.push({
        x: x + (seeded(index, 6) - 0.5) * 1.8,
        y: y + (seeded(index, 7) - 0.5) * 1.8,
        ox: 0,
        oy: 0,
        vx: 0,
        vy: 0,
        size: 0.7 + seeded(index, 8) * 0.75,
        color: cyan ? [67, 228, 207] : [238, 252, 249],
        alpha: cyan ? 0.9 : 0.82,
      });
    }
  }
};

const animateMessage = () => {
  context.clearRect(0, 0, width, height);
  for (const particle of messageParticles) {
    const currentX = particle.x + particle.ox;
    const currentY = particle.y + particle.oy;
    if (pointer.active) {
      const dx = currentX - pointer.x;
      const dy = currentY - pointer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 0.1 && distance < 115) {
        const force = (1 - distance / 115) * 2.1;
        particle.vx += (dx / distance) * force;
        particle.vy += (dy / distance) * force;
      }
    }
    particle.vx += -particle.ox * 0.006;
    particle.vy += -particle.oy * 0.006;
    particle.vx *= 0.93;
    particle.vy *= 0.93;
    particle.ox += particle.vx;
    particle.oy += particle.vy;
    const [r, g, b] = particle.color;
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${particle.alpha})`;
    context.beginPath();
    context.arc(particle.x + particle.ox, particle.y + particle.oy, particle.size, 0, Math.PI * 2);
    context.fill();
  }
  requestAnimationFrame(animateMessage);
};

const onCoverMove = (event) => {
  const rect = cover.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
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

window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
}, { passive: true });
document.documentElement.addEventListener("pointerleave", () => { pointer.active = false; });
window.addEventListener("blur", () => { pointer.active = false; });

document.querySelector("[data-current-year]").textContent = new Date().getFullYear();
window.addEventListener("load", () => {
  renderComingSoon();
  requestAnimationFrame(animateMessage);
}, { once: true });
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderComingSoon, 120);
});
