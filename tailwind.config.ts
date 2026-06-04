import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#0d4f2a',
          dark: '#0a3d20',
          light: '#1a6b3a',
        },
        surface: {
          DEFAULT: '#1e2d20',
          light: '#2a3d2c',
        },
        primary: '#2ecc71',
        gold: '#f1c40f',
        danger: '#e74c3c',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
