# Magnet2Torrent Web

Text-first editorial-console web port of [Magnet2Torrent CLI](../README.md) built with **Next.js App Router**, **TypeScript**, and **Tailwind CSS**, deployed on **Vercel**.

> [!WARNING]
> **Anti-Piracy & Legal Advisory**: Magnet2Torrent is strictly intended for legal, open-source, and public-domain P2P file sharing (such as Linux distributions and Creative Commons media). Do **not** use this software for copyright infringement or piracy. See [DISCLAIMER.md](../DISCLAIMER.md).

## Highlights

- **Mandatory Legal Gate**: Users must review and accept the anti-piracy terms of use before searching
- **9 Public Sources (All Mode)**: Concurrently searches ThePirateBay, Knaben, TorrentsCSV, LimeTorrents, InternetArchive, Nyaa, SubsPlease, 1337x, and EZTV
- **Source Telemetry Ledger**: Shows exact hit counts from each source and whether any provider is UP or DOWN/timed out
- **Automatic Movie & Series Dossier**: Fetches poster artwork, IMDb rating, year, runtime, genres, and cast/synopsis when movie or series releases match
- **Pure Text UI**: Zero UI icons, no tab icon, red/grey/black/white split-workspace design

## Local Development

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHurley2017%2FMagnet2Torrent&root-directory=web)
