// Medical Records Domain Models
// Core record entities: MedicalRecord, Document, LabResult, ImagingStudy, MedicalHistory

module.exports = {
  MedicalRecord: require('./MedicalRecord'),
  Document: require('./Document'), 
  LabResult: require('./LabResult'),
  ImagingStudy: require('./ImagingStudy'),
  MedicalHistory: require('./MedicalHistory')
};