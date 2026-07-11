import React from 'react';

const DateRenderer = ({ value, format = 'date', showRelative = false }) => {
  if (!value) return <span className="text-gray-400">--</span>;

  const date = new Date(value);
  if (isNaN(date.getTime())) return <span className="text-gray-400">--</span>;

  const formatDate = () => {
    const options = {
      date: {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      },
      time: {
        hour: '2-digit',
        minute: '2-digit'
      },
      datetime: {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }
    };

    return date.toLocaleString('en-US', options[format] || options.date);
  };

  const getRelativeTime = () => {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffSecs > 0) return `${diffSecs} second${diffSecs > 1 ? 's' : ''} ago`;
    return 'just now';
  };

  const formattedDate = formatDate();
  const relativeTime = showRelative ? getRelativeTime() : null;

  // Check if date is overdue (past dates for future appointments)
  const isOverdue = date < new Date() && format === 'date';

  if (showRelative && relativeTime) {
    return (
      <span
        className={`text-sm ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-900'}`}
        title={formattedDate}
      >
        {relativeTime}
      </span>
    );
  }

  return (
    <span
      className={`text-sm ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-900'}`}
    >
      {formattedDate}
    </span>
  );
};

export default DateRenderer;