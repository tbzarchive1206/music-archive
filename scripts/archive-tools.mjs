export const ROOT_FOLDER_ID = "1YUuf9COhHdQeyG7PsO9tYCHQDbmQX3h_";
export const ROOT_TITLE = "MUSIC";
export const ALBUMS_FOLDER = "[ALBUMS AND DIGITAL SINGLES]";
export const SOUNDCLOUD_FOLDER = "[THE BOYZ SOUNDCLOUD]";

export function directReleaseFolders(raw) {
  return raw.nodes.filter((node) => node.type === "folder" && node.path.length === 2 && node.path[1] === ALBUMS_FOLDER);
}

export function soundcloudMemberFolders(raw) {
  return raw.nodes.filter((node) => node.type === "folder" && node.path.length === 2 && node.path[1] === SOUNDCLOUD_FOLDER);
}

export function summarizeRaw(raw) {
  return {
    nodes: raw.nodes.length,
    folders: raw.nodes.filter((node) => node.type === "folder").length,
    files: raw.nodes.filter((node) => node.type === "file").length,
    audio: raw.nodes.filter((node) => node.mimeType.startsWith("audio/")).length,
    releases: directReleaseFolders(raw).length,
    soundcloudMembers: soundcloudMemberFolders(raw).length,
  };
}
