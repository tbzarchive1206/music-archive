import { useEffect, useMemo, useState } from "react";

type RawNode = {
  id: string;
  name: string;
  mimeType: string;
  type: "file" | "folder";
  size?: string | null;
  createdTime?: string | null;
  modifiedTime?: string | null;
  path: string[];
};

type Metadata = Record<string, string>;
export type RawArchive = {
  generatedAt: string;
  sourceFolderId: string;
  metadataSheetId?: string;
  metadata?: Record<string, Metadata>;
  nodes: RawNode[];
};

type Variant = "original" | "vocals" | "instrumental";
type Track = RawNode & { title: string; variant: Variant; format: string; releaseId: string; releaseTitle: string; coverId?: string; coverUrl?: string };
type Release = { id: string; sourceName: string; title: string; files: RawNode[]; tracks: Track[]; coverId?: string; coverUrl?: string; date: string; type: string; members: string[]; market: string; notes: string; order: number };
type SoundcloudMember = { id: string; name: string; tracks: Track[] };

const ALBUMS = "[ALBUMS AND DIGITAL SINGLES]";
const SOUNDCLOUD = "[THE BOYZ SOUNDCLOUD]";
const normalize = (value = "") => value.normalize("NFKD").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const cleanTrack = (value: string) => value.replace(/\.(flac|mp3|m4a|wav|ogg)$/iu, "").replace(/^\s*\d{1,3}[\s._-]+/u, "").replace(/\s+-\s+THE BOYZ(?:\s*\([^)]*\))?$/iu, "").trim();
const normalizeDate = (value = "") => {
  const text = String(value).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/u.test(text)) return text;
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};
const formatDate = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "DATE TO ADD";
const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
const fileUrl = (id: string) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
const downloadUrl = (id: string) => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
const previewUrl = (id: string) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
const driveImageId = (value = "") => value.match(/\/d\/([^/?#]+)/u)?.[1] || value.match(/[?&]id=([^&#]+)/u)?.[1] || "";

function inferType(title: string) {
  if (/\bOST\b|soundtrack|argylle/iu.test(title)) return "OST & SOUNDTRACK";
  if (/Jacob|unit|TIGER|Priority|Last Man Standing/iu.test(title)) return "SOLO & UNIT";
  if (/Special|Single|Sweet$|Drink It|ECHO|Electric Energy/iu.test(title)) return "DIGITAL & SPECIAL SINGLE";
  if (/Road to Kingdom|KINGDOM\s*</iu.test(title)) return "PROJECT & COMPETITION";
  if (/TATTOO|SHE'S THE BOSS|GIBBERISH|DELICIOUS|Breaking Dawn|導火線/iu.test(title)) return "JAPANESE RELEASE";
  return "ALBUM & MINI ALBUM";
}

function variantOf(node: RawNode): Variant {
  const folders = node.path.slice(3).join(" ");
  if (/vocal/iu.test(folders)) return "vocals";
  if (/instrumental/iu.test(folders)) return "instrumental";
  return "original";
}

function orderTracks(a: Track, b: Track) {
  const number = (value: string) => Number(value.match(/^\s*(\d{1,3})/u)?.[1] || 9999);
  return number(a.name) - number(b.name) || a.title.localeCompare(b.title, "en", { numeric: true });
}

function buildArchive(data: RawArchive) {
  const releaseFolders = data.nodes.filter((node) => node.type === "folder" && node.path.length === 2 && node.path[1] === ALBUMS);
  const releases = releaseFolders.map((folder) => {
    const metadata = data.metadata?.[folder.id] || {};
    const files = data.nodes.filter((node) => node.type === "file" && node.path[1] === ALBUMS && node.path[2] === folder.name);
    const image = files.find((node) => node.mimeType.startsWith("image/"));
    const coverId = metadata.cover_file_id || image?.id || "";
    const coverUrl = metadata.cover_url || "";
    const title = metadata.release_title || folder.name;
    const releaseBase = { releaseId: folder.id, releaseTitle: title, coverId, coverUrl };
    const tracks = files.filter((node) => node.mimeType.startsWith("audio/")).map((node) => ({
      ...node,
      ...releaseBase,
      title: cleanTrack(node.name),
      variant: variantOf(node),
      format: node.mimeType === "audio/flac" ? "FLAC" : node.mimeType === "audio/mpeg" ? "MP3" : node.name.split(".").pop()?.toUpperCase() || "AUDIO",
    })).sort(orderTracks);
    return {
      id: folder.id,
      sourceName: folder.name,
      title,
      files,
      tracks,
      coverId,
      coverUrl,
      date: normalizeDate(metadata.release_date),
      type: metadata.release_type || inferType(title),
      members: (metadata.members || "THE BOYZ").split(/[,;/]/u).map((item) => item.trim()).filter(Boolean),
      market: metadata.market || "",
      notes: metadata.notes || "",
      order: Number(metadata.display_order || 9999),
      visible: !/^(false|no|0)$/iu.test(metadata.visible || "true"),
    };
  }).filter((release) => release.visible).sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order || a.title.localeCompare(b.title));

  const memberFolders = data.nodes.filter((node) => node.type === "folder" && node.path.length === 2 && node.path[1] === SOUNDCLOUD);
  const soundcloud = memberFolders.map((folder) => {
    const files = data.nodes.filter((node) => node.type === "file" && node.path[1] === SOUNDCLOUD && node.path[2] === folder.name && node.mimeType.startsWith("audio/"));
    return {
      id: folder.id,
      name: folder.name,
      tracks: files.map((node) => ({
        ...node,
        title: cleanTrack(node.name),
        variant: variantOf(node),
        format: node.mimeType === "audio/flac" ? "FLAC" : "MP3",
        releaseId: folder.id,
        releaseTitle: `${folder.name} / SOUNDCLOUD`,
      })).sort(orderTracks),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { releases, soundcloud };
}

function Cover({ release, compact = false }: { release: Pick<Release, "title" | "coverId" | "coverUrl">; compact?: boolean }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const linkedDriveId = driveImageId(release.coverUrl);
  const sources = [release.coverId, linkedDriveId].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index).map((id) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`);
  if (release.coverUrl && !linkedDriveId) sources.push(release.coverUrl);
  useEffect(() => setSourceIndex(0), [release.coverId, release.coverUrl]);
  const source = sources[sourceIndex] || "";
  if (!source) return <span className={`generated-cover ${compact ? "compact" : ""}`} role="img" aria-label={`Generated cover for ${release.title}`}><i>THE BOYZ</i><strong>{release.title}</strong><small>MUSIC ARCHIVE</small></span>;
  return <img src={source} alt={`${release.title} cover`} loading="lazy" onError={() => setSourceIndex((index) => index + 1)} />;
}

function route() {
  const parts = location.hash.replace(/^#\/?/u, "").split("/").filter(Boolean);
  return { page: parts[0] || "home", id: parts[1] || "" };
}

function TrackList({ tracks, current, play }: { tracks: Track[]; current: Track | null; play: (track: Track, queue: Track[]) => void }) {
  return <div className="track-list">{tracks.map((track, index) => <article className={`track-row ${current?.id === track.id ? "playing" : ""}`} key={track.id}>
    <button className="track-play" onClick={() => play(track, tracks)} aria-label={`Play ${track.title}`}>{current?.id === track.id ? "■" : "▶"}</button>
    <span className="track-number">{String(index + 1).padStart(2, "0")}</span>
    <div><strong>{track.title}</strong><small>{track.name}</small></div>
    <span className="track-format">{track.format}</span>
    <a href={downloadUrl(track.id)} target="_blank" rel="noreferrer">DOWNLOAD ↓</a>
  </article>)}</div>;
}

function Player({ track, next, previous }: { track: Track | null; next: () => void; previous: () => void }) {
  if (!track) return null;
  return <aside className="player" aria-label="Music player">
    <div className="player-cover"><Cover release={{ title: track.releaseTitle, coverId: track.coverId, coverUrl: track.coverUrl }} compact /></div>
    <div className="player-title"><small>NOW PLAYING / {track.variant.toUpperCase()}</small><strong>{track.title}</strong><span>{track.releaseTitle}</span></div>
    <button onClick={previous} aria-label="Previous track">‹</button>
    <iframe key={track.id} src={previewUrl(track.id)} title={`Player: ${track.title}`} allow="autoplay" />
    <button onClick={next} aria-label="Next track">›</button>
    <a href={fileUrl(track.id)} target="_blank" rel="noreferrer">SOURCE ↗</a>
  </aside>;
}

export function MusicArchive({ data }: { data: RawArchive }) {
  const catalog = useMemo(() => buildArchive(data), [data]);
  const [view, setView] = useState(route);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [year, setYear] = useState("ALL");
  const [member, setMember] = useState("ALL");
  const [sort, setSort] = useState("NEWEST");
  const [variant, setVariant] = useState<Variant>("original");
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  useEffect(() => { const change = () => { setView(route()); window.scrollTo({ top: 0, behavior: "smooth" }); }; addEventListener("hashchange", change); return () => removeEventListener("hashchange", change); }, []);
  const play = (track: Track, tracks: Track[]) => { if (current?.id === track.id) return; setQueue(tracks); setCurrent(track); };
  const move = (direction: number) => { if (!current || !queue.length) return; const index = queue.findIndex((item) => item.id === current.id); setCurrent(queue[(index + direction + queue.length) % queue.length]); };
  const totalTracks = catalog.releases.reduce((sum, item) => sum + item.tracks.length, 0) + catalog.soundcloud.reduce((sum, item) => sum + item.tracks.length, 0);
  const source = (hash: string) => { location.hash = hash; };
  const selectedRelease = catalog.releases.find((item) => item.id === view.id);
  const selectedSoundcloud = catalog.soundcloud.find((item) => item.id === view.id);
  const types = [...new Set(catalog.releases.map((item) => item.type))].sort();
  const years = [...new Set(catalog.releases.map((item) => item.date.slice(0, 4)).filter(Boolean))].sort().reverse();
  const members = [...new Set(catalog.releases.flatMap((item) => item.members))].sort();
  const tokens = normalize(query).split(" ").filter(Boolean);
  const filtered = catalog.releases.filter((release) => {
    if (type !== "ALL" && release.type !== type) return false;
    if (year !== "ALL" && !release.date.startsWith(year)) return false;
    if (member !== "ALL" && !release.members.includes(member)) return false;
    const haystack = normalize([release.title, release.sourceName, release.date, release.type, release.members.join(" "), ...release.tracks.map((track) => track.name)].join(" "));
    return tokens.every((token) => haystack.includes(token));
  }).sort((a, b) => sort === "OLDEST" ? a.date.localeCompare(b.date) || a.title.localeCompare(b.title) : sort === "A-Z" ? a.title.localeCompare(b.title) : b.date.localeCompare(a.date) || a.order - b.order || a.title.localeCompare(b.title));

  return <main id="top" className={current ? "has-player" : ""}>
    <Header releases={catalog.releases.length} tracks={totalTracks} files={data.nodes.filter((node) => node.type === "file").length} updated={data.generatedAt} />
    {selectedRelease ? <AlbumPage release={selectedRelease} variant={variant} setVariant={setVariant} current={current} play={play} back={() => source("albums")} />
      : selectedSoundcloud ? <SoundcloudPage member={selectedSoundcloud} current={current} play={play} back={() => source("soundcloud")} />
      : view.page === "albums" ? <AlbumsPage releases={filtered} allCount={catalog.releases.length} query={query} setQuery={setQuery} type={type} setType={setType} types={types} year={year} setYear={setYear} years={years} member={member} setMember={setMember} members={members} sort={sort} setSort={setSort} open={(id) => source(`album/${id}`)} />
      : view.page === "soundcloud" ? <SoundcloudIndex members={catalog.soundcloud} open={(id) => source(`soundcloud/${id}`)} />
      : <Home releases={catalog.releases} soundcloud={catalog.soundcloud} open={source} />}
    <Footer data={data} />
    <Player track={current} next={() => move(1)} previous={() => move(-1)} />
  </main>;
}

function Header({ releases, tracks, files, updated }: { releases: number; tracks: number; files: number; updated: string }) {
  return <header className="masthead"><div className="utility"><a className="brand" href="https://tbzarchive1206.github.io/tbzarchive/">THE BOYZ / FAN ARCHIVE</a><nav><span>MUSIC ARCHIVE</span><span>/</span><a href="https://x.com/tbzarchive1206_" target="_blank" rel="noreferrer">TWITTER ↗</a></nav></div><a href="#/"><h1><span className="solid">MUSIC</span><span className="outline">ARCHIVE</span></h1></a><div className="stats"><p><strong>{releases}</strong> RELEASES</p><i /><p><strong>{tracks}</strong> AUDIO FILES</p><i /><p><strong>{files}</strong> TOTAL FILES</p><i /><p>UPDATED <strong>{new Date(updated).toLocaleDateString("en-GB")}</strong></p></div></header>;
}

function Home({ releases, soundcloud, open }: { releases: Release[]; soundcloud: SoundcloudMember[]; open: (hash: string) => void }) {
  return <section className="source-picker"><div className="section-label"><span>SELECT MUSIC SOURCE</span><span>02 COLLECTIONS</span></div><div className="source-grid">
    <button onClick={() => open("albums")}><span>01 / DISCOGRAPHY</span><strong>ALBUMS &<br />DIGITAL SINGLES</strong><small>{releases.length} RELEASES · {releases.reduce((sum, item) => sum + item.tracks.filter((track) => track.variant === "original").length, 0)} PRIMARY TRACKS</small></button>
    <button onClick={() => open("soundcloud")}><span>02 / MEMBER AUDIO</span><strong>THE BOYZ<br />SOUNDCLOUD</strong><small>{soundcloud.length} MEMBER FOLDERS · {soundcloud.reduce((sum, item) => sum + item.tracks.length, 0)} FILES</small></button>
  </div></section>;
}

function AlbumsPage(props: { releases: Release[]; allCount: number; query: string; setQuery: (v: string) => void; type: string; setType: (v: string) => void; types: string[]; year: string; setYear: (v: string) => void; years: string[]; member: string; setMember: (v: string) => void; members: string[]; sort: string; setSort: (v: string) => void; open: (id: string) => void }) {
  return <><section className="controls"><div className="search"><span>⌕</span><input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="SEARCH RELEASE, TRACK, MEMBER OR DATE…" aria-label="Search music" />{props.query && <button onClick={() => props.setQuery("")}>CLEAR</button>}</div><div className="filter-row">
    <label>TYPE<select value={props.type} onChange={(e) => props.setType(e.target.value)}><option>ALL</option>{props.types.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label>YEAR<select value={props.year} onChange={(e) => props.setYear(e.target.value)}><option>ALL</option>{props.years.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label>MEMBER<select value={props.member} onChange={(e) => props.setMember(e.target.value)}><option>ALL</option>{props.members.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label>SORT<select value={props.sort} onChange={(e) => props.setSort(e.target.value)}><option>NEWEST</option><option>OLDEST</option><option>A-Z</option></select></label>
  </div></section><section className="archive-section"><div className="section-label"><button onClick={() => { location.hash = ""; }}>← ALL MUSIC</button><span>{props.releases.length} OF {props.allCount} RELEASES</span></div>{props.releases.length ? <div className="release-grid">{props.releases.map((release) => <ReleaseCard key={release.id} release={release} open={() => props.open(release.id)} />)}</div> : <div className="empty"><strong>NO RESULTS</strong>TRY ANOTHER TITLE, YEAR, TYPE OR MEMBER.</div>}</section></>;
}

function ReleaseCard({ release, open }: { release: Release; open: () => void }) {
  const primary = release.tracks.filter((track) => track.variant === "original").length;
  return <article className="release-card"><button className="release-cover" onClick={open}><Cover release={release} /><span>{release.date ? release.date.slice(0, 4) : "YEAR —"}</span></button><div className="release-info"><small>{release.type}</small><h2>{release.title}</h2><p>{formatDate(release.date)} · {primary} TRACK{primary === 1 ? "" : "S"}</p><button onClick={open}>OPEN RELEASE →</button></div></article>;
}

function AlbumPage({ release, variant, setVariant, current, play, back }: { release: Release; variant: Variant; setVariant: (v: Variant) => void; current: Track | null; play: (track: Track, queue: Track[]) => void; back: () => void }) {
  const tracks = release.tracks.filter((track) => track.variant === variant);
  const counts = Object.fromEntries((["original", "vocals", "instrumental"] as Variant[]).map((item) => [item, release.tracks.filter((track) => track.variant === item).length]));
  return <section className="album-page"><div className="album-toolbar"><button onClick={back}>← ALL RELEASES</button><a href={folderUrl(release.id)} target="_blank" rel="noreferrer">OPEN SOURCE FOLDER ↗</a></div><div className="album-hero"><div className="album-cover-large"><Cover release={release} /></div><div className="album-summary"><small>{release.type}</small><h2>{release.title}</h2><dl><div><dt>RELEASE DATE</dt><dd>{formatDate(release.date)}</dd></div><div><dt>MEMBERS</dt><dd>{release.members.join(", ")}</dd></div>{release.market && <div><dt>MARKET</dt><dd>{release.market}</dd></div>}<div><dt>FILES</dt><dd>{release.tracks.length} AUDIO</dd></div></dl>{release.notes && <p>{release.notes}</p>}<button disabled={!tracks.length} onClick={() => tracks[0] && play(tracks[0], tracks)}>▶ PLAY {variant.toUpperCase()}</button></div></div><div className="variant-tabs">{(["original", "vocals", "instrumental"] as Variant[]).map((item) => <button key={item} className={variant === item ? "active" : ""} disabled={!counts[item]} onClick={() => setVariant(item)}>{item.toUpperCase()} <span>{counts[item]}</span></button>)}</div>{tracks.length ? <TrackList tracks={tracks} current={current} play={play} /> : <div className="empty compact-empty">NO FILES IN THIS VERSION.</div>}</section>;
}

function SoundcloudIndex({ members, open }: { members: SoundcloudMember[]; open: (id: string) => void }) {
  return <section className="soundcloud-index"><div className="section-label"><button onClick={() => { location.hash = ""; }}>← ALL MUSIC</button><span>{members.length} MEMBER FOLDERS</span></div><div className="member-grid">{members.map((member, index) => <button key={member.id} onClick={() => open(member.id)}><span>{String(index + 1).padStart(2, "0")} / SOUNDCLOUD</span><strong>{member.name}</strong><small>{member.tracks.length ? `${member.tracks.length} AUDIO FILES` : "READY FOR FUTURE UPLOADS"}</small></button>)}</div></section>;
}

function SoundcloudPage({ member, current, play, back }: { member: SoundcloudMember; current: Track | null; play: (track: Track, queue: Track[]) => void; back: () => void }) {
  return <section className="album-page"><div className="album-toolbar"><button onClick={back}>← ALL MEMBERS</button><a href={folderUrl(member.id)} target="_blank" rel="noreferrer">OPEN SOURCE FOLDER ↗</a></div><div className="soundcloud-heading"><small>THE BOYZ SOUNDCLOUD</small><h2>{member.name}</h2><p>{member.tracks.length} AUDIO FILES</p></div>{member.tracks.length ? <TrackList tracks={member.tracks} current={current} play={play} /> : <div className="empty"><strong>NO TRACKS YET</strong>THIS MEMBER FOLDER IS READY FOR FUTURE UPLOADS.</div>}</section>;
}

function Footer({ data }: { data: RawArchive }) {
  return <footer><span>© THE BOYZ FAN ARCHIVE</span>{data.metadataSheetId && <a href={`https://docs.google.com/spreadsheets/d/${data.metadataSheetId}/edit`} target="_blank" rel="noreferrer">METADATA SHEET ↗</a>}<a href={folderUrl(data.sourceFolderId)} target="_blank" rel="noreferrer">SOURCE FOLDER ↗</a><a href="#top">BACK TO TOP ↑</a></footer>;
}
