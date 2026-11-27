const CelCommands = (() => {
  const prompt = document.querySelector("#console-prompt");
  let cwd = "";

  function setCwd(folder) {
    cwd = folder;
    prompt.textContent = `nx-2142:~${cwd ? `/${cwd}` : ""}$`;
  }

  // ---------- listing ----------

  function rootEntries() {
    const folders = CelContent.getFolders().map((folder) => ({ ...folder, name: `${folder.id}/` }));
    const tools = CelContent.getTools().map((tool) => ({ ...tool, name: tool.id }));
    return folders.concat(tools);
  }

  function fileEntry(file) {
    const solved = file.type !== "inscription" || CelState.isSolved(file.puzzle.secret);
    return {
      id: file.id,
      name: file.id,
      permissions: file.type === "inscription" ? (solved ? "-rw-r--r--" : "-r--------") : "-rw-r-----",
      description: file.type === "inscription"
        ? `${file.title.toLowerCase()} // ${solved ? "translated" : "untranslated"}`
        : `${file.meta.split(" // ")[0].toLowerCase()} // ${file.title.toLowerCase()}`
    };
  }

  function listRoot() {
    CelConsole.appendLine("owner archive:", "dim");
    CelConsole.appendEntryList(rootEntries(), (id) => run(`cd ${id}`, { echo: true }));
  }

  function listFolder(folderId) {
    const files = CelContent.getFiles(folderId);
    CelConsole.appendLine(`~/${folderId}:`, "dim");
    CelConsole.appendEntryList(files.map(fileEntry), (id) => run(`cat ${id}`, { echo: true }));
  }

  // ---------- readers ----------

  function paragraph(text, className = "") {
    const p = document.createElement("p");
    if (className) p.className = className;
    p.textContent = text;
    return p;
  }

  function renderTextFile(file, root) {
    root.appendChild(paragraph(file.meta, "doc-meta"));
    const body = document.createElement("div");
    body.className = "doc-lines";
    file.lines.forEach((line) => body.appendChild(paragraph(line)));
    root.appendChild(body);
    (file.footer || []).forEach((line) => root.appendChild(paragraph(line, "doc-footer")));
  }

  function renderInscription(file, root) {
    const solved = CelState.isSolved(file.puzzle.secret);
    root.appendChild(paragraph(file.meta, "doc-meta"));

    const block = document.createElement("section");
    block.className = `inscription-block${solved ? " is-solved" : ""}`;
    block.appendChild(CelGlyphs.renderText(file.puzzle.text, {
      mode: solved ? "all" : "known",
      interactive: !solved,
      label: solved ? file.puzzle.text : "Untranslated Thetan inscription"
    }));
    root.appendChild(block);

    if (!solved) {
      file.before.forEach((line) => root.appendChild(paragraph(line, "inscription-note")));

      const form = document.createElement("form");
      form.className = "translate-form";
      form.autocomplete = "off";
      const label = document.createElement("label");
      label.textContent = "Reading";
      label.htmlFor = `translate-${file.id}`;
      const field = document.createElement("input");
      field.id = `translate-${file.id}`;
      field.spellcheck = false;
      field.placeholder = "type the full inscription in plain letters";
      const button = document.createElement("button");
      button.type = "submit";
      button.className = "primary-button";
      button.textContent = "Translate";
      const message = document.createElement("p");
      message.className = "form-message";
      message.setAttribute("role", "status");
      form.append(label, field, button, message);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!attemptTranslation(file, field.value, { fromReader: true })) {
          message.textContent = "The signs do not agree with that reading.";
          field.select();
        }
      });
      root.appendChild(form);
      root.appendChild(paragraph(`console: translate ${file.id} <reading>`, "doc-footer"));
    } else {
      const after = document.createElement("div");
      after.className = "doc-lines";
      file.after.forEach((line, index) => after.appendChild(paragraph(line, index === 0 ? "solved-banner" : "")));
      root.appendChild(after);
    }
  }

  function renderFeed(file, root) {
    root.appendChild(paragraph(file.meta, "doc-meta"));

    const frame = document.createElement("figure");
    frame.className = "feed-frame";
    const video = document.createElement("video");
    video.src = file.video.src;
    video.poster = file.video.poster;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("aria-label", file.video.label);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) video.autoplay = true;

    const overlay = document.createElement("figcaption");
    overlay.className = "feed-overlay";
    const left = document.createElement("span");
    left.className = "feed-rec";
    left.textContent = file.video.overlayLeft;
    const right = document.createElement("span");
    right.textContent = file.video.overlayRight;
    overlay.append(left, right);

    frame.append(video, overlay);
    root.appendChild(frame);

    const body = document.createElement("div");
    body.className = "doc-lines";
    file.lines.forEach((line) => body.appendChild(paragraph(line)));
    root.appendChild(body);
    (file.footer || []).forEach((line) => root.appendChild(paragraph(line, "doc-footer")));
  }

  function openFile(file) {
    const folder = file.folder.toUpperCase();
    CelConsole.openReader(`~/${file.folder} // ${file.id}`, file.title, (root) => {
      if (file.type === "inscription") renderInscription(file, root);
      else if (file.type === "feed") renderFeed(file, root);
      else renderTextFile(file, root);
    });
    CelConsole.appendLine(`opened ${folder.toLowerCase()}/${file.id}`, "dim");
  }

  function openLexicon() {
    CelConsole.openReader("~/lexicon", "Owner Script Lexicon", (root) => {
      root.appendChild(paragraph(`SIGNS DECIPHERED: ${CelState.knownCount()}/26`, "doc-meta"));
      root.appendChild(CelGlyphs.renderLexicon());
      root.appendChild(paragraph("Unknown signs take your guesses. A guess is a pencil mark: it shows on every capture, but only a verified translation writes it in ink.", "inscription-note"));
    });
  }

  // ---------- puzzles ----------

  function attemptTranslation(file, reading, { fromReader = false } = {}) {
    const puzzle = file.puzzle;

    if (CelState.isSolved(puzzle.secret)) {
      CelConsole.appendLine(`${file.id} is already translated`, "dim");
      return true;
    }

    if (!CelSecrets.matches(puzzle.secret, reading)) {
      if (!fromReader) {
        CelConsole.appendBlock([
          "TRANSLATION REJECTED",
          "the signs do not agree with that reading",
          `open ${file.id} and pencil guesses under the unknown signs`
        ], "err");
      }
      return false;
    }

    CelState.markSolved(puzzle.secret);
    CelState.learn(puzzle.learns);
    CelState.addContext(puzzle.unlocks);
    updateHeader();
    onSolved(file);
    CelConsole.refreshReader();
    return true;
  }

  function onSolved(file) {
    if (file.puzzle.unlocks === "ritual") {
      CelReward.show({ kicker: "Location Recovered", title: "The Ritual" });
      CelConsole.appendBlock([
        "",
        "TRANSLATION ACCEPTED // wall-01",
        "\"SOULS GIVEN AT THE RITUAL\"",
        "",
        "lexicon +4 signs",
        "survey map updated: The Ritual",
        "NEW ARCHIVE LAYER: cd ritual"
      ], "warn");
      CelCaretaker.receive("You read it. He spent twenty days on four signs. You will need fewer for what comes next.");
    } else if (file.puzzle.unlocks === "machine") {
      CelReward.show({ kicker: "Bearing Recovered", title: "The Machine" });
      CelConsole.appendBlock([
        "",
        "TRANSLATION ACCEPTED // tablet-06",
        "\"THEY BUILT THEIR OWN BODIES AND CAME FOR US\"",
        "",
        "lexicon +5 signs",
        "survey map updated: The Machine (bearing only)",
        "NEW ARCHIVE LAYER: cd machine"
      ], "warn");
      CelCaretaker.receive("Now you know what walks out there. Go to the surface. Find what is carved about The Machine. I will wait.");
    }
  }

  function findInscription(id) {
    const file = CelContent.getFile(id);
    return file && file.type === "inscription" ? file : null;
  }

  function handleTranslate(args) {
    const [id, ...rest] = args;
    if (!id) {
      CelConsole.appendBlock(["usage:", "  translate <capture> <reading>", "example: translate wall-01 your reading here"], "err");
      return;
    }
    const file = findInscription(id.toLowerCase());
    if (!file) {
      CelConsole.appendLine(`no untranslated capture named ${id}`, "err");
      return;
    }
    if (!rest.length) {
      CelConsole.appendLine(`usage: translate ${file.id} <reading>`, "err");
      return;
    }
    attemptTranslation(file, rest.join(" "));
  }

  function handleField(args) {
    if (!CelState.hasContext("machine")) {
      CelConsole.appendLine("field: no field record is expected yet", "err");
      return;
    }
    if (!args.length) {
      CelConsole.appendBlock(["usage:", "  field <reading of a carved wall>"], "err");
      return;
    }
    if (CelSecrets.matches("fieldMachine", args.join(" "))) {
      CelReward.show({ kicker: "Field Glyph Verified", title: "The Machine" });
      CelConsole.appendLine("FIELD GLYPH VERIFIED // the next layer is not written yet", "warn");
      return;
    }
    CelConsole.appendBlock([
      "FIELD GLYPH NOT RECOGNISED",
      "no carving with that reading is registered on this unit",
      "the record waits on the surface"
    ], "err");
  }

  // ---------- misc ----------

  function layerLabel() {
    if (CelState.hasContext("machine")) return "THE MACHINE";
    if (CelState.hasContext("ritual")) return "THE RITUAL";
    return "OWNER CAMP";
  }

  function updateHeader() {
    document.querySelector("#lexicon-count").textContent = `LEXICON: ${CelState.knownCount()}/26`;
    document.querySelector("#chapter-label").textContent = `LAYER: ${layerLabel()}`;
  }

  function printHelp() {
    const lines = [
      "commands:",
      "  ls                     list this folder",
      "  cd <folder>            open a folder (cd .. to go back)",
      "  cat <file>             read a record or capture",
      "  translate <id> <text>  submit a reading of a capture",
      "  lexicon                deciphered signs",
      "  map                    surface survey",
      "  say <message>          speak on the carrier",
      "  status                 unit status",
      "  clear                  clear the screen"
    ];
    if (CelState.hasContext("machine")) lines.splice(5, 0, "  field <reading>        enter the reading of a carved wall");
    CelConsole.appendBlock(lines);
  }

  function printStatus() {
    CelConsole.appendBlock([
      "UNIT NX-2142 // NYCTOGRAPH",
      "owner:    ▒▒▒▒▒▒ (vitals lost, day 047)",
      "visitor:  new suit signature, day 000",
      `lexicon:  ${CelState.knownCount()}/26 signs`,
      `layer:    ${layerLabel().toLowerCase()}`,
      `carrier:  ${CelState.hasContext("ritual") ? "strengthening" : "unresolved"}`
    ]);
  }

  function changeDirectory(target) {
    const name = target.replace(/^~\/?/, "").replace(/\/$/, "").toLowerCase();

    if (!name || name === ".." || name === "~" || name === "/") {
      setCwd("");
      listRoot();
      return;
    }
    if (name === "lexicon") return openLexicon();
    if (name === "map") return CelPlanetMap.open();
    if (name === "signal") {
      CelConsole.appendLine("carrier channel open on the left. say <message> works here too.", "dim");
      CelCaretaker.focus();
      return;
    }

    const folder = CelContent.getFolder(name);
    if (folder) {
      setCwd(folder.id);
      listFolder(folder.id);
      return;
    }

    const file = CelContent.getFile(name);
    if (file) return openFile(file);

    CelConsole.appendLine(`cd: no such entry: ${target}`, "err");
  }

  function readFile(target) {
    const file = CelContent.getFile(target.toLowerCase());
    if (!file) {
      CelConsole.appendLine(`cat: no such record: ${target}`, "err");
      return;
    }
    openFile(file);
  }

  function run(raw, { echo = true } = {}) {
    const command = raw.trim();
    if (!command) return;
    if (echo) CelConsole.appendLine(`${prompt.textContent} ${command}`, "echo");

    const [verb, ...args] = command.split(/\s+/);
    const lower = verb.toLowerCase();

    switch (lower) {
      case "help":
      case "?":
        return printHelp();
      case "ls":
      case "dir":
        if (args[0]) return changeDirectory(args[0]);
        return cwd ? listFolder(cwd) : listRoot();
      case "cd":
      case "open":
        if (!args[0]) return changeDirectory("");
        return changeDirectory(args[0]);
      case "cat":
      case "read":
      case "play":
        if (!args[0]) return CelConsole.appendLine(`usage: ${lower} <record>`, "err");
        return readFile(args[0]);
      case "translate":
      case "decode":
        return handleTranslate(args);
      case "lexicon":
      case "glyphs":
        return openLexicon();
      case "map":
      case "survey":
        return CelPlanetMap.open();
      case "say":
      case "signal":
      case "caretaker":
        if (!args.length) return changeDirectory("signal");
        CelConsole.appendLine("sent on the carrier", "dim");
        return CelCaretaker.send(args.join(" "));
      case "field":
        return handleField(args);
      case "status":
        return printStatus();
      case "whoami":
        return CelConsole.appendLine("not the owner. the unit let you in anyway.");
      case "clear":
      case "cls":
        return CelConsole.resetOutput();
      default:
        // Bare file or folder names work as a shortcut.
        if (CelContent.getFolder(lower) || CelContent.getFile(lower) || ["lexicon", "map"].includes(lower)) {
          return changeDirectory(lower);
        }
        CelConsole.appendLine(`unknown command: ${verb}. type help`, "err");
    }
  }

  return { run, setCwd, updateHeader };
})();
