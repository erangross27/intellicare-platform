import React from 'react';

/**
 * IntelliCare brand mark — the pulse / ECG tile from the landing page.
 * Reusable across sidebars, chat header, settings, etc.
 *
 * Props:
 *   size  — px (default 32)
 *   glow  — blue drop-shadow (default true)
 *   style — extra inline styles
 */
export default function PulseMark({ size = 32, glow = true, style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{
        display: 'block',
        filter: glow ? 'drop-shadow(0 4px 14px rgba(61,139,255,0.45))' : 'none',
        ...style,
      }}
    >
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#0A1020" stroke="#3D8BFF" strokeWidth="1.4" />
      <path
        d="M4 17 H10 L12.5 9 L16 24 L19 13 L21 17 H28"
        stroke="#3D8BFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
