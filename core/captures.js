// Buffer recovery: the unit's last captures, shown before the login.
// The sequence (CelContent.getCaptures) runs clean captures first, then The Caretaker's message
// cuts in, and every capture after it arrives damaged: "received" block by block, stalling where
// the data ends, glitching while it is on screen. The damage is baked into the images on disk.
// Sound (CelAudio) and screen effects are cued per step in CUES below.
const CelCaptures = (() => {
  const screen = document.querySelector("#capture-screen");
  const panel = document.querySelector(".capture-panel");
  const canvas = document.querySelector("#capture-canvas");
  const ctx = canvas.getContext("2d");
  const indexEl = document.querySelector("#capture-index");
  const stampEl = document.querySelector("#capture-stamp");
  const progressEl = document.querySelector("#capture-progress");
  const labelEl = document.querySelector("#capture-label");
  const textEl = document.querySelector("#capture-text");
  const dotsEl = document.querySelector("#capture-dots");
  const nextButton = document.querySelector("#capture-next");
  const skipButton = document.querySelector("#capture-skip");
  const soundButton = document.querySelector("#capture-sound");
  const frame = document.querySelector(".capture-frame");
  const flashEl = document.querySelector("#capture-flash");
  const gateEl = document.querySelector("#capture-gate");
  const messageEl = document.querySelector("#capture-message");
  const loopVideo = document.querySelector("#capture-loop");

  const BLOCK = 16; // source pixels per macroblock (matches the generator)
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let steps = [];
  let imagesReady = Promise.resolve([]);
  let index = -1;
  let run = 0; // bumps on every new step so stale timers stop
  let finished = false;
  let atGate = false;
  let busy = false; // true while the message cuts in or the screen powers off
  let onDone = null;
  let glitchTimer = 0;

  function wait(ms, token) {
    return new Promise((resolve, reject) => {
      setTimeout(() => (token === run ? resolve() : reject(new Error("stale"))), ms);
    });
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  const isMessage = (step) => step && step.type === "message";
  const captureCount = () => steps.filter((step) => !isMessage(step)).length;
  const captureNumber = (i) => steps.slice(0, i + 1).filter((step) => !isMessage(step)).length;

  // ---------- screen effects ----------

  // Restartable one-shot CSS effect on an element.
  function fx(el, name, ms) {
    if (reducedMotion.matches) return;
    el.classList.remove(name);
    void el.offsetWidth;
    el.classList.add(name);
    setTimeout(() => el.classList.remove(name), ms);
  }

  function flash(colour, ms = 600) {
    if (reducedMotion.matches) return;
    flashEl.style.setProperty("--flash", colour);
    fx(flashEl, "is-flashing", ms);
  }

  function setMood(mood) {
    frame.classList.toggle("fx-alert", mood === "alert");
    panel.classList.toggle("fx-rumble", mood === "rumble" && !reducedMotion.matches);
  }

  // ---------- sound + effect cues per step ----------

  const CUES = {
    "capture-01": {
      show() {
        CelAudio.loop("hum", { volume: 0.35 });
      },
      received() {
        CelAudio.play("beep-ok", { volume: 0.5 });
      }
    },
    "capture-02": {
      show() {
        CelAudio.loop("hum", { volume: 0.25 });
        CelAudio.loop("engine", { volume: 0.4, fade: 2.5, rate: 0.7 });
        CelAudio.bend("engine", 1, 2.5);
        CelAudio.loop("field", { volume: 0.12, fade: 3, rate: 0.8 });
        CelAudio.bend("field", 1.05, 6);
        setMood("rumble");
      },
      received() {
        CelAudio.play("beep-soft", { volume: 0.5 });
      }
    },
    carrier: {
      show() {
        flash("rgba(224, 180, 105, 0.55)", 900);
        CelAudio.play("boom", { volume: 0.35, rate: 0.55 });
        CelAudio.loop("rumble", { volume: 0.45, fade: 1.5 });
      }
    },
    "capture-03": {
      show() {
        setMood("alert");
        CelAudio.loop("rumble", { volume: 0.35 });
        CelAudio.loop("field", { volume: 0.15, fade: 0.5 });
        CelAudio.bend("field", 1.7, 3);
        [0, 1.1].forEach((delay) => CelAudio.play("alert", { volume: 0.3, delay }));
        CelAudio.play("charge", { volume: 0.3, delay: 0.4, rate: 0.8 });
      }
    },
    "capture-04": {
      show() {
        setMood(null);
        flash("rgba(255, 244, 225, 0.9)", 1100);
        fx(panel, "fx-shake-hard", 700);
        CelAudio.stop("field", 0.3);
        CelAudio.play("boom", { volume: 0.6, rate: 0.8 });
        CelAudio.loop("rumble", { volume: 0.5, fade: 0.6 });
        CelAudio.bend("rumble", 0.6, 4);
      }
    },
    "capture-05": {
      show() {
        setMood(null);
        CelAudio.stop("rumble", 2.5);
        CelAudio.loop("wind", { volume: 0.6, fade: 3 });
      },
      received() {
        [0.4, 1.6].forEach((delay) => CelAudio.play("o2", { volume: 0.3, delay }));
      }
    }
  };

  function cue(step, phase) {
    const entry = step && CUES[step.id];
    if (entry && entry[phase]) entry[phase]();
  }

  // ---------- drawing ----------

  function renderDots() {
    dotsEl.innerHTML = "";
    steps.forEach((step, i) => {
      const dot = document.createElement("span");
      dot.className = "capture-dot"
        + (isMessage(step) ? " is-carrier" : "")
        + (i < index || finished ? " is-done" : "")
        + (i === index && !finished ? " is-current" : "");
      dotsEl.appendChild(dot);
    });
  }

  function clearCanvas() {
    ctx.fillStyle = "#020408";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function setProgress(text, state) {
    progressEl.textContent = text;
    progressEl.classList.toggle("is-ended", state === "ended");
    progressEl.classList.toggle("is-carrier", state === "carrier");
  }

  async function typeText(text, token) {
    textEl.textContent = "";
    if (reducedMotion.matches) {
      textEl.textContent = text;
      return;
    }
    for (let i = 0; i < text.length; i += 1) {
      textEl.textContent = text.slice(0, i + 1);
      await wait(text[i] === "." ? 160 : 22, token);
    }
  }

  // Short horizontal tear on the frame, then restore.
  function glitchOnce(img, strength = 1) {
    const h = canvas.height;
    const w = canvas.width;
    const bands = Math.round((1 + Math.random() * 2) * strength);
    for (let b = 0; b < bands; b += 1) {
      const y = Math.floor(Math.random() * h * 0.9);
      const bh = 4 + Math.floor(Math.random() * 40 * strength);
      const dx = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 140 * strength);
      ctx.drawImage(img, 0, y, w, bh, dx, y, w, bh);
      ctx.fillStyle = Math.random() < 0.5 ? "rgba(224, 180, 105, 0.22)" : "rgba(255, 60, 200, 0.14)";
      ctx.fillRect(0, y, w, bh);
    }
    if (Math.random() < 0.5) CelAudio.glitch(0.4 * strength);
    if (strength > 1.2) fx(canvas, "fx-rgb", 220);
    frame.classList.add("is-tearing");
    setTimeout(() => {
      ctx.drawImage(img, 0, 0, w, h);
      frame.classList.remove("is-tearing");
    }, 70 + Math.random() * 90);
  }

  function startGlitching(img, token) {
    clearTimeout(glitchTimer);
    if (reducedMotion.matches) return;
    const tick = () => {
      if (token !== run) return;
      glitchOnce(img);
      glitchTimer = setTimeout(tick, 1400 + Math.random() * 3200);
    };
    glitchTimer = setTimeout(tick, 900 + Math.random() * 1500);
  }

  // Clean capture: steady top-to-bottom receive, no stalls, nothing missing.
  async function receiveClean(img, token) {
    const w = canvas.width;
    const h = canvas.height;
    clearCanvas();
    if (reducedMotion.matches) {
      ctx.drawImage(img, 0, 0, w, h);
      setProgress("RECEIVED 100% // NOMINAL");
      return;
    }
    const scale = w / img.naturalWidth;
    const band = BLOCK * scale * 2;
    let n = 0;
    for (let y = 0; y < h; y += band) {
      ctx.drawImage(img, 0, y / scale, w / scale, band / scale, 0, y, w, band);
      setProgress(`RECEIVING ${pad(Math.min(100, Math.round(((y + band) / h) * 100)))}%`);
      if (n++ % 6 === 0) CelAudio.chirp(false);
      await wait(16, token);
    }
    ctx.drawImage(img, 0, 0, w, h);
    setProgress("RECEIVED 100% // NOMINAL");
  }

  async function receiveDamaged(cap, img, token) {
    const w = canvas.width;
    const h = canvas.height;
    const scale = w / img.naturalWidth;
    const block = BLOCK * scale;
    const cols = Math.ceil(w / block);
    const stopRow = Math.round((cap.stop * h) / block);
    const stopCol = Math.round((cap.stopCol * w) / block);
    const total = stopRow * cols + stopCol;
    const recovered = Math.round(cap.stop * 100);
    const draw = (sx, sy, sw, sh) => ctx.drawImage(img, sx / scale, sy / scale, sw / scale, sh / scale, sx, sy, sw, sh);

    clearCanvas();
    if (reducedMotion.matches) {
      ctx.drawImage(img, 0, 0, w, h);
      setProgress(`RECOVERED ${recovered}% // DATA ENDS`, "ended");
      return;
    }

    setProgress("RECEIVING 00%");
    let done = 0;
    let n = 0;
    const stalls = 2 + Math.floor(Math.random() * 2);
    const stallAt = new Set(Array.from({ length: stalls }, () => Math.floor(total * (0.15 + Math.random() * 0.7))));
    const perFrame = Math.max(8, Math.round(total / 150));

    while (done < total) {
      const step = Math.min(perFrame, total - done);
      const startRow = Math.floor(done / cols);
      const startCol = done % cols;
      const end = done + step;
      const endRow = Math.floor(end / cols);
      const endCol = end % cols;
      for (let row = startRow; row <= endRow; row += 1) {
        const from = row === startRow ? startCol : 0;
        const to = row === endRow ? endCol : cols;
        if (to > from) draw(from * block, row * block, (to - from) * block, block);
      }
      done = end;
      setProgress(`RECEIVING ${pad(Math.floor((done / total) * recovered))}%`);
      if (n++ % 8 === 0) CelAudio.chirp(true);
      for (const at of stallAt) {
        if (done >= at) {
          stallAt.delete(at);
          await wait(220 + Math.random() * 520, token);
        }
      }
      await wait(16, token);
    }

    // Data runs out: hold, then the decoder gives up and shows what it has.
    setProgress(`RECEIVING ${pad(recovered)}% ...`);
    await wait(900, token);
    const coarseY = Math.round(cap.coarseEnd * h);
    const stopY = stopRow * block;
    draw(stopCol * block, stopY, w - stopCol * block, block);
    draw(0, stopY + block, w, Math.max(0, coarseY - stopY - block));
    CelAudio.glitch(1.2);
    fx(canvas, "fx-rgb", 260);
    await wait(260, token);
    draw(0, coarseY, w, h - coarseY);
    setProgress(`RECOVERED ${recovered}% // DATA ENDS`, "ended");
  }

  function nextLabel(i) {
    return i >= steps.length - 1 ? "End of buffer" : "Next capture";
  }

  function resetView() {
    screen.classList.remove("is-finished", "is-message", "is-gate");
    gateEl.hidden = true;
    messageEl.hidden = true;
    playLoop(false);
  }

  // ---------- steps ----------

  function showGate() {
    run += 1;
    atGate = true;
    index = -1;
    finished = false;
    resetView();
    setMood(null);
    screen.classList.add("is-gate");
    gateEl.hidden = false;
    clearCanvas();
    renderDots();
    indexEl.textContent = "BUFFER FOUND";
    stampEl.textContent = "UNIT NX-2142";
    setProgress(`${pad(captureCount())} CAPTURES // 01 UNRESOLVED CARRIER`);
    labelEl.textContent = "RECOVERED FLIGHT BUFFER";
    textEl.textContent = "The unit kept its last flight. Play it back. Best with sound.";
    canvas.setAttribute("aria-label", "A dark screen. The unit has found a flight buffer.");
    nextButton.disabled = false;
    nextButton.textContent = "Begin recovery";
    nextButton.focus({ preventScroll: true });
  }

  async function begin() {
    busy = true;
    atGate = false;
    // Wait briefly for the sounds; never hold the intro hostage to them.
    await Promise.race([CelAudio.unlock(), sleep(1500)]);
    CelAudio.play("beep-long", { volume: 0.45 });
    gateEl.hidden = true;
    screen.classList.remove("is-gate");
    fx(frame, "fx-poweron", 750);
    busy = false;
    go(0);
  }

  async function showCapture(i) {
    run += 1;
    const token = run;
    clearTimeout(glitchTimer);
    index = i;
    finished = false;
    resetView();
    const cap = steps[i];

    indexEl.textContent = `CAPTURE ${pad(captureNumber(i))}/${pad(captureCount())}`;
    stampEl.textContent = cap.stamp;
    labelEl.textContent = cap.label;
    textEl.textContent = "";
    canvas.setAttribute("aria-label", cap.alt);
    nextButton.disabled = true;
    nextButton.textContent = nextLabel(i);
    renderDots();
    cue(cap, "show");

    try {
      const img = (await imagesReady)[i];
      if (token !== run) return;
      if (!img) {
        clearCanvas();
        setProgress("CAPTURE UNREADABLE", "ended");
      } else if (cap.clean) {
        await receiveClean(img, token);
      } else {
        await receiveDamaged(cap, img, token);
      }
      cue(cap, "received");
      await wait(reducedMotion.matches ? 0 : 300, token);
      await typeText(cap.text, token);
      nextButton.disabled = false;
      nextButton.focus({ preventScroll: true });
      if (img && !cap.clean) startGlitching(img, token);
    } catch (error) {
      // a newer step took over; drop this one
    }
  }

  // The message cuts into a clean feed: gold interference, the drive dies, the carrier takes the frame.
  async function interrupt(i) {
    busy = true;
    run += 1;
    const token = run;
    clearTimeout(glitchTimer);
    nextButton.disabled = true;
    setMood(null);
    const img = (await imagesReady)[i];
    try {
      setProgress("CARRIER DETECTED // SOURCE UNKNOWN", "carrier");
      stampEl.textContent = "T+00:00:2▒";
      document.body.classList.add("carrier-surge");
      fx(panel, "fx-shake-hard", 1500);
      CelAudio.bend("engine", 0.35, 1.6);
      CelAudio.bend("field", 0.5, 1.6);
      CelAudio.stop("engine", 1.8);
      CelAudio.stop("field", 1.4);
      CelAudio.stop("hum", 0.3);
      CelAudio.loop("rumble", { volume: 0.35, fade: 1.2 });
      if (img && !reducedMotion.matches) {
        for (let k = 0; k < 9; k += 1) {
          glitchOnce(img, 1 + k * 0.25);
          await wait(110 + Math.random() * 90, token);
        }
        clearCanvas();
        await wait(220, token);
      }
    } catch (error) {
      // skipped
    }
    document.body.classList.remove("carrier-surge");
    busy = false;
  }

  function showEnd() {
    run += 1;
    clearTimeout(glitchTimer);
    finished = true;
    index = steps.length;
    setMood(null);
    screen.classList.add("is-finished");
    screen.classList.remove("is-message");
    renderDots();
    indexEl.textContent = `BUFFER ${pad(captureCount())}/${pad(captureCount())}`;
    stampEl.textContent = "OWNER SIGNAL: LOST";
    setProgress("END OF RECOVERABLE BUFFER", "ended");
    labelEl.textContent = `BUFFER EXHAUSTED // ${captureCount()} CAPTURES`;
    textEl.textContent = "Everything after this is locked behind the owner's passphrase. The unit is still waiting for it.";
    canvas.setAttribute("aria-label", "The last capture, frozen and dimmed.");
    CelAudio.stopAll(3);
    [0.3, 1.5].forEach((delay, k) => CelAudio.play("heartbeat", { volume: 0.6 - k * 0.2, delay }));
    nextButton.disabled = false;
    nextButton.textContent = "Open the unit";
    nextButton.focus({ preventScroll: true });
  }

  // The unit translating as it goes: letters arrive as noise and settle left to right.
  async function decodeLine(el, text, token) {
    if (reducedMotion.matches) {
      el.textContent = text;
      return;
    }
    const noise = "▒░▓ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const span = 10;
    for (let i = 0; i <= text.length; i += 1) {
      let tail = "";
      for (let k = i; k < Math.min(text.length, i + span); k += 1) {
        tail += text[k] === " " ? " " : noise[Math.floor(Math.random() * noise.length)];
      }
      el.textContent = text.slice(0, i) + tail;
      if (i % 6 === 0 && text[i] !== " ") CelAudio.tick();
      await wait(text[i - 1] === "," || text[i - 1] === ":" ? 110 : text[i - 1] === "." ? 260 : 14, token);
    }
  }

  async function showMessage(i) {
    run += 1;
    const token = run;
    const msg = CelContent.getCarrierMessage();
    index = i;
    finished = false;
    resetView();
    screen.classList.add("is-message");
    renderDots();
    clearCanvas();
    indexEl.textContent = "INCOMING CARRIER";
    stampEl.textContent = msg.age;
    setProgress("TRANSLATING ...", "carrier");
    labelEl.textContent = msg.label;
    textEl.textContent = "";
    canvas.setAttribute("aria-label", "Golden rings turn slowly above white cloud under a green-lit sky. A message is being translated.");
    playLoop(true);
    messageEl.innerHTML = "";
    messageEl.hidden = false;
    nextButton.disabled = true;
    nextButton.textContent = nextLabel(i);
    cue(steps[i], "show");

    try {
      await wait(reducedMotion.matches ? 0 : 400, token);
      for (const line of msg.lines) {
        const p = document.createElement("p");
        messageEl.appendChild(p);
        await decodeLine(p, line, token);
        await wait(reducedMotion.matches ? 0 : 300, token);
      }
      setProgress("TRANSLATION: ROUGH // SOURCE: UNRESOLVED", "carrier");
      await typeText(msg.note, token);
      nextButton.disabled = false;
      nextButton.focus({ preventScroll: true });
    } catch (error) {
      // skipped
    }
  }

  // SkyRings loop behind the message. Reduced motion keeps the poster still.
  function playLoop(on) {
    loopVideo.hidden = !on;
    if (!on || reducedMotion.matches) {
      loopVideo.pause();
      return;
    }
    loopVideo.currentTime = 0;
    const playing = loopVideo.play();
    if (playing && playing.catch) playing.catch(() => {});
  }

  async function go(i) {
    if (i >= steps.length) {
      showEnd();
      return;
    }
    if (isMessage(steps[i])) {
      if (index >= 0 && index < steps.length && !isMessage(steps[index])) await interrupt(index);
      if (screen.hidden) return; // skipped while the message was cutting in
      showMessage(i);
    } else {
      showCapture(i);
    }
  }

  function close() {
    run += 1;
    busy = false;
    atGate = false;
    setMood(null);
    document.body.classList.remove("carrier-surge");
    playLoop(false);
    clearTimeout(glitchTimer);
    CelAudio.stopAll(0.5);
    screen.hidden = true;
    CelState.setCapturesSeen();
    if (onDone) onDone();
  }

  // The unit's screen collapses to a line before handing over to the login.
  async function powerOff() {
    busy = true;
    CelAudio.play("boom", { volume: 0.35, rate: 0.6 });
    CelAudio.glitch(0.8);
    if (!reducedMotion.matches) {
      fx(frame, "fx-poweroff", 700);
      await sleep(650);
    }
    close();
  }

  function renderSoundButton() {
    const on = CelAudio.isEnabled();
    soundButton.textContent = on ? "Sound on" : "Sound off";
    soundButton.setAttribute("aria-pressed", on ? "true" : "false");
  }

  nextButton.addEventListener("click", () => {
    if (busy) return;
    if (atGate) begin();
    else if (finished) powerOff();
    else go(index + 1);
  });

  skipButton.addEventListener("click", close);

  soundButton.addEventListener("click", () => {
    CelAudio.setEnabled(!CelAudio.isEnabled());
    if (CelAudio.isEnabled()) CelAudio.unlock();
    renderSoundButton();
  });

  screen.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  function start(done) {
    onDone = done;
    steps = CelContent.getCaptures();
    screen.hidden = false;
    renderSoundButton();
    imagesReady = Promise.all(steps.map((step) => (isMessage(step) ? null : loadImage(step.image))));
    showGate();
  }

  return { start, isOpen: () => !screen.hidden };
})();
