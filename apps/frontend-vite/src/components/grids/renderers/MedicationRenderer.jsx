import React from 'react';
import { Box, Typography, Tooltip, Chip, Stack } from '@mui/material';
import LocalPharmacy from '@mui/icons-material/LocalPharmacy';
import Warning from '@mui/icons-material/Warning';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import Schedule from '@mui/icons-material/Schedule';
import Block from '@mui/icons-material/Block';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Medication from '@mui/icons-material/Medication';

const MedicationRenderer = ({
  value,
  genericName,
  brandName,
  dosage,
  frequency,
  isControlled,
  isHighAlert,
  interactions,
  status
}) => {
  if (!value) return '--';

  // Determine medication classification and warnings
  const getMedicationFlags = () => {
    const flags = [];

    if (isControlled) {
      flags.push({
        label: 'CONTROLLED',
        color: 'error',
        icon: <ErrorOutline fontSize="small" />,
        severity: 'high'
      });
    }

    if (isHighAlert) {
      flags.push({
        label: 'HIGH ALERT',
        color: 'warning',
        icon: <Warning fontSize="small" />,
        severity: 'high'
      });
    }

    if (interactions && interactions.length > 0) {
      flags.push({
        label: `${interactions.length} INTERACTIONS`,
        color: 'warning',
        icon: <Warning fontSize="small" />,
        severity: 'medium'
      });
    }

    // Check for specific drug categories
    const medication = value.toLowerCase();

    if (medication.includes('warfarin') || medication.includes('coumadin')) {
      flags.push({
        label: 'ANTICOAGULANT',
        color: 'error',
        icon: <Warning fontSize="small" />,
        severity: 'high'
      });
    }

    if (medication.includes('insulin')) {
      flags.push({
        label: 'INSULIN',
        color: 'warning',
        icon: <LocalPharmacy fontSize="small" />,
        severity: 'high'
      });
    }

    if (medication.includes('morphine') || medication.includes('oxycodone') ||
        medication.includes('fentanyl') || medication.includes('hydrocodone')) {
      flags.push({
        label: 'OPIOID',
        color: 'error',
        icon: <ErrorOutline fontSize="small" />,
        severity: 'high'
      });
    }

    return flags;
  };

  // Determine status configuration
  const getStatusConfig = () => {
    if (!status) return null;

    const normalizedStatus = status.toLowerCase();
    const statusMap = {
      'active': {
        color: 'success',
        icon: <CheckCircle fontSize="small" />,
        label: 'ACTIVE'
      },
      'discontinued': {
        color: 'error',
        icon: <Block fontSize="small" />,
        label: 'DISCONTINUED'
      },
      'on-hold': {
        color: 'warning',
        icon: <Schedule fontSize="small" />,
        label: 'ON HOLD'
      },
      'completed': {
        color: 'default',
        icon: <CheckCircle fontSize="small" />,
        label: 'COMPLETED'
      },
      'expired': {
        color: 'error',
        icon: <Block fontSize="small" />,
        label: 'EXPIRED'
      }
    };

    return statusMap[normalizedStatus];
  };

  const flags = getMedicationFlags();
  const statusConfig = getStatusConfig();
  const hasWarnings = flags.some(f => f.severity === 'high');

  // Format medication name with generic/brand
  const formatMedicationName = () => {
    if (genericName && brandName && genericName !== value) {
      return `${value} (${genericName} / ${brandName})`;
    }
    if (genericName && genericName !== value) {
      return `${value} (${genericName})`;
    }
    if (brandName && brandName !== value) {
      return `${value} (${brandName})`;
    }
    return value;
  };

  // Build tooltip content
  const tooltipContent = (
    <Box sx={{ p: 1, minWidth: 250 }}>
      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
        {formatMedicationName()}
      </Typography>

      {dosage && (
        <Typography variant="caption" display="block">
          Dosage: {dosage}
        </Typography>
      )}

      {frequency && (
        <Typography variant="caption" display="block">
          Frequency: {frequency}
        </Typography>
      )}

      {flags.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
            Warnings:
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
            {flags.map((flag, index) => (
              <Chip
                key={index}
                label={flag.label}
                size="small"
                color={flag.color}
                icon={flag.icon}
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {interactions && interactions.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
            Drug Interactions:
          </Typography>
          {interactions.slice(0, 3).map((interaction, index) => (
            <Typography key={index} variant="caption" display="block" sx={{ ml: 1 }}>
              • {interaction}
            </Typography>
          ))}
          {interactions.length > 3 && (
            <Typography variant="caption" display="block" sx={{ ml: 1, fontStyle: 'italic' }}>
              ...and {interactions.length - 3} more
            </Typography>
          )}
        </Box>
      )}
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
          backgroundColor: hasWarnings ? '#fff3e0' : 'transparent',
          border: hasWarnings ? '1px solid #ffb74d' : 'none',
          animation: hasWarnings ? 'glow 3s infinite' : 'none',
          '@keyframes glow': {
            '0%, 100%': {
              boxShadow: 'none'
            },
            '50%': {
              boxShadow: '0 0 8px rgba(255, 152, 0, 0.3)'
            }
          }
        }}
      >
        <Medication fontSize="small" sx={{ color: hasWarnings ? '#f57c00' : '#1976d2' }} />

        <Box sx={{ flex: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: hasWarnings ? 'medium' : 'normal',
              color: hasWarnings ? '#e65100' : 'inherit'
            }}
          >
            {value}
          </Typography>

          {dosage && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {dosage}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={0.5}>
          {/* Show priority flags inline */}
          {flags.filter(f => f.severity === 'high').slice(0, 2).map((flag, index) => (
            <Chip
              key={index}
              label={flag.label}
              size="small"
              color={flag.color}
              sx={{
                height: 18,
                fontSize: '0.65rem',
                '& .MuiChip-label': {
                  px: 0.5
                }
              }}
            />
          ))}

          {statusConfig && (
            <Chip
              label={statusConfig.label}
              icon={statusConfig.icon}
              size="small"
              color={statusConfig.color}
              sx={{
                height: 18,
                fontSize: '0.65rem',
                '& .MuiChip-label': {
                  px: 0.5
                }
              }}
            />
          )}
        </Stack>
      </Box>
    </Tooltip>
  );
};

export default MedicationRenderer;