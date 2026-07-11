import React from 'react';

const LinkRenderer = ({ value, onClick, linkTo, newTab = false }) => {
  if (!value) return <span className="text-gray-400">--</span>;

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick(value);
    } else if (linkTo && !newTab) {
      // Handle internal navigation
      window.location.href = linkTo;
    }
  };

  if (!onClick && !linkTo) {
    return <span className="text-sm text-gray-900">{value}</span>;
  }

  return (
    <a
      href={linkTo || '#'}
      onClick={handleClick}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
    >
      {value}
      {newTab && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      )}
    </a>
  );
};

export default LinkRenderer;