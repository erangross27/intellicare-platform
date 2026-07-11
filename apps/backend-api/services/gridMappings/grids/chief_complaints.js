module.exports = {
  title: '🤒 Chief Complaints',
  columns: ['Date', 'Complaint', 'Duration', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    // Remove duplicates based on complaint text and date
    const uniqueComplaints = new Map();
    categoryData.forEach(entry => {
      const complaintText = (entry.complaint || entry.chiefComplaint || entry.description || '').toLowerCase().trim();
      const dateStr = entry.date ? new Date(entry.date).toLocaleDateString() : '';
      const key = `${complaintText}_${dateStr}`;
      // Keep the entry with the most complete data (e.g., has provider info)
      if (key && complaintText && (!uniqueComplaints.has(key) ||
          (uniqueComplaints.get(key).provider === '' && entry.provider !== ''))) {
        uniqueComplaints.set(key, entry);
      }
    });

    return Array.from(uniqueComplaints.values()).map(entry => ({
      'Date': entry.date ? new Date(entry.date).toLocaleDateString() :
              (entry.reportedDate ? new Date(entry.reportedDate).toLocaleDateString() : '-'),
      'Complaint': getValue(entry.complaint || entry.chiefComplaint || entry.description),
      'Duration': getValue(entry.duration),
      'Provider': getValue(entry.provider || entry.reportedTo || entry.reportedBy, 'Intake')
    }));
  }
};
