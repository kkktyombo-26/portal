import './globals.css';
import { AuthProvider } from '../hooks/useAuth';

export const metadata = {
  title: 'KKKT DMP Yombo | Kanisa La Kiinjili La Kilutheri',
  description: 'Church Community Management Portal — KKKT DMP Yombo, Dar es Salaam',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Font stack chosen for a dignified, warm church aesthetic:

          • Playfair Display  — Elegant high-contrast serif. Used for all
            display headings (hero titles, section titles). Its bracketed
            serifs and classic proportions evoke tradition and reverence.

          • Lato              — Humanist sans-serif with warmth and clarity.
            Used for body copy, nav, buttons, and UI text. Pairs beautifully
            with Playfair without competing.

          • IM Fell English   — Historical Old-style serif with ink-trap
            character. Used sparingly for liturgical accent tags, scripture
            references, and decorative labels (the "Kanisa La Kiinjili" tags).

          • JetBrains Mono    — Kept for time/schedule displays (monospace
            digits ensure columns align cleanly).
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,400&family=IM+Fell+English:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}