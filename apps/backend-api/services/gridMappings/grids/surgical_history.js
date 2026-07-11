module.exports = {
  title: '🔪 Surgical History',
  columns: ['Date', 'Procedure', 'Surgeon', 'Indication', 'Outcome'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const formatDate = (dateVal) => {
      if (!dateVal) return '-';

      // Try to parse as date
      const parsed = new Date(dateVal);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString();
      }

      // If not a valid date, return as-is (e.g., "childhood", "2018", "unknown")
      return String(dateVal);
    };

    return categoryData.flatMap(entry => {
      // Check if this entry has a surgicalHistory array (from merged document data)
      if (entry.surgicalHistory && Array.isArray(entry.surgicalHistory)) {
        // Return mapped entries from the nested array
        return entry.surgicalHistory.map(surgery => ({ 'Date': formatDate(surgery.date || surgery.surgeryDate), 'Procedure': getValue(surgery.procedure || surgery.operation || surgery.surgeryType), 'Surgeon': getValue(surgery.surgeon || surgery.provider || surgery.operatingSurgeon), 'Indication': getValue(surgery.indication || surgery.reason), 'Outcome': getValue(surgery.outcome || surgery.result || surgery.complications || surgery.status)
        }));
      }

      // Handle nested procedure object: { 'Procedure': { 'Procedure': "X", Date: "Y"}}
      const proc = entry.procedure || {};
      const isNested = typeof proc === 'object' && proc !== null && !Array.isArray(proc) && Object.keys(proc).length > 0;

      return [{ 'Date': formatDate(isNested ? proc.date : (entry.date || entry.surgeryDate)), 'Procedure': getValue(isNested ? proc.procedure : (typeof entry.procedure === 'string' ? entry.procedure : (entry.operation || entry.surgeryType))), 'Surgeon': getValue(isNested ? proc.surgeon : (entry.surgeon || entry.provider || entry.operatingSurgeon)), 'Indication': getValue(isNested ? proc.indication : (entry.indication || entry.reason)), 'Outcome': getValue(isNested ? (proc.outcome || proc.complications) : (entry.outcome || entry.result || entry.status))
      }];
    });
  }
};
