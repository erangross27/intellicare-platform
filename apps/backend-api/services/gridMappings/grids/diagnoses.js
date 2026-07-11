module.exports = {
  title: '📋 Diagnoses',
  columns: ['Date', 'Diagnosis', 'ICD Code', 'Provider', 'Status'],
  mapper: (entry) => ({
    'Date': entry.date ? new Date(entry.date).toLocaleDateString() : (entry.diagnosisDate ? new Date(entry.diagnosisDate).toLocaleDateString() : '-'),
    'Diagnosis': entry.diagnosis || entry.condition || '',
    'ICD Code': entry.icdCode || entry.code || '-',
    'Provider': entry.diagnosedBy || entry.provider || 'Provider',
    'Status': entry.status || 'Active'
  })
};
