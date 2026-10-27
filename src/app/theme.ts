export const colors = {
  background: '#171717',
  surface: '#262626',
  surfaceFocused: '#24405a',
  // A chosen option: neutral, so it never looks like focus (blue)
  surfaceSelected: '#3d3d3d',
  focus: '#55aaff',
  text: '#ffffff',
  textMuted: '#a3a3a3',
  // Behind text laid over a photo. Dark enough that white text stays above
  // 9:1 and textOnScrim above 6:1 even over a pure white photo.
  scrim: 'rgba(0, 0, 0, 0.72)',
  textOnScrim: '#d4d4d4',
  danger: '#b3261e',
};

export const spacing = {
  xs: 8,
  sm: 12,
  md: 20,
  lg: 32,
};

export const radius = {
  sm: 8,
  md: 12,
};

// Every text style sets this: left to the font, Arabic lines are taller
// than Latin ones and switching language would shift the layout
export const lineHeightFor = (fontSize: number) => Math.round(fontSize * 1.35);
