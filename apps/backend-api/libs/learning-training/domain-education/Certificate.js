/**
 * Certificate Entity
 * Represents completion certificates and credentials
 */

class Certificate {
  constructor({
    id,
    title,
    description,
    type, // completion, competency, continuing-education
    category, // medical, technical, compliance
    userId,
    userName,
    programId,
    programTitle,
    assessmentId,
    score,
    completionDate = new Date(),
    expirationDate,
    issuedBy,
    certificateNumber,
    verificationCode,
    digitalSignature,
    metadata = {},
    status = 'active', // active, expired, revoked
    createdAt = new Date()
  }) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.type = type;
    this.category = category;
    this.userId = userId;
    this.userName = userName;
    this.programId = programId;
    this.programTitle = programTitle;
    this.assessmentId = assessmentId;
    this.score = score;
    this.completionDate = completionDate;
    this.expirationDate = expirationDate;
    this.issuedBy = issuedBy;
    this.certificateNumber = certificateNumber || this.generateCertificateNumber();
    this.verificationCode = verificationCode || this.generateVerificationCode();
    this.digitalSignature = digitalSignature;
    this.metadata = metadata;
    this.status = status;
    this.createdAt = createdAt;
  }

  generateCertificateNumber() {
    const prefix = this.category?.substring(0, 3).toUpperCase() || 'CRT';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  generateVerificationCode() {
    return Math.random().toString(36).substr(2, 12).toUpperCase();
  }

  isValid() {
    if (this.status !== 'active') return false;
    if (this.expirationDate && new Date() > this.expirationDate) {
      this.status = 'expired';
      return false;
    }
    return true;
  }

  isExpired() {
    return this.expirationDate && new Date() > this.expirationDate;
  }

  isExpiringSoon(daysThreshold = 30) {
    if (!this.expirationDate) return false;
    
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntilExpiration = (this.expirationDate - new Date()) / msPerDay;
    
    return daysUntilExpiration <= daysThreshold && daysUntilExpiration > 0;
  }

  revoke(reason = 'Not specified') {
    this.status = 'revoked';
    this.metadata.revocationReason = reason;
    this.metadata.revokedAt = new Date();
    return this;
  }

  renew(newExpirationDate) {
    if (this.status === 'revoked') {
      throw new Error('Cannot renew revoked certificate');
    }
    
    this.expirationDate = newExpirationDate;
    this.status = 'active';
    this.metadata.renewedAt = new Date();
    return this;
  }

  getCreditHours() {
    return this.metadata.creditHours || 0;
  }

  setCreditHours(hours) {
    this.metadata.creditHours = hours;
    return this;
  }

  addContinuingEducationCredit(credit) {
    if (!this.metadata.continuingEducation) {
      this.metadata.continuingEducation = [];
    }
    this.metadata.continuingEducation.push({
      ...credit,
      addedAt: new Date()
    });
    return this;
  }

  getQRCodeData() {
    return {
      certificateNumber: this.certificateNumber,
      verificationCode: this.verificationCode,
      userId: this.userId,
      completionDate: this.completionDate.toISOString(),
      verificationUrl: `${process.env.BASE_URL}/verify-certificate/${this.verificationCode}`
    };
  }

  validate() {
    const errors = [];
    
    if (!this.title) errors.push('Title is required');
    if (!this.type) errors.push('Type is required');
    if (!this.category) errors.push('Category is required');
    if (!this.userId) errors.push('User ID is required');
    if (!this.userName) errors.push('User name is required');
    if (this.score !== undefined && (this.score < 0 || this.score > 100)) {
      errors.push('Score must be between 0 and 100');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = Certificate;