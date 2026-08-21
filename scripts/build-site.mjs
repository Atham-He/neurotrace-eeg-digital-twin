import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
const client = join(dist, "client");
const server = join(dist, "server");

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });

for (const file of ["index.html", "eeg-demo.css", "eeg-demo.js", "favicon.svg"]) {
  await cp(join(root, file), join(client, file));
}
await cp(join(root, "assets"), join(client, "assets"), { recursive: true });

const worker = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/eeg-demo.html") {
      url.pathname = "/";
      return Response.redirect(url.toString(), 308);
    }
    return env.ASSETS.fetch(request);
  },
};
`;

await writeFile(join(server, "index.js"), worker);
console.log("NeuroTrace deployment bundle built.");
