# 🧲 Magnet2Torrent (Desktop, Web & CLI)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20Desktop%20%7C%20macOS%20%7C%20Linux%20%7C%20Web-lightgrey.svg)]()
[![GitHub Release](https://img.shields.io/github/v/release/Hurley2017/Magnet2Torrent)](https://github.com/Hurley2017/Magnet2Torrent/releases)

Search across public BitTorrent providers with automatic movie/series metadata, stream directly to **VLC Media Player** from the **Electron Desktop App** (or CLI), or launch magnet links from the Next.js Web app.

---

> [!WARNING]
> ### ⚠️ Anti-Piracy & Legal Advisory
> **Magnet2Torrent is developed strictly for legal, legitimate, and educational file distribution.**
> - The BitTorrent protocol is an open peer-to-peer networking protocol widely used for sharing open-source operating systems (e.g., Linux distributions), public-domain archives, Creative Commons media, and large open datasets.
> - **DO NOT USE THIS SOFTWARE FOR COPYRIGHT INFRINGEMENT OR PIRACY.**
> - The authors and contributors do not host, index, or distribute copyrighted content, and do not condone unauthorized copying or piracy of protected works.
> - Users are solely responsible for ensuring that they have the legal right or license to download any content accessed through this software.
> 
> For full details, please review the [Legal Disclaimer](DISCLAIMER.md).

---

## 🖥️ Desktop Application (`desktop/`)

A standalone **Electron** desktop app featuring the red, grey, black, and white UI, automatic movie/series dossiers, multi-provider ledger, and **direct one-click VLC playback**:

### Windows PowerShell One-Line Installer (`iex`)

```powershell
irm https://raw.githubusercontent.com/Hurley2017/Magnet2Torrent/main/install.ps1 | iex
```

This checks Node.js `>= 22.12`, installs `Magnet2Torrent Desktop` into `%LOCALAPPDATA%\Magnet2Torrent\app\desktop`, fetches the Electron runtime and WebTorrent P2P dependencies, creates **Desktop & Start Menu shortcuts** (`Magnet2Torrent`), detects VLC, and registers `magnet2torrent` on User `PATH`.

### Run Desktop App From Source

```bash
cd desktop
npm install
node node_modules/electron/install.js
npm start
```

---

## 🌐 Web Application (`web/`)

The Web port provides full feature parity in your browser with Next.js App Router serverless API routes ready for **Vercel**:

- **Concurrent Provider Search** (`/api/search`) across all 9 public sources (`ThePirateBay`, `Knaben`, `TorrentsCSV`, `LimeTorrents`, `InternetArchive`, `Nyaa`, `SubsPlease`, `1337x`, `EZTV`) with live fetch counts & up/down ledger
- **Automatic Movie & Series Details**: Detects movie/series queries and fetches poster artwork, IMDb rating, runtime, genres, and synopsis automatically
- **On-Demand Magnet Resolution** (`/api/magnet`) with SSRF allowlist protection
- **One-Click Torrent Client Launch** (`magnet:` URI trigger) + Copy Magnet strip
- **Mandatory Legal Terms Gate**: Requires users to accept the anti-piracy legal terms before searching in the red, grey, black, and white split-workspace UI

### Run Web App Locally

```bash
cd web
npm install
npm run dev
```

### Deploy Web App to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHurley2017%2FMagnet2Torrent&root-directory=web)

Or using the Vercel CLI:

```bash
cd web
npx vercel --prod
```

*(When connecting this repository in the Vercel dashboard, set **Root Directory** to `web`.)*

---

## ✨ Features

- 🔍 **Multi-Provider Aggregation**: Concurrently queries public torrent indexes including ThePirateBay, Knaben, TorrentsCSV, LimeTorrents, InternetArchive, Nyaa, SubsPlease, 1337x, and EZTV.
- 🎬 **Direct VLC Playback (CLI)**: Streams video/audio files locally via WebTorrent straight into VLC Media Player (`--vlc` / `stream` command) with real-time speed & peer stats and automatic temp buffer cleanup.
- 🚀 **Instant Client Launcher**: Automatically retrieves magnet links on demand and opens them in your operating system's registered BitTorrent client using system handlers.
- 📊 **Clean Results View**: Displays results sorted by seeders with provider badges, file size, seeders, leechers, and upload age.
- 🎨 **Color-Coded Health Indicators**: Quick visual cues for torrent health based on seed counts (Green: 100+ seeds, Yellow: 10–99 seeds, Red: <10 seeds).
- 🏷️ **Category Filtering**: Easily filter results by category (All, Movies, TV Shows, Music, Apps/Software, Books, Games, Anime).
- 🪟 **Desktop Ready**: Includes a Windows PowerShell `iex` one-line installer (`install.ps1`), `launch.bat` script, and icon for seamless Windows desktop CLI use.

---

## 📋 Prerequisites

- **[Node.js](https://nodejs.org/)** v22.12.0 or higher (LTS)
- **[VLC Media Player](https://www.videolan.org/)** (recommended for direct streaming in Desktop & `--vlc` in CLI)
- A registered BitTorrent client installed on your system (e.g., [qBittorrent](https://www.qbittorrent.org/), [Transmission](https://transmissionbt.com/), [Deluge](https://deluge-torrent.org/))

---

## 📥 CLI Installation

### Option 1: Windows Desktop + Launcher (`iex`)

```powershell
irm https://raw.githubusercontent.com/Hurley2017/Magnet2Torrent/main/install.ps1 | iex
```

Installs the standalone Electron Desktop app with Desktop/Start Menu shortcuts and registers `magnet2torrent`. For terminal-only CLI mode, clone & run Option 2 below.

### Option 2: Clone & Run

```bash
# 1. Clone the repository
git clone https://github.com/Hurley2017/Magnet2Torrent.git
cd Magnet2Torrent

# 2. Install dependencies
npm install

# 3. Start the CLI application
npm start
```

### Option 3: Install as Global CLI Tool

```bash
git clone https://github.com/Hurley2017/Magnet2Torrent.git
cd Magnet2Torrent
npm install
npm link
```
Now you can run `magnet2torrent` from any terminal directory!

### Option 4: Windows Desktop Launch
Simply double-click `launch.bat` in the root folder. It will verify dependencies and start the interactive terminal session directly.

---

## 🚀 CLI Usage

### 1. Interactive Mode (Default)

```bash
npm start
# or
magnet2torrent
```

1. Enter your search term (e.g., `Ubuntu 24.04 LTS` or `Big Buck Bunny`).
2. Select your category from the interactive list.
3. Choose the maximum number of results to fetch.
4. Browse the results table sorted by seeders.
5. Select a torrent and choose whether to **Stream directly in VLC** or **Launch in default torrent client**.

### 2. Direct Command-Line Search & VLC Stream

```bash
# Search and pick open/stream mode
magnet2torrent search "archlinux" --category Apps --limit 10

# Search and stream directly into VLC
magnet2torrent search "Big Buck Bunny" --vlc

# Stream a magnet link directly in VLC (or search by title and stream)
magnet2torrent stream "magnet:?xt=urn:btih:..."
```

Available flags:
- `-c, --category <name>`: Filter category (`All`, `Movies`, `TV`, `Music`, `Apps`, `Books`, `Games`, `Anime`)
- `-l, --limit <count>`: Limit search results (1–50, default: 20)
- `-v, --vlc` / `--stream`: Stream directly in VLC Media Player
- `-o, --open`: Launch directly in default torrent client
- `--keep`: Keep streamed temporary files after closing VLC
- `--dir <path>`: Custom directory to save streamed media
- `--vlc-path <path>`: Custom path to VLC executable

### 3. List Supported Providers

Check the status of available public torrent providers:

```bash
node index.js providers
```

---

## ⚖️ License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for more information.
