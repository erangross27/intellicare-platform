module.exports = {
  title: '🔬 Endocrine Lab Results',
  columns: ['Date', 'Test', 'Result', 'Reference Range', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Test: getValue(entry.test || entry.testName),
      Result: `${getValue(entry.result || entry.value)} ${getValue(entry.unit, '')}`.trim(),
      'Reference Range': getValue(entry.referenceRange || entry.normalRange),
      Status: entry.abnormalFlag ? '⚠️ Abnormal' : '✓ Normal'
    }));
  }
};
