// Backdrop: the unit's surface feed, dimmed behind the panels.
// Falls back to the CSS starfield if the video cannot load; reduced motion shows the poster still.
(() => {
  const sky = document.querySelector(".sky");
  const video = document.querySelector("#sky-feed");
  if (!sky || !video) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function goLive() {
    sky.classList.add("has-feed");
  }

  function applyMotionPreference() {
    if (reducedMotion.matches) {
      video.pause();
      goLive();
      return;
    }
    const playing = video.play();
    if (playing && playing.catch) playing.catch(() => goLive());
  }

  video.addEventListener("playing", goLive);
  video.addEventListener("error", () => sky.classList.remove("has-feed"), true);
  reducedMotion.addEventListener("change", applyMotionPreference);
  applyMotionPreference();
})();
