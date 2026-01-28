/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      screens: {
        'xl': '1110px',
        '2xl': '1542px',
      },
    },
  },
  plugins: [],
}
