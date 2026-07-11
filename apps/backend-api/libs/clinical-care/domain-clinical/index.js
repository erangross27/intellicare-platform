// Clinical Domain Models
// Core clinical entities: Diagnosis, Treatment, Prescription, ClinicalNote, MedicalProcedure

module.exports = {
  Diagnosis: require('./Diagnosis'),
  Treatment: require('./Treatment'),
  Prescription: require('./Prescription'),
  ClinicalNote: require('./ClinicalNote'),
  MedicalProcedure: require('./MedicalProcedure')
};