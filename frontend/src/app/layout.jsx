import './globals.css';
import { AuthProvider } from '../hooks/useAuth';

export const metadata = {
  title: 'KKKT DMP Yombo | Kanisa La Kiinjili La Kilutheri',
  description: 'Church Community Management Portal - KKKT DMP Yombo, Dar es Salaam',
};

export default function RootLayout({ children }) {
  return (
    <html lang="sw">
      <head>
        {/*
          Font stack - dignified, two families only:

          - Lora: warm, moderate-contrast serif for ALL display headings
            (h1-h4, card titles, modal titles, hero text, stat values).
            Carries the parish's authority without the editorial chill of
            a high-contrast Didone. This is the family globals.css and every
            component actually asks for. Playfair Display used to be loaded
            here and was never referenced by a single rule, so headings fell
            back to Georgia while an unused font downloaded.

          - Inter: humanist geometric sans-serif for ALL UI text
            (nav, buttons, inputs, body, labels, badges, table cells).
            Extremely legible at small sizes; neutral enough to not compete.

          - JetBrains Mono: monospace, used only for schedule times and
            numeric ID codes where column alignment matters.

          This URL is byte-identical to the @import at the top of
          globals.css, so the browser issues one request. Preconnecting here
          starts the fetch earlier than a stylesheet @import can, so once
          this is in place you can delete that @import line from globals.css.

          The two-family rule is intentional and must be maintained.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}