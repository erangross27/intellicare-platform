import React from 'react';
import { Box, Typography, Tooltip, Chip } from '@mui/material';
import TrendingUp from '@mui/icons-material/TrendingUp';
import TrendingDown from '@mui/icons-material/TrendingDown';
import Warning from '@mui/icons-material/Warning';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import CheckCircle from '@mui/icons-material/CheckCircle';
import HorizontalRule from '@mui/icons-material/HorizontalRule';

const LabResultRenderer = ({ value, referenceRange, flag, previousValue, unit }) => {
  if (!value && value !== 0) return '--';

  // Parse reference range if provided as string
  const parseReferenceRange = (range) => {
    if (!range) return null;
    if (typeof range === 'object' && (range.min !== undefined || range.max !== undefined)) {
      return range;
    }
    // Parse string format "min-max" or "<max" or ">min"
    if (typeof range === 'string') {
      if (range.includes('-')) {
        const [min, max] = range.split('-').map(v => parseFloat(v.trim()));
        return { min, max };
      }
      if (range.startsWith('<')) {
        return { max: parseFloat(range.substring(1).trim()) };
      }
      if (range.startsWith('>')) {
        return { min: parseFloat(range.substring(1).trim()) };
      }
    }
    return null;
  };

  const range = parseReferenceRange(referenceRange);
  const numericValue = parseFloat(value);
  const isNumeric = !isNaN(numericValue);

  // Determine status based on flag or reference range
  const getStatus = () => {
    if (flag) {
      const normalizedFlag = flag.toUpperCase();
      if (normalizedFlag === 'HH' || normalizedFlag === 'CRITICAL HIGH') return 'critical-high';
      if (normalizedFlag === 'LL' || normalizedFlag === 'CRITICAL LOW') return 'critical-low';
      if (normalizedFlag === 'H' || normalizedFlag === 'HIGH') return 'high';
      if (normalizedFlag === 'L' || normalizedFlag === 'LOW') return 'low';
      if (normalizedFlag === 'A' || normalizedFlag === 'ABNORMAL') return 'abnormal';
      if (normalizedFlag === 'N' || normalizedFlag === 'NORMAL') return 'normal';
    }

    if (isNumeric && range) {
      // Check critical ranges (typically 20% beyond normal)
      const criticalMargin = 0.2;
      if (range.min !== undefined && range.max !== undefined) {
        const rangeSpan = range.max - range.min;
        const criticalLow = range.min - (rangeSpan * criticalMargin);
        const criticalHigh = range.max + (rangeSpan * criticalMargin);

        if (numericValue < criticalLow) return 'critical-low';
        if (numericValue > criticalHigh) return 'critical-high';
        if (numericValue < range.min) return 'low';
        if (numericValue > range.max) return 'high';
      } else if (range.min !== undefined && numericValue < range.min) {
        return 'low';
      } else if (range.max !== undefined && numericValue > range.max) {
        return 'high';
      }
    }

    return 'normal';
  };

  const status = getStatus();

  // Determine styling based on status
  const getStatusConfig = () => {
    switch (status) {
      case 'critical-high':
        return {
          color: '#d32f2f',
          backgroundColor: '#ffebee',
          icon: <ErrorOutline fontSize="small" sx={{ color: '#d32f2f' }} />,
          label: 'CRITICAL HIGH',
          fontWeight: 'bold',
          animation: true
        };
      case 'critical-low':
        return {
          color: '#d32f2f',
          backgroundColor: '#ffebee',
          icon: <ErrorOutline fontSize="small" sx={{ color: '#d32f2f' }} />,
          label: 'CRITICAL LOW',
          fontWeight: 'bold',
          animation: true
        };
      case 'high':
        return {
          color: '#f57c00',
          backgroundColor: '#fff3e0',
          icon: <TrendingUp fontSize="small" sx={{ color: '#f57c00' }} />,
          label: 'HIGH',
          fontWeight: 'medium'
        };
      case 'low':
        return {
          color: '#f57c00',
          backgroundColor: '#fff3e0',
          icon: <TrendingDown fontSize="small" sx={{ color: '#f57c00' }} />,
          label: 'LOW',
          fontWeight: 'medium'
        };
      case 'abnormal':
        return {
          color: '#ff9800',
          backgroundColor: '#fff3e0',
          icon: <Warning fontSize="small" sx={{ color: '#ff9800' }} />,
          label: 'ABNORMAL',
          fontWeight: 'medium'
        };
      case 'normal':
        return {
          color: '#2e7d32',
          backgroundColor: '#f1f8e9',
          icon: <CheckCircle fontSize="small" sx={{ color: '#2e7d32' }} />,
          label: 'NORMAL',
          fontWeight: 'normal'
        };
      default:
        return {
          color: '#616161',
          backgroundColor: '#fafafa',
          icon: <HorizontalRule fontSize="small" sx={{ color: '#616161' }} />,
          label: '',
          fontWeight: 'normal'
        };
    }
  };

  const config = getStatusConfig();

  // Calculate trend if previous value exists
  const getTrend = () => {
    if (!previousValue || !isNumeric) return null;
    const prevNumeric = parseFloat(previousValue);
    if (isNaN(prevNumeric)) return null;

    const diff = numericValue - prevNumeric;
    const percentChange = (diff / prevNumeric) * 100;

    return {
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable',
      amount: Math.abs(diff),
      percent: Math.abs(percentChange)
    };
  };

  const trend = getTrend();

  // Build tooltip content
  const tooltipContent = (
    <Box sx={{ p: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
        {value} {unit || ''}
      </Typography>
      {range && (
        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
          Reference: {range.min !== undefined ? range.min : ''}
          {range.min !== undefined && range.max !== undefined ? ' - ' : ''}
          {range.max !== undefined ? range.max : ''} {unit || ''}
        </Typography>
      )}
      {trend && (
        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
          {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
          {' '}{trend.amount.toFixed(2)} ({trend.percent.toFixed(1)}%) from previous
        </Typography>
      )}
      {config.label && (
        <Chip
          label={config.label}
          size="small"
          sx={{
            mt: 0.5,
            height: 20,
            backgroundColor: config.backgroundColor,
            color: config.color,
            fontWeight: config.fontWeight
          }}
        />
      )}
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} placement="top">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          p: 0.5,
          borderRadius: 1,
          backgroundColor: config.backgroundColor,
          animation: config.animation ? 'pulse 2s infinite' : 'none',
          '@keyframes pulse': {
            '0%': {
              boxShadow: `0 0 0 0 ${config.color}40`
            },
            '70%': {
              boxShadow: '0 0 0 6px rgba(0, 0, 0, 0)'
            },
            '100%': {
              boxShadow: '0 0 0 0 rgba(0, 0, 0, 0)'
            }
          }
        }}
      >
        {config.icon}
        <Typography
          variant="body2"
          sx={{
            color: config.color,
            fontWeight: config.fontWeight
          }}
        >
          {value}
        </Typography>
        {unit && (
          <Typography variant="caption" sx={{ color: config.color }}>
            {unit}
          </Typography>
        )}
        {trend && (
          <Typography
            variant="caption"
            sx={{
              ml: 0.5,
              color: trend.direction === 'up' ? '#f57c00' : trend.direction === 'down' ? '#1976d2' : '#616161'
            }}
          >
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};

export default LabResultRenderer;