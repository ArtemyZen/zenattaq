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
        art.style.setProperty("--tilt-x", `${y * -8}deg`);
        art.style.setProperty("--tilt-y", `${x * 8}deg`);
        art.style.setProperty("--shadow-x", `${x * -18}px`);
        art.style.setProperty("--shadow-y", `${18 + y * 12}px`);
        art.style.setProperty("--shine-x", `${x * 145 + 50}%`);
        art.style.setProperty("--shine-angle", `${112 + y * 18}deg`);
      });
    };

    const reset = () => {
      cancelAnimationFrame(frame);
      art.style.setProperty("--tilt-x", "0deg");
      art.style.setProperty("--tilt-y", "0deg");
      art.style.setProperty("--shadow-x", "0px");
      art.style.setProperty("--shadow-y", "18px");
      art.style.setProperty("--shine-x", "-45%");
      art.style.setProperty("--shine-angle", "112deg");
    };

    art.addEventListener("pointermove", update);
    art.addEventListener("pointerleave", reset);
  });
}
