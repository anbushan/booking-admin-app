// Design tokens mirrored from the mockups shown earlier — kept in one
// place so the whole app stays visually consistent without hardcoding
// hex values in every screen.
export const colors = {
  bg: "#F1EFE8",
  surface: "#FFFFFF",
  border: "#E3E1D8",
  textPrimary: "#1A1A18",
  textSecondary: "#5F5E5A",
  textMuted: "#888780",
  accent: "#185FA5",
  accentBg: "#E6F1FB",
  accentText: "#0C447C",
  success: "#3B6D11",
  successBg: "#EAF3DE",
  danger: "#A32D2D",
  dangerBg: "#FCEBEB",
  warning: "#854F0B",
  warningBg: "#FAEEDA",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
};

export const typography = {
  title: { fontSize: 16, fontWeight: "500" as const },
  body: { fontSize: 14, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
  small: { fontSize: 11, fontWeight: "400" as const },
};
