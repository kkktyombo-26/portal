/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Base surfaces (portal warm parchment theme) ──────────
        canvas:    '#FFFFFF',
        surface:   '#F5F4F0',   // warm off-white
        parchment: '#EDE8DC',   // warm paper tone
        ink: {
          DEFAULT: '#1C1917',   // warm near-black
          muted:   '#78716C',   // warm grey
          faint:   '#A8A29E',
        },
        hairline: '#E7E5E0',
        border:   '#D6D3CE',

        // ── Church brand (from dashboard) ────────────────────────
        navy: {
          DEFAULT: '#1B3A6B',
          light:   '#2A4F8F',   // hover state
          dark:    '#122748',   // pressed / deep header
          muted:   '#D5E1F0',   // navy-tinted bg for badges
          text:    '#0C244A',   // navy text on light bg
        },
        gold: {
          DEFAULT: '#C8A84B',
          light:   '#F5EDD0',   // gold-tinted bg for badges / info boxes
          dark:    '#A08030',   // darker accent / hover
          border:  '#E0C878',   // hairline gold
        },

        // ── Semantic status (calm, muted tones) ──────────────────
        status: {
          open:          '#6B7280',
          'in-progress': '#92400E',
          completed:     '#3D6B4F',
          live:          '#B91C1C',   // red — only used for LIVE badge
        },

        // ── Role hierarchy ────────────────────────────────────────
        role: {
          pastor:       '#1C1917',
          elder:        '#44403C',
          group_leader: '#57534E',
          member:       '#78716C',
        },

        // ── Semantic feedback ─────────────────────────────────────
        success: {
          DEFAULT: '#1a7a4a',
          bg:      '#F0FDF4',
          border:  '#BBF7D0',
          text:    '#166534',
        },
        warning: {
          DEFAULT: '#C8A84B',   // reuse gold for warnings — fits the calm theme
          bg:      '#FFFBEB',
          border:  '#FDE68A',
          text:    '#92400E',
        },
        danger: {
          DEFAULT: '#B45309',
          bg:      '#FEF3C7',
          border:  '#FDE68A',
          text:    '#92400E',
        },
        error: {
          DEFAULT: '#B91C1C',
          bg:      '#FEF2F2',
          border:  '#FECACA',
          text:    '#991B1B',
        },

        // ── Stream / YPP progress ─────────────────────────────────
        stream: {
          live:    '#B91C1C',
          offline: '#6B7280',
        },
      },

      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'Cambria', 'serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },

      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.08em' }],
        'xs':  ['11px', { lineHeight: '16px', letterSpacing: '0.04em' }],
        'sm':  ['13px', { lineHeight: '20px' }],
        'base':['14px', { lineHeight: '22px' }],
        'md':  ['15px', { lineHeight: '24px' }],
        'lg':  ['17px', { lineHeight: '26px' }],
        'xl':  ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['28px', { lineHeight: '36px' }],
        '4xl': ['32px', { lineHeight: '40px' }],
      },

      borderRadius: {
        sm:    '4px',
        DEFAULT:'6px',
        md:    '8px',
        lg:    '10px',
        xl:    '12px',
        '2xl': '16px',
        full:  '9999px',
      },

      boxShadow: {
        xs:     '0 1px 2px rgba(28,25,23,0.05)',
        sm:     '0 2px 6px rgba(28,25,23,0.06)',
        DEFAULT:'0 4px 12px rgba(28,25,23,0.07)',
        modal:  '0 20px 56px rgba(28,25,23,0.14)',
        // Subtle navy glow — for focused inputs inside dashboard panels
        navy:   '0 0 0 3px rgba(27,58,107,0.12)',
        none:   'none',
      },

      maxWidth: {
        content: '900px',
        form:    '480px',
        modal:   '520px',
        sidebar: '240px',
        dashboard: '680px',   // matches dashboard maxWidth
      },

      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.98)' }, to: { opacity: '1', transform: 'scale(1)' } },
        // Progress bar fill animation (used in YPP tracker & service readiness bar)
        fillBar: { from: { width: '0%' }, to: { width: 'var(--bar-width)' } },
        // Pulse — skeleton loaders in dashboard stat cards
        pulse:   { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
      },

      animation: {
        'fade-in':  'fadeIn 150ms ease both',
        'slide-up': 'slideUp 180ms ease both',
        'scale-in': 'scaleIn 160ms ease both',
        'fill-bar': 'fillBar 500ms ease both',
        'pulse':    'pulse 1.5s ease-in-out infinite',
      },

      screens: {
        sm: '600px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
    },
  },
  plugins: [],
};