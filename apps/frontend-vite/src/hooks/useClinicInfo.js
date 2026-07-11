import { useState, useEffect } from 'react';
import { authAPI } from '../services/apiMigration';
import { useAuth } from '../context/AuthContext';

export const useClinicInfo = () => {
  const { practice } = useAuth();
  const [practiceInfo, setPracticeInfo] = useState(practice || null);
  const [loading, setLoading] = useState(!practice);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If practice info is already available from auth context, use it
    if (practice) {
      setPracticeInfo(practice);
      setLoading(false);
      return;
    }

    // Otherwise fetch it from API
    const fetchClinicInfo = async () => {
      try {
        setLoading(true);
        const response = await authAPI.getCurrentUserAndPractice();
        if (response.data.success) {
          setPracticeInfo(response.data.practice);
        } else {
          setError('Failed to fetch practice information');
        }
      } catch (err) {
        process.env.NODE_ENV !== 'production' && console.error('Error fetching practice info:', err);
        setError('Failed to fetch practice information');
      } finally {
        setLoading(false);
      }
    };

    fetchClinicInfo();
  }, [practice]);

  return { practiceInfo, loading, error };
};

// Utility function to get patient ID configuration based on practice settings
export const getPatientIdConfig = (practiceInfo, t) => {
  const patientIdFormat = practiceInfo?.settings?.patientIdFormat || 'israeli_id';
  
  const configs = {
    israeli_id: {
      fieldName: 'nationalId',
      label: t('israeliId'),
      placeholder: '123456789',
      helpText: t('israeliIdHelp'),
      pattern: '[0-9]{9}',
      maxLength: 9,
      minLength: 9,
      inputMode: 'numeric',
      validator: (value) => /^\d{9}$/.test(value),
      formatter: (value) => value.replace(/\D/g, '').slice(0, 9)
    },
    us_ssn: {
      fieldName: 'nationalId',
      label: t('usSsn'),
      placeholder: '123-45-6789',
      helpText: t('usSsnHelp'),
      pattern: '[0-9]{3}-[0-9]{2}-[0-9]{4}',
      maxLength: 11,
      minLength: 11,
      inputMode: 'numeric',
      validator: (value) => /^\d{3}-\d{2}-\d{4}$/.test(value),
      formatter: (value) => {
        const digits = value.replace(/\D/g, '');
        if (digits.length <= 3) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
      }
    },
    ca_health: {
      fieldName: 'nationalId',
      label: t('canadianHealth'),
      placeholder: '1234567890',
      helpText: t('canadianHealthHelp'),
      pattern: '[0-9]{10}',
      maxLength: 10,
      minLength: 10,
      inputMode: 'numeric',
      validator: (value) => /^\d{10}$/.test(value),
      formatter: (value) => value.replace(/\D/g, '').slice(0, 10)
    },
    uk_nhs: {
      fieldName: 'nationalId',
      label: t('ukNhs'),
      placeholder: '123 456 7890',
      helpText: t('ukNhsHelp'),
      pattern: '[0-9]{3} [0-9]{3} [0-9]{4}',
      maxLength: 12,
      minLength: 12,
      inputMode: 'numeric',
      validator: (value) => /^\d{3} \d{3} \d{4}$/.test(value),
      formatter: (value) => {
        const digits = value.replace(/\D/g, '');
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
      }
    }
  };
  
  return configs[patientIdFormat] || configs.israeli_id;
};
