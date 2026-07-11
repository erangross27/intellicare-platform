// FHIR Standards Integration Services Barrel Export
module.exports = {
  FHIRService: require('./fhirService'),
  FHIRConverter: require('./fhirConverter'),
  FHIRValidator: require('./fhirValidator'),
  LabIntegrationService: require('./labIntegrationService'),
  PharmacyIntegrationService: require('./pharmacyIntegrationService')
};