// reflow design system — single source of truth for all tokens

export const colors = {
  // Primary
  teal:      "#4a9e8e",
  tealLight: "#b8ddd8",
  tealDark:  "#1f7a68",

  // Surface
  cream: "#f4f7f7",
  warm:  "#e6efee",
  card:  "#ffffff",

  // Text
  ink:     "#141e1e",
  inkSoft: "#2e4040",
  inkMute: "#5a7070",

  // Accent
  slate:     "#4a7a9b",
  slateDark: "#2a5a7a",
  focusBlue: "#2a6a8a",

  // Semantic
  error: "#a84040",

  // Alpha
  glow:           "rgba(31,122,104,0.13)",
  focusBlueLight: "rgba(42,106,138,0.12)",
};

export const darkColors = {
  cream:          "#0e1818",
  warm:           "#162222",
  card:           "#1c2c2c",
  ink:            "#ddeae8",
  inkSoft:        "#a8c4c0",
  inkMute:        "#6a9090",
  tealLight:      "#1f4040",
  tealDark:       "#3ecfb0",
  slateDark:      "#4a9aba",
  error:          "#e07070",
  focusBlue:      "#5aaaca",
  focusBlueLight: "rgba(90,170,202,0.2)",
  glow:           "rgba(62,207,176,0.08)",
};

export const radius = {
  xs:    "4px",
  sm:    "10px",   // --radius-sm: inputs, task rows
  md:    "16px",   // --radius: cards
  lg:    "24px",   // modals, onboard cards
  pill:  "40px",   // buttons, nav tabs
};

export const space = {
  xs:  "4px",
  sm:  "8px",
  md:  "12px",
  lg:  "16px",
  xl:  "20px",
  "2xl": "24px",
  "3xl": "36px",
  "4xl": "48px",
};

export const font = {
  sans:  "'DM Sans', sans-serif",
  mono:  "'DM Mono', monospace",
  serif: "'Playfair Display', serif",
};

export const fontSize = {
  "2xs": "10px",
  xs:    "11px",
  sm:    "12px",
  md:    "13px",
  base:  "14px",
  lg:    "16px",
  xl:    "18px",
  "2xl": "22px",
  "3xl": "24px",
};

// Energy level semantic tokens
export const energy = {
  high: {
    bg:    "rgba(90,122,90,0.12)",
    color: colors.tealDark,
  },
  med: {
    bg:    "rgba(196,168,130,0.2)",
    color: colors.slateDark,
  },
  low: {
    bg:    "rgba(196,114,106,0.12)",
    color: colors.error,
  },
  rest: {
    bg:    "rgba(106,138,170,0.15)",
    color: colors.focusBlue,
  },
};

// Priority pill tokens
export const priority = {
  must:   { bg: "rgba(196,114,106,0.12)", color: colors.error },
  should: { bg: "rgba(196,168,130,0.2)",  color: colors.slateDark },
  could:  { bg: "rgba(138,158,138,0.15)", color: colors.tealDark },
};

// Urgency left-border colors (task rows)
export const urgency = {
  urgent: "#d94f4f",
  high:   "#c8903a",
};

export const shadow = {
  card:  "0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)",
  hover: "0 6px 20px rgba(0,0,0,0.09)",
  modal: "0 20px 60px rgba(0,0,0,0.18)",
  sm:    "0 1px 8px rgba(0,0,0,0.05)",
  nav:   "0 2px 8px rgba(0,0,0,0.06)",
};

export const transition = "all 0.3s cubic-bezier(0.4,0,0.2,1)";
