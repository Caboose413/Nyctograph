(() => {
  const bootScreen = document.querySelector("#boot-screen");
  const consoleScreen = document.querySelector("#console-screen");
  const readerScreen = document.querySelector("#reader-screen");
  const form = document.querySelector("#access-form");
  const unitId = document.querySelector("#unit-id");
  const pass = document.querySelector("#unit-pass");
  const message = document.querySelector("#form-message");
  const consoleForm = document.querySelector("#console-form");
  const consoleInput = document.querySelector("#console-input");

  const history = [];
  let historyIndex = 0;

  function renderBootGlyphs() {
    const rows = document.querySelector("#calibration-rows");
    rows.innerHTML = "";
    ["SOLAR WIND", "TIDE"].forEach((text) => rows.appendChild(CelGlyphs.renderText(text, { mode: "all", label: text })));

    const clue = document.querySelector("#passphrase-glyphs");
    clue.innerHTML = "";
    clue.appendChild(CelGlyphs.renderText("DILATION", { mode: "blank", label: "Owner passphrase in Thetan script" }));
  }

  function showConsole() {
    bootScreen.hidden = true;
    readerScreen.hidden = true;
    consoleScreen.hidden = false;
    CelConsole.resetOutput();
    CelCommands.setCwd("");
    CelCommands.updateHeader();
    CelCommands.run("ls", { echo: false });
    consoleInput.focus();
  }

  function setInvalid(input, invalid) {
    input.setAttribute("aria-invalid", invalid ? "true" : "false");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const idValue = unitId.value.trim();
    const passValue = pass.value.trim();

    setInvalid(unitId, !idValue);
    setInvalid(pass, !passValue);
    if (!idValue || !passValue) {
      message.textContent = "Unit ID and passphrase required.";
      return;
    }

    const idOk = idValue.toUpperCase().replace(/[\s-]/g, "") === CelConfig.UNIT_ID.replace(/-/g, "");
    const passOk = CelSecrets.matches("passphrase", passValue);
    setInvalid(unitId, !idOk);
    setInvalid(pass, !passOk);

    if (!idOk) {
      message.textContent = "Unit does not answer to that ID.";
      return;
    }
    if (!passOk) {
      message.textContent = "Passphrase rejected. The screen flickers and holds.";
      return;
    }

    message.textContent = "";
    CelState.setAccess(true);
    showConsole();
    CelReward.show({ kicker: "Unit Awake", title: "Nyctograph Online" });
    CelCaretaker.reset();
    document.querySelector("#caretaker-state").textContent = "LISTENING";
    CelCaretaker.receive("...carrier found. You can hear me now. Good.");
    CelCaretaker.receive("The unit remembers more than its owner did. Start with his recordings.");
  });

  consoleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = consoleInput.value;
    consoleInput.value = "";
    if (value.trim()) {
      history.push(value);
      historyIndex = history.length;
    }
    CelCommands.run(value);
  });

  consoleInput.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (!history.length) return;
    event.preventDefault();
    historyIndex = event.key === "ArrowUp"
      ? Math.max(0, historyIndex - 1)
      : Math.min(history.length, historyIndex + 1);
    consoleInput.value = history[historyIndex] || "";
  });

  document.querySelector("#reader-back").addEventListener("click", CelConsole.closeReader);

  document.querySelectorAll(".reset-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (!window.confirm("Reset the unit? All translations and progress on this device are lost.")) return;
      CelState.reset();
      window.location.reload();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (CelPlanetMap.isOpen()) CelPlanetMap.close();
    else if (CelConsole.isReaderOpen()) CelConsole.closeReader();
  });

  // Mouse back button closes overlays instead of leaving the page.
  window.addEventListener("mouseup", (event) => {
    if (event.button !== 3) return;
    if (CelPlanetMap.isOpen()) {
      event.preventDefault();
      CelPlanetMap.close();
    } else if (CelConsole.isReaderOpen()) {
      event.preventDefault();
      CelConsole.closeReader();
    }
  });

  document.addEventListener("cel:state", () => {
    if (CelState.hasAccess()) CelCommands.updateHeader();
  });

  const shell = document.querySelector(".shell");

  // Buffer recovery runs in front of the login: first visit, after a reset, or with ?captures in the URL.
  function playCaptures() {
    shell.hidden = true;
    CelCaptures.start(() => {
      shell.hidden = false;
      if (CelState.hasAccess()) showConsole();
      else unitId.focus();
    });
  }

  document.querySelector("#capture-replay").addEventListener("click", playCaptures);

  renderBootGlyphs();
  CelCaretaker.boot();
  const forceCaptures = new URLSearchParams(window.location.search).has("captures");
  if (forceCaptures || (!CelState.hasAccess() && !CelState.hasSeenCaptures())) playCaptures();
  else if (CelState.hasAccess()) showConsole();
  else unitId.focus();
})();
