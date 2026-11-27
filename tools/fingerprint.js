// Prints the fingerprint for an answer so it can be pasted into core/secrets.js.
// usage: node tools/fingerprint.js <secretId> "<answer>"
const path = require("path");
const CelSecrets = require(path.join(__dirname, "..", "core", "secrets.js"));

const [id, ...words] = process.argv.slice(2);
const secret = CelSecrets._secrets[id];

if (!secret || !words.length) {
  console.log("usage: node tools/fingerprint.js <secretId> \"<answer>\"");
  console.log(`secret ids: ${Object.keys(CelSecrets._secrets).join(", ")}`);
  process.exit(1);
}

const answer = words.join(" ");
console.log(`${id}: "${CelSecrets.normalize(answer)}" -> ${CelSecrets.fingerprint(answer, secret.salt)}`);
