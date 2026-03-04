/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        muted: "var(--muted)",
        border: "var(--border)",
        accent: "var(--accent)",
        danger: "var(--danger)",
        success: "var(--success)",
        "text-soft": "var(--text-soft)",
      },
    },
  },
  plugins: [],
};
