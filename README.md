# 🧲 Magnet2Torrent (Desktop & Web)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20Desktop%20%7C%20macOS%20%7C%20Linux%20%7C%20Web-lightgrey.svg)]()
[![GitHub Release](https://img.shields.io/github/v/release/Hurley2017/Magnet2Torrent)](https://github.com/Hurley2017/Magnet2Torrent/releases)

Search across public BitTorrent providers with automatic movie/series metadata, stream directly into **VLC Media Player** from the standalone **Electron Desktop App** (`desktop/`), or launch magnet links from the Next.js **Web App** (`web/`).

---

> [!WARNING]
> ### ⚠️ Anti-Piracy & Legal Advisory
> **Magnet2Torrent is developed strictly for legal, legitimate, and educational file distribution.**
> - The BitTorrent protocol is an open peer-to-peer networking protocol widely used for sharing open-source operating systems (e.g., Linux distributions), public-domain archives, Creative Commons media, and large open datasets.
> - **DO NOT USE THIS SOFTWARE FOR COPYRIGHT INFRINGEMENT OR PIRACY.**
> - The authors and contributors do not host, index, or distribute copyrighted content, and do not condone unauthorized copying or piracy of protected works.
> - Users are solely responsible for ensuring that they have the legal right or license to download or stream any content accessed through this software.
>
> For full details, please review the [Legal Disclaimer](DISCLAIMER.md).

---

## 🖥️ Desktop Application (`desktop/`)

A standalone **Electron** desktop app featuring a red, grey, black, and white UI, automatic movie/series dossiers, source telemetry ledger, dynamic pagination, and **one-click direct VLC playback**:

### Windows PowerShell Installer (`iex`)

```powershell
irm https://raw.githubusercontent.com/Hurley2017/Magnet2Torrent/main/install.ps1 | iex
```

This checks Node.js `>= 22.12`, installs `Magnet2Torrent Desktop` into `%LOCALAPPDATA%\Magnet2Torrent\app\desktop`, fetches Electron and WebTorrent dependencies, creates **Desktop & Start Menu shortcuts** (`Magnet2Torrent`), detects VLC, and adds `magnet2torrent` to your User `PATH`.

### Run Desktop App From Source

```bash
cd desktop
npm install
node node_modules/electron/install.js
npm start
```

---

## 🌐 Web Application (`web/`)

The Web portal provides fast browser search with Next.js App Router serverless API routes ready for **Vercel**:

- **Concurrent Provider Search** (`/api/search`) across all 9 public sources (`ThePirateBay`, `Knaben`, `TorrentsCSV`, `LimeTorrents`, `InternetArchive`, `Nyaa`, `SubsPlease`, `1337x`, `EZTV`) with live fetch counts & up/down ledger
- **Automatic Movie & Series Details**: Detects movie/series queries and fetches poster artwork, IMDb rating, runtime, genres, and synopsis automatically
- **On-Demand Magnet Resolution** (`/api/magnet`) with SSRF allowlist protection
- **One-Click Torrent Client Launch** (`magnet:` URI trigger) + Copy Magnet strip
- **Mandatory Legal Terms Gate**: Requires users to accept the anti-piracy legal terms before searching, plus a compact Desktop promo strip with `i` info panel

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

## 📋 Prerequisites

- **[Node.js](https://nodejs.org/)** v22.12.0 or higher (LTS)
- **[VLC Media Player](https://www.videolan.org/)** (recommended for direct playback in Magnet2Torrent Desktop)
- A registered BitTorrent client installed on your system (e.g., [qBittorrent](https://www.qbittorrent.org/), [Transmission](https://transmissionbt.com/), [Deluge](https://deluge-torrent.org/)) for the `Client` / web `magnet:` handoff

---

## ⚖️ License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for more information.
