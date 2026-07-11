module.exports = {
  title: '📋 Administrative Data',
  columns: ['Type', 'Value', 'Date'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    // Flatten administrative fields into separate rows
    const rows = [];
    categoryData.forEach(entry => {
      // Get date from entry.date or _securityMetadata.createdAt or documentDate
      let date = '-';
      if (entry.date) {
        date = new Date(entry.date).toLocaleDateString();
      } else if (entry._securityMetadata && entry._securityMetadata.createdAt) {
        date = new Date(entry._securityMetadata.createdAt).toLocaleDateString();
      } else if (entry.documentDate) {
        date = new Date(entry.documentDate).toLocaleDateString();
      }

      // Add row for each administrative field that has data
      if (entry.mrn) {
        rows.push({ Type: 'Medical Record Number', Value: getValue(entry.mrn), Date: date });
      }
      if (entry.admissionDate) {
        rows.push({ Type: 'Admission Date', Value: new Date(entry.admissionDate).toLocaleDateString(), Date: date });
      }
      if (entry.dischargeDate) {
        rows.push({ Type: 'Discharge Date', Value: new Date(entry.dischargeDate).toLocaleDateString(), Date: date });
      }
      if (entry.disposition) {
        rows.push({ Type: 'Disposition', Value: getValue(entry.disposition), Date: date });
      }
      if (entry.insurance) {
        rows.push({ Type: 'Insurance', Value: getValue(entry.insurance), Date: date });
      }
      if (entry.facility) {
        rows.push({ Type: 'Facility', Value: getValue(entry.facility), Date: date });
      }

      // Fallback for non-standard format
      if (!entry.mrn && !entry.admissionDate && (entry.type || entry.category)) {
        rows.push({
          Type: getValue(entry.type || entry.category || entry.field),
          Value: getValue(entry.value || entry.data || entry.contact),
          Date: date
        });
      }
    });

    return rows;
  }
};
