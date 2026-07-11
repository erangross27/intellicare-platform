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
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : (entry.studyDate ? new Date(entry.studyDate).toLocaleDateString() : '-'),
      Type: getValue(entry.imagingType || entry.studyType || entry.type || entry.modality),
      'Body Part': getValue(entry.bodyPart || entry.anatomicRegion || entry.region),
      Findings: getValue(entry.findings || entry.impression || entry.result),
      Radiologist: getValue(entry.radiologist || entry.reader || entry.provider)
    }));
  }
};
