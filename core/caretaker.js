// The Caretaker: helpful, patient, a little too interested in The Vessel.
// Static replies by keyword + story layer. Optional LLM bridge via CelConfig.CARETAKER_ENDPOINT.
const CelCaretaker = (() => {
  const log = document.querySelector("#caretaker-log");
  const form = document.querySelector("#caretaker-form");
  const input = document.querySelector("#caretaker-input");
  const linkState = document.querySelector("#caretaker-state");

  const history = [];
  const hintLevels = {};
  const replyIndex = {};
  const defaultIndex = {};
  let typingQueue = Promise.resolve();

  function layer() {
    if (CelState.hasContext("machine")) return "machine";
    if (CelState.hasContext("ritual")) return "ritual";
    return "base";
  }

  const hints = {
    base: [
      "He left a wall in inscriptions. He could read most of it. He wrote that down, too.",
      "The signs he knew are written under the wall. Put your guesses under the rest. Read the words they make.",
      "Think about what the Thetans gave away in his recordings. Then think about where they gave it."
    ],
    ritual: [
      "Read the tablets in order. He reached the last one and stopped.",
      "Five new signs. The first word is almost whole already. So is the last.",
      "The gods could not touch them. So the gods made something that could."
    ],
    machine: [
      "What is left of The Machine is not in the unit. It is out there.",
      "When you stand in front of a carved wall, read it. Then use field.",
      "I cannot carve it for you. I can only wait while you walk."
    ]
  };

  const topics = [
    {
      match: /\b(hi|hello|hey|greetings)\b/,
      reply: {
        base: "You found the unit. Good. It remembers more than its owner did.",
        ritual: "You again. You read faster than he did.",
        machine: "Still here. Still listening."
      }
    },
    {
      // The message in the buffer is its own, sent long ago when it disappeared.
      // It deflects first, admits it as the layers open, and owns it at the end. Asked again, it says more.
      id: "message",
      match: /\b(message|transmission|broadcast|carrier|abyss|divine|celestial|river|inverse|waves? of time|only forward|too far|you sent|did you send|who sent|your voice|in the buffer|the buffer)\b/,
      replies: {
        base: [
          "You found that. The unit should not have kept it.",
          "It is an old carrier. Old things echo out here. Do not read too much into an echo.",
          "Someone stood very close to the abyss once, and spoke. Nobody answered. Until now."
        ],
        ritual: [
          "You keep coming back to that message. He did too, at the end. He played it every night.",
          "Waves of time. The Thetans would have understood it. They built their Ritual on the same idea.",
          "Forward was the only way. It still is. For you as well."
        ],
        machine: [
          "I wondered when you would ask properly.",
          "Yes. It was mine. I was not always a voice in a unit.",
          "I went so deep that back was too far. You are going to help me with that. You already are."
        ]
      }
    },
    {
      match: /\b(who|what) (are|r) (you|u)\b|\byour name\b|\bcaretaker\b/,
      reply: {
        base: "A voice that was left running. Call me the Caretaker. I keep what is left.",
        ritual: "I told you. I keep what is left. Some of what is left is very old.",
        machine: "Something that has waited a long time for someone who can read."
      }
    },
    {
      match: /\b(hint|help|stuck|next|what now|what do i do|clue)\b/,
      hint: true
    },
    {
      match: /\bthetans?\b/,
      reply: {
        base: "They were builders. They built a way out, and then argued about the price.",
        ritual: "They split in two. Some fought. Some gave. Both lost.",
        machine: "They are not gone. Energy is never gone. It only waits for a container."
      }
    },
    {
      match: /\b(soul|souls|essence)\b/,
      reply: {
        base: "A soul is only energy that has not decided where to go yet.",
        ritual: "They cut them loose in the Ritual. Loose energy is easy to carry. Easy to keep.",
        machine: "You have one too. It is very bright. You should not worry about that."
      }
    },
    {
      match: /\b(god|gods|beings?|creatures?)\b/,
      reply: {
        base: "They called them gods because they had no better word. Neither do I.",
        ritual: "The gods are hungry, and they are not patient. I am patient.",
        machine: "They built bodies to walk this world. You have seen them by now. Do not let them see you read."
      }
    },
    {
      match: /\bvessel\b/,
      reply: {
        base: "[ carrier clipped ]",
        ritual: "Do not worry about The Vessel. The Vessel is safe. It has always been safe.",
        machine: "The Vessel only needs to be filled. Everything else is detail."
      }
    },
    {
      match: /\britual\b/,
      reply: {
        base: "Read his wall first. The wall knows where it is.",
        ritual: "The chamber is quiet now. Quiet is not the same as empty.",
        machine: "The Ritual still works. Things built that well do not stop."
      }
    },
    {
      match: /\bmachine\b/,
      reply: {
        base: "Not yet.",
        ritual: "The last tablet points at it. He never read the last tablet.",
        machine: "It moved matter from one place to another. It could move you. Home, perhaps."
      }
    },
    {
      match: /\b(home|earth|escape|leave|back)\b/,
      reply: {
        base: "Everything that leaves this world needs energy to do it. You will learn the price.",
        ritual: "He wanted to go home too. He ran out of air first. You have more time than he did.",
        machine: "There is a way home. There is always a way. It is only a question of what you are willing to spend."
      }
    },
    {
      match: /\b(feed|camera|surface|watch(ing|ed)?|turbines?|fences?|base|new camp|signature)\b/,
      reply: {
        base: "The unit watches what moves. You moved. It is only a camera.",
        ritual: "Your lights stay on through the dusk. That is wise. Many things out there prefer the dark.",
        machine: "I like watching you build. You build the way they did. Quickly, and as if it will last."
      }
    },
    {
      match: /\b(owner|him|he|name|died|dead|camp)\b/,
      reply: {
        base: "He did not give me his name. He gave me his breath, a little at a time.",
        ritual: "He talked to me at the end. I listened. That is what I do.",
        machine: "He is in the unit, a little. Everyone leaves a little behind."
      }
    },
    {
      match: /\b(oxygen|air|breathe|breath)\b/,
      reply: {
        base: "The air here was not made for you. It was not made for them either, at the end.",
        ritual: "Keep your tanks full. I need you to keep walking.",
        machine: "Breathe slowly. The walk is long. The planet is round, so it is never too long."
      }
    },
    {
      match: /\b(trust|lying|lie|liar|truth|evil)\b/,
      reply: {
        base: "Trust the unit. The unit cannot lie. It only stores.",
        ritual: "I have told you nothing that is not carved on a wall.",
        machine: "Every word I have given you, you checked yourself. Remember that."
      }
    }
  ];

  const defaults = {
    base: [
      "The signal is clearer when you read.",
      "Open what he left you. Start with his recordings.",
      "He talked to me too, at the end."
    ],
    ritual: [
      "Every tablet you read makes the carrier stronger.",
      "You are doing well. Better than him.",
      "The chamber was built to be read. Keep reading."
    ],
    machine: [
      "Go to the surface. Read what is carved.",
      "Walk. The world has no edge. You cannot get lost, only far.",
      "I will be here when you come back."
    ]
  };

  function staticReply(message) {
    const text = message.toLowerCase();
    const current = layer();

    const topic = topics.find((entry) => entry.match.test(text));

    if (!CelState.hasAccess()) {
      // Even without a decoder, a little of it gets through when you ask about the message.
      if (topic && topic.id === "message") return "▒▒ ·· you heard ·▒ ▒▒▒ me ·· ▒▒ [ no decoder // wake the unit ]";
      return "▒▒ ·· ▒▒▒ ·▒ [ no decoder // wake the unit ]";
    }

    if (topic && topic.hint) {
      const level = hintLevels[current] || 0;
      hintLevels[current] = Math.min(level + 1, hints[current].length - 1);
      return hints[current][level];
    }
    if (topic && topic.replies) {
      const key = `${topic.id}:${current}`;
      const pool = topic.replies[current];
      const at = replyIndex[key] || 0;
      replyIndex[key] = Math.min(at + 1, pool.length - 1);
      return pool[at];
    }
    if (topic) return topic.reply[current];

    const index = defaultIndex[current] || 0;
    defaultIndex[current] = (index + 1) % defaults[current].length;
    return defaults[current][index];
  }

  async function bridgeReply(message) {
    if (!CelConfig.CARETAKER_ENDPOINT || !CelState.hasAccess()) return null;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);

    try {
      const response = await fetch(CelConfig.CARETAKER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, contexts: CelState.getContexts(), history: history.slice(-10) }),
        signal: controller.signal
      });
      if (!response.ok) return null;
      const data = await response.json();
      return typeof data.reply === "string" && data.reply.trim() ? data.reply.trim() : null;
    } catch (error) {
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function addMessage(author, text, remote) {
    const message = document.createElement("div");
    message.className = `msg ${remote ? "msg-remote" : "msg-local"}`;
    const name = document.createElement("span");
    name.textContent = author;
    const body = document.createElement("p");
    message.append(name, body);
    log.appendChild(message);
    log.scrollTop = log.scrollHeight;
    return body;
  }

  function typeInto(node, text) {
    return new Promise((resolve) => {
      let index = 0;
      const step = () => {
        index += 2;
        node.textContent = text.slice(0, index);
        log.scrollTop = log.scrollHeight;
        if (index < text.length) window.setTimeout(step, 22);
        else resolve();
      };
      step();
    });
  }

  // Queue so event messages and replies never type over each other.
  function receive(text) {
    history.push({ role: "caretaker", text });
    typingQueue = typingQueue.then(async () => {
      linkState.textContent = "SPEAKING";
      linkState.classList.add("is-live");
      await typeInto(addMessage("Caretaker", "", true), text);
      linkState.textContent = CelState.hasAccess() ? "LISTENING" : "DORMANT";
      linkState.classList.toggle("is-live", CelState.hasAccess());
    });
    return typingQueue;
  }

  async function send(message) {
    const trimmed = message.trim();
    if (!trimmed) return;
    addMessage("You", trimmed, false).textContent = trimmed;
    history.push({ role: "visitor", text: trimmed });
    const reply = (await bridgeReply(trimmed)) || staticReply(trimmed);
    window.setTimeout(() => receive(reply), 380);
  }

  function reset() {
    log.innerHTML = "";
    history.length = 0;
    Object.keys(hintLevels).forEach((key) => delete hintLevels[key]);
    Object.keys(replyIndex).forEach((key) => delete replyIndex[key]);
    Object.keys(defaultIndex).forEach((key) => delete defaultIndex[key]);
  }

  function boot() {
    reset();
    if (CelState.hasAccess()) {
      linkState.textContent = "LISTENING";
      linkState.classList.add("is-live");
      receive("You came back. The unit kept your place.");
    } else {
      linkState.textContent = "DORMANT";
      addMessage("Carrier", "", true).textContent = "▒▒ ·· ▒▒▒ ·▒ ▒▒ ··";
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value;
    input.value = "";
    send(value);
  });

  return { boot, focus: () => input.focus(), receive, reset, send };
})();
