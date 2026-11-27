// Sound for the buffer-recovery intro. Game sounds (media/audio, built by tools/build-audio.py)
// for ambience and story beats; glitch bursts, data chirps and decode ticks are synthesised here.
// Browsers only allow sound after a click, so unlock() is called from the intro's "Begin" button.
const CelAudio = (() => {
  const PREF_KEY = "celestial_nyctograph_sound";
  const FILES = ["hum", "engine", "field", "rumble", "wind", "beep-long", "beep-ok", "beep-soft", "alert", "charge", "boom", "o2", "heartbeat"];
  const MASTER = 0.10; // overall volume
  const LOOP_TRIM = 0.06; // skip MP3 encoder padding at both ends of a loop

  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  const buffers = {};
  const loops = {};
  let enabled = localStorage.getItem(PREF_KEY) !== "off";
  let loading = null;

  function unlock() {
    if (!ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return Promise.resolve();
      ctx = new Context();
      master = ctx.createGain();
      master.gain.value = enabled ? MASTER : 0;
      master.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      loading = Promise.all(FILES.map(load));
    }
    if (ctx.state === "suspended") ctx.resume();
    return loading;
  }

  // Opened from disk (file://) the browser blocks fetch, so fall back to the embedded copy.
  let embedded = null;
  function loadEmbedded() {
    if (!embedded) {
      embedded = new Promise((resolve) => {
        if (window.CelAudioData) return resolve(window.CelAudioData);
        const script = document.createElement("script");
        script.src = "media/audio/audio-data.js";
        script.onload = () => resolve(window.CelAudioData || {});
        script.onerror = () => resolve({});
        document.head.appendChild(script);
      });
    }
    return embedded;
  }

  async function bytesFor(name) {
    if (window.location.protocol !== "file:") {
      try {
        const response = await fetch(`media/audio/${name}.mp3`);
        if (response.ok) return await response.arrayBuffer();
      } catch (error) {
        // fall through to the embedded copy
      }
    }
    const data = (await loadEmbedded())[name];
    if (!data) return null;
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  async function load(name) {
    try {
      const bytes = await bytesFor(name);
      buffers[name] = bytes ? await ctx.decodeAudioData(bytes) : null;
    } catch (error) {
      buffers[name] = null; // the intro still runs, silently
    }
  }

  const ready = () => Boolean(ctx && enabled);

  function play(name, { volume = 1, rate = 1, delay = 0 } = {}) {
    if (!ready() || !buffers[name]) return null;
    const source = ctx.createBufferSource();
    source.buffer = buffers[name];
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(master);
    source.start(ctx.currentTime + delay);
    return source;
  }

  // Looping bed with fade in. Calling again for a playing loop just retargets its volume.
  function loop(name, { volume = 1, fade = 1.2, rate = 1 } = {}) {
    if (!ctx || !buffers[name]) return;
    const now = ctx.currentTime;
    let entry = loops[name];
    if (!entry) {
      const source = ctx.createBufferSource();
      source.buffer = buffers[name];
      source.loop = true;
      source.loopStart = LOOP_TRIM;
      source.loopEnd = buffers[name].duration - LOOP_TRIM;
      source.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(master);
      source.start(now, LOOP_TRIM);
      entry = loops[name] = { source, gain };
    }
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
    entry.gain.gain.linearRampToValueAtTime(volume, now + fade);
  }

  function bend(name, rate, seconds = 1) {
    const entry = loops[name];
    if (!entry) return;
    const now = ctx.currentTime;
    entry.source.playbackRate.cancelScheduledValues(now);
    entry.source.playbackRate.setValueAtTime(entry.source.playbackRate.value, now);
    entry.source.playbackRate.linearRampToValueAtTime(rate, now + seconds);
  }

  function stop(name, fade = 0.8) {
    const entry = loops[name];
    if (!entry) return;
    delete loops[name];
    const now = ctx.currentTime;
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
    entry.gain.gain.linearRampToValueAtTime(0, now + fade);
    entry.source.stop(now + fade + 0.05);
  }

  function stopAll(fade = 0.8) {
    Object.keys(loops).forEach((name) => stop(name, fade));
  }

  // Filtered noise burst: digital tearing. strength 0..2
  function glitch(strength = 1) {
    if (!ready()) return;
    const now = ctx.currentTime;
    const length = 0.04 + Math.random() * 0.12 * strength;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 400 + Math.random() * 4000;
    filter.Q.value = 2 + Math.random() * 8;
    const crush = ctx.createWaveShaper();
    crush.curve = stepCurve(4 + Math.floor(Math.random() * 6));
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14 * strength, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    source.connect(filter).connect(crush).connect(gain).connect(master);
    source.start(now, Math.random() * 0.8, length + 0.02);
    // a square blip under the noise, like a bad packet
    blip(80 + Math.random() * 900, length * 0.6, 0.03 * strength, "square");
  }

  function stepCurve(steps) {
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i += 1) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.round(x * steps) / steps;
    }
    return curve;
  }

  function blip(freq, length, volume, type = "sine") {
    if (!ready()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + length + 0.02);
  }

  // Data arriving: quiet high chirps. Damaged data chirps lower and rougher.
  function chirp(damaged = false) {
    if (damaged) blip(300 + Math.random() * 500, 0.03, 0.025, "sawtooth");
    else blip(1800 + Math.random() * 1600, 0.018, 0.018);
  }

  // One letter settling during the message decode.
  function tick() {
    blip(900 + Math.random() * 300, 0.012, 0.012, "triangle");
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    localStorage.setItem(PREF_KEY, enabled ? "on" : "off");
    if (master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(enabled ? MASTER : 0, now + 0.25);
    }
  }

  return {
    unlock, play, loop, bend, stop, stopAll, glitch, chirp, tick,
    isEnabled: () => enabled,
    // for debugging: which sounds decoded, which loops are running
    status: () => ({
      state: ctx ? ctx.state : "locked",
      loaded: Object.keys(buffers).filter((name) => buffers[name]),
      loops: Object.keys(loops)
    }),
    setEnabled
  };
})();
