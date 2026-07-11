module.exports = {
  title: '📸 Imaging Reports',
  columns: ['Date', 'Type', 'Body Part', 'Findings', 'Radiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const formatFindings = (findings) => {
      if (!findings || findings === '-') return '-';

      const text = String(findings).trim();

      // Format with line breaks after commas for better readability
      // Replace ", " with ",\n" to put each finding on new line
      return text.replace(/,\s+/g, ',\n');
    };

    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Type': getValue(entry.imagingType || entry.modality || entry.type),
      'Body Part': getValue(entry.bodyPart || entry.location),
      Findings: formatFindings(entry.findings || entry.results),
      Radiologist: getValue(entry.radiologist || entry.provider)
    }));
  }
};
