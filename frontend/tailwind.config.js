/** @type {import('tailwindcss').Config} */

/*
 * ============================================================
 * KKKT DMP Yombo — Tailwind Config
 * Two-color palette: Stone #44403C · Amber #D97706
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
      // Swapped to Inter (matches component's clean, warm sans-serif feel)
      sans:    ['"Inter"', 'system-ui', 'sans-serif'],
      // Display stays serif but shifts to a warmer, less editorial face
      display: ['"Lora"', 'Georgia', 'serif'],
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
      sm:   '4px',   // was 2px — warmer, slightly rounder at smallest size
      DEFAULT: '8px', // was 4px — matches component's rounded-lg base feel
      md:   '10px',  // was 6px
      lg:   '12px',  // was 10px — component's primary card radius
      xl:   '16px',  // unchanged
      '2xl':'24px',  // unchanged — component uses rounded-2xl on cards
      pill: '9999px',
    },

    // ── Two-color palette: Warm Stone + Amber ─────────────────────────────
    //
    // SURFACE CONVENTION — mirrors the layout philosophy above:
    //   neutral.50  (#F5F4F0) = --surface-page  — the single root bg for all
    //                           content areas; warm parchment, not cool gray.
    //   white       (#FFFFFF) = --surface-card  — interactive/structured
    //                           components only (forms, tables, stat panels).
    //                           Must not be nested inside one another.
    //   navy.950    (#1C1917) = sidebar chrome  — navigation only.
    //   navy.900    (#292524) = page-header chrome — page identity only.
    //
    // Do not introduce a third content surface (panel, inset, etc.).
    //
    colors: {
      transparent: 'transparent',
      current:     'currentColor',
      white:       '#FFFFFF',  /* --surface-card: interactive components only */
      black:       '#000000',

      // Primary — Warm Stone (replaces cool navy)
      // The component's chrome (sidebar, topbar) uses deep warm-stone tones.
      navy: {
        950: '#1C1917',  /* sidebar bg — deep warm stone, near-black */
        900: '#292524',  /* page-header bg — warm dark stone */
        800: '#3D3835',  /* strong text on dark surfaces */
        700: '#57534E',  /* stone-700: secondary on dark */
        600: '#78716C',  /* stone-600: muted on dark */
        500: '#A8A29E',  /* stone-400 equivalent: placeholder on dark */
        400: '#C7C2BE',  /* light stone for borders on dark */
        300: '#D6D3D1',  /* stone-300 */
        200: '#E7E5E4',  /* stone-200: border on light surfaces */
        100: '#F5F5F4',  /* stone-100: subtle dividers */
        50:  '#FAFAF9',  /* stone-50: near-white tint */
      },

      // Accent — Amber (replaces warm gold; aligns exactly with component)
      // amber-500 (#F59E0B) is the interactive anchor; amber-600 for hover.
      gold: {
        950: '#451A03',  /* amber-950 */
        900: '#78350F',  /* amber-900 */
        800: '#92400E',  /* amber-800 */
        700: '#B45309',  /* amber-700 — warning-adjacent, strong cta */
        600: '#D97706',  /* amber-600 — hover state */
        500: '#F59E0B',  /* amber-500 — brand accent, primary interactive */
        400: '#FBBF24',  /* amber-400 — focus ring, highlights */
        300: '#FCD34D',  /* amber-300 */
        200: '#FDE68A',  /* amber-200 — soft tints */
        100: '#FEF3C7',  /* amber-100 — very soft bg tint */
        50:  '#FFFBEB',  /* amber-50 — icon bg, badge bg */
      },

      // Pure neutrals — warm-tinted stone (replaces cool-hued neutral)
      // neutral.50 is the exact page bg from the component (#F5F4F0).
      neutral: {
        950: '#1C1917',  /* stone-950 */
        900: '#292524',  /* stone-900 */
        800: '#44403C',  /* stone-800 — primary text */
        700: '#57534E',  /* stone-700 — secondary text */
        600: '#78716C',  /* stone-600 — muted text */
        500: '#A8A29E',  /* stone-500 — placeholder */
        400: '#A8A29E',  /* stone-400 */
        300: '#D6D3D1',  /* stone-300 — borders */
        200: '#E7E5E4',  /* stone-200 — subtle borders */
        100: '#F5F5F4',  /* stone-100 — dividers */
        50:  '#F5F4F0',  /* page bg — warm parchment (component's bg-[#F5F4F0]) */
      },

      // Semantic — shifted to warmer tones to avoid cool-palette clash
      success: '#15803D',  /* green-700 — warm, not teal */
      warning: '#D97706',  /* amber-600 — aligns with gold accent */
      danger:  '#DC2626',  /* red-600 */
      info:    '#0369A1',  /* sky-700 — the one cool note, for information only */
    },

    // ── Shadows (stone-tinted, not navy-tinted) ────────────────────────────
    boxShadow: {
      none: 'none',
      xs:   '0 1px 2px 0 rgba(68,64,60,.05)',
      sm:   '0 1px 3px 0 rgba(68,64,60,.08), 0 1px 2px -1px rgba(68,64,60,.05)',
      DEFAULT:'0 4px 6px -1px rgba(68,64,60,.08), 0 2px 4px -2px rgba(68,64,60,.05)',
      md:   '0 6px 12px -2px rgba(68,64,60,.10), 0 3px 6px -3px rgba(68,64,60,.06)',
      lg:   '0 10px 24px -4px rgba(68,64,60,.12), 0 4px 8px -4px rgba(68,64,60,.08)',
      xl:   '0 20px 40px -6px rgba(68,64,60,.14), 0 8px 16px -6px rgba(68,64,60,.08)',
      '2xl':'0 32px 64px -8px rgba(68,64,60,.18)',
      inner:'inset 0 2px 4px 0 rgba(68,64,60,.06)',
      // Focus / brand rings use amber (matches component's ring-amber-400/40)
      'gold-sm':'0 0 0 2px rgba(245,158,11,.25)',
      'gold-md':'0 0 0 3px rgba(245,158,11,.35)',
      'navy-sm':'0 0 0 2px rgba(68,64,60,.20)',
      'focus':  '0 0 0 3px rgba(245,158,11,.40)',
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
      // pulse-gold now pulses amber to match component's amber-400 focus rings
      'pulse-gold': {
        '0%,100%': { boxShadow: '0 0 0 0 rgba(245,158,11,.35)' },
        '50%':     { boxShadow: '0 0 0 6px rgba(245,158,11,0)' },
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
        // Stone-tinted grid/dot patterns (replaces navy-tinted)
        'grid-navy':   "url(\"data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v1H0zM0 0h1v40H0z' fill='%2344403C' fill-opacity='.05'/%3E%3C/svg%3E\")",
        'cross-navy':  "url(\"data:image/svg+xml,%3Csvg width='32' height='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M14 0h4v32h-4zM0 14h32v4H0z' fill='%2344403C' fill-opacity='.04'/%3E%3C/svg%3E\")",
        'dots-navy':   "url(\"data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1.5' fill='%2344403C' fill-opacity='.06'/%3E%3C/svg%3E\")",
        // Dark hero gradient — deep warm stone instead of navy
        'hero-dark':   'linear-gradient(160deg, #1C1917 0%, #292524 55%, #3D3835 100%)',
        'hero-accent': 'linear-gradient(160deg, #292524 0%, #3D3835 60%, #57534E 100%)',
        // Gold bar now uses amber ramp
        'gold-bar':    'linear-gradient(90deg, #D97706 0%, #FCD34D 50%, #D97706 100%)',
        'shimmer-bg':  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.06) 50%, transparent 100%)',
      },
    },
  },

  plugins: [],
};