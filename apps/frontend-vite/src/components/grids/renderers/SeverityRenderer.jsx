import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import Warning from '@mui/icons-material/Warning';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import ReportProblem from '@mui/icons-material/ReportProblem';
import Info from '@mui/icons-material/Info';
import CheckCircle from '@mui/icons-material/CheckCircle';

const SeverityRenderer = ({ value }) => {
  if (!value) return '--';

  const getSeverityConfig = (severity) => {
    const normalizedSeverity = severity.toLowerCase().replace(/\s+/g, '-');

    const severityMap = {
      // Life-threatening
      'life-threatening': {
        color: 'error',
        icon: <ErrorOutline fontSize="small" />,
        variant: 'filled',
        backgroundColor: '#d32f2f',
        tooltip: 'Life-threatening allergy - requires immediate attention'
      },
      'severe': {
        color: 'error',
        icon: <ReportProblem fontSize="small" />,
        variant: 'filled',
        backgroundColor: '#f44336',
        tooltip: 'Severe reaction possible'
      },
      'anaphylactic': {
        color: 'error',
        icon: <ErrorOutline fontSize="small" />,
        variant: 'filled',
        backgroundColor: '#b71c1c',
        tooltip: 'Anaphylactic reaction risk - CRITICAL'
      },

      // Moderate
      'moderate': {
        color: 'warning',
        icon: <Warning fontSize="small" />,
        variant: 'outlined',
        tooltip: 'Moderate reaction expected'
      },
      'moderate-to-severe': {
        color: 'warning',
        icon: <Warning fontSize="small" />,
        variant: 'filled',
        backgroundColor: '#ff9800',
        tooltip: 'Moderate to severe reaction possible'
      },

      // Mild
      'mild': {
        color: 'info',
        icon: <Info fontSize="small" />,
        variant: 'outlined',
        tooltip: 'Mild reaction only'
      },
      'minimal': {
        color: 'default',
        icon: <Info fontSize="small" />,
        variant: 'outlined',
        tooltip: 'Minimal reaction expected'
      },

      // Unknown/Not specified
      'unknown': {
        color: 'default',
        icon: null,
        variant: 'outlined',
        tooltip: 'Severity not determined'
      },
      'not-specified': {
        color: 'default',
        icon: null,
        variant: 'outlined',
        tooltip: 'Severity not specified'
      },

      // Resolved/Inactive
      'resolved': {
        color: 'success',
        icon: <CheckCircle fontSize="small" />,
        variant: 'outlined',
        tooltip: 'Allergy resolved or inactive'
      },

      // Default
      'default': {
        color: 'default',
        icon: null,
        variant: 'outlined',
        tooltip: value
      }
    };

    return severityMap[normalizedSeverity] || severityMap['default'];
  };

  const config = getSeverityConfig(value);
  const chipContent = (
    <Chip
      label={value.toUpperCase()}
      color={config.color}
      icon={config.icon}
      variant={config.variant}
      size="small"
      sx={{
        fontWeight: config.variant === 'filled' ? 'bold' : 'medium',
        minWidth: 100,
        backgroundColor: config.backgroundColor,
        '& .MuiChip-label': {
          color: config.variant === 'filled' ? '#fff' : undefined,
          fontSize: config.variant === 'filled' ? '0.75rem' : '0.7rem'
        },
        animation: ['life-threatening', 'anaphylactic', 'severe'].includes(
          value.toLowerCase().replace(/\s+/g, '-')
        )
          ? 'pulse 2s infinite'
          : 'none',
        '@keyframes pulse': {
          '0%': {
            boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.4)'
          },
          '70%': {
            boxShadow: '0 0 0 10px rgba(211, 47, 47, 0)'
          },
          '100%': {
            boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)'
          }
        }
      }}
    />
  );

  if (config.tooltip) {
    return (
      <Tooltip title={config.tooltip} placement="top">
        {chipContent}
      </Tooltip>
    );
  }

  return chipContent;
};

export default SeverityRenderer;