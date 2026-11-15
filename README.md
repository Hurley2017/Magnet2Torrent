# 🧲 Magnet2Torrent CLI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![GitHub Release](https://img.shields.io/github/v/release/Hurley2017/Magnet2Torrent)](https://github.com/Hurley2017/Magnet2Torrent/releases)

A fast, interactive command-line interface to search for titles across multiple public BitTorrent providers and instantly launch magnet links directly in your default BitTorrent client (qBittorrent, Transmission, Deluge, uTorrent, etc.).

---

> [!WARNING]
> ### ⚠️ Anti-Piracy & Legal Advisory
> **Magnet2Torrent CLI is developed strictly for legal, legitimate, and educational file distribution.**
> - The BitTorrent protocol is an open peer-to-peer networking protocol widely used for sharing open-source operating systems (e.g., Linux distributions), public-domain archives, Creative Commons media, and large open datasets.
> - **DO NOT USE THIS SOFTWARE FOR COPYRIGHT INFRINGEMENT OR PIRACY.**
> - The authors and contributors do not host, index, or distribute copyrighted content, and do not condone unauthorized copying or piracy of protected works.
> - Users are solely responsible for ensuring that they have the legal right or license to download any content accessed through this software.
> 
> For full details, please review the [Legal Disclaimer](DISCLAIMER.md).

---

## ✨ Features

- 🔍 **Multi-Provider Aggregation**: Concurrently queries 10+ public torrent indexes including 1337x, ThePirateBay, LimeTorrents, YTS, EZTV, and more.
- 🚀 **Instant Client Launcher**: Automatically retrieves magnet links on demand and opens them in your operating system's registered BitTorrent client using system handlers.
- 📊 **Rich Terminal UI**: Displays search results in clean, formatted tables showing title, provider, file size, seeders, leechers, and upload age.
- 🎨 **Color-Coded Health Indicators**: Quick visual cues for torrent health based on seed counts (Green: 100+ seeds, Yellow: 10–99 seeds, Red: <10 seeds).
- 🏷️ **Category Filtering**: Easily filter results by category (All, Movies, TV Shows, Music, Apps/Software, Books, Games, Anime).
- ⌨️ **Interactive Navigation**: Intuitive arrow-key selection powered by Inquirer.
- 🪟 **Desktop Ready**: Includes a one-click `launch.bat` script and icon for seamless Windows desktop use.

---

## 📋 Prerequisites

- **[Node.js](https://nodejs.org/)** v16.0.0 or higher
- A registered BitTorrent client installed on your system (e.g., [qBittorrent](https://www.qbittorrent.org/), [Transmission](https://transmissionbt.com/), [Deluge](https://deluge-torrent.org/))

---

## 📥 Installation

### Option 1: Clone & Run

```bash
# 1. Clone the repository
git clone https://github.com/Hurley2017/Magnet2Torrent.git
cd Magnet2Torrent

# 2. Install dependencies
npm install

# 3. Start the application
npm start
```

### Option 2: Install as Global CLI Tool

```bash
git clone https://github.com/Hurley2017/Magnet2Torrent.git
cd Magnet2Torrent
npm install
npm link
```
Now you can run `magnet2torrent` from any terminal directory!

### Option 3: Windows Desktop Launch
Simply double-click `launch.bat` in the root folder. It will verify dependencies and start the interactive terminal session directly.

---

## 🚀 Usage

### 1. Interactive Mode (Default)

```bash
npm start
# or
node index.js
```

1. Enter your search term (e.g., `Ubuntu 24.04 LTS`).
2. Select your category from the interactive list.
3. Choose the maximum number of results to fetch.
4. Browse the results table sorted by seeders.
5. Select a torrent with your arrow keys and press **Enter** — the magnet link is fetched and opened in your torrent client immediately!

### 2. Direct Command-Line Search

Quickly search directly from your terminal arguments:

```bash
node index.js search "archlinux" --category Apps --limit 10
```

Available flags:
- `-c, --category <name>`: Filter category (`All`, `Movies`, `TV`, `Music`, `Apps`, `Books`, `Games`, `Anime`)
- `-l, --limit <count>`: Limit search results (1–50, default: 20)

### 3. List Supported Providers

Check the status of available public torrent providers:

```bash
node index.js providers
```

---

## 🛠️ Supported Providers

- 1337x
- ThePirateBay
- LimeTorrents
- YTS
- EZTV
- Torrent9
- Torrentz2
- KickassTorrents
- TorrentProject

*(Note: Provider availability may vary depending on network conditions, mirrors, and regional ISP blocks).*

---

## ⚖️ License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for more information.
