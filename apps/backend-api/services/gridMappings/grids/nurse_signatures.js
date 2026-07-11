module.exports = {
  title: '✍️ Nurse Signatures',
  columns: ['Date', 'Shift', 'Nurse Name', 'License Number', 'Signature'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Shift: getValue(entry.shift || entry.shiftTime),
      'Nurse Name': getValue(entry.nurseName || entry.name),
      'License Number': getValue(entry.licenseNumber || entry.license),
      Signature: getValue(entry.signature || entry.signedBy)
    }));
  }
};
