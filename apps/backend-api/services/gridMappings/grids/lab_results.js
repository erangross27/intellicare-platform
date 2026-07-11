module.exports = {
  title: '🧪 Lab Results',
  columns: ['Date', 'Test', 'Result', 'Reference', 'Status'],
  mapper: (entry) => ({
    'Date': entry.date ? new Date(entry.date).toLocaleDateString() : '',
    'Test': entry.testName || entry.name || 'Lab Test',
    'Result': `${entry.result || entry.value || ''} ${entry.unit || ''}`.trim(),
    'Reference': entry.referenceRange || '-',
    'Status': entry.abnormalFlag ? '⚠️ Abnormal' : '✓ Normal'
  })
};
