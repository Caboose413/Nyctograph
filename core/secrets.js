// Answers are stored as salted fingerprints, never as plain text.
// Input is normalised to lowercase letters/digits only, so spacing and punctuation never matter.
const CelSecrets = (() => {
  const secrets = {
    passphrase: { salt: [19, 142, 7, 88, 203, 61], fingerprints: [1192472015] },
    wall01: { salt: [91, 4, 177, 36, 250, 12, 68], fingerprints: [820319006] },
    tablet06: { salt: [222, 45, 9, 130, 77, 164], fingerprints: [2145613950] },
    // Area 2 field glyph: carved in the game world, not set yet. Add fingerprints when it exists.
    fieldMachine: { salt: [33, 199, 81, 2, 140, 57], fingerprints: [] }
  };

  function normalize(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function fingerprint(value, salt) {
    const normalized = normalize(value);
    let hash = 2166136261;

    salt.forEach((byte) => {
      hash ^= byte & 255;
      hash = Math.imul(hash, 16777619);
    });

    for (let index = 0; index < normalized.length; index += 1) {
      hash ^= normalized.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    hash ^= normalized.length;
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;

    return hash >>> 0;
  }

  function matches(id, value) {
    const secret = secrets[id];
    if (!secret || !normalize(value)) return false;
    return secret.fingerprints.includes(fingerprint(value, secret.salt));
  }

  return { matches, fingerprint, normalize, _secrets: secrets };
})();

if (typeof module !== "undefined") module.exports = CelSecrets;
