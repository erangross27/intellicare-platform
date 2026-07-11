// Professional Typography System for IntelliCare Chat
// Clean, readable, medical-grade interface design

export const fontFamily = {
  primary: 'Comfortaa, Geneva, Tahoma, sans-serif',
  secondary: 'Comfortaa, Geneva, Tahoma, sans-serif',
  mono: 'Comfortaa, Geneva, Tahoma, sans-serif',
  medical: 'Comfortaa, Geneva, Tahoma, sans-serif'
};

export const fontSize = {
  // Headers
  h1: '24px',
  h2: '20px',
  h3: '18px',
  h4: '16px',
  h5: '15px',
  h6: '14px',

  // Body
  large: '17px',
  regular: '15px',
  small: '13px',
  tiny: '11px',

  // Special
  code: '13px',
  badge: '12px',
  caption: '12px'
};

export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700
};

export const lineHeight = {
  tight: 1.2,
  snug: 1.4,
  normal: 1.6,
  relaxed: 1.8,
  loose: 2.0
};

export const letterSpacing = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em'
};

export const colors = {
  // Primary text colors
  text: {
    primary: '#ffffff',
    secondary: '#e8eaf0',
    tertiary: '#a8a8b6',
    muted: '#93A2BE',
    inverse: '#1a1b26'
  },

  // Medical data colors
  medical: {
    normal: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
    info: '#3b82f6',
    success: '#22c55e'
  },

  // Background colors - Glassmorphism
  background: {
    primary: 'rgba(255, 255, 255, 0.08)',
    secondary: 'rgba(255, 255, 255, 0.05)',
    tertiary: 'rgba(167, 139, 250, 0.1)',
    elevated: 'rgba(255, 255, 255, 0.15)',
    overlay: 'rgba(0, 0, 0, 0.3)'
  },

  // Accent colors
  accent: {
    blue: '#60a5fa',
    purple: '#a78bfa',
    teal: '#2dd4bf',
    rose: '#fb7185',
    amber: '#fbbf24'
  },

  // Border colors
  border: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.15)',
    strong: 'rgba(255, 255, 255, 0.2)'
  }
};

// Text Styles Presets
export const textStyles = {
  // Headers
  h1: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
    color: colors.text.primary
  },
  h2: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.h2,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.tight,
    color: colors.text.primary
  },
  h3: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.h3,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    color: colors.text.primary
  },

  // Body text
  body: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.regular,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    color: colors.text.secondary
  },
  bodyLarge: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.large,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    color: colors.text.secondary
  },
  bodySmall: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.small,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    color: colors.text.tertiary
  },

  // Special text
  code: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.code,
    fontWeight: fontWeight.medium,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    color: colors.accent.blue,
    padding: '3px 6px',
    borderRadius: '4px',
    border: `1px solid ${colors.border.light}`
  },
  caption: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.snug,
    color: colors.text.muted
  },
  label: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase',
    color: colors.text.tertiary
  }
};

// Component-specific styles
export const componentStyles = {
  table: {
    header: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize.small,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      textTransform: 'uppercase',
      letterSpacing: letterSpacing.wider,
      backgroundColor: colors.background.tertiary,
      padding: '12px',
      borderBottom: `2px solid ${colors.border.medium}`
    },
    cell: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize.regular,
      fontWeight: fontWeight.regular,
      color: colors.text.secondary,
      padding: '10px 12px',
      borderBottom: `1px solid ${colors.border.light}`
    },
    monospace: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.small,
      letterSpacing: letterSpacing.wide
    }
  },

  list: {
    item: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize.regular,
      lineHeight: lineHeight.relaxed,
      color: colors.text.secondary,
      paddingLeft: '24px',
      position: 'relative'
    },
    bullet: {
      position: 'absolute',
      left: '0',
      color: colors.accent.blue,
      fontSize: '16px',
      fontWeight: fontWeight.semibold
    },
    number: {
      position: 'absolute',
      left: '0',
      color: colors.accent.blue,
      fontSize: fontSize.small,
      fontWeight: fontWeight.semibold,
      minWidth: '20px'
    }
  },

  card: {
    title: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize.h4,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: '8px'
    },
    subtitle: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize.small,
      fontWeight: fontWeight.regular,
      color: colors.text.tertiary,
      marginBottom: '12px'
    },
    content: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize.regular,
      lineHeight: lineHeight.normal,
      color: colors.text.secondary
    }
  },

  medical: {
    value: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.large,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.tight
    },
    unit: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize.small,
      fontWeight: fontWeight.regular,
      color: colors.text.tertiary,
      marginLeft: '4px'
    },
    range: {
      fontFamily: fontFamily.primary,
      fontSize: fontSize.small,
      color: colors.text.muted
    },
    status: {
      normal: {
        color: colors.medical.normal,
        fontWeight: fontWeight.medium
      },
      warning: {
        color: colors.medical.warning,
        fontWeight: fontWeight.medium
      },
      critical: {
        color: colors.medical.critical,
        fontWeight: fontWeight.semibold
      }
    }
  }
};

// Utility function to apply RTL styles
export const applyRTL = (styles, isRTL) => {
  if (!isRTL) return styles;

  const rtlStyles = { ...styles };

  // Swap left/right properties
  if (styles.marginLeft) {
    rtlStyles.marginRight = styles.marginLeft;
    delete rtlStyles.marginLeft;
  }
  if (styles.marginRight) {
    rtlStyles.marginLeft = styles.marginRight;
    delete rtlStyles.marginRight;
  }
  if (styles.paddingLeft) {
    rtlStyles.paddingRight = styles.paddingLeft;
    delete rtlStyles.paddingLeft;
  }
  if (styles.paddingRight) {
    rtlStyles.paddingLeft = styles.paddingRight;
    delete rtlStyles.paddingRight;
  }

  // Add RTL direction
  rtlStyles.direction = 'rtl';

  return rtlStyles;
};

export default {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  colors,
  textStyles,
  componentStyles,
  applyRTL
};