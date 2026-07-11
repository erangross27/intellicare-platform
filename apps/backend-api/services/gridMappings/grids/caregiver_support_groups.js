module.exports = {
  title: '👥 Caregiver Support Groups',
  columns: ['Group Name', 'Schedule', 'Location', 'Contact', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Group Name': getValue(entry.groupName || entry.name),
      Schedule: getValue(entry.schedule || entry.meetingTime),
      Location: getValue(entry.location || entry.venue),
      Contact: getValue(entry.contact || entry.facilitator),
      Status: getValue(entry.status, 'Active')
    }));
  }
};
