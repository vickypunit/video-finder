import { Schibsted_Grotesk } from 'next/font/google';
import './globals.css';

const font = Schibsted_Grotesk({ subsets: ['latin'], weight: ['400', '500', '700', '800'], display: 'swap' });

export const metadata = {
  title: 'Video Finder',
  description: 'Find Instagram Reels and Meta ads that show a specific product.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={font.className}>{children}</body>
    </html>
  );
}
