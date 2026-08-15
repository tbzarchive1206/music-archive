import fs from "node:fs/promises";
import { ROOT_FOLDER_ID, ROOT_TITLE, summarizeRaw } from "./archive-tools.mjs";

const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim();
if (!apiKey) throw new Error("Missing GOOGLE_DRIVE_API_KEY.");
const sheetApiKey = process.env.GOOGLE_SHEETS_API_KEY?.trim() || apiKey;
const metadataSheetId = process.env.MUSIC_METADATA_SHEET_ID?.trim() || "1W8FX5WECtlOu-zmlkQ9kPVuSnTo9EKzZyVGbvAHlveI";
const output = new URL("../app/data/archive.generated.json", import.meta.url);

async function listFolder(folderId) {
  const files = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime)",
      pageSize: "1000",
      orderBy: "name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { "X-Goog-Api-Key": apiKey, "User-Agent": "THE-BOYZ-Music-Archive" },
    });
    if (!response.ok) throw new Error(`Drive API ${response.status}: ${await response.text()}`);
    const data = await response.json();
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return files;
}

function keyOf(value = "") {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

async function readMetadata() {
  if (!metadataSheetId || metadataSheetId.startsWith("__")) return {};
  const range = encodeURIComponent("Releases!A1:M1000");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${metadataSheetId}/values/${range}?majorDimension=ROWS&key=${encodeURIComponent(sheetApiKey)}`;
  try {
    const response = await fetch(url, { headers: { "User-Agent": "THE-BOYZ-Music-Archive" } });
    if (!response.ok) throw new Error(`Sheets API ${response.status}: ${await response.text()}`);
    const rows = (await response.json()).values || [];
    const headers = (rows.shift() || []).map(keyOf);
    return Object.fromEntries(rows.map((values) => {
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
      return [row.folder_id, row];
    }).filter(([folderId]) => folderId));
  } catch (error) {
    console.warn(`Metadata sheet unavailable; keeping Drive-only data. ${error.message}`);
    return {};
  }
}

let frontier = [{ id: ROOT_FOLDER_ID, title: ROOT_TITLE, path: [] }];
const nodes = [];
while (frontier.length) {
  const next = [];
  for (let index = 0; index < frontier.length; index += 8) {
    const batch = frontier.slice(index, index + 8);
    const results = await Promise.all(batch.map(async (folder) => ({ folder, files: await listFolder(folder.id) })));
    for (const { folder, files } of results) for (const file of files) {
      const isFolder = file.mimeType === "application/vnd.google-apps.folder";
      const node = {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        type: isFolder ? "folder" : "file",
        size: file.size || null,
        createdTime: file.createdTime || null,
        modifiedTime: file.modifiedTime || null,
        path: [...folder.path, folder.title],
      };
      nodes.push(node);
      if (isFolder) next.push({ id: file.id, title: file.name, path: node.path });
    }
  }
  frontier = next;
}

const archive = {
  generatedAt: new Date().toISOString(),
  sourceFolderId: ROOT_FOLDER_ID,
  metadataSheetId: metadataSheetId.startsWith("__") ? "" : metadataSheetId,
  metadata: await readMetadata(),
  nodes,
};
await fs.mkdir(new URL("../app/data/", import.meta.url), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(archive)}\n`, "utf8");
console.log(JSON.stringify(summarizeRaw(archive)));
