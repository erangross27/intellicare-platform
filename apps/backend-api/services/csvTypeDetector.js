/**
 * CSV Type Detector
 * Detects whether a CSV is for patient import or user import by inspecting headers
 */

/**
 * Detect CSV type by analyzing headers
 * @param {Buffer|String} csvContent - CSV file content (encrypted or decrypted)
 * @param {Object} e2eEncryptionService - E2E encryption service instance
 * @param {String} userId - User ID for decryption
 * @returns {Promise<String>} - 'patients', 'users', or 'unknown'
 */
async function detectCSVType(encryptedPackage, e2eEncryptionService, userId) {
  try {
    // Decrypt the CSV to read headers (files are encrypted with service key, not user keys)
    const decryptedResult = await e2eEncryptionService.decryptWithServiceKey(encryptedPackage);

    const csvContent = Buffer.isBuffer(decryptedResult.data)
      ? decryptedResult.data.toString('utf-8')
      : decryptedResult.data;

    // Get first line (headers)
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      console.warn('⚠️ CSV has less than 2 lines - likely missing header row');
      return { type: 'error', error: 'missing_headers', message: 'CSV file must have a header row. Expected headers like: firstName, lastName, dateOfBirth, etc.' };
    }

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

    // Check if first line looks like data instead of headers (has numbers, special chars)
    const firstLine = lines[0];
    const looksLikeData = /\d{3}-\d{2}-\d{4}|^\d+,/.test(firstLine); // SSN pattern or starts with numbers

    if (looksLikeData) {
      console.warn('⚠️ CSV first line appears to be data, not headers:', firstLine.substring(0, 50));
      return {
        type: 'error',
        error: 'missing_headers',
        message: 'CSV file is missing header row. First line should be column names like:\nfirstName,lastName,dateOfBirth,socialSecurityNumber,phone,email,insuranceProvider\n\nInstead found data: ' + firstLine.substring(0, 80) + '...'
      };
    }

    // Patient CSV indicators
    const patientIndicators = [
      'firstname', 'lastname', 'dateofbirth', 'dob',
      'socialsecuritynumber', 'ssn', 'nationalid',
      'insuranceprovider', 'insurancenumber',
      'allergies', 'bloodtype', 'emergencycontact'
    ];

    // User CSV indicators
    const userIndicators = [
      'username', 'password', 'role', 'permissions',
      'department', 'employeeid', 'jobtitle',
      'hiredate', 'supervisor'
    ];

    // Count matches
    const patientMatches = headers.filter(h =>
      patientIndicators.some(indicator => h.includes(indicator))
    ).length;

    const userMatches = headers.filter(h =>
      userIndicators.some(indicator => h.includes(indicator))
    ).length;

    console.log(`📊 CSV header analysis: patientMatches=${patientMatches}, userMatches=${userMatches}`);
    console.log(`📊 Headers found: ${headers.join(', ')}`);

    // Determine type based on matches
    if (patientMatches >= 3) return { type: 'patients' };
    if (userMatches >= 2) return { type: 'users' };

    // Fallback: if has email + phone + address = likely patients
    const hasEmailPhone = headers.includes('email') && headers.includes('phone');
    const hasAddress = headers.some(h => h.includes('street') || h.includes('address') || h.includes('city'));
    if (hasEmailPhone && hasAddress) return { type: 'patients' };

    // Unknown type - provide helpful message
    return {
      type: 'error',
      error: 'unknown_csv_type',
      message: `Could not determine CSV type. Headers found: ${headers.join(', ')}\n\nFor patient CSV, include headers like: firstName, lastName, dateOfBirth, socialSecurityNumber, phone, email, insuranceProvider\n\nFor user CSV, include headers like: username, email, role, department`
    };

  } catch (error) {
    console.error('❌ CSV type detection failed:', error.message);
    return { type: 'error', error: 'detection_failed', message: 'Failed to read CSV file: ' + error.message };
  }
}

module.exports = {
  detectCSVType
};
