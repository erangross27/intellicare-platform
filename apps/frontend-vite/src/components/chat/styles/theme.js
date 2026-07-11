/**
 * Professional dark grey theme configuration
 * Clean solid colors - NO transparency or glass morphism
 */

export const theme = {
  colors: {
    // Blue-dark "clinical instrument" theme — matches the landing page
    primary: '#060A14',
    secondary: '#0E1626',
    sidebar: '#0A1020',

    // Dark mode
    darkPrimary: '#0A1020',
    darkSecondary: '#121E33',

    // Text colors - solid only
    text: {
      primary: '#E9EFFA',
      secondary: '#B7C2D8',
      muted: '#93A2BE',
      white: '#E9EFFA'
    },

    // Message colors
    userMessage: {
      bg: '#0E1626',
      text: '#E9EFFA',
      border: '#28395C'
    },
    agentMessage: {
      bg: 'transparent',
      text: '#E9EFFA',
      border: 'none'
    },

    // UI elements
    border: '#1A2740',
    borderLight: '#28395C',
    hover: '#13203A',
    focus: '#3D8BFF',

    // Accents (blue)
    accent: '#3D8BFF',
    accentBright: '#74AEFF',

    // Actions
    action: '#121E33',
    actionHover: '#1B2C4A',
    danger: '#ef4444',
    dangerHover: '#dc2626',

    // Cost display
    cost: {
      bg: '#121E33',
      text: '#A9CDFF',
      border: '#28395C'
    }
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px'
  },

  borderRadius: {
    sm: '6px',
    md: '12px',
    lg: '16px',
    full: '9999px'
  },

  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '15px',
    lg: '16px',
    xl: '18px'
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },

  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 2px 4px 0 rgba(0, 0, 0, 0.3)',
    lg: '0 4px 8px 0 rgba(0, 0, 0, 0.3)',
    xl: '0 8px 16px 0 rgba(0, 0, 0, 0.3)'
  },

  transitions: {
    // Transitions removed for clean theme
    fast: 'none',
    base: 'none',
    slow: 'none'
  }
};

export default theme;
