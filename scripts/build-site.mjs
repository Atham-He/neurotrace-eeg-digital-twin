import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
const webFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "brain-renderer.js",
  "device-profiles.js",
  "validation-framework.js",
  "cortex-client.js",
  "generic-device-client.js",
  "THIRD_PARTY_NOTICES.md",
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of webFiles) await cp(join(root, file), join(dist, file));
await cp(join(root, "assets"), join(dist, "assets"), { recursive: true });
console.log("NeuroScope static bundle built in dist/.");
