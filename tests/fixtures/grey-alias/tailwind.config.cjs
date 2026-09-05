const { typewindTransforms } = require('typewind-v4/transform');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: {
    files: ['*.{js,jsx,ts,tsx}'],
    transform: typewindTransforms,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
