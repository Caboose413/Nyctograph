// Progress lives in localStorage so a reload keeps the player's place.
const CelState = (() => {
  // Letters the owner's calibration strip already teaches (SOLAR WIND / TIDE).
  const CALIBRATION = "SOLARWINDTIDE";

  function defaults() {
    return {
      access: false,
      capturesSeen: false,
      solved: {},
      learned: [],
      notes: {},
      contexts: ["base"]
    };
  }

  let state = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(CelConfig.STATE_KEY) || "null");
      return raw ? { ...defaults(), ...raw } : defaults();
    } catch (error) {
      return defaults();
    }
  }

  function save() {
    localStorage.setItem(CelConfig.STATE_KEY, JSON.stringify(state));
    document.dispatchEvent(new CustomEvent("cel:state"));
  }

  function knows(letter) {
    const upper = String(letter).toUpperCase();
    return CALIBRATION.includes(upper) || state.learned.includes(upper);
  }

  function knownCount() {
    let count = 0;
    for (let code = 65; code <= 90; code += 1) {
      if (knows(String.fromCharCode(code))) count += 1;
    }
    return count;
  }

  return {
    hasAccess: () => state.access,
    setAccess(value) {
      state.access = Boolean(value);
      save();
    },
    hasSeenCaptures: () => Boolean(state.capturesSeen),
    setCapturesSeen() {
      state.capturesSeen = true;
      save();
    },
    isSolved: (id) => Boolean(state.solved[id]),
    markSolved(id) {
      state.solved[id] = Date.now();
      save();
    },
    learn(letters) {
      String(letters).toUpperCase().split("").forEach((letter) => {
        if (!state.learned.includes(letter)) state.learned.push(letter);
      });
      save();
    },
    knows,
    knownCount,
    getNote: (shape) => state.notes[shape] || "",
    setNote(shape, letter) {
      const value = String(letter || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1);
      if (value) state.notes[shape] = value;
      else delete state.notes[shape];
      save();
    },
    hasContext: (context) => state.contexts.includes(context),
    addContext(context) {
      if (!state.contexts.includes(context)) state.contexts.push(context);
      save();
    },
    getContexts: () => [...state.contexts],
    reset() {
      localStorage.removeItem(CelConfig.STATE_KEY);
      state = defaults();
    }
  };
})();
