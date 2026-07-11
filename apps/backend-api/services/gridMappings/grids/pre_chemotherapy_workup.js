module.exports = {
  title: '💊 Pre-Chemotherapy Workup',
  columns: ['Date', 'Labs', 'Imaging', 'Clearance', 'Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Labs: getValue(entry.labs || entry.labResults),
      Imaging: getValue(entry.imaging || entry.scans),
      Clearance: getValue(entry.clearance || entry.status),
      Oncologist: getValue(entry.oncologist || entry.provider)
    }));
  }
};
