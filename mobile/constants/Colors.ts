// Centralized color palette — "dreamy sunset" theme. Every theme-aware
// screen reads from here via useThemeColors() (in components/Themed.tsx).
// Adding a new color? Add it to BOTH light and dark so the type stays in
// sync.
//
// The look: warm cream / deep-plum backgrounds, soft (never pure-black)
// text, and peach → pink → lavender sunset accents. The gradient* stops
// are for LinearGradient surfaces (buttons, headers, splash).

const light = {
  text: '#3A2A33', // warm plum-charcoal — softer than pure black
  textMuted: 'rgba(58,42,51,0.55)',
  textSubtle: 'rgba(58,42,51,0.40)',
  background: '#FFF6F0', // warm cream
  card: '#FFFFFF',
  cardHighlight: 'rgba(255,111,145,0.14)',
  border: 'rgba(58,42,51,0.10)',
  separator: 'rgba(58,42,51,0.07)',
  inputBackground: '#FFFFFF',
  inputText: '#3A2A33',
  placeholder: 'rgba(58,42,51,0.35)',
  primary: '#FF6F91', // sunset pink-coral
  primaryText: '#FFFFFF',
  secondaryButton: 'rgba(255,111,145,0.12)',
  danger: '#E5484D',
  walkingActive: '#8E7CC3', // dreamy lavender
  overlay: 'rgba(58,42,51,0.92)',
  overlayText: '#fff',
  overlaySubtext: 'rgba(255,255,255,0.7)',
  tint: '#FF6F91',
  tabIconDefault: 'rgba(58,42,51,0.35)',
  tabIconSelected: '#FF6F91',
  // Sunset gradient stops (peach → pink → lavender).
  gradientStart: '#FFC9A9',
  gradientMid: '#FF8FA3',
  gradientEnd: '#C89BE0',
  // Map markers: yours = warm sunset pink, others = a cool teal so it's
  // instantly "me vs everyone else" (and distinct from the blue you-dot).
  pinMine: '#FF6F91',
  pinOther: '#13B5A3',
};

const dark = {
  text: '#FCEFF4',
  textMuted: 'rgba(252,239,244,0.60)',
  textSubtle: 'rgba(252,239,244,0.40)',
  background: '#191222', // deep plum night
  card: 'rgba(255,255,255,0.06)',
  cardHighlight: 'rgba(255,143,176,0.22)',
  border: 'rgba(255,255,255,0.12)',
  separator: 'rgba(255,255,255,0.08)',
  inputBackground: 'rgba(255,255,255,0.06)',
  inputText: '#FCEFF4',
  placeholder: 'rgba(252,239,244,0.40)',
  primary: '#FF8FB0',
  primaryText: '#2A1622', // dark plum reads crisp on the lighter pink
  secondaryButton: 'rgba(255,255,255,0.10)',
  danger: '#FF6B6B',
  walkingActive: '#9B86CC',
  overlay: 'rgba(25,18,34,0.95)',
  overlayText: '#fff',
  overlaySubtext: 'rgba(255,255,255,0.7)',
  tint: '#FF8FB0',
  tabIconDefault: 'rgba(252,239,244,0.40)',
  tabIconSelected: '#FF8FB0',
  gradientStart: '#E8A87C',
  gradientMid: '#D96A92',
  gradientEnd: '#9B7BC0',
  pinMine: '#FF8FB0',
  pinOther: '#3FD0C0',
};

export type ThemeColors = typeof light;

export default { light, dark };
