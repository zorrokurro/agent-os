/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // AIVault 主色票
        'bg': '#051424',
        'surface': '#122131',
        'surface-low': '#0d1c2d',
        'surface-lowest': '#010f1f',
        'surface-container': '#1c2b3c',
        'surface-container-low': '#0d1c2d',
        'surface-container-high': '#273647',
        'surface-container-highest': '#344355',
        'surface-bright': '#2c3a4c',
        'surface-dim': '#051424',
        'surface-tint': '#d0bcff',
        'surface-variant': '#273647',

        // Primary 紫色系
        'primary': '#d0bcff',
        'primary-dim': '#a078ff',
        'primary-fixed': '#e9ddff',
        'primary-fixed-dim': '#d0bcff',
        'primary-container': '#a078ff',
        'on-primary': '#3c0091',
        'on-primary-container': '#340080',
        'on-primary-fixed': '#23005c',
        'on-primary-fixed-variant': '#5516be',

        // Secondary 藍色系
        'secondary': '#adc6ff',
        'secondary-fixed': '#d8e2ff',
        'secondary-fixed-dim': '#adc6ff',
        'secondary-container': '#0566d9',
        'on-secondary': '#002e6a',
        'on-secondary-container': '#e6ecff',
        'on-secondary-fixed': '#001a42',
        'on-secondary-fixed-variant': '#004395',

        // Tertiary 橙色系
        'tertiary': '#ffb869',
        'tertiary-fixed': '#ffdcbb',
        'tertiary-fixed-dim': '#ffb869',
        'tertiary-container': '#ca801e',
        'on-tertiary': '#482900',
        'on-tertiary-container': '#3f2300',
        'on-tertiary-fixed': '#2c1700',
        'on-tertiary-fixed-variant': '#673d00',

        // 中性色
        'text-primary': '#d4e4fa',
        'text-secondary': '#cbc3d7',
        'text-dim': '#958ea0',
        'text-dark': '#494454',
        'border': 'rgba(255,255,255,0.1)',
        'border-variant': '#494454',
        'outline': '#958ea0',
        'outline-variant': '#494454',

        // 狀態色
        'error': '#ffb4ab',
        'error-container': '#93000a',
        'on-error': '#690005',
        'on-error-container': '#ffdad6',
        'success': '#5c8a2a',
        'warning': '#ffb74d',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Microsoft JhengHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
