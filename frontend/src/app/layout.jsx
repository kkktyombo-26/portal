import './globals.css';
import { AuthProvider } from '../hooks/useAuth';

export const metadata = {
  title: 'KKKT DMP Yombo | Kanisa La Kiinjili La Kilutheri',
  description: 'Church Community Management Portal — KKKT DMP Yombo, Dar es Salaam',
};

export default function RootLayout({ children }) {
  return (
    <html lang="sw">
      <head>
        {/*
          Font stack — modern, dignified, two families only:

          • Playfair Display — High-contrast serif for ALL display headings
            (h1–h4, card titles, modal titles, hero text, stat values).
            Carries the institution's authority without feeling stiff.

          • Inter — Humanist geometric sans-serif for ALL UI text
            (nav, buttons, inputs, body, labels, badges, table cells).
            Extremely legible at small sizes; neutral enough to not compete.

          • JetBrains Mono — Monospace, used only for schedule times
            and numeric ID codes where column alignment matters.

          Previous "IM Fell English" and "Lato" are removed.
          The two-family rule is intentional and must be maintained.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}