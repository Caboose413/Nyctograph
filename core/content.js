// All story text lives here. Contexts unlock in order: base -> ritual -> machine.
const CelContent = (() => {
  const folders = [
    { id: "recordings", context: "base", permissions: "drwxr-x---", description: "owner voice log transcripts" },
    { id: "inscriptions", context: "base", permissions: "drwxr-x---", description: "wall captures awaiting translation" },
    { id: "surface", context: "base", permissions: "drwxr-x---", description: "unit camera // surface feed" },
    { id: "ritual", context: "ritual", permissions: "drwxr-x---", description: "chamber tablets // the ritual" },
    { id: "machine", context: "machine", permissions: "drwx------", description: "incomplete record // the machine" }
  ];

  const tools = [
    { id: "lexicon", permissions: "-rw-r-----", description: "owner script decipher table" },
    { id: "map", permissions: "-rw-r-----", description: "surface survey // spherical" },
    { id: "signal", permissions: "crw-r-----", description: "unresolved carrier // the caretaker" }
  ];

  const files = [
    {
      id: "rec-001",
      folder: "recordings",
      type: "text",
      title: "First Day",
      meta: "DAY 001 // OWNER VOICE LOG",
      lines: [
        "My name is ▒▒▒▒▒▒. This is my first day on this strange planet.",
        "I don't know how I got here. The last thing I remember is stepping into the prototype device I built.",
        "It was supposed to generate a gravity field strong enough to slow down time around me.",
        "Instead I woke up here, under a sky I have never seen. The air is toxic. The suit is holding. For now."
      ]
    },
    {
      id: "rec-002",
      folder: "recordings",
      type: "text",
      title: "The Unit",
      meta: "DAY 004 // OWNER VOICE LOG",
      lines: [
        "I started reprogramming my computing unit. It should help me decipher these ancient writings faster.",
        "So far I'm having a hard time understanding the letters. Some signs repeat on every wall. Some never repeat at all.",
        "I need to find a way back before my oxygen reserves run out, and my best chance is to learn as much as possible about this place before that happens.",
        "I named the decoder Nyctograph. Writing in the dark. It seemed fitting."
      ]
    },
    {
      id: "rec-003",
      folder: "recordings",
      type: "text",
      title: "Thetans",
      meta: "DAY 011 // OWNER VOICE LOG",
      lines: [
        "The artifact I found talks about their culture. They call themselves Thetans.",
        "Even they believed in a higher being. Their technology is so advanced we might mistake them for gods, and still they could not understand a life form more advanced than themselves.",
        "The Thetans seem to have been at war with some kind of spiritual beings. Are these the same beings they were trying to understand?",
        "I could only translate a few words. They talk about sacrificing themselves: extracting the soul essence from their bodies and giving it to these beings, to please them and create peace."
      ]
    },
    {
      id: "rec-004",
      folder: "recordings",
      type: "text",
      title: "Eons",
      meta: "DAY 023 // OWNER VOICE LOG",
      lines: [
        "It seems the beings were never satisfied with the sacrifices. The Thetans must have disturbed them somehow, to the point where they became a threat.",
        "By the look of this place it all happened eons ago. No wonder everything here seems empty and broken.",
        "There is a wall near the camp. I captured it with the unit. I can read most of the signs now, but four of them mean nothing to me yet.",
        "I'll come back to it tomorrow. I have to figure out more about this place."
      ]
    },
    {
      id: "rec-005",
      folder: "recordings",
      type: "text",
      title: "Last Entry",
      meta: "DAY 047 // OWNER VOICE LOG // FINAL",
      lines: [
        "...it is getting harder to breathe. I don't know how much time has passed.",
        "I'm starting to realize there is no escape for me. All this knowledge and no time.",
        "Why do I even leave these recordings? Nobody will come and save me.",
        "Nobody will ever come here again."
      ],
      footer: [
        "[ RECORDING ENDS // OWNER VITALS LOST ]",
        "[ UNIT NOTE: new suit signature detected on the surface. Counting from day 000. ]"
      ]
    },
    {
      id: "feed-000",
      folder: "surface",
      type: "feed",
      title: "New Signature",
      meta: "SURFACE FEED // DAY 000 // UNIT CAMERA",
      video: {
        src: "media/base-feed.mp4",
        poster: "media/base-feed-poster.jpg",
        label: "Unit camera feed: a fenced camp at dusk, wind turbines and solar panels on red sand, a pale moon above",
        overlayLeft: "FEED NX-2142 // DUSK",
        overlayRight: "SIGNATURE: NEW"
      },
      lines: [
        "The unit kept its camera open after its owner stopped moving.",
        "Day 000: a second suit came down near the impact flare. It did not look for the owner's camp. It started building its own.",
        "Fences. Turbines turning in the dust. Panels facing a sun that never sits still. Lights left on through the dusk.",
        "The owner had one camp and forty-seven days. This one is still breathing."
      ],
      footer: [
        "[ FEED LIVE // SOURCE: UNRESOLVED CARRIER ]"
      ]
    },
    {
      id: "wall-01",
      folder: "inscriptions",
      type: "inscription",
      title: "Camp Wall",
      meta: "WALL CAPTURE // 30 M FROM OWNER CAMP",
      before: [
        "OWNER NOTE: The signs I know are written under the wall. Four I can't place.",
        "Type a guess into any ? and the unit marks that sign everywhere it appears."
      ],
      puzzle: {
        secret: "wall01",
        text: "SOULS GIVEN AT THE RITUAL",
        learns: "UGVH",
        unlocks: "ritual"
      },
      after: [
        "TRANSLATION ACCEPTED // four signs added to the lexicon",
        "The wall marks the way to a chamber the Thetans called The Ritual.",
        "The owner never went inside. The unit holds his capture of its tablets: cd ritual"
      ]
    },
    {
      id: "tablet-01",
      folder: "ritual",
      type: "text",
      title: "The Ritual",
      meta: "CHAMBER TABLET 01 // OWNER TRANSLATION",
      lines: [
        "Here they speak of a place called The Ritual: the place where they separated their souls, so they could offer them to the \"gods\" in the hope of calming them down."
      ]
    },
    {
      id: "tablet-02",
      folder: "ritual",
      type: "text",
      title: "The Machine",
      meta: "CHAMBER TABLET 02 // OWNER TRANSLATION",
      lines: [
        "They mention The Machine. It works on the same basis as The Ritual, and it is used to transport matter from one place to another.",
        "It needs a rare material, found on this planet and hard to refine. They were in conflict over how to spend it."
      ]
    },
    {
      id: "tablet-03",
      folder: "ritual",
      type: "text",
      title: "The Divide",
      meta: "CHAMBER TABLET 03 // OWNER TRANSLATION",
      lines: [
        "The Ritual uses a great amount of the material, material they could otherwise use for devices to fight the gods, or for The Vessel.",
        "They split into groups: those who would fight the gods, and those who would provide enough souls to escape extermination."
      ]
    },
    {
      id: "tablet-04",
      folder: "ritual",
      type: "text",
      title: "On Souls",
      meta: "CHAMBER TABLET 04 // OWNER TRANSLATION",
      lines: [
        "Everything has energy. A living being's energy is bound by its soul and trapped in a vessel we call a body.",
        "Once the body becomes obsolete, the soul finds itself a new container. Until then it is only energy, loosely held together.",
        "In that form it can be absorbed by the \"gods\", who are always hunting for more energy to give them strength.",
        "The gods compete with each other for their right to exist. The Thetans tried to transcend into this pure energy form, and are now hunted by beings more powerful than themselves."
      ]
    },
    {
      id: "tablet-05",
      folder: "ritual",
      type: "text",
      title: "The Vessel",
      meta: "CHAMBER TABLET 05 // OWNER TRANSLATION",
      lines: [
        "Before, The Ritual was used to gather their energy and store it in The Vessel. Once they had collected enough, they meant to break into the place where the gods exist.",
        "They write about heavily protecting The Vessel: several layers of exotic matter, and a barrier of pure energy, so the gods could not claim what it holds.",
        "The gods could not attack the Thetans on a physical level. Only when a Thetan transcended into pure energy could it be absorbed."
      ]
    },
    {
      id: "tablet-06",
      folder: "ritual",
      type: "inscription",
      title: "The Last Tablet",
      meta: "CHAMBER TABLET 06 // UNTRANSLATED",
      before: [
        "OWNER NOTE: The last tablet. Five signs I have never seen.",
        "I'm out of time to guess."
      ],
      puzzle: {
        secret: "tablet06",
        text: "THEY BUILT THEIR OWN BODIES AND CAME FOR US",
        learns: "YBCMF",
        unlocks: "machine"
      },
      after: [
        "UNIT RECONSTRUCTION // tablet 06",
        "The gods found another way to attack. They crafted physical bodies of their own and gave these creatures their own energy, then sent them against the Thetans.",
        "That is what led the Thetans to offer some of their souls to the gods: souls they extracted from The Vessel.",
        "Margin signs give a bearing toward The Machine. Survey map updated: map"
      ]
    },
    {
      id: "fragment-01",
      folder: "machine",
      type: "text",
      title: "The Machine // Incomplete",
      meta: "UNIT RECONSTRUCTION // DISTANCE UNKNOWN",
      lines: [
        "The record of The Machine was never stored in this unit.",
        "The owner logged a bearing from tablet 06 and nothing else. He never walked it.",
        "Records like this are not written. They are carved, and they wait on the surface.",
        "When you have read the carving, enter it here:  field <reading>"
      ]
    }
  ];

  // Survey map points. lat/lon in degrees. approx = drawn with an uncertainty ring.
  const pois = [
    { id: "camp", label: "Owner Camp", lat: 14, lon: -38, context: "base" },
    { id: "impact", label: "New Suit Signature", lat: -4, lon: -18, context: "base", flicker: true },
    { id: "ritual", label: "The Ritual", lat: -24, lon: 32, context: "ritual" },
    { id: "machine", label: "The Machine", lat: 38, lon: 128, context: "machine", approx: true },
    { id: "artifact", label: "The Artifact", context: "locked" },
    { id: "vessel", label: "The Vessel", context: "locked" }
  ];

  // Buffer recovery intro, shown before the unit's login. It plays in this order:
  // two clean captures (all nominal), The Caretaker's message arrives, then everything after it is damaged.
  // Images come from tools/corrupt-captures.py; stop / stopCol / coarseEnd are its output (fractions of the frame).
  const captures = [
    {
      id: "capture-01",
      clean: true,
      image: "media/captures/capture-01.jpg",
      alt: "A small white ship drifts clear of a ringed space station above a blue planet.",
      label: "UNDOCK // PRE-FLIGHT",
      stamp: "T-00:01:40",
      text: "Pilot aboard. Clear of the station. Ring alignment good. All systems nominal."
    },
    {
      id: "capture-02",
      clean: true,
      image: "media/captures/capture-02.jpg",
      alt: "The ship's engines burn white over the planet, a dark ring waiting behind it.",
      label: "DRIVE START // ENGINES NOMINAL",
      stamp: "T+00:00:00",
      text: "Drive start. Engines up. Field ring charging. Hull clock and ring clock agree."
    },
    { id: "carrier", type: "message" },
    {
      id: "capture-03",
      image: "media/captures/capture-03.jpg",
      alt: "Close on the ship's hull as the ring flares orange around it. The frame breaks off halfway down.",
      label: "FIELD SPIKE",
      stamp: "T+00:00:4▒",
      stop: 0.4978, stopCol: 0.49, coarseEnd: 0.6756,
      text: "Field past its limit. Nobody touched the controls. Ring clock running slow. Drift 0.4 s. 4 s. 4▒ s."
    },
    {
      id: "capture-04",
      image: "media/captures/capture-04.jpg",
      alt: "A black hole with a burning orange disc fills the view, the ringed ship small beside it. Most of the frame is lost.",
      label: "TRANSIT // CLOCK DISAGREES",
      stamp: "T+▒▒▒:▒▒:▒▒",
      stop: 0.4267, stopCol: 0.5, coarseEnd: 0.64,
      text: "Ring clock stopped. Hull clock still counting. Gap: ▒▒▒ years."
    },
    {
      id: "capture-05",
      image: "media/captures/capture-05.jpg",
      alt: "A violet alien surface under a giant pale planet, strange trees and stone arches on the horizon. The ground never loaded.",
      label: "SURFACE // NO CATALOGUE MATCH",
      stamp: "DAY 001",
      stop: 0.5689, stopCol: 0.27, coarseEnd: 0.6933,
      text: "Surface contact. Atmosphere toxic. Suit holding. Location: no match in any catalogue."
    }
  ];

  // The Caretaker's own message, sent long ago when it disappeared. It reaches the ship mid-drive,
  // and everything after it goes wrong. The unit's translation is rough.
  const carrierMessage = {
    label: "UNRESOLVED CARRIER // INCOMING",
    age: "SENT ▒▒▒▒▒▒▒ YEARS AGO",
    lines: [
      "While I stand here, in the wake of time flowing away into the river of the abyss, the divine celestial, waiting.",
      "A path that follows, to see the now: an inverse point in space, converging into waves of time.",
      "So deep that only forward was possible, because back was too far."
    ],
    note: "Picked up mid-drive on no known channel. Timestamped long before the unit was built."
  };

  function isVisible(context) {
    return CelState.hasContext(context);
  }

  return {
    getFolders: () => folders.filter((folder) => isVisible(folder.context)),
    getTools: () => tools,
    getFolder: (id) => folders.find((folder) => folder.id === id && isVisible(folder.context)) || null,
    getFiles(folderId) {
      if (!this.getFolder(folderId)) return [];
      return files.filter((file) => file.folder === folderId);
    },
    getFile(id) {
      const file = files.find((entry) => entry.id === id);
      return file && this.getFolder(file.folder) ? file : null;
    },
    getPois: () => pois.map((poi) => ({ ...poi, known: poi.context !== "locked" && isVisible(poi.context) })),
    getCaptures: () => captures,
    getCarrierMessage: () => carrierMessage
  };
})();
