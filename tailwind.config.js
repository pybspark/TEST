/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    'md:flex',
    'md:hidden',
    'md:ml-[220px]',
    'md:pt-0',
    'md:pb-0',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#E6F1FB',
          100: '#B5D4F4',
          200: '#85B7EB',
          400: '#378ADD',
          600: '#185FA5',
          800: '#0C447C',
          900: '#042C53',
        },
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.9rem', { lineHeight: '1.25rem' }],
        sm: ['1.05rem', { lineHeight: '1.5rem' }],
        base: ['1.2rem', { lineHeight: '1.8rem' }],
        lg: ['1.35rem', { lineHeight: '2rem' }],
        xl: ['1.5rem', { lineHeight: '2rem' }],
        '2xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '3xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '4xl': ['2.7rem', { lineHeight: '2.75rem' }],
        '5xl': ['3.6rem', { lineHeight: '1' }],
      },
      keyframes: {
        'cat-walk': {
          '0%, 100%': { transform: 'translateX(0px)' },
          '25%': { transform: 'translateX(4px)' },
          '50%': { transform: 'translateX(-3px)' },
          '75%': { transform: 'translateX(2px)' },
        },
        'cat-zz': {
          '0%, 40%': { opacity: 0, transform: 'translateY(2px)' },
          '50%, 80%': { opacity: 1, transform: 'translateY(0)' },
          '100%': { opacity: 0, transform: 'translateY(2px)' },
        },
      },
      animation: {
        'cat-walk': 'cat-walk 4s ease-in-out infinite',
        'cat-zz': 'cat-zz 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}