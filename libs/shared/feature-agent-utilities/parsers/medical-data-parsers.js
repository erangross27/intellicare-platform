// Medical Data Parser Utilities
// Provides medical data parsing utilities for AgentServiceV4

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class MedicalDataParsers {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('medical-data-parsers');
    }

    // Parse HL7 message (basic implementation)
    parseHL7Message(hl7String) {
        if (!hl7String) return null;
        
        const segments = hl7String.split('\r').filter(s => s.length > 0);
        const message = {
            messageType: null,
            segments: {},
            patient: {},
            observations: []
        };
        
        segments.forEach(segment => {
            const fields = segment.split('|');
            const segmentType = fields[0];
            
            switch (segmentType) {
                case 'MSH':
                    message.messageType = this.parseHL7MSH(fields);
                    break;
                case 'PID':
                    message.patient = this.parseHL7PID(fields);
                    break;
                case 'OBX':
                    message.observations.push(this.parseHL7OBX(fields));
                    break;
                default:
                    if (!message.segments[segmentType]) {
                        message.segments[segmentType] = [];
                    }
                    message.segments[segmentType].push(fields);
            }
        });
        
        return message;
    }

    // Parse MSH (Message Header) segment
    parseHL7MSH(fields) {
        return {
            fieldSeparator: fields[1],
            encodingChars: fields[2],
            sendingApplication: fields[3],
            sendingFacility: fields[4],
            receivingApplication: fields[5],
            receivingFacility: fields[6],
            timestamp: fields[7],
            messageType: fields[9]
        };
    }

    // Parse PID (Patient Identification) segment
    parseHL7PID(fields) {
        return {
            patientId: fields[3],
            name: this.parseHL7Name(fields[5]),
            dateOfBirth: fields[7],
            gender: fields[8],
            race: fields[10],
            address: this.parseHL7Address(fields[11])
        };
    }

    // Parse OBX (Observation/Result) segment
    parseHL7OBX(fields) {
        return {
            setId: fields[1],
            valueType: fields[2],
            observationId: fields[3],
            observationSubId: fields[4],
            observationValue: fields[5],
            units: fields[6],
            referenceRange: fields[7],
            abnormalFlags: fields[8],
            probability: fields[9],
            natureOfAbnormalTest: fields[10],
            observationResultStatus: fields[11],
            effectiveDate: fields[12],
            userDefinedAccessChecks: fields[13],
            dateTimeOfObservation: fields[14]
        };
    }

    // Parse HL7 name format
    parseHL7Name(nameString) {
        if (!nameString) return {};
        
        const parts = nameString.split('^');
        return {
            lastName: parts[0] || '',
            firstName: parts[1] || '',
            middleName: parts[2] || '',
            suffix: parts[3] || '',
            prefix: parts[4] || ''
        };
    }

    // Parse HL7 address format
    parseHL7Address(addressString) {
        if (!addressString) return {};
        
        const parts = addressString.split('^');
        return {
            streetAddress: parts[0] || '',
            otherDesignation: parts[1] || '',
            city: parts[2] || '',
            state: parts[3] || '',
            zipCode: parts[4] || '',
            country: parts[5] || ''
        };
    }

    // Parse FHIR resource
    parseFHIRResource(fhirJson) {
        if (!fhirJson || typeof fhirJson !== 'object') return null;
        
        const resource = {
            resourceType: fhirJson.resourceType,
            id: fhirJson.id,
            meta: fhirJson.meta
        };
        
        switch (fhirJson.resourceType) {
            case 'Patient':
                return this.parseFHIRPatient(fhirJson);
            case 'Observation':
                return this.parseFHIRObservation(fhirJson);
            case 'MedicationRequest':
                return this.parseFHIRMedicationRequest(fhirJson);
            case 'Condition':
                return this.parseFHIRCondition(fhirJson);
            default:
                return resource;
        }
    }

    // Parse FHIR Patient resource
    parseFHIRPatient(patient) {
        return {
            resourceType: 'Patient',
            id: patient.id,
            identifier: patient.identifier,
            active: patient.active,
            name: patient.name ? patient.name.map(n => ({
                use: n.use,
                family: n.family,
                given: n.given
            })) : [],
            telecom: patient.telecom,
            gender: patient.gender,
            birthDate: patient.birthDate,
            address: patient.address,
            maritalStatus: patient.maritalStatus,
            communication: patient.communication
        };
    }

    // Parse FHIR Observation resource
    parseFHIRObservation(observation) {
        return {
            resourceType: 'Observation',
            id: observation.id,
            status: observation.status,
            category: observation.category,
            code: observation.code,
            subject: observation.subject,
            effectiveDateTime: observation.effectiveDateTime,
            valueQuantity: observation.valueQuantity,
            valueCodeableConcept: observation.valueCodeableConcept,
            interpretation: observation.interpretation,
            referenceRange: observation.referenceRange
        };
    }

    // Parse FHIR MedicationRequest resource
    parseFHIRMedicationRequest(medicationRequest) {
        return {
            resourceType: 'MedicationRequest',
            id: medicationRequest.id,
            status: medicationRequest.status,
            intent: medicationRequest.intent,
            medicationCodeableConcept: medicationRequest.medicationCodeableConcept,
            subject: medicationRequest.subject,
            authoredOn: medicationRequest.authoredOn,
            requester: medicationRequest.requester,
            dosageInstruction: medicationRequest.dosageInstruction
        };
    }

    // Parse FHIR Condition resource
    parseFHIRCondition(condition) {
        return {
            resourceType: 'Condition',
            id: condition.id,
            clinicalStatus: condition.clinicalStatus,
            verificationStatus: condition.verificationStatus,
            category: condition.category,
            severity: condition.severity,
            code: condition.code,
            subject: condition.subject,
            onsetDateTime: condition.onsetDateTime,
            recordedDate: condition.recordedDate
        };
    }

    // Parse CDA document
    parseCDADocument(cdaXml) {
        // Basic CDA parsing - in production, use a proper XML parser
        const document = {
            title: this.extractXMLValue(cdaXml, 'title'),
            effectiveTime: this.extractXMLValue(cdaXml, 'effectiveTime'),
            confidentialityCode: this.extractXMLValue(cdaXml, 'confidentialityCode'),
            patient: this.extractCDAPatient(cdaXml),
            sections: this.extractCDASections(cdaXml)
        };
        
        return document;
    }

    // Extract value from XML
    extractXMLValue(xml, tagName) {
        const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
        const match = xml.match(regex);
        return match ? match[1] : null;
    }

    // Extract patient information from CDA
    extractCDAPatient(cdaXml) {
        // Simplified CDA patient extraction
        return {
            name: this.extractXMLValue(cdaXml, 'name'),
            birthTime: this.extractXMLValue(cdaXml, 'birthTime'),
            administrativeGenderCode: this.extractXMLValue(cdaXml, 'administrativeGenderCode'),
            addr: this.extractXMLValue(cdaXml, 'addr')
        };
    }

    // Extract sections from CDA
    extractCDASections(cdaXml) {
        const sections = [];
        const sectionRegex = /<section[^>]*>[\s\S]*?<\/section>/gi;
        const matches = cdaXml.match(sectionRegex) || [];
        
        matches.forEach(sectionXml => {
            sections.push({
                code: this.extractXMLValue(sectionXml, 'code'),
                title: this.extractXMLValue(sectionXml, 'title'),
                text: this.extractXMLValue(sectionXml, 'text')
            });
        });
        
        return sections;
    }
}

const medicalDataParsers = new MedicalDataParsers();

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('medicalDataParsers', () => medicalDataParsers);
}

module.exports = medicalDataParsers;