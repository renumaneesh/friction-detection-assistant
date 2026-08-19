/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        "risk-high": "#F59E0B",
        "risk-low": "#2DD4BF",
        "flag-cart": "#F59E0B",
        "flag-payment": "#F43F5E",
        "flag-hesitation": "#A78BFA",
        "flag-delivery": "#38BDF8",
      },
      backgroundImage: {
        "dashboard-gradient":
          "radial-gradient(ellipse at 20% 10%, rgba(79,70,229,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(16,185,129,0.08) 0%, transparent 50%), linear-gradient(135deg, #07080E 0%, #0C0F1A 50%, #090D17 100%)",
      },
      boxShadow: {
        glass: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 8px 32px rgba(0,0,0,0.4)",
        "glass-hover": "0 1px 0 0 rgba(255,255,255,0.1) inset, 0 12px 40px rgba(0,0,0,0.5)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out forwards",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
