/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // DM Sans carries the display voice — tight tracking at large sizes.
        display: ['"DM Sans"', "system-ui", "sans-serif"],
        // Inter carries everything you read rather than look at.
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // A single graded neutral. No second hue anywhere — depth comes from
        // value and whitespace, never from a gradient between two colours.
        ink: {
          DEFAULT: "#0B0B0C",
          900: "#121214",
          800: "#1C1C1F",
          700: "#2A2A2E",
          600: "#3D3D43",
          500: "#5B5B63",
          400: "#84848D",
          300: "#AEAEB6",
          200: "#D4D4D9",
          100: "#E9E9EC",
          50: "#F5F5F7",
        },
        // The one accent. Used for a single action per view, nothing else.
        accent: {
          DEFAULT: "#0A5C4A",
          soft: "#0F7A62",
          wash: "#EFF6F3",
        },
        // Status colours are functional, not decorative: they only ever appear
        // attached to a specific piece of information.
        critical: { DEFAULT: "#9B2226", wash: "#FDF3F3" },
        caution: { DEFAULT: "#8A5A00", wash: "#FDF8EE" },
        affirm: { DEFAULT: "#1D6B47", wash: "#F1F8F4" },
      },
      letterSpacing: {
        display: "-0.05em",
        tight: "-0.03em",
      },
      borderRadius: {
        card: "18px",
        field: "10px",
      },
      boxShadow: {
        // Barely-there elevation. Two stops, both neutral.
        subtle: "0 1px 2px rgba(11,11,12,0.04), 0 1px 1px rgba(11,11,12,0.03)",
        lift: "0 12px 32px -12px rgba(11,11,12,0.16), 0 2px 6px rgba(11,11,12,0.04)",
        deep: "0 40px 80px -32px rgba(11,11,12,0.32)",
      },
      maxWidth: {
        shell: "1240px",
        prose: "68ch",
      },
      animation: {
        "fade-up": "fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fadeIn 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "slide-left": "slideInLeft 0.8s cubic-bezier(0.16,1,0.3,1) both",
        "slide-right": "slideInRight 0.8s cubic-bezier(0.16,1,0.3,1) both",
        "scale-in": "scaleIn 1s cubic-bezier(0.16,1,0.3,1) both",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: "translateY(30px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideInLeft: {
          from: { opacity: 0, transform: "translateX(-40px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        slideInRight: {
          from: { opacity: 0, transform: "translateX(40px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        scaleIn: {
          from: { opacity: 0, transform: "scale(0.94)" },
          to: { opacity: 1, transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
