// Centralized color palette. Every theme-aware screen reads from here
// via useThemeColors() (in components/Themed.tsx). Adding a new color?
// Add it to BOTH light and dark so the type stays in sync.

const brand = '#FF6B9D'; // Coral pink — accent color, same in both themes

const light = {
  text: '#000',
  textMuted: 'rgba(0,0,0,0.55)',
  textSubtle: 'rgba(0,0,0,0.4)',
  background: '#fff',
  card: 'rgba(0,0,0,0.04)',
  cardHighlight: 'rgba(255,107,157,0.18)',
  border: '#ccc',
  separator: '#eee',
  inputBackground: '#f7f7f7',
  inputText: '#000',
  placeholder: '#999',
  primary: brand,
  primaryText: '#fff',
  secondaryButton: 'rgba(0,0,0,0.07)',
  danger: '#c00',
  walkingActive: '#222',
  overlay: 'rgba(20,20,20,0.92)',
  overlayText: '#fff',
  overlaySubtext: '#bbb',
  tint: brand,
  tabIconDefault: '#bbb',
  tabIconSelected: brand,
};

const dark = {
  text: '#fff',
  textMuted: 'rgba(255,255,255,0.6)',
  textSubtle: 'rgba(255,255,255,0.4)',
  background: '#000',
  card: 'rgba(255,255,255,0.07)',
  cardHighlight: 'rgba(255,107,157,0.28)',
  border: '#333',
  separator: '#222',
  inputBackground: '#1a1a1a',
  inputText: '#fff',
  placeholder: '#666',
  primary: brand,
  primaryText: '#fff',
  secondaryButton: 'rgba(255,255,255,0.12)',
  danger: '#ff5555',
  walkingActive: '#444',
  overlay: 'rgba(30,30,30,0.95)',
  overlayText: '#fff',
  overlaySubtext: '#bbb',
  tint: brand,
  tabIconDefault: '#555',
  tabIconSelected: brand,
};

export type ThemeColors = typeof light;

export default { light, dark };
