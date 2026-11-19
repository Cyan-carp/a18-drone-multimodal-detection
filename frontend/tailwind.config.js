// 令牌映射说明：沿用旧类名（ink、signal、text 前缀），但取值改由 PersonalGate 语义角色提供，
// 因此同一套组件在浅色与深色主题下自动切换，无需逐文件改写。
//   ink-950 window · ink-900 sidebar · ink-850 surface · ink-800 status
//   ink-700 cardBorder · ink-600 controlBorder
//   signal-cyan primary · green success · amber warning · red danger · blue info · violet viz
const role = (name) => `rgb(var(--pg-${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: role('window'),
          900: role('sidebar'),
          850: role('surface'),
          800: role('status'),
          700: role('border'),
          600: role('control-border'),
        },
        signal: {
          cyan: role('primary'),
          deep: role('primary-pressed'),
          green: role('success'),
          amber: role('warning'),
          red: role('danger'),
          blue: role('info'),
          violet: role('viz'),
        },
        text: {
          primary: role('text'),
          strong: role('text-strong'),
          secondary: role('muted'),
          muted: role('muted-weak'),
        },
      },
      fontFamily: {
        sans: ['Microsoft YaHei UI', 'Microsoft YaHei', 'Segoe UI', 'system-ui', 'PingFang SC', 'sans-serif'],
        mono: ['Segoe UI Variable Text', 'Segoe UI', 'Microsoft YaHei UI', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
      },
      borderRadius: {
        card: '16px',
        control: '9px',
        status: '12px',
        nav: '13px',
        pill: '6px',
      },
      boxShadow: {
        pg: 'var(--pg-shadow)',
        'pg-lift': 'var(--pg-shadow-lift)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.2s ease-out both',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
