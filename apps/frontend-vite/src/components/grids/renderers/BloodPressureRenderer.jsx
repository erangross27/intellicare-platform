import React from 'react';
import { Box, Typography, Tooltip, Chip } from '@mui/material';
import TrendingUp from '@mui/icons-material/TrendingUp';
import TrendingDown from '@mui/icons-material/TrendingDown';
import Warning from '@mui/icons-material/Warning';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import CheckCircle from '@mui/icons-material/CheckCircle';

const BloodPressureRenderer = ({ value, systolic, diastolic, map, pulse }) => {
  // Handle different input formats
  let sys, dia;

  if (systolic && diastolic) {
    sys = systolic;
    dia = diastolic;
  } else if (value) {
    // Parse value string like "120/80"
    if (typeof value === 'string' && value.includes('/')) {
      [sys, dia] = value.split('/').map(v => parseInt(v.trim()));
    } else if (typeof value === 'object' && value.systolic && value.diastolic) {
      sys = value.systolic;
      dia = value.diastolic;
    }
  }

  if (!sys || !dia) return '--';

  // Categorize blood pressure according to AHA guidelines
  const getCategory = () => {
    if (sys < 90 || dia < 60) {
      return {
        label: 'HYPOTENSION',
        color: '#1976d2',
        severity: 'warning',
        icon: <TrendingDown fontSize="small" />,
        backgroundColor: '#e3f2fd'
      };
    }
    if (sys < 120 && dia < 80) {
      return {
        label: 'NORMAL',
        color: '#2e7d32',
        severity: 'normal',
        icon: <CheckCircle fontSize="small" />,
        backgroundColor: '#e8f5e9'
      };
    }
    if (sys < 130 && dia < 80) {
      return {
        label: 'ELEVATED',
        color: '#f57c00',
        severity: 'warning',
        icon: <TrendingUp fontSize="small" />,
        backgroundColor: '#fff3e0'
      };
    }
    if (sys < 140 || dia < 90) {
      return {
        label: 'STAGE 1 HTN',
        color: '#ff6f00',
        severity: 'warning',
        icon: <Warning fontSize="small" />,
        backgroundColor: '#fff3e0'
      };
    }
    if (sys < 180 && dia < 120) {
      return {
        label: 'STAGE 2 HTN',
        color: '#d84315',
        severity: 'high',
        icon: <Warning fontSize="small" />,
        backgroundColor: '#ffebee'
      };
    }
    // Hypertensive crisis
    return {
      label: 'CRISIS',
      color: '#b71c1c',
      severity: 'critical',
      icon: <ErrorOutline fontSize="small" />,
      backgroundColor: '#ffebee',
      animation: true
    };
  };

  const category = getCategory();

  // Calculate Mean Arterial Pressure if not provided
  const calculatedMap = map || Math.round(dia + (sys - dia) / 3);

  // Determine pulse pressure
  const pulsePressure = sys - dia;
  const widePulsePressure = pulsePressure > 60;
  const narrowPulsePressure = pulsePressure < 30;

  // Build tooltip content
  const tooltipContent = (
    <Box sx={{ p: 1, minWidth: 200 }}>
      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
        Blood Pressure: {sys}/{dia} mmHg
      </Typography>

      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
        Category: {category.label}
      </Typography>

      <Typography variant="caption" display="block">
        MAP: {calculatedMap} mmHg {calculatedMap < 65 && '(Low)'}
      </Typography>

      <Typography variant="caption" display="block">
        Pulse Pressure: {pulsePressure} mmHg
        {widePulsePressure && ' (Wide)'}
        {narrowPulsePressure && ' (Narrow)'}
      </Typography>

      {pulse && (
        <Typography variant="caption" display="block">
          Heart Rate: {pulse} bpm
        </Typography>
      )}

      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
          Normal: &lt;120/&lt;80 | Elevated: 120-129/&lt;80
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
          Stage 1: 130-139/80-89 | Stage 2: ≥140/≥90
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
          Crisis: ≥180/≥120
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} placement="top">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 0.5,
          borderRadius: 1,
          backgroundColor: category.backgroundColor,
          border: category.severity === 'critical' ? '2px solid' : '1px solid',
          borderColor: category.color + '40',
          animation: category.animation ? 'pulse 2s infinite' : 'none',
          '@keyframes pulse': {
            '0%': {
              boxShadow: `0 0 0 0 ${category.color}40`
            },
            '70%': {
              boxShadow: '0 0 0 8px rgba(0, 0, 0, 0)'
            },
            '100%': {
              boxShadow: '0 0 0 0 rgba(0, 0, 0, 0)'
            }
          }
        }}
      >
        <Box sx={{ color: category.color }}>
          {category.icon}
        </Box>

        <Typography
          variant="body2"
          sx={{
            fontWeight: category.severity === 'critical' ? 'bold' : 'medium',
            color: category.color
          }}
        >
          {sys}/{dia}
        </Typography>

        <Typography
          variant="caption"
          sx={{
            color: category.color,
            opacity: 0.8
          }}
        >
          mmHg
        </Typography>

        {category.severity !== 'normal' && (
          <Chip
            label={category.label}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.6rem',
              backgroundColor: category.color,
              color: '#fff',
              '& .MuiChip-label': {
                px: 0.5
              }
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
};

export default BloodPressureRenderer;