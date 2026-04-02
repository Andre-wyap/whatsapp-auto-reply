import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        void: '#0A0E1A',
        coral: '#FF7F50',
        teal: '#008080',
        amber: '#FFBF00',
        surface: {
          DEFAULT: '#0D1220',
          low: '#111827',
          high: '#1a2235',
          highest: '#1f2b40',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '2rem',
      },
      backgroundImage: {
        'gradient-cta': 'linear-gradient(135deg, #FF7F50, #008080)',
      },
    },
  },
  plugins: [],
}

export default config
