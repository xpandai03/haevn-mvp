import type { Config } from 'tailwindcss'

// all in fixtures is set to tailwind v3 as interims solutions

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        // HAEVN Brand Colors (Official Style Guide v1.0)
        'haevn-orange': {
          DEFAULT: '#E29E0C',
          50: '#FEF9E7',
          100: '#FDF3CF',
          200: '#FBE79F',
          300: '#F8DB6F',
          400: '#F6CF3F',
          500: '#E29E0C',
          600: '#C28609',
          700: '#916407',
          800: '#614305',
          900: '#302102',
        },
        'haevn-teal': {
          DEFAULT: '#008080',
          50: '#E6F7F7',
          100: '#CCF0F0',
          200: '#99E0E0',
          300: '#66D1D1',
          400: '#33C1C1',
          500: '#008080',
          600: '#006666',
          700: '#004D4D',
          800: '#003333',
          900: '#001A1A',
        },
        'haevn-navy': {
          DEFAULT: '#1E2A4A',
          50: '#E8EAF0',
          100: '#D1D5E0',
          200: '#A3ABC2',
          300: '#7681A3',
          400: '#485785',
          500: '#1E2A4A',
          600: '#18223D',
          700: '#12192E',
          800: '#0C111F',
          900: '#06080F',
        },
        'haevn-gray': {
          50: '#F9F9F8',
          100: '#E8E8E3',
          200: '#D4D4CF',
          300: '#B8B8B0',
          400: '#9C9C91',
          500: '#7D7D72',
          600: '#636358',
          700: '#4A4A42',
          800: '#31312C',
          900: '#252627',
        },
        'haevn-error': {
          DEFAULT: '#D32F2F',
          light: '#FFEBEE',
        },
        'haevn-success': {
          DEFAULT: '#388E3C',
          light: '#E8F5E9',
        }
      },
      fontSize: {
        'display-lg': ['48px', { lineHeight: '1.0', letterSpacing: '-0.015em', fontWeight: '700' }],
        'display-md': ['40px', { lineHeight: '1.0', letterSpacing: '-0.015em', fontWeight: '700' }],
        'display-sm': ['32px', { lineHeight: '1.0', letterSpacing: '-0.015em', fontWeight: '700' }],
        'h1': ['28px', { lineHeight: '1.0', letterSpacing: '-0.015em', fontWeight: '700' }],
        'h2': ['24px', { lineHeight: '1.0', letterSpacing: '-0.015em', fontWeight: '700' }],
        'h3': ['20px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '500' }],
        'h4': ['18px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '500' }],
        'h5': ['16px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '500' }],
        'body-lg': ['18px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '300' }],
        'body': ['16px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '300' }],
        'body-sm': ['14px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '300' }],
        'button-lg': ['18px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '500' }],
        'button': ['16px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '500' }],
        'button-sm': ['14px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '500' }],
        'caption': ['13px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '400' }],
        'overline': ['12px', { lineHeight: '1.4', letterSpacing: '0.05em', fontWeight: '500' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // Add scrollbar-hide utility
    function ({ addUtilities }: any) {
      addUtilities({
        '.scrollbar-hide': {
          /* Firefox */
          'scrollbar-width': 'none',
          /* Safari and Chrome */
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }
      })
    }
  ],
}
export default config
