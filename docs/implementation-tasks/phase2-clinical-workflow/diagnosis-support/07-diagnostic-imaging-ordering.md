# Diagnostic Imaging Ordering System

## Implementation Details
- **Service**: `diagnosticImagingOrderService.js`
- **Priority**: High | **Time**: 25-35 hours
- **Dependencies**: Imaging facilities, clinical guidelines, insurance authorization

## Objective
Streamlined diagnostic imaging ordering with clinical decision support, appropriate use criteria validation, insurance pre-authorization, and seamless integration with imaging facilities.

## Key Methods
```javascript
// Imaging order management
async createImagingOrder(orderData, clinicalIndication, context)
async validateAppropriateUse(imagingType, indication, context)
async checkInsuranceAuthorization(orderDetails, patientInsurance, context)
async scheduleImagingStudy(orderId, facilityPreferences, context)
async trackOrderStatus(orderId, context)
```

## API Endpoints
- `POST /imaging/orders` - Create new imaging order
- `PUT /imaging/orders/:id/validate` - Validate appropriate use criteria
- `POST /imaging/orders/:id/authorize` - Process insurance authorization
- `GET /imaging/orders/:id/schedule` - Schedule imaging appointment
- `GET /imaging/orders/:id/status` - Track order and result status

## Database Schema
**ImagingOrder**: `orderId`, `patientId`, `providerId`, `imagingType`, `indication`, `urgency`, `facilityId`, `authorizationStatus`, `scheduledDate`, `resultStatus`

## Key Features
1. **Clinical Decision Support** - Appropriate use criteria validation
2. **Insurance Integration** - Real-time pre-authorization processing
3. **Facility Integration** - Direct scheduling with imaging centers
4. **Order Tracking** - Real-time status updates from order to result
5. **Protocol Selection** - Automated imaging protocol recommendations
6. **Contrast Management** - Allergy screening and contrast protocols

## UI Components
- `ImagingOrderForm` - Structured imaging requisition interface
- `CriteriaValidator` - Appropriate use criteria checking
- `FacilitySelector` - Choose imaging facility with availability
- `AuthorizationTracker` - Insurance pre-authorization status
- `OrderStatusBoard` - Track all pending imaging orders

## Imaging Types Supported
**Plain Radiography:**
- Chest X-ray, extremity films
- Abdominal series, spine imaging

**Cross-Sectional Imaging:**
- CT scans (head, chest, abdomen, pelvis)
- MRI studies (brain, spine, joints)
- Ultrasound examinations

**Specialized Studies:**
- Nuclear medicine scans
- Interventional procedures
- Mammography and breast imaging

## Clinical Decision Support
- **Appropriate Use Criteria** - ACR/specialty society guidelines
- **Radiation Dose Tracking** - Monitor cumulative radiation exposure
- **Alternative Modality Suggestions** - Recommend optimal imaging approach
- **Urgent vs Routine Triage** - Priority-based scheduling

## Integration Points
- **RIS Systems** - Radiology Information System connectivity
- **Insurance Networks** - Real-time eligibility and authorization
- **Imaging Centers** - Direct facility scheduling integration
- **Result Delivery** - Automated result notification and import

## Authorization Workflows
1. **Real-Time Checking** - Instant authorization status verification
2. **Auto-Submission** - Automatic pre-authorization request submission
3. **Status Tracking** - Monitor authorization processing progress
4. **Appeal Support** - Streamlined authorization appeal process

## Success Criteria
- [ ] 95%+ appropriate use criteria compliance
- [ ] <24 hour average time for insurance pre-authorization
- [ ] Direct scheduling integration with 10+ imaging facilities
- [ ] Real-time order status tracking from request to result