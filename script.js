const cleanPath = window.location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
if (cleanPath !== window.location.pathname) {
  window.history.replaceState(null, "", `${cleanPath}${window.location.search}${window.location.hash}`);
}

const year = document.querySelector("[data-current-year]");

if (year) {
  year.textContent = new Date().getFullYear();
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (!reduceMotion.matches) {
  document.querySelectorAll("[data-tilt-card]").forEach((art) => {
    let frame;

    const update = (event) => {
      const rect = art.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        art.style.setProperty("--tilt-x", `${y * -12}deg`);
        art.style.setProperty("--tilt-y", `${x * 12}deg`);
        art.style.setProperty("--shadow-x", `${x * -28}px`);
        art.style.setProperty("--shadow-y", `${20 + y * 18}px`);
        art.style.setProperty("--foil-shift-x", `${50 + x * 62}%`);
        art.style.setProperty("--foil-shift-y", `${50 + y * 62}%`);
        art.style.setProperty("--foil-angle", `${112 + x * 16 - y * 12}deg`);
      });
    };

    const reset = () => {
      cancelAnimationFrame(frame);
      art.style.setProperty("--tilt-x", "0deg");
      art.style.setProperty("--tilt-y", "0deg");
      art.style.setProperty("--shadow-x", "0px");
      art.style.setProperty("--shadow-y", "18px");
      art.style.setProperty("--foil-shift-x", "50%");
      art.style.setProperty("--foil-shift-y", "50%");
      art.style.setProperty("--foil-angle", "112deg");
    };

    art.addEventListener("pointermove", update);
    art.addEventListener("pointerleave", reset);
  });
}
