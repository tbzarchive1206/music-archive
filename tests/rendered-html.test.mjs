import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("builds a self-contained Music archive for GitHub Pages", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const assets = await readdir(new URL("../dist/assets/", import.meta.url));
  const scriptName = assets.find((name) => name.endsWith(".js"));
  assert.ok(scriptName, "compiled JavaScript asset is missing");
  const script = await readFile(new URL(`../dist/assets/${scriptName}`, import.meta.url), "utf8");
  assert.match(html, /MUSIC — THE BOYZ ARCHIVE/);
  assert.match(html, /\.\/assets\//);
  assert.match(script, /ALBUMS &/);
  assert.match(script, /THE BOYZ SOUNDCLOUD/);
  assert.match(script, /INSTRUMENTAL/);
  assert.match(script, /NOW PLAYING/);
  assert.match(script, /\/preview/);
  assert.doesNotMatch(script, /PLAYBACK ERROR/);
  assert.match(script, /Generated cover/);
});
