module.exports = {
  title: '🏠 Discharge Summaries',
  columns: ['Date', 'Admission Diagnosis', 'Discharge Diagnosis', 'Disposition', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Admission Diagnosis': getValue(entry.admissionDiagnosis || entry.admittingDiagnosis),
      'Discharge Diagnosis': getValue(entry.dischargeDiagnosis || entry.finalDiagnosis),
      Disposition: getValue(entry.disposition || entry.dischargeDisposition),
      Provider: getValue(entry.provider)
    }));
  }
};
