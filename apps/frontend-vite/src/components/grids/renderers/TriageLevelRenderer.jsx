import React from 'react';
import { Chip, Box, Typography, Tooltip } from '@mui/material';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import Warning from '@mui/icons-material/Warning';
import PriorityHigh from '@mui/icons-material/PriorityHigh';
import Info from '@mui/icons-material/Info';
import CheckCircle from '@mui/icons-material/CheckCircle';

const TriageLevelRenderer = ({ value }) => {
  if (!value && value !== 0) return '--';

  // Parse triage level (1-5 or ESI levels)
  const getTriageConfig = () => {
    const level = typeof value === 'number' ? value : parseInt(value);

    const triageMap = {
      1: {
        label: 'ESI 1 - RESUSCITATION',
        shortLabel: 'CRITICAL',
        color: '#b71c1c',
        backgroundColor: '#ffebee',
        icon: <ErrorOutline fontSize="small" />,
        description: 'Immediate life-saving intervention required',
        targetTime: 'Immediate',
        animation: true
      },
      2: {
        label: 'ESI 2 - EMERGENT',
        shortLabel: 'EMERGENT',
        color: '#d32f2f',
        backgroundColor: '#ffebee',
        icon: <Warning fontSize="small" />,
        description: 'High risk, severe pain, or altered mental status',
        targetTime: '10 minutes',
        animation: true
      },
      3: {
        label: 'ESI 3 - URGENT',
        shortLabel: 'URGENT',
        color: '#f57c00',
        backgroundColor: '#fff3e0',
        icon: <PriorityHigh fontSize="small" />,
        description: 'Stable, multiple resources needed',
        targetTime: '30 minutes'
      },
      4: {
        label: 'ESI 4 - LESS URGENT',
        shortLabel: 'SEMI-URGENT',
        color: '#388e3c',
        backgroundColor: '#e8f5e9',
        icon: <Info fontSize="small" />,
        description: 'Stable, single resource needed',
        targetTime: '60 minutes'
      },
      5: {
        label: 'ESI 5 - NON-URGENT',
        shortLabel: 'NON-URGENT',
        color: '#1976d2',
        backgroundColor: '#e3f2fd',
        icon: <CheckCircle fontSize="small" />,
        description: 'Stable, no resources needed',
        targetTime: '120 minutes'
      }
    };

    // Handle string values like "Critical", "Urgent", etc.
    if (typeof value === 'string') {
      const normalizedValue = value.toLowerCase();
      if (normalizedValue.includes('critical') || normalizedValue.includes('resus')) return triageMap[1];
      if (normalizedValue.includes('emergent')) return triageMap[2];
      if (normalizedValue.includes('urgent') && !normalizedValue.includes('non')) return triageMap[3];
      if (normalizedValue.includes('less') || normalizedValue.includes('semi')) return triageMap[4];
      if (normalizedValue.includes('non')) return triageMap[5];
    }

    return triageMap[level] || {
      label: `Level ${value}`,
      shortLabel: value.toString(),
      color: '#616161',
      backgroundColor: '#fafafa',
      icon: <Info fontSize="small" />,
      description: 'Unknown triage level',
      targetTime: 'N/A'
    };
  };

  const config = getTriageConfig();

  // Build tooltip content
  const tooltipContent = (
    <Box sx={{ p: 1, minWidth: 250 }}>
      <Typography variant="body2" sx={{ fontWeight: 'bold', color: config.color }}>
        {config.label}
      </Typography>

      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
        {config.description}
      </Typography>

      <Box sx={{ mt: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
          Target Time to Provider:
        </Typography>
        <Typography variant="caption" display="block" sx={{ color: config.color, fontWeight: 'bold' }}>
          {config.targetTime}
        </Typography>
      </Box>

      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
          ESI (Emergency Severity Index) Triage System
        </Typography>
      </Box>
    </Box>
  );

  const isHighPriority = [1, 2].includes(typeof value === 'number' ? value : parseInt(value));

  return (
    <Tooltip title={tooltipContent} placement="top">
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          p: 0.5,
          borderRadius: 1,
          backgroundColor: config.backgroundColor,
          border: `2px solid ${config.color}`,
          animation: config.animation ? 'emergency-pulse 1.5s infinite' : 'none',
          '@keyframes emergency-pulse': {
            '0%': {
              boxShadow: `0 0 0 0 ${config.color}80`
            },
            '50%': {
              boxShadow: `0 0 0 10px ${config.color}00`
            },
            '100%': {
              boxShadow: `0 0 0 0 ${config.color}00`
            }
          }
        }}
      >
        <Box sx={{ color: config.color, display: 'flex' }}>
          {config.icon}
        </Box>

        <Typography
          variant="body2"
          sx={{
            fontWeight: isHighPriority ? 'bold' : 'medium',
            color: config.color,
            fontSize: isHighPriority ? '0.9rem' : '0.875rem'
          }}
        >
          {config.shortLabel}
        </Typography>

        {isHighPriority && (
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: config.color,
              animation: 'blink 1s infinite',
              '@keyframes blink': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.3 }
              }
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
};

export default TriageLevelRenderer;