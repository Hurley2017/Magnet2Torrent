# Magnet2Torrent Web

Lightweight text-first web port of [Magnet2Torrent CLI](../README.md) built with **Next.js App Router**, **TypeScript**, and **Tailwind CSS**, deployed on **Vercel**.

> [!WARNING]
> **Anti-Piracy & Legal Advisory**: Magnet2Torrent is strictly intended for legal, open-source, and public-domain P2P file sharing (such as Linux distributions and Creative Commons media). Do **not** use this software for copyright infringement or piracy. See [DISCLAIMER.md](../DISCLAIMER.md).

## Highlights

- **Mandatory Legal Gate**: Users must review and accept the anti-piracy terms of use before searching
- **9 Public Sources**: ThePirateBay, Knaben, TorrentsCSV, LimeTorrents, InternetArchive, Nyaa, SubsPlease, 1337x, and EZTV
- **Live Source Status & Fetch Counts**: Shows how many results came from each source and whether any provider is down or timed out
- **Movie & Series Metadata**: Fetches poster artwork, IMDb rating, year, runtime, genres, and cast/synopsis when searching Movies or Series
- **Fast & Text-First**: Zero UI icons, red/grey/black/white theme, static SSR shell

## Local Development

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHurley2017%2FMagnet2Torrent&root-directory=web)
