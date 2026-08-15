import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { ALBUMS_FOLDER, ROOT_FOLDER_ID, ROOT_TITLE, SOUNDCLOUD_FOLDER, directReleaseFolders, soundcloudMemberFolders, summarizeRaw } from "../scripts/archive-tools.mjs";

const raw = JSON.parse(await fs.readFile(new URL("../app/data/archive.generated.json", import.meta.url), "utf8"));

test("snapshot contains a complete internally consistent music tree", () => {
  assert.equal(raw.sourceFolderId, ROOT_FOLDER_ID);
  const summary = summarizeRaw(raw);
  assert.equal(summary.nodes, summary.folders + summary.files);
  assert.equal(new Set(raw.nodes.map((node) => node.id)).size, summary.nodes);
  assert.ok(summary.releases >= 48);
  assert.ok(summary.audio >= 512);
  assert.ok(raw.nodes.every((node) => Array.isArray(node.path) && node.path[0] === ROOT_TITLE));
});

test("album and SoundCloud sources remain data-driven", () => {
  assert.ok(raw.nodes.some((node) => node.name === ALBUMS_FOLDER));
  assert.ok(raw.nodes.some((node) => node.name === SOUNDCLOUD_FOLDER));
  assert.ok(directReleaseFolders(raw).some((folder) => folder.name === "UNEXPECTED"));
  assert.ok(soundcloudMemberFolders(raw).some((folder) => folder.name.toUpperCase() === "SANGYEON"));
});

test("audio variants include originals, vocals and instrumentals", () => {
  const paths = raw.nodes.filter((node) => node.mimeType.startsWith("audio/")).map((node) => node.path.join("/").toUpperCase());
  assert.ok(paths.some((path) => path.includes("VOCAL")));
  assert.ok(paths.some((path) => path.includes("INSTRUMENTAL")));
  assert.ok(raw.nodes.some((node) => node.mimeType === "audio/flac"));
  assert.ok(raw.nodes.some((node) => node.mimeType === "audio/mpeg"));
});
