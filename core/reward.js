const CelReward = (() => {
  const effect = document.querySelector("#reward-effect");
  const kicker = effect.querySelector("[data-reward-kicker]");
  const title = effect.querySelector("[data-reward-title]");
  let timer = null;

  // Low, slow open fifth: reads as "old machine wakes up", not as a game chime.
  function playSound() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const context = new AudioContext();
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.08);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.8);
    master.connect(context.destination);

    [98, 147, 196, 294].forEach((frequency, index) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.12;
      osc.type = index % 2 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(frequency, start);
      osc.detune.setValueAtTime(index * 3 - 4, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.45, start + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 1.5);
    });

    window.setTimeout(() => context.close(), 2200);
  }

  function hide() {
    if (timer) window.clearTimeout(timer);
    timer = null;
    effect.hidden = true;
    document.body.classList.remove("reward-active");
  }

  function show({ kicker: kickerText, title: titleText, duration = 2200, sound = true }) {
    kicker.textContent = kickerText;
    title.textContent = titleText;
    if (sound) playSound();
    if (timer) window.clearTimeout(timer);

    document.body.classList.remove("reward-active");
    effect.hidden = true;
    void effect.offsetWidth;
    effect.hidden = false;
    document.body.classList.add("reward-active");
    timer = window.setTimeout(hide, duration);
  }

  return { hide, show };
})();
