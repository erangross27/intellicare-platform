const fs = require('fs');
const path = require('path');

// Script to fix all audit logging calls in patients.js
function fixAuditLogging() {
  const filePath = path.join(__dirname, 'routes', 'patients.js');
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Pattern to match direct audit logging calls
    const auditPattern = /(\s+)\/\/ 🔒 SECURITY: Audit log for ([^\n]+)\n(\s+)await immutableAuditService\.logAction\(([^}]+}\s*}\s*}\s*);?\);/g;
    
    // Replace with try-catch wrapped version
    content = content.replace(auditPattern, (match, indent, description, indent2, logCall) => {
      return `${indent}// 🔒 SECURITY: Audit log for ${description} (optional)
${indent}try {
${indent}  if (immutableAuditService && typeof immutableAuditService.logAction === 'function') {
${indent}    await immutableAuditService.logAction(${logCall});
${indent}  }
${indent}} catch (auditError) {
${indent}  console.warn('⚠️ Audit logging failed (non-critical):', auditError.message);
${indent}}`;
    });
    
    // Write the fixed content back
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Fixed all audit logging calls in patients.js');
    
  } catch (error) {
    console.error('❌ Error fixing audit logging:', error.message);
  }
}

fixAuditLogging();
