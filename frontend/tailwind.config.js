/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ssms: {
          header: '#dee1e6',
          sidebar: '#f0f0f0',
          active: '#c9d1d9',
          border: '#ced4da',
          primary: '#0078d4',
          editor: '#ffffff',
          toolbar: '#f5f5f5',
          dark: {
            header: '#2d2d2d',
            sidebar: '#252526',
            active: '#37373d',
            border: '#3c3c3c',
            editor: '#1e1e1e'
          }
        }
      }
    },
  },
  plugins: [],
}
