/** @type {import('tailwindcss').Config} */

/*
 * ============================================================
 * KKKT DMP Yombo — Tailwind Config
 * Two-color palette: Navy #0F1F3D · Gold #C49A2A
 *
 * LAYOUT PHILOSOPHY
 * ─────────────────
 * This system uses a SINGLE ROOT BACKGROUND. Content does not
 * nest inside layered box surfaces. --surface-page / neutral.50
 * is the one and only background for all content areas.
 *
 * The hierarchy is:
 *   root bg (neutral.50) → spacing & typography → component
 * Never:
 *   root bg → panel bg → card bg → content
 *
 * Cards (surface-card / white) exist only for interactive or
 * structured data — a form, a table, a stat panel, a modal.
 * They are never used as passive section wrappers. The sidebar
 * (navy.950) and page-header (navy.900) are the only permitted
 * background-colour breaks; they mark navigation chrome, not
 * content grouping.
 *
 * When in doubt: use spacing to separate, not a box.
 * ============================================================
 */

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    // ── Replace defaults entirely ──────────────────────────────────────────
    screens: {
      sm:  '640px',
      md:  '768px',
      lg:  '1024px',
      xl:  '1280px',
      '2xl': '1536px',
    },

    // ── Type scale (Perfect Fourth — 1.333) ───────────────────────────────
    fontSize: {
      '2xs': ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.04em'  }], //  10px
      xs:    ['0.75rem',  { lineHeight: '1rem',     letterSpacing: '0.02em'  }], //  12px
      sm:    ['0.875rem', { lineHeight: '1.25rem',  letterSpacing: '0.01em'  }], //  14px
      base:  ['1rem',     { lineHeight: '1.625rem', letterSpacing: '0'       }], //  16px — body
      md:    ['1.125rem', { lineHeight: '1.75rem',  letterSpacing: '-0.01em' }], //  18px
      lg:    ['1.25rem',  { lineHeight: '1.875rem', letterSpacing: '-0.01em' }], //  20px
      xl:    ['1.5rem',   { lineHeight: '2rem',     letterSpacing: '-0.02em' }], //  24px — h4
      '2xl': ['2rem',     { lineHeight: '2.25rem',  letterSpacing: '-0.03em' }], //  32px — h3
      '3xl': ['2.5rem',   { lineHeight: '2.75rem',  letterSpacing: '-0.03em' }], //  40px — h2
      '4xl': ['3.25rem',  { lineHeight: '3.5rem',   letterSpacing: '-0.04em' }], //  52px — h1
      '5xl': ['4.25rem',  { lineHeight: '4.5rem',   letterSpacing: '-0.05em' }], //  68px — hero
      '6xl': ['5.5rem',   { lineHeight: '5.75rem',  letterSpacing: '-0.05em' }], //  88px — display
    },

    fontWeight: {
      light:    '300',
      regular:  '400',
      medium:   '500',
      semibold: '600',
      bold:     '700',
      black:    '900',
    },

    fontFamily: {
      sans:    ['"Inter"', 'system-ui', 'sans-serif'],
      display: ['"Playfair Display"', 'Georgia', 'serif'],
      mono:    ['"JetBrains Mono"', 'monospace'],
    },

    // ── Spacing (4-pt base) ────────────────────────────────────────────────
    spacing: {
      px: '1px',
      0:  '0',
      0.5:'0.125rem', //  2
      1:  '0.25rem',  //  4
      1.5:'0.375rem', //  6
      2:  '0.5rem',   //  8
      2.5:'0.625rem', // 10
      3:  '0.75rem',  // 12
      4:  '1rem',     // 16
      5:  '1.25rem',  // 20
      6:  '1.5rem',   // 24
      7:  '1.75rem',  // 28
      8:  '2rem',     // 32
      10: '2.5rem',   // 40
      12: '3rem',     // 48
      14: '3.5rem',   // 56
      16: '4rem',     // 64
      20: '5rem',     // 80
      24: '6rem',     // 96
      28: '7rem',     // 112
      32: '8rem',     // 128
      40: '10rem',    // 160
      48: '12rem',    // 192
      56: '14rem',    // 224
      64: '16rem',    // 256
      72: '18rem',    // 288
      80: '20rem',    // 320
      96: '24rem',    // 384
    },

    borderRadius: {
      none: '0',
      sm:   '2px',
      DEFAULT: '4px',
      md:   '6px',
      lg:   '10px',
      xl:   '16px',
      '2xl':'24px',
      pill: '9999px',
    },

    // ── Two-color palette: Navy + Gold, plus pure neutrals ─────────────────
    //
    // SURFACE CONVENTION — mirrors the layout philosophy above:
    //   neutral.50  (#F5F5FA) = --surface-page  — the single root bg for all
    //                           content areas; never change this per-section.
    //   white       (#FFFFFF) = --surface-card  — interactive/structured
    //                           components only (forms, tables, stat panels).
    //                           Must not be nested inside one another.
    //   navy.950    (#060D1A) = sidebar chrome  — navigation only.
    //   navy.900    (#0F1F3D) = page-header chrome — page identity only.
    //
    // Do not introduce a third content surface (panel, inset, etc.).
    //
    colors: {
      transparent: 'transparent',
      current:     'currentColor',
      white:       '#FFFFFF',  /* --surface-card: interactive components only */
      black:       '#000000',

      // Primary — Deep Indigo-Navy
      navy: {
        950: '#060D1A',  /* sidebar bg — navigation chrome only */
        900: '#0F1F3D',  /* page-header bg — page identity chrome only */
        800: '#162B53',
        700: '#1D3869',
        600: '#24457F',
        500: '#2B5295',
        400: '#4A6EAB',
        300: '#6B8EC2',
        200: '#9AB3D8',
        100: '#C8D7ED',
        50:  '#EDF1F8',
      },

      // Accent — Warm Gold
      gold: {
        950: '#2B2000',
        900: '#4A3800',
        800: '#6B5100',
        700: '#8C6A00',
        600: '#A88000',
        500: '#C49A2A',  /* brand accent */
        400: '#D4AE4E',
        300: '#E0C472',
        200: '#ECDA9C',
        100: '#F5EEC7',
        50:  '#FAF6E8',
      },

      // Pure neutrals derived from navy hue
      neutral: {
        950: '#09090F',
        900: '#111118',
        800: '#1C1C26',
        700: '#2D2D3D',
        600: '#4A4A5F',
        500: '#6B6B82',
        400: '#8F8FA8',
        300: '#B8B8CC',
        200: '#D8D8E8',
        100: '#EBEBF4',
        50:  '#F5F5FA',  /* --surface-page: THE root background; use this everywhere */
      },

      // Semantic
      success: '#1A7F55',
      warning: '#B45309',
      danger:  '#B91C1C',
      info:    '#1E5FA8',
    },

    // ── Shadows (navy-tinted) ──────────────────────────────────────────────
    boxShadow: {
      none: 'none',
      xs:   '0 1px 2px 0 rgba(15,31,61,.06)',
      sm:   '0 1px 3px 0 rgba(15,31,61,.08), 0 1px 2px -1px rgba(15,31,61,.06)',
      DEFAULT:'0 4px 6px -1px rgba(15,31,61,.10), 0 2px 4px -2px rgba(15,31,61,.07)',
      md:   '0 6px 12px -2px rgba(15,31,61,.12), 0 3px 6px -3px rgba(15,31,61,.08)',
      lg:   '0 10px 24px -4px rgba(15,31,61,.14), 0 4px 8px -4px rgba(15,31,61,.10)',
      xl:   '0 20px 40px -6px rgba(15,31,61,.16), 0 8px 16px -6px rgba(15,31,61,.10)',
      '2xl':'0 32px 64px -8px rgba(15,31,61,.20)',
      inner:'inset 0 2px 4px 0 rgba(15,31,61,.08)',
      'gold-sm':'0 0 0 2px rgba(196,154,42,.30)',
      'gold-md':'0 0 0 3px rgba(196,154,42,.40)',
      'navy-sm':'0 0 0 2px rgba(15,31,61,.30)',
      'focus':  '0 0 0 3px rgba(196,154,42,.50)',
    },

    // ── Z-index scale ──────────────────────────────────────────────────────
    zIndex: {
      0:    '0',
      10:   '10',    // sticky nav
      20:   '20',    // dropdowns
      30:   '30',    // tooltips
      40:   '40',    // drawers
      50:   '50',    // modals
      60:   '60',    // toasts
      70:   '70',    // command palette
      auto: 'auto',
    },

    // ── Transitions ────────────────────────────────────────────────────────
    transitionTimingFunction: {
      DEFAULT:  'cubic-bezier(.4,0,.2,1)',
      in:       'cubic-bezier(.4,0,1,1)',
      out:      'cubic-bezier(0,0,.2,1)',
      'in-out': 'cubic-bezier(.4,0,.2,1)',
      spring:   'cubic-bezier(.34,1.56,.64,1)',
      sharp:    'cubic-bezier(.25,.46,.45,.94)',
    },

    transitionDuration: {
      75:  '75ms',
      100: '100ms',
      150: '150ms',
      200: '200ms',
      300: '300ms',
      500: '500ms',
      700: '700ms',
    },

    // ── Keyframe animations ────────────────────────────────────────────────
    keyframes: {
      'fade-in': {
        from: { opacity: '0' },
        to:   { opacity: '1' },
      },
      'slide-up': {
        from: { opacity: '0', transform: 'translateY(8px)' },
        to:   { opacity: '1', transform: 'translateY(0)' },
      },
      'slide-down': {
        from: { opacity: '0', transform: 'translateY(-8px)' },
        to:   { opacity: '1', transform: 'translateY(0)' },
      },
      'slide-right': {
        from: { opacity: '0', transform: 'translateX(-8px)' },
        to:   { opacity: '1', transform: 'translateX(0)' },
      },
      'scale-in': {
        from: { opacity: '0', transform: 'scale(.96)' },
        to:   { opacity: '1', transform: 'scale(1)' },
      },
      'shimmer': {
        from: { backgroundPosition: '-400px 0' },
        to:   { backgroundPosition: '400px 0' },
      },
      'pulse-gold': {
        '0%,100%': { boxShadow: '0 0 0 0 rgba(196,154,42,.4)' },
        '50%':     { boxShadow: '0 0 0 6px rgba(196,154,42,0)' },
      },
      'spin-slow': {
        to: { transform: 'rotate(360deg)' },
      },
    },

    animation: {
      none:        'none',
      'fade-in':   'fade-in 200ms ease-out both',
      'slide-up':  'slide-up 250ms ease-out both',
      'slide-down':'slide-down 250ms ease-out both',
      'slide-right':'slide-right 250ms ease-out both',
      'scale-in':  'scale-in 200ms cubic-bezier(.34,1.56,.64,1) both',
      'shimmer':   'shimmer 1.5s ease-in-out infinite',
      'pulse-gold':'pulse-gold 2s ease-in-out infinite',
      'spin-slow': 'spin-slow 3s linear infinite',
    },

    extend: {
      maxWidth: {
        prose:   '68ch',
        content: '1200px',
        sidebar: '280px',
        modal:   '560px',
        drawer:  '400px',
      },

      lineHeight: {
        display: '1.05',
        heading: '1.2',
        snug:    '1.375',
        base:    '1.625',
        loose:   '1.8',
      },

      letterSpacing: {
        tighter: '-0.05em',
        tight:   '-0.03em',
        snug:    '-0.015em',
        normal:  '0',
        wide:    '0.025em',
        wider:   '0.05em',
        widest:  '0.12em',
      },

      height: {
        'hero':        '560px',
        'hero-lg':     '680px',
        'page-header': '200px',
        'topbar':      '64px',
        'sidebar':     'calc(100vh - 64px)',
      },

      backgroundImage: {
        'grid-navy':   "url(\"data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v1H0zM0 0h1v40H0z' fill='%230F1F3D' fill-opacity='.06'/%3E%3C/svg%3E\")",
        'cross-navy':  "url(\"data:image/svg+xml,%3Csvg width='32' height='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M14 0h4v32h-4zM0 14h32v4H0z' fill='%230F1F3D' fill-opacity='.04'/%3E%3C/svg%3E\")",
        'dots-navy':   "url(\"data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1.5' fill='%230F1F3D' fill-opacity='.07'/%3E%3C/svg%3E\")",
        'hero-dark':   'linear-gradient(160deg, #060D1A 0%, #0F1F3D 55%, #162B53 100%)',
        'hero-accent': 'linear-gradient(160deg, #0F1F3D 0%, #162B53 60%, #1D3869 100%)',
        'gold-bar':    'linear-gradient(90deg, #C49A2A 0%, #E0C472 50%, #C49A2A 100%)',
        'shimmer-bg':  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.06) 50%, transparent 100%)',
      },
    },
  },

  plugins: [],
};