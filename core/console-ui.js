const CelConsole = (() => {
  const output = document.querySelector("#console-output");
  const consoleScreen = document.querySelector("#console-screen");
  const readerScreen = document.querySelector("#reader-screen");
  const readerKicker = document.querySelector("#reader-kicker");
  const readerTitle = document.querySelector("#reader-title");
  const readerContent = document.querySelector("#reader-content");
  const input = document.querySelector("#console-input");
  let readerRefresh = null;

  function scroll() {
    output.scrollTop = output.scrollHeight;
  }

  function appendLine(text, className = "sys") {
    const line = document.createElement("div");
    line.className = `line ${className}`;
    line.textContent = text;
    output.appendChild(line);
    scroll();
  }

  function appendBlock(lines, className = "sys") {
    lines.forEach((line) => appendLine(line, className));
  }

  function appendNode(node) {
    output.appendChild(node);
    scroll();
  }

  function appendEntryList(entries, onOpen) {
    const list = document.createElement("div");
    list.className = "entry-list";

    entries.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "entry-item";
      button.addEventListener("click", () => onOpen(entry.id));

      const perms = document.createElement("span");
      perms.className = "entry-perm";
      perms.textContent = entry.permissions;

      const name = document.createElement("span");
      name.className = "entry-name";
      name.textContent = entry.name;

      const description = document.createElement("span");
      description.className = "entry-desc";
      description.textContent = `[${entry.description}]`;

      button.append(perms, name, description);
      list.appendChild(button);
    });

    appendNode(list);
  }

  function resetOutput() {
    output.innerHTML = "";
    appendBlock([
      "[ NYCTOGRAPH :: OWNER ARCHIVE ]",
      "[ OWNER VITALS: LOST // ACCESS: PASSPHRASE ]",
      "[ TYPE HELP FOR COMMANDS ]",
      ""
    ]);
  }

  // render() builds the reader body; it is called again whenever progress changes.
  function openReader(kicker, title, render) {
    readerKicker.textContent = kicker;
    readerTitle.textContent = title;
    readerRefresh = render;
    readerContent.innerHTML = "";
    render(readerContent);
    consoleScreen.hidden = true;
    readerScreen.hidden = false;
    readerContent.scrollTop = 0;
    const focusTarget = readerContent.querySelector("input:not(.glyph-note)") || document.querySelector("#reader-back");
    focusTarget.focus();
  }

  function refreshReader() {
    if (readerScreen.hidden || !readerRefresh) return;
    const scrollTop = readerContent.scrollTop;
    readerContent.innerHTML = "";
    readerRefresh(readerContent);
    readerContent.scrollTop = scrollTop;
  }

  function closeReader() {
    if (readerScreen.hidden) return;
    readerScreen.hidden = true;
    readerRefresh = null;
    consoleScreen.hidden = false;
    input.focus();
  }

  return {
    appendBlock,
    appendEntryList,
    appendLine,
    appendNode,
    closeReader,
    isReaderOpen: () => !readerScreen.hidden,
    openReader,
    refreshReader,
    resetOutput
  };
})();
