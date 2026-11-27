// Thetan script: 26 glyphs built from a small stroke vocabulary.
// Letter -> glyph assignment is shuffled so the glyph order never spells the alphabet.
const CelGlyphs = (() => {
  const SVG_NS = "http://www.w3.org/2000/svg";

  const strokes = {
    a: "M4 4H20",
    b: "M4 16H20",
    c: "M4 28H20",
    d: "M4 4V28",
    e: "M20 4V28",
    f: "M12 4V28",
    g: "M4 4L20 28",
    h: "M20 4L4 28",
    i: "M4 16A8 8 0 0 1 20 16",
    j: "M4 16A8 8 0 0 0 20 16",
    k: "M9 16a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
    l: "M12 0.6h.01",
    m: "M12 4V16",
    n: "M12 16V28",
    o: "M20 4Q4 10 12 16",
    p: "M4 10L12 4L20 10",
    q: "M4 22L12 28L20 22"
  };

  const shapes = [
    "fp", "cdk", "in", "aej", "bg", "mq", "aq", "fk", "pq", "dek", "fij", "ik", "co",
    "cfl", "ack", "no", "di", "jl", "blq", "hk", "bcp", "jm", "eg", "iln", "afq", "bdk"
  ];

  // Index = letter (A..Z), value = glyph shape index.
  const letterToShape = [17, 4, 22, 9, 0, 13, 25, 6, 11, 2, 19, 15, 8, 21, 3, 24, 10, 1, 14, 7, 20, 5, 23, 12, 18, 16];

  function shapeOf(letter) {
    const index = String(letter).toUpperCase().charCodeAt(0) - 65;
    return index >= 0 && index < 26 ? letterToShape[index] : -1;
  }

  function letterOfShape(shape) {
    return String.fromCharCode(65 + letterToShape.indexOf(shape));
  }

  function createSvg(shape) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 -2 24 34");
    svg.setAttribute("class", "glyph-svg");
    svg.setAttribute("aria-hidden", "true");

    shapes[shape].split("").forEach((key) => {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", strokes[key]);
      svg.appendChild(path);
    });

    return svg;
  }

  function syncNotes(shape) {
    const note = CelState.getNote(shape);
    document.querySelectorAll(`.glyph-cell[data-shape="${shape}"] input`).forEach((input) => {
      if (input.value !== note) input.value = note;
    });
  }

  function createNoteInput(shape) {
    const input = document.createElement("input");
    input.className = "glyph-note";
    input.maxLength = 1;
    input.spellcheck = false;
    input.autocomplete = "off";
    input.value = CelState.getNote(shape);
    input.setAttribute("aria-label", "Your guess for this glyph");
    input.addEventListener("input", () => {
      CelState.setNote(shape, input.value);
      input.value = CelState.getNote(shape);
      syncNotes(shape);
    });
    input.addEventListener("focus", () => input.select());
    return input;
  }

  // mode: "all" = show every letter, "known" = show known letters (unknown = ? or a guess box),
  // "blank" = show no letters at all.
  function createCell(letter, { mode, interactive }) {
    const shape = shapeOf(letter);
    const cell = document.createElement("span");
    cell.className = "glyph-cell";
    cell.dataset.shape = String(shape);
    cell.appendChild(createSvg(shape));

    const caption = document.createElement("span");
    caption.className = "glyph-latin";

    if (mode === "all" || (mode === "known" && CelState.knows(letter))) {
      caption.textContent = letter.toUpperCase();
      cell.classList.add("is-known");
    } else if (mode === "known" && interactive) {
      caption.appendChild(createNoteInput(shape));
      cell.classList.add("is-unknown");
    } else if (mode === "known") {
      caption.textContent = CelState.getNote(shape) || "?";
      cell.classList.add("is-unknown");
    } else {
      caption.textContent = "";
      cell.classList.add("is-blank");
    }

    cell.appendChild(caption);
    return cell;
  }

  function renderText(text, { mode = "known", interactive = false, label = "" } = {}) {
    const line = document.createElement("div");
    line.className = "glyph-line";
    line.setAttribute("role", "img");
    line.setAttribute("aria-label", label || "Thetan inscription");

    text.trim().split(/\s+/).forEach((word) => {
      const wordNode = document.createElement("span");
      wordNode.className = "glyph-word";
      word.replace(/[^A-Za-z]/g, "").split("").forEach((letter) => {
        wordNode.appendChild(createCell(letter, { mode, interactive }));
      });
      line.appendChild(wordNode);
    });

    return line;
  }

  function renderLexicon() {
    const grid = document.createElement("div");
    grid.className = "lexicon-grid";

    shapes.forEach((_, shape) => {
      const letter = letterOfShape(shape);
      const cell = document.createElement("div");
      cell.className = "lexicon-cell glyph-cell";
      cell.dataset.shape = String(shape);
      cell.appendChild(createSvg(shape));

      const caption = document.createElement("span");
      caption.className = "glyph-latin";

      if (CelState.knows(letter)) {
        caption.textContent = letter;
        cell.classList.add("is-known");
      } else {
        caption.appendChild(createNoteInput(shape));
        cell.classList.add("is-unknown");
      }

      const index = document.createElement("small");
      index.className = "lexicon-index";
      index.textContent = `T-${String(shape + 1).padStart(2, "0")}`;

      cell.append(caption, index);
      grid.appendChild(cell);
    });

    return grid;
  }

  return {
    createSvg,
    renderLexicon,
    renderText,
    shapeOf
  };
})();
