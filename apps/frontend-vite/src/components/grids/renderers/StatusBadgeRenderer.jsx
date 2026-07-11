import React from 'react';

const StatusBadgeRenderer = ({ value }) => {
  if (!value) return <span className="text-gray-400">--</span>;

  const getStatusConfig = (status) => {
    const normalizedStatus = status.toLowerCase().replace(/\s+/g, '-');

    const statusMap = {
      // Appointment statuses
      'scheduled': { color: 'blue', icon: '📅', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
      'confirmed': { color: 'cyan', icon: '✓', bgColor: 'bg-cyan-100', textColor: 'text-cyan-800' },
      'in-progress': { color: 'yellow', icon: '⏳', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
      'completed': { color: 'green', icon: '✅', bgColor: 'bg-green-100', textColor: 'text-green-800' },
      'cancelled': { color: 'red', icon: '❌', bgColor: 'bg-red-100', textColor: 'text-red-800' },
      'no-show': { color: 'gray', icon: '🚫', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },

      // Medical record statuses
      'active': { color: 'green', icon: '✅', bgColor: 'bg-green-100', textColor: 'text-green-800' },
      'inactive': { color: 'gray', icon: '🚫', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
      'pending': { color: 'yellow', icon: '⏳', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
      'discontinued': { color: 'red', icon: '✖', bgColor: 'bg-red-100', textColor: 'text-red-800' },
      'expired': { color: 'red', icon: '⚠️', bgColor: 'bg-red-100', textColor: 'text-red-800' },

      // Lab/Test statuses
      'ordered': { color: 'blue', icon: '📋', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
      'collected': { color: 'cyan', icon: '🧪', bgColor: 'bg-cyan-100', textColor: 'text-cyan-800' },
      'in-process': { color: 'yellow', icon: '⏳', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
      'resulted': { color: 'green', icon: '📊', bgColor: 'bg-green-100', textColor: 'text-green-800' },
      'reviewed': { color: 'green', icon: '✅', bgColor: 'bg-green-100', textColor: 'text-green-800' },
      'abnormal': { color: 'red', icon: '⚠️', bgColor: 'bg-red-100', textColor: 'text-red-800' },

      // Emergency statuses
      'critical': { color: 'red', icon: '🚨', bgColor: 'bg-red-600', textColor: 'text-white', animate: true },
      'urgent': { color: 'orange', icon: '⚠️', bgColor: 'bg-orange-500', textColor: 'text-white', animate: true },
      'stable': { color: 'green', icon: '✅', bgColor: 'bg-green-100', textColor: 'text-green-800' },
      'admitted': { color: 'blue', icon: '🏥', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
      'discharged': { color: 'green', icon: '🏠', bgColor: 'bg-green-100', textColor: 'text-green-800' },
      'transferred': { color: 'yellow', icon: '🚑', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },

      // Default
      'default': { color: 'gray', icon: '', bgColor: 'bg-gray-100', textColor: 'text-gray-800' }
    };

    return statusMap[normalizedStatus] || statusMap['default'];
  };

  const config = getStatusConfig(value);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor} ${
        config.animate ? 'animate-pulse' : ''
      }`}
    >
      {config.icon && <span>{config.icon}</span>}
      <span>{value}</span>
    </span>
  );
};

export default StatusBadgeRenderer;