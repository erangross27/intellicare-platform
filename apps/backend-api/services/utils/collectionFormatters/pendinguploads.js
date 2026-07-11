/**
 * Pending Uploads Formatter
 */
function formatDate(dateValue) {
  if (!dateValue) return 'Unknown date';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (err) {
    return 'Unknown date';
  }
}

module.exports = function formatPendingUpload(doc) {
  const lines = [];
  if (doc.uploadDate || doc.date) lines.push(`Upload Date: ${formatDate(doc.uploadDate || doc.date)}`);
  if (doc.filename || doc.name) lines.push(`Filename: ${doc.filename || doc.name}`);
  if (doc.fileType || doc.type) lines.push(`File Type: ${doc.fileType || doc.type}`);
  if (doc.fileSize) lines.push(`File Size: ${doc.fileSize}`);
  if (doc.status) lines.push(`Status: ${doc.status}`);
  if (doc.uploadedBy) lines.push(`Uploaded By: ${doc.uploadedBy}`);
  if (doc.notes) lines.push(`Notes: ${doc.notes}`);
  return lines.join('\n');
};
