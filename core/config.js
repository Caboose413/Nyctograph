const CelConfig = {
  // Printed on the unit casing on the boot screen. Compared without spaces/dashes.
  UNIT_ID: "NX-2142",
  STATE_KEY: "celestial_nyctograph_state_v1",
  // Planet label on the survey map. The GDD does not name the world yet.
  PLANET_NAME: "Uncatalogued World",
  // Optional local LLM bridge for The Caretaker. Empty = static in-world replies only.
  // Contract: POST { message, contexts, history } -> { reply }.
  CARETAKER_ENDPOINT: "",
  VERSION: "0.1"
};
