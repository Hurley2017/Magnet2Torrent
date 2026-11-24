import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Magnet2Torrent — Search Torrents & Launch Magnet Links',
  description:
    'Lightweight web search across public BitTorrent indexes to launch magnet links in your torrent client. Strictly for legal and open-source distribution.',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/magnet.ico', type: 'image/x-icon' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#140d07',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#140d07] text-[#fef3c7] antialiased selection:bg-yellow-400 selection:text-[#140d07]">
        {children}
      </body>
    </html>
  );
}
