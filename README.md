# MUSIC

Samodzielne archiwum muzyczne THE BOYZ przeznaczone do publikacji jako GitHub Pages. Układ, kolorystyka, typografia i responsywność są zgodne z pozostałymi repozytoriami THE BOYZ FAN ARCHIVE.

## Funkcje

- 48 wydań automatycznie zbudowanych z folderów Google Drive,
- albumy, single, OST, projekty oraz sekcja THE BOYZ SoundCloud,
- osobne tracklisty `Original`, `Vocals` i `Instrumental`,
- jeden stały odtwarzacz działający bez opuszczania strony,
- wyszukiwanie po nazwie wydania, utworu, członku i dacie,
- filtrowanie po roku, typie wydania i członku,
- rzeczywiste okładki wskazywane w arkuszu lub dodane do folderu albumu,
- automatyczna typograficzna okładka zastępcza,
- metadane albumów pobierane z edytowalnego Google Sheet,
- synchronizacja Dysku Google i arkusza dwa razy dziennie.

## Uruchomienie lokalne

Wymagane są Node.js 22 i pnpm.

```bash
pnpm install
pnpm dev
```

Test i kompilacja:

```bash
pnpm test
```

## Publikacja na GitHub Pages

1. Utwórz puste repozytorium GitHub, np. `music`.
2. Rozpakuj ZIP i otwórz CMD w jego folderze.
3. Wykonaj:

   ```bash
   git init -b main
   git add .
   git commit -m "Initial MUSIC archive"
   git remote add origin https://github.com/TWOJ_LOGIN/music.git
   git push -u origin main
   ```

4. W `Settings → Pages` wybierz `Source → GitHub Actions`.

## Klucze i automatyczna synchronizacja

W `Settings → Secrets and variables → Actions` dodaj:

- sekret `GOOGLE_DRIVE_API_KEY` – klucz serwerowy z włączonym Google Drive API, używany wyłącznie przez synchronizację GitHub Actions,
- sekret `GOOGLE_DRIVE_PLAYER_API_KEY` – osobny klucz przeglądarkowy z włączonym Google Drive API i ograniczeniem HTTP referrer do adresu Twojej GitHub Page; zostanie użyty przez player,
- sekret `GOOGLE_SHEETS_API_KEY` – klucz z włączonym Google Sheets API; może to być ten sam klucz, jeśli ma dostęp do obu API,
- opcjonalną zmienną repozytorium `MUSIC_METADATA_SHEET_ID`, jeśli chcesz później podmienić przygotowany arkusz na inny. Dołączony arkusz jest już wpisany jako domyślny.

Folder muzyczny oraz arkusz muszą mieć dostęp `Każda osoba mająca link → Wyświetlający`. Ty nadal możesz edytować arkusz jako właściciel.

Synchronizacja działa o `05:17` i `17:17` UTC. Błąd arkusza nie zatrzyma aktualizacji plików z Dysku – strona zachowa ostatnie lub domyślne metadane.

## Kolumny arkusza

Zakładka musi nazywać się `Releases`. Nie zmieniaj wartości `Folder ID`, ponieważ łączy ona wiersz z folderem albumu. Możesz edytować pozostałe pola: nazwę, datę w formacie `YYYY-MM-DD`, typ, członków, rynek, język, ID lub URL okładki, notatki, kolejność i widoczność.

## Okładki

Okładkę można dodać na trzy sposoby:

1. wpisać `Cover File ID` w arkuszu,
2. wpisać bezpośredni `Cover URL`,
3. dodać plik graficzny do folderu albumu.

Bez okładki strona automatycznie wygeneruje typograficzną kartę z tytułem wydania.

## Źródło

- [Folder Google Drive](https://drive.google.com/drive/folders/1YUuf9COhHdQeyG7PsO9tYCHQDbmQX3h_)
