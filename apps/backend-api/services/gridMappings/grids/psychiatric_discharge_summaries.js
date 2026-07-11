module.exports = {
  title: '🧠 Psychiatric Discharge Summary',
  columns: ['Date', 'Admission Diagnosis', 'Treatment', 'Discharge Plan', 'Psychiatrist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Admission Diagnosis': getValue(entry.admissionDiagnosis || entry.diagnosis),
      Treatment: getValue(entry.treatment || entry.interventions),
      'Discharge Plan': getValue(entry.dischargePlan || entry.aftercarePlan),
      Psychiatrist: getValue(entry.psychiatrist || entry.provider)
    }));
  }
};
