import React from 'react';

// Professional briefcase-style close icon matching the IntelliCare design system
const CloseIcon = ({ size = 24, color = 'currentColor', className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" stroke={color} strokeWidth="2"/>
      <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2" stroke={color} strokeWidth="2"/>
      <rect x="8" y="2" width="8" height="3" rx="1" stroke={color} strokeWidth="2"/>
      <line x1="12" y1="11" x2="12" y2="17" stroke={color} strokeWidth="2"/>
      <line x1="9" y1="14" x2="15" y2="14" stroke={color} strokeWidth="2"/>
    </svg>
  );
};

export default CloseIcon;