import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import archiveData from "../app/data/archive.generated.json";
import { MusicArchive, type RawArchive } from "./MusicArchive";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><MusicArchive data={archiveData as RawArchive} /></StrictMode>,
);
