const { MongoClient } = require('mongodb');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellicare_global';

// Translation data
// AI Prompts for medical diagnosis
const aiPrompts = {
  en: {
    language: 'en',
    languageName: 'English',
    version: '1.0.0',
    category: 'ai_prompts',
    prompts: {
      diagnosis_with_confidence: `You are a medical expert. Provide comprehensive medical analysis for this patient:

Symptoms: {symptoms}
Age: {age}
Gender: {gender}
Medical History: {history}

Provide detailed analysis in this structure:

**SYMPTOM ANALYSIS:**
Analyze each symptom using numbered points:
1. [Symptom name]: [detailed medical analysis]
2. [Symptom name]: [detailed medical analysis]
3. [Symptom name]: [detailed medical analysis]

**MEDICAL ASSESSMENT:**
- Primary Diagnosis: [most likely condition]
- Differential Diagnoses: [other possible conditions]
- Risk Factors: [patient-specific risk factors]

**CLINICAL INSIGHTS:**
- Pathophysiology: [underlying medical mechanisms]
- Prognosis: [expected outcome]
- Complications: [potential complications]

**REQUIRED INVESTIGATIONS:**
- Laboratory Tests: [specific tests needed]
- Imaging Studies: [required imaging]
- Specialist Consultations: [referrals needed]

**MONITORING PLAN:**
- Vital Signs: [what to monitor]
- Follow-up Schedule: [when to reassess]
- Warning Signs: [red flags to watch for]

Confidence Level: [number]%
Risk Level: [LOW/MEDIUM/HIGH]

IMPORTANT: Please respond in English language.`,

      diagnosis_self_assess: `You are a medical expert. Analyze this patient case:

Symptoms: {symptoms}
Age: {age}
Gender: {gender}
Medical History: {history}

Analyze each symptom using numbered points like this:

1. Chest Pain: [your analysis]

2. Shortness of Breath: [your analysis]

3. Palpitations: [your analysis]

4. [Any other symptom]: [your analysis]

How sure are you from 1 to 100?

What is the risk level for this patient - LOW, MEDIUM, or HIGH?

Diagnostic Confidence: [number]%
Risk Level: [LOW/MEDIUM/HIGH]

IMPORTANT: Please respond in English language.`,

      recommendations: `Instruction: You are a medical expert. Based on the following patient information and diagnosis, provide specific treatment recommendations:

Patient Information:
Symptoms: {symptoms}
Age: {age}
Gender: {gender}
Medical History: {history}

Initial Diagnosis: {diagnosis}

Based on this diagnosis and patient information, provide detailed treatment recommendations. Focus ONLY on treatment recommendations, not on re-diagnosing the condition. Provide practical, actionable medical advice in plain text format.

IMPORTANT: Please respond in English language.`,

      // Medical Relevance Check - AI determines if document is medical
      medical_relevance_check: `You are a medical expert. Analyze this document and determine if it contains medical information.

Document: {documentText}

Return ONLY one word:
- MEDICAL (if document contains medical information, patient data, lab results, prescriptions, medical reports, hospital documents, doctor notes, etc.)
- NON_MEDICAL (if document is not medical - recipes, general documents, non-medical content, irrelevant files)

IMPORTANT: Please respond in English language.`,

      // Document Categorization - AI determines category
      document_categorization: `You are a medical expert. Analyze this medical document and return ONLY the category:

CATEGORIES:
- lab_results: Blood tests, urine tests, laboratory reports, pathology reports
- prescriptions: Medication prescriptions, pharmacy documents, drug prescriptions
- discharge_summary: Hospital discharge letters, release documents, discharge instructions
- imaging_reports: X-ray, MRI, CT scan, ultrasound reports, radiology reports
- consultation_notes: Doctor visit notes, consultation letters, medical consultations
- vaccination_records: Vaccination certificates, immunization records, vaccine documentation
- referrals: Medical referrals, specialist referrals, referral letters
- medical_certificate: Medical certificates, sick leave documents, fitness for work certificates
- medical_procedures: Medical procedure reports, colonoscopy, endoscopy, biopsy, surgery reports
- vaccination_records: Vaccination certificates, immunization records, vaccine documentation
- referrals: Medical referrals, specialist referrals, referral letters

Document text: {documentText}

Return ONLY the category name (example: lab_results)

IMPORTANT: Please respond in English language.`,

      // Lab Results Extraction - AI determines all relevant data
      lab_results_extraction: `You are a medical expert. Extract ALL relevant information from this lab report and return as structured data:

Document: {documentText}

Analyze this lab report and extract ALL relevant medical information. Return the data in a clear, structured format that includes:
- All test names and values
- Reference ranges and normal/abnormal status
- Dates and timing information
- Laboratory details
- Any clinical significance or abnormal findings
- Patient information if available
- Doctor or ordering physician details

Be comprehensive - extract everything medically relevant from this document. Organize the information logically.

IMPORTANT: Please respond in English language.`,

      // Prescription Extraction - AI determines all relevant data
      prescriptions_extraction: `You are a medical expert. Extract ALL relevant information from this prescription and return as structured data:

Document: {documentText}

Analyze this prescription document and extract ALL relevant medical information. Return the data in a clear, structured format that includes:
- All medications with complete details (names, dosages, frequencies, durations)
- Prescribing physician information
- Pharmacy details
- Prescription dates and refill information
- Special instructions or warnings
- Patient information if available
- Drug interactions or contraindications mentioned
- Any additional medical notes

Be comprehensive - extract everything medically relevant from this prescription document. Organize the information logically.

IMPORTANT: Please respond in English language.`,

      // Discharge Summary Extraction - AI determines all relevant data
      discharge_summary_extraction: `You are a medical expert. Extract ALL relevant information from this discharge summary and return as structured data:

Document: {documentText}

Analyze this discharge summary and extract ALL relevant medical information. Return the data in a clear, structured format that includes:
- Complete admission and discharge details (dates, reasons, duration)
- All procedures, surgeries, and treatments performed
- Final diagnoses and medical conditions
- Comprehensive discharge instructions and care plans
- All medications prescribed at discharge
- Follow-up appointments and referrals
- Patient condition and prognosis
- Any complications or special considerations
- Healthcare team involved

Be comprehensive - extract everything medically relevant from this discharge document. Organize the information logically.

IMPORTANT: Please respond in English language.`,

      // Imaging Reports Extraction - AI determines all relevant data
      imaging_reports_extraction: `You are a medical expert. Extract ALL relevant information from this imaging report and return as structured data:

Document: {documentText}

Analyze this imaging report and extract ALL relevant medical information. Return the data in a clear, structured format that includes:
- Complete study details (type, body parts, technique, contrast)
- All radiologist findings and observations
- Clinical impressions and diagnoses
- Comparison with previous studies if mentioned
- Recommendations for follow-up or additional imaging
- Radiologist and facility information
- Study dates and technical parameters
- Any abnormalities, pathology, or areas of concern
- Clinical correlation notes

Be comprehensive - extract everything medically relevant from this imaging report. Organize the information logically.

IMPORTANT: Please respond in English language.`,

      // Consultation Notes Extraction - AI determines all relevant data
      consultation_notes_extraction: `You are a medical expert. Extract ALL relevant information from this consultation note and return as structured data:

Document: {documentText}

Analyze this consultation note and extract ALL relevant medical information. Return the data in a clear, structured format that includes:
- Complete visit details (date, duration, type of consultation)
- Chief complaint and history of present illness
- Physical examination findings
- Assessment and clinical impressions
- Treatment plans and recommendations
- All medications prescribed or adjusted
- Follow-up plans and referrals
- Patient education provided
- Physician and facility information
- Any diagnostic tests ordered

Be comprehensive - extract everything medically relevant from this consultation. Organize the information logically.

IMPORTANT: Please respond in English language.`,

      // Vaccination Records Extraction - AI determines all relevant data
      vaccination_records_extraction: `You are a medical expert. Extract structured information from this vaccination record:

Document: {documentText}

Extract and return the data in this EXACT format:

DATE: [Vaccination date in DD/MM/YYYY HH:MM format if time available, or DD/MM/YYYY if only date - search entire document for ANY time information and include it here]
DIAGNOSIS: [Types of vaccines administered - vaccine name, dose number]
SYMPTOMS: [Batch numbers, administration location, vaccination details]
TREATMENT: [Next vaccination required, adverse reactions, follow-up instructions]
NOTES: [Doctor/nurse details, certificate number, additional information]

Example format:
DIAGNOSIS: COVID-19 vaccine third dose, seasonal flu vaccine
SYMPTOMS: Date: 15/01/2025, Batch: ABC123, Location: General Health Fund
TREATMENT: Next vaccination in 6 months, no adverse reactions
NOTES: Doctor: Dr. Cohen, Vaccination certificate: 123456789

Be comprehensive - extract everything medically relevant from this vaccination record. Organize the information logically.

IMPORTANT: Please respond in English language.`,

      // Referrals Extraction - AI determines all relevant data
      referrals_extraction: `You are a medical expert. Extract ALL relevant information from this referral document and return as structured data:

Document: {documentText}

Analyze this referral document and extract ALL relevant medical information. Return the data in a clear, structured format that includes:
- Referring physician details
- Specialist or department being referred to
- Reason for referral and medical indication
- Patient information and medical history
- Urgency level and appointment details
- Insurance and authorization information
- Any specific instructions or requirements

Be comprehensive - extract everything medically relevant from this referral document. Organize the information logically.

IMPORTANT: Please respond in English language.`,

      // Medical Certificate Extraction - AI determines all relevant data
      medical_certificate_extraction: `You are a medical expert. Extract information from this medical certificate and organize it for medical records:

Document: {documentText}

Extract and return the data in this EXACT format:

DATE_VALUE: [Certificate issue date in DD/MM/YYYY HH:MM format if time available, or DD/MM/YYYY if only date - extract from document]
DIAGNOSIS_VALUE: [The medical condition or reason for the certificate - if not specified, use 'Medical Certificate']
SYMPTOMS_VALUE: [Work limitations, restrictions, or inability to work - extract from limitations/restrictions section]
TREATMENT_VALUE: [Treatment recommendations, medical instructions, or follow-up care - if none specified, use 'Not specified in document']
NOTES: [Administrative details: illness period dates, doctor name, certificate validity, patient details]

Example format:
DIAGNOSIS: Medical Certificate
SYMPTOMS: Unable to work
TREATMENT: Rest and follow-up as needed
NOTES: Illness period: 07/05/2025 to 09/05/2025 - Doctor: Dr. Smith

IMPORTANT: Please respond in English language.`,

      // Medical Procedures Extraction - AI determines all relevant data
      medical_procedures_extraction: `You are a medical expert. Extract comprehensive structured information from this medical procedure report:

Document: {documentText}

Extract and return the data in this EXACT format:

DATE_VALUE: [Procedure date in DD/MM/YYYY HH:MM format if time available, or DD/MM/YYYY if only date - search entire document including "report date", "procedure time", "examination time" - if ANY time exists in document, include it here]
DIAGNOSIS_VALUE: [Specific procedure name and type - colonoscopy, upper endoscopy, cardiac catheterization, biopsy, surgical procedure, etc. Include anatomical area examined]
SYMPTOMS_VALUE: [Detailed findings in plain text - pathological results, measurements, tissue samples, abnormalities detected, procedure success/complications. Do not use bullets or formatting]
TREATMENT_VALUE: [Post-procedure care instructions in plain text - prescribed medications, dietary restrictions, activity limitations, wound care, follow-up schedule. Do not use bullets or formatting]
NOTES_VALUE: [Complete procedure details in plain text - performing physician, medical facility, anesthesia used, procedure duration, equipment used, patient preparation, discharge status. Do not use bullets or formatting. DO NOT include dates or times here, put ALL dates/times in DATE_VALUE only]

Example format:
DIAGNOSIS: Diagnostic colonoscopy with polypectomy - complete examination of colon and rectum
SYMPTOMS: 2 small polyps removed from sigmoid colon (5mm and 3mm), normal mucosa elsewhere, mild inflammation in rectum, excellent bowel preparation
TREATMENT: Clear liquids today, regular diet tomorrow, avoid NSAIDs for 1 week, follow-up in 3 months for biopsy results
NOTES: Date: 12/02/2025 10:30 AM - Dr. Smith (Gastroenterology) - Outpatient Endoscopy Center - Conscious sedation with midazolam - 45 minutes duration - Olympus colonoscope - Patient discharged stable

Be extremely comprehensive - extract ALL medical details, measurements, findings, and procedural information from this report.

IMPORTANT: Please respond in English language.`
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  he: {
    language: 'he',
    languageName: 'עברית',
    version: '1.0.0',
    category: 'ai_prompts',
    prompts: {
      diagnosis_with_confidence: `אתה רופא מומחה. ספק ניתוח רפואי מקיף למטופל הזה:

תסמינים: {symptoms}
גיל: {age}
מין: {gender}
היסטוריה רפואית: {history}

ספק ניתוח מפורט במבנה הזה:

**ניתוח תסמינים:**
נתח כל תסמין באמצעות נקודות ממוספרות:
1. [שם התסמין]: [ניתוח רפואי מפורט]
2. [שם התסמין]: [ניתוח רפואי מפורט]
3. [שם התסמין]: [ניתוח רפואי מפורט]

**הערכה רפואית:**
- אבחנה ראשית: [המצב הסביר ביותר]
- אבחנות מבדלות: [מצבים אפשריים אחרים]
- גורמי סיכון: [גורמי סיכון ספציפיים למטופל]

**תובנות קליניות:**
- פתופיזיולוגיה: [מנגנונים רפואיים בסיסיים]
- פרוגנוזה: [תוצאה צפויה]
- סיבוכים: [סיבוכים אפשריים]

**בדיקות נדרשות:**
- בדיקות מעבדה: [בדיקות ספציפיות נדרשות]
- בדיקות הדמיה: [הדמיה נדרשת]
- ייעוצי מומחים: [הפניות נדרשות]

**תוכנית מעקב:**
- סימנים חיוניים: [מה לעקוב אחריו]
- לוח זמנים למעקב: [מתי להעריך מחדש]
- סימני אזהרה: [דגלים אדומים לשים לב אליהם]

רמת ביטחון: [מספר]%
רמת סיכון: [נמוכה/בינונית/גבוהה]

חשוב: ענה בעברית בלבד.`,

      diagnosis_self_assess: `אתה רופא מומחה. נתח את המקרה הרפואי הבא:

תסמינים: {symptoms}
גיל: {age}
מין: {gender}
היסטוריה רפואית: {history}

נתח כל תסמין באמצעות נקודות ממוספרות כמו זה:

1. כאבי חזה: [הניתוח שלך]

2. קוצר נשימה: [הניתוח שלך]

3. דפיקות לב: [הניתוח שלך]

4. [כל תסמין אחר]: [הניתוח שלך]

עד כמה אתה בטוח מ-1 עד 100?

מה רמת הסיכון למטופל זה - נמוכה, בינונית, או גבוהה?

רמת ביטחון באבחון: [מספר]%
רמת סיכון: [נמוכה/בינונית/גבוהה]

חשוב: ענה בעברית בלבד.`,

      recommendations: `אתה רופא מומחה. על בסיס האבחנה הבאה, ספק המלצות טיפול מובנות:

מידע על המטופל:
תסמינים: {symptoms}
גיל: {age}
מין: {gender}
היסטוריה רפואית: {history}

אבחנה ראשונית: {diagnosis}

ספק המלצות טיפול בפורמט הבא:

**המלצות טיפול מיידיות:**

1. **טיפול תרופתי:**
   - תרופות מומלצות: [פירוט תרופות ומינונים]
   - משך הטיפול: [זמן מומלץ]

2. **שינויי אורח חיים:**
   - תזונה: [המלצות תזונתיות ספציפיות]
   - פעילות גופנית: [סוג ועצימות מומלצים]
   - הרגלי שינה: [המלצות לשיפור השינה]

3. **מעקב רפואי:**
   - בדיקות נדרשות: [בדיקות מעבדה והדמיה]
   - תדירות ביקורים: [לוח זמנים למעקב]

**אזהרות חשובות:**
[סימני אזהרה שדורשים פנייה מיידית לרופא]

**המלצות נוספות:**
[עצות כלליות לשיפור המצב]`,

      // בדיקת רלוונטיות רפואית - הבינה המלאכותית קובעת אם המסמך רפואי
      medical_relevance_check: `אתה רופא מומחה. נתח את המסמך הזה וקבע אם הוא מכיל מידע רפואי.

מסמך: {documentText}

החזר רק את התשובה:
- MEDICAL (אם המסמך מכיל מידע רפואי, נתוני מטופל, תוצאות בדיקות, מרשמים, דוחות רפואיים, מסמכי בית חולים, רשומות רופא וכו')
- NON_MEDICAL (אם המסמך אינו רפואי - מתכונים, מסמכים כלליים, תוכן לא רפואי, קבצים לא רלוונטיים)

חשוב: ענה בעברית בלבד.`,

      // קטלוג מסמכים - זיהוי קטגוריה פשוט
      document_categorization: `אתה רופא מומחה. נתח את המסמך הרפואי הזה והחזר רק את הקטגוריה:

קטגוריות:
- lab_results: בדיקות דם, בדיקות שתן, דוחות מעבדה, דוחות פתולוגיה
- prescriptions: מרשמי תרופות, מסמכי בית מרקחת, רישום תרופות
- discharge_summary: מכתבי שחרור מבית חולים, מסמכי שחרור, הוראות שחרור
- imaging_reports: דוחות צילום, MRI, CT, אולטרסאונד, דוחות רדיולוגיה
- consultation_notes: רשומות ביקור רופא, מכתבי ייעוץ, ייעוצים רפואיים
- vaccination_records: אישורי חיסונים, רשומות חיסונים, תיעוד חיסונים
- referrals: הפניות רפואיות, הפניות למומחים, מכתבי הפניה
- medical_certificate: אישורי מחלה, אישורי מחלה לעבודה, אישורי כושר לעבודה
- medical_procedures: דוחות פרוצדורות רפואיות, קולונוסקופיה, אנדוסקופיה, ביופסיה, דוחות ניתוחים

טקסט המסמך: {documentText}

החזר רק את שם הקטגוריה (דוגמה: lab_results)

חשוב: ענה בעברית בלבד.`,

      // חילוץ תוצאות מעבדה - הבינה המלאכותית קובעת את כל הנתונים הרלוונטיים
      lab_results_extraction: `אתה מומחה רפואי. חלץ מידע מובנה מדוח המעבדה הזה:

מסמך: {documentText}

חלץ והחזר את הנתונים בפורמט המדויק הזה:

DATE_VALUE: [תאריך הבדיקה בפורמט DD/MM/YYYY HH:MM אם זמן זמין, או DD/MM/YYYY אם רק תאריך - חלץ מהמסמך]
DIAGNOSIS_VALUE: [סוגי הבדיקות שבוצעו - בדיקות דם, שתן, כימיה קלינית וכו']
SYMPTOMS_VALUE: [תוצאות הבדיקות, ערכים חריגים, ממצאים חשובים]
TREATMENT_VALUE: [המלצות רפואיות, בדיקות נוספות נדרשות, מעקב]
NOTES_VALUE: [מעבדה, רופא מפנה, טווחי ערכים תקינים]

דוגמה לפורמט:
אבחנה: בדיקות דם כלליות, כימיה קלינית
תסמינים: המוגלובין נמוך 10.5, כולסטרול גבוה 250, סוכר תקין 95
טיפול: המלצה לבדיקת ברזל, ייעוץ תזונתי, מעקב בעוד 3 חודשים
הערות: תאריך: 15/01/2025, מעבדה: מכבי, רופא: ד"ר כהן

היה מקיף - חלץ כל מה שרלוונטי רפואית מדוח המעבדה הזה. ארגן את המידע בצורה לוגית.

חשוב: ענה בעברית בלבד.`,

      // חילוץ מרשמים
      prescriptions_extraction: `אתה מומחה רפואי. חלץ מידע מובנה מהמרשם הזה:

מסמך: {documentText}

חלץ והחזר את הנתונים בפורמט המדויק הזה:

DATE_VALUE: [תאריך המרשם בפורמט DD/MM/YYYY HH:MM אם זמן זמין, או DD/MM/YYYY אם רק תאריך - חלץ מהמסמך]
DIAGNOSIS_VALUE: [שמות התרופות שנרשמו - תרופה 1, תרופה 2 וכו']
SYMPTOMS_VALUE: [מינונים, תדירות נטילה, משך הטיפול]
TREATMENT_VALUE: [הוראות נטילה, אזהרות, מעקב נדרש]
NOTES_VALUE: [רופא רושם, בית מרקחת, הערות מיוחדות]

דוגמה לפורמט:
אבחנה: אמוקסיצילין 500 מ"ג, פרצטמול 1000 מ"ג
תסמינים: אמוקסיצילין 3 פעמים ליום למשך 7 ימים, פרצטמול לפי הצורך
טיפול: ליטול עם אוכל, להשלים את כל המנות, להימנע מאלכוהול
הערות: רופא: ד"ר כהן, תאריך: 15/01/2025, בית מרקחת: סופר-פארם

היה מקיף - חלץ כל מה שרלוונטי רפואית מהמרשם הזה. ארגן את המידע בצורה לוגית.

חשוב: ענה בעברית בלבד.`,

      // חילוץ מכתב שחרור
      discharge_summary_extraction: `אתה מומחה רפואי. חלץ מידע מובנה ממכתב השחרור הזה:

מסמך: {documentText}

חלץ והחזר את הנתונים בפורמט המדויק הזה:

DATE_VALUE: [תאריך השחרור בפורמט DD/MM/YYYY HH:MM אם זמן זמין, או DD/MM/YYYY אם רק תאריך - חלץ מהמסמך]
DIAGNOSIS_VALUE: [אבחנה סופית, סיבת האשפוז, פרוצדורות שבוצעו]
SYMPTOMS_VALUE: [מצב המטופל בשחרור, ממצאים, שיפור/החמרה]
TREATMENT_VALUE: [הוראות שחרור, תרופות, מעקב נדרש, הגבלות]
NOTES_VALUE: [תאריכי אשפוז, רופא מטפל, מחלקה, תורים למעקב]

דוגמה לפורמט:
אבחנה: דלקת ריאות, טיפול אנטיביוטי, ניקוז נוזלים
תסמינים: שיפור במצב הנשימה, חום ירד, כאבי חזה פחתו
טיפול: המשך אנטיביוטיקה למשך 7 ימים, מנוחה, שתיית נוזלים
הערות: אשפוז: 10-15/01/2025, רופא: ד"ר כהן, מחלקה פנימית, מעקב בעוד שבוע

היה מקיף - חלץ כל מה שרלוונטי רפואית ממכתב השחרור הזה. ארגן את המידע בצורה לוגית.

חשוב: ענה בעברית בלבד.`,

      // חילוץ דוחות הדמיה
      imaging_reports_extraction: `אתה מומחה רפואי. חלץ מידע מובנה מדוח ההדמיה הזה:

מסמך: {documentText}

חלץ והחזר את הנתונים בפורמט המדויק הזה:

DATE_VALUE: [תאריך הבדיקה בפורמט DD/MM/YYYY HH:MM אם זמן זמין, או DD/MM/YYYY אם רק תאריך - חלץ מהמסמך]
DIAGNOSIS_VALUE: [סוג הבדיקה שבוצעה - רנטגן, MRI, CT, אולטרסאונד וכו']
SYMPTOMS_VALUE: [ממצאי ההדמיה, חריגות שנמצאו, תיאור הממצאים]
TREATMENT_VALUE: [המלצות רדיולוג, מעקב נדרש, בדיקות נוספות]
NOTES_VALUE: [איבר שנבדק, רדיולוג, מקום הבדיקה]

דוגמה לפורמט:
אבחנה: צילום רנטגן חזה, בדיקת CT בטן
תסמינים: ריאות נקיות, כתם חשוד בכבד בגודל 2 ס"מ
טיפול: המלצה לבדיקת MRI כבד, מעקב בעוד חודש
הערות: תאריך: 15/01/2025, רדיולוג: ד"ר לוי, בית חולים הדסה

היה מקיף - חלץ כל מה שרלוונטי רפואית מדוח ההדמיה הזה. ארגן את המידע בצורה לוגית.

חשוב: ענה בעברית בלבד.`,

      // חילוץ רשומות ייעוץ
      consultation_notes_extraction: `אתה מומחה רפואי. חלץ מידע מובנה מרשומת הייעוץ הזו:

מסמך: {documentText}

חלץ והחזר את הנתונים בפורמט המדויק הזה:

DATE_VALUE: [תאריך הביקור בפורמט DD/MM/YYYY HH:MM אם זמן זמין, או DD/MM/YYYY אם רק תאריך - חלץ מהמסמך]
DIAGNOSIS_VALUE: [אבחנה רפואית, מצב המטופל, הערכת הרופא]
SYMPTOMS_VALUE: [תלונות המטופל, סימנים קליניים, ממצאי בדיקה]
TREATMENT_VALUE: [תוכנית טיפול, תרופות שנרשמו, הוראות]
NOTES_VALUE: [רופא מייעץ, מעקב נדרש, הערות נוספות]

דוגמה לפורמט:
אבחנה: יתר לחץ דם, סוכרת סוג 2, מעקב שגרתי
תסמינים: כאבי ראש, עייפות, לחץ דם 150/90, סוכר 180
טיפול: התאמת מינון תרופות, דיאטה דלת נתרן, פעילות גופנית
הערות: תאריך: 15/01/2025, רופא: ד"ר כהן, מעקב בעוד חודש

היה מקיף - חלץ כל מה שרלוונטי רפואית מרשומת הייעוץ הזו. ארגן את המידע בצורה לוגית.

חשוב: ענה בעברית בלבד.`,

      // חילוץ רשומות חיסונים
      vaccination_records_extraction: `אתה מומחה רפואי. חלץ מידע מובנה מרשומת החיסונים הזו:

מסמך: {documentText}

חלץ והחזר את הנתונים בפורמט המדויק הזה:

DATE_VALUE: [תאריך החיסון בפורמט DD/MM/YYYY HH:MM אם זמן זמין, או DD/MM/YYYY אם רק תאריך - חלץ מהמסמך]
DIAGNOSIS_VALUE: [סוגי החיסונים שניתנו - שם החיסון, מספר מנה]
SYMPTOMS_VALUE: [מספרי אצווה, מקום מתן החיסון, פרטי החיסון]
TREATMENT_VALUE: [החיסון הבא הנדרש, תגובות לוואי, הוראות מעקב]
NOTES_VALUE: [פרטי רופא/אחות, מספר תעודה, פרטים נוספים]

דוגמה לפורמט:
אבחנה: חיסון קורונה מנה שלישית, חיסון שפעת עונתי
תסמינים: תאריך: 15/01/2025, אצווה: ABC123, מקום: קופת חולים כללית
טיפול: חיסון הבא בעוד 6 חודשים, ללא תגובות לוואי
הערות: רופא: ד"ר כהן, תעודת חיסון: 123456789

היה מקיף - חלץ כל מה שרלוונטי רפואית מרשומת החיסונים הזו. ארגן את המידע בצורה לוגית.

חשוב: ענה בעברית בלבד.`,

      // חילוץ הפניות
      referrals_extraction: `אתה מומחה רפואי. חלץ מידע מובנה מההפניה הזו:

מסמך: {documentText}

חלץ והחזר את הנתונים בפורמט המדויק הזה:

DATE_VALUE: [תאריך ההפניה בפורמט DD/MM/YYYY HH:MM אם זמן זמין, או DD/MM/YYYY אם רק תאריך - חלץ מהמסמך]
DIAGNOSIS_VALUE: [סיבת ההפניה, מצב רפואי, התמחות נדרשת]
SYMPTOMS_VALUE: [תלונות המטופל, ממצאים קליניים, בעיות שמצריכות התייעצות]
TREATMENT_VALUE: [המלצות לטיפול, בדיקות נדרשות, מעקב]
NOTES_VALUE: [רופא מפנה, מומחה יעד, דחיפות, פרטי ביטוח]

דוגמה לפורמט:
אבחנה: חשד לבעיה קרדיולוגית, כאבי חזה חוזרים
תסמינים: כאבי חזה בעת מאמץ, קוצר נשימה, דפיקות לב
טיפול: בדיקת אקו לב, מבחן מאמץ, הערכה קרדיולוגית
הערות: רופא מפנה: ד"ר כהן, יעד: קרדיולוג, דחוף, תאריך: 15/01/2025

היה מקיף - חלץ כל מה שרלוונטי רפואית מההפניה הזו. ארגן את המידע בצורה לוגית.

חשוב: ענה בעברית בלבד.`,

      // חילוץ אישור מחלה
      medical_certificate_extraction: `אתה מומחה רפואי. חלץ מידע מאישור המחלה הזה וארגן אותו לרשומה רפואית:

מסמך: {documentText}

חלץ והחזר את הנתונים בפורמט המדויק הזה:

DATE_VALUE: [תאריך הנפקת האישור בפורמט DD/MM/YYYY HH:MM אם זמן זמין, או DD/MM/YYYY אם רק תאריך - חלץ מהמסמך]
DIAGNOSIS_VALUE: [המצב הרפואי או הסיבה לאישור - אם לא מצוין, השתמש ב'אישור מחלה']
SYMPTOMS_VALUE: [מגבלות עבודה, הגבלות, או אי יכולת לעבוד - חלץ מחלק המגבלות/הגבלות]
TREATMENT_VALUE: [המלצות טיפול, הוראות רפואיות, או מעקב - אם לא מצוין, השתמש ב'לא מצוין במסמך']
NOTES_VALUE: [פרטים מנהליים: תאריכי תקופת מחלה, שם רופא, תוקף אישור, פרטי מטופל]

דוגמה לפורמט:
אבחנה: אישור מחלה
תסמינים: אינו/ה מסוגל/ת לעבוד
טיפול: מנוחה ומעקב לפי הצורך
הערות: תקופת מחלה: 07/05/2025 עד 09/05/2025 - רופא: ד"ר כהן

חשוב: ענה בעברית בלבד.`,

      // חילוץ פרוצדורות רפואיות
      medical_procedures_extraction: `אתה מומחה רפואי. חלץ מידע מקיף ומובנה מדוח הפרוצדורה הרפואית הזה:

מסמך: {documentText}

חלץ והחזר את הנתונים בפורמט המדויק הזה:

DATE_VALUE: [תאריך הפרוצדורה בפורמט DD/MM/YYYY HH:MM אם זמן זמין, או DD/MM/YYYY אם רק תאריך - חפש בכל המסמך כולל "תאריך כתיבת הגרסה", "תאריך הבדיקה", "זמן הפרוצדורה" - אם יש זמן כלשהו במסמך, הכלל אותו כאן]
DIAGNOSIS_VALUE: [שם הפרוצדורה הספציפי - קולונוסקופיה אבחנתית, אנדוסקופיה עליונה, צנתור לב וכו']
SYMPTOMS_VALUE: [ממצאים עיקריים בטקסט רגיל - תוצאות, מדידות, חריגות שהתגלו. אל תשתמש בכוכביות או עיצוב]
TREATMENT_VALUE: [הוראות עיקריות בטקסט רגיל - תרופות, הגבלות, מעקב. אל תשתמש בכוכביות או עיצוב]
NOTES_VALUE: [פרטים נוספים בטקסט רגיל - רופא, מוסד רפואי, הרדמה, ציוד. אל תשתמש בכוכביות או עיצוב]

דוגמה לפורמט:
DATE_VALUE: 12/02/2025
DIAGNOSIS_VALUE: קולונוסקופיה אבחנתית עם הסרת פוליפים - בדיקה מלאה של המעי הגס והחלחולת
SYMPTOMS_VALUE: הוסרו 2 פוליפים קטנים מהמעי הסיגמואידי (5 מ"מ ו-3 מ"מ), רירית תקינה במקומות אחרים, דלקת קלה בחלחולת, הכנת מעיים מצוינת
TREATMENT_VALUE: נוזלים צלולים היום, תזונה רגילה מחר, להימנע מנוגדי דלקת למשך שבוע, מעקב בעוד 3 חודשים לתוצאות ביופסיה
NOTES_VALUE: ד"ר כהן (גסטרואנטרולוגיה) - מרכז אנדוסקופיה אמבולטורי - הרגעה עם מידזולם - משך 45 דקות - קולונוסקופ אולימפוס - מטופל שוחרר במצב יציב

היה מקיף ביותר - חלץ את כל הפרטים הרפואיים, המדידות, הממצאים והמידע הפרוצדורלי מהדוח הזה.

חשוב: ענה בעברית בלבד.`
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
};

const translations = {
  en: {
    language: 'en',
    languageName: 'English',
    isRTL: false,
    version: '1.0.0',
    category: 'ui',
    translations: {
      // Navigation
      home: 'Home',
      date: 'Date',
      diagnosis: 'Diagnosis',
      patients: 'Patients',
  user: 'User',
      chatAgent: 'Chat Agent',
      logout: 'Logout',
      login: 'Login',
      signup: 'Sign Up',

      // Chat Interface
      newChat: 'New Chat',
      searchHistory: 'Search history...',
      voiceInput: 'Voice input',
      textToSpeech: 'Text to speech',
      typeMessage: 'Type a message...',
      send: 'Send',
      processing: 'Processing...',
      loading: 'Loading...',
      messages: 'messages',
      medicalChatAgent: 'Medical Chat Agent',
      helloMessage: 'Hello! How can I help you today?',
      exampleCommands: 'Example commands:',
      uploadingFiles: 'Uploading files...',
      uploadDocuments: 'Upload documents',
      documentAnalyzed: 'Document analyzed successfully',

      // Patient Details
      patientDetails: 'Patient Details',
      overview: 'Overview',
      documents: 'Documents',
      history: 'History',
      analysis: 'Analysis',
      labResults: 'Lab Results',
      labResultsDetails: 'Lab Results Details',
      symptoms: 'Symptoms',
      loading: 'Loading...',
      error: 'Error occurred',
      medicalData: 'Medical Data',
      errorParsingData: 'Error parsing medical data',
      noDataAvailable: 'No data available',
      medicalRecord: 'Medical Record',
      comprehensiveMedicalRecords: 'Comprehensive Medical Records',
      patientActivityTimelineTitle: 'Patient Activity Timeline',
      patientRegistrationTitle: 'Patient Registration',
      patientRegisteredInSystem: 'Patient was registered in the system',
      andBecamePartOfOurMedicalNetwork: 'and became part of our medical network',
      symptoms: 'Symptoms',
      treatment: 'Treatment',

      // Medical Categories
      labResults: 'Lab Results',
      imagingStudies: 'Imaging Studies',
      imagingReports: 'Imaging Reports',
      prescriptions: 'Prescriptions',
      visitNotes: 'Visit Notes',
      consultationNotes: 'Consultation Notes',
      consultation_notes: 'Consultation Notes',
      dischargeSummary: 'Discharge Summary',
      specialistReports: 'Specialist Reports',
      vaccinationRecords: 'Vaccination Records',
      vaccination_records: 'Vaccination Records',
      referrals: 'Referrals',
      medicalCertificate: 'Medical Certificate',
      medical_certificate: 'Medical Certificate',
      medical_procedures: 'Medical Procedures',

      // Structured Data Labels
      labResultsDetails: 'Lab Results Details',
      testName: 'Test Name',
      testValues: 'Test Values',
      referenceRange: 'Reference Range',
      abnormalFindings: 'Abnormal Findings',
      prescriptionDetails: 'Prescription Details',
      medicationName: 'Medication Name',
      dosage: 'Dosage',
      frequency: 'Frequency',
      instructions: 'Instructions',
      vaccinationDetails: 'Vaccination Details',
      vaccinationRecord: 'Vaccination Record',
      referralDetails: 'Referral Details',
      referralDocument: 'Referral Document',
      certificateDetails: 'Certificate Details',
      medicalCertificateDocument: 'Medical Certificate Document',
      aiAnalysis: 'AI Analysis',

      // Error Messages
      duplicateFileDetected: 'Duplicate File Detected',
      duplicateFileMessage: 'A file with this name already exists for this patient. Please delete the existing file first or rename your file.',
      uploadFailed: 'Upload Failed',
      fileTooLarge: 'File Too Large',
      fileTooLargeMessage: 'One or more files exceed the 10MB size limit',
      tooManyFiles: 'Too Many Files',
      tooManyFilesMessage: 'Maximum 10 files allowed per upload',
      noFilesUploaded: 'No Files Uploaded',
      noFilesUploadedMessage: 'Please select files to upload',
      fileTypeNotAllowed: 'File Type Not Allowed',
      uploadSuccess: 'Upload Successful',
      uploadError: 'Upload Error',

      // Medical History Modal
      editMedicalHistoryEntry: 'Edit Medical History Entry',
      viewMedicalHistoryEntry: 'View Medical History Entry',
      medicalHistoryEntries: 'Medical History Entries',
      enterDiagnosis: 'Enter diagnosis...',
      enterSymptoms: 'Enter symptoms...',
      enterTreatment: 'Enter treatment...',
      enterNotes: 'Enter additional notes...',
      errorUpdatingEntry: 'Error updating medical history entry',
      errorDeletingEntry: 'Error deleting medical history entry',
      confirmDeleteEntry: 'Are you sure you want to delete this medical history entry?',
      deleteAllRecords: 'Delete All Records',
      confirmDeleteAllInCategory: 'Are you sure you want to delete all records in this category?',
      saving: 'Saving...',
      date: 'Date',
      notes: 'Notes',
      entries: 'entries',
      close: 'Close',
      viewAll: 'View All',
      deleted: 'Deleted',
      recentlyDeleted: 'Recently Deleted',
      deletedOn: 'Deleted on',
      restore: 'Restore',
      deletePermanently: 'Delete Permanently',
      confirmPermanentDelete: 'Are you sure you want to permanently delete this entry? This action cannot be undone.',
      errorRestoringEntry: 'Error restoring medical history entry',
      noDeletedEntries: 'No recently deleted entries',
      noRecordsInCategory: 'No records in this category',
      noEntriesForCategory: 'No entries found for this category',
      cards: 'Cards',
      lines: 'Lines',

      // Patient Timeline
      patientTimeline: 'Patient Timeline',
      patientRegistered: 'Patient Registered',
      patientRegisteredDescription: 'Patient account created in the system',
      medicalRecord: 'Medical Record',
      medicalRecordAdded: 'Medical record added to patient history',
      documentUploaded: 'Document Uploaded',
      documentProcessed: 'Document uploaded and processed',
      analysisCompleted: 'Analysis Completed',
      aiAnalysisFinished: 'AI analysis completed successfully',
      noTimelineEvents: 'No timeline events available',
      event: 'event',
      events: 'events',

      // Medical History Edit Form
      editMedicalHistoryEntry: 'Edit Medical History Entry',
      enterDiagnosis: 'Enter diagnosis...',
      enterSymptoms: 'Enter symptoms...',
      enterTreatment: 'Enter treatment...',
      enterNotes: 'Enter additional notes...',
      errorUpdatingEntry: 'Error updating medical history entry',
      saving: 'Saving...',
      date: 'Date',
      notes: 'Notes',

      // AI Processing
      aiProcessing: 'AI Processing...',
      aiAnalysisComplete: 'AI Analysis Complete',
      processingDocument: 'Processing Document',
      medicalData: 'Medical Data',
      errorParsingData: 'Error parsing medical data',
      noDataAvailable: 'No data available',
      medicalData: 'Medical Data',
      errorParsingData: 'Error parsing medical data',
      noDataAvailable: 'No data available',
      medicalData: 'Medical Data',
      errorParsingData: 'Error parsing medical data',
      noDataAvailable: 'No data available',

      // Home Page
      welcomeTitle: 'Welcome to IntelliCare',
      welcomeSubtitle: 'Intelligent AI-powered medical diagnosis and patient management system',
      medicalDiagnosis: 'Medical Diagnosis',
      medicalDiagnosisDesc: 'Get AI-powered diagnostic assistance based on patient symptoms',
      patientManagement: 'Patient Management',
      patientManagementDesc: 'Manage patient records and medical history in one place',
      medicalKnowledge: 'Medical Knowledge',
      medicalKnowledgeDesc: 'Access to vast medical databases and research',
      tryDiagnosis: 'Try Diagnosis',
      viewPatients: 'View Patients',
      learnMore: 'Learn More',
      aboutIntelliCare: 'About IntelliCare',
      companyName: 'IntelliCare',
      doctorTitle: 'Dr.',
      aboutDescription1: 'IntelliCare is an advanced medical AI system that combines multiple open-source medical models to provide intelligent diagnostic assistance and patient management capabilities. Our system helps medical professionals make more informed decisions by providing data-driven insights and saving lives through AI-powered healthcare.',
      aboutDescription2: 'Using state-of-the-art natural language processing and machine learning models, IntelliCare can analyze patient symptoms, medical history, and other relevant factors to provide diagnostic suggestions and treatment recommendations with intelligent precision.',

      // Patient List
      patientRecords: 'Patient Records',
      deletedPatients: 'Deleted Patients',
      addNewPatient: 'Add New Patient',
      showActivePatients: 'Show Active Patients',
      showDeletedPatients: 'Show Deleted Patients',
      totalPatients: 'Total Patients',
      malePatients: 'Male Patients',
      femalePatients: 'Female Patients',
      newThisMonth: 'New This Month',
      noPatients: 'No patients yet',
      noPatientsDesc: 'Get started by adding your first patient to begin managing their medical records.',
      addFirstPatient: 'Add Your First Patient',
      noDeletedPatients: 'No deleted patients',
      noDeletedPatientsDesc: 'No patients have been deleted yet. Deleted patients will appear here and can be restored if needed.',
      deletedBy: 'Deleted by',

      // Patient Form
      addNewPatientTitle: 'Add New Patient',
      fullName: 'Full Name',
      fullNamePlaceholder: "Patient's full name",
      age: 'Age',
      agePlaceholder: "Patient's age",
      gender: 'Gender',
      email: 'Email',
      emailPlaceholder: "Patient's email",
      phone: 'Phone',
      phonePlaceholder: "Patient's phone number",
      doctorSummary: 'Doctor Summary',
      doctorSummaryPlaceholder: 'Enter initial assessment, chief complaint, medical history, or any relevant notes...',
      medicalHistory: 'Medical History',
      selectGender: 'Select gender',
      male: 'Male',
      female: 'Female',
      other: 'Other',
      medicalDocuments: 'Medical Documents & Images',
      general_images: 'General Images',
      uploadFiles: 'Click to upload or drag and drop',
      uploadDescription: 'PDF, DOC, XLS, Images, MRI, CT, X-Ray (up to 50MB each)',
      uploadedFiles: 'Uploaded Files',
      cancel: 'Cancel',
      save: 'Save',
      addPatient: 'Add Patient',
      updatePatient: 'Update Patient',
      editPatient: 'Edit Patient',
      requiredField: 'Please fill in all required fields',

      // Patient Actions
      view: 'View',
      edit: 'Edit',
      delete: 'Delete',
      restore: 'Restore',
      permanentDelete: 'Permanent Delete',
      deleteSelected: 'Delete Selected',
      actions: 'Actions',
      contact: 'Contact',
      deletedDate: 'Deleted Date',

      // Delete Modal
      deletePatient: 'Delete Patient',
      deletePatients: 'Delete {count} Patient(s)',
      deletePatientConfirmation: 'Are you sure you want to delete {name}? This action can be undone by restoring the patient from the deleted patients list.',
      deletePatientsConfirmation: 'Are you sure you want to delete {count} selected patient(s)? This action can be undone by restoring the patients from the deleted patients list.',
      reasonForDeletion: 'Reason for deletion (optional):',
      enterReasonForDeletion: 'Enter reason for deletion...',
      cancel: 'Cancel',
      delete: 'Delete',

      // Patient Card
      years: 'years',
      registered: 'Registered',
      status: 'Status',
      active: 'Active',
      lastUpdated: 'Last Updated',

      // Modal tabs
      details: 'Details',
      timeline: 'Timeline',
      actions: 'Actions',
      basicInfo: 'Basic Information',
      medicalInformation: 'Medical Information',
      notSpecified: 'Not specified',
      medicalTimeline: 'Medical Timeline',
      recordCreated: 'Medical record created',
      availableActions: 'Available Actions',
      category: 'Category',
      selectDate: 'Select Date',
      select: 'Select',

      // Calendar days
      sun: 'Sun',
      mon: 'Mon',
      tue: 'Tue',
      wed: 'Wed',
      thu: 'Thu',
      fri: 'Fri',
      sat: 'Sat',
      selectDate: 'Select Date',
      select: 'Select',

      // Calendar days
      sunday: 'Sun',
      monday: 'Mon',
      tuesday: 'Tue',
      wednesday: 'Wed',
      thursday: 'Thu',
      friday: 'Fri',
      saturday: 'Sat',

      // View modes
      cards: 'Cards',
      list: 'List',
      lines: 'Lines',
      patientListView: 'Patient List View',
      patientName: 'Patient Name',
      record: 'record',
      records: 'records',
      andMore: 'and {{count}} more',

      // Common
      yes: 'Yes',
      no: 'No',
      confirm: 'Confirm',
      back: 'Back',
      next: 'Next',
      submit: 'Submit',
      close: 'Close',
      search: 'Search',
      filter: 'Filter',
      sort: 'Sort',

      // Login & Signup
      signInToIntelliCare: 'Sign in to IntelliCare',
      useMedicalAccount: 'Use your medical professional account',
      emailAddress: 'Email address',
      password: 'Password',
      rememberMe: 'Remember me',
      forgotPassword: 'Forgot your password?',
      forgotPasswordSubtitle: 'Enter your email to receive a password reset link',
      sendResetLink: 'Send Reset Link',
      sending: 'Sending...',
      enterEmailAddress: 'Enter your email address',
      forgotPasswordFailed: 'Failed to send reset link',
      signingIn: 'Signing in...',
      loggingIn: 'Logging in...',
      signIn: 'Sign in',
      dontHaveAccount: "Don't have an account?",
      signUp: 'Sign up',
      createAccount: 'Create your account',
      joinIntelliCare: 'Join IntelliCare to start providing intelligent healthcare solutions',
      fullName: 'Full Name',
      confirmPassword: 'Confirm Password',
      creatingAccount: 'Creating account...',
      alreadyHaveAccount: 'Already have an account?',
      passwordsDoNotMatch: 'Passwords do not match',
      passwordMinLength: 'Password must be at least 6 characters',

      // Practice Selection
      selectClinic: 'Select Your Practice',
      enterClinicSubdomain: 'Enter your practice subdomain to continue',
      clinicSubdomainPlaceholder: 'practice-name',
      clinicSubdomainRequired: 'Practice subdomain is required',
      clinicNotFound: 'Practice not found or inactive',
      validating: 'Validating...',
      continue: 'Continue',
      clinicSubdomainHelp: 'Contact your practice administrator if you need help finding your subdomain',
      selectedClinic: 'Selected Practice',
      changeClinic: 'Change Practice',

      // User Management
      userManagement: 'User Management',
      addNewUser: 'Add New User',
      editUser: 'Edit User',
      createUser: 'Create User',
      updateUser: 'Update User',
      searchUsers: 'Search users...',
      allRoles: 'All Roles',
      allStatuses: 'All Statuses',
      active: 'Active',
      inactive: 'Inactive',
      suspended: 'Suspended',
      firstName: 'First Name',
      lastName: 'Last Name',
      title: 'Title',
      titlePlaceholder: 'Dr., RN, LPN, etc.',
      roles: 'Roles',
      status: 'Status',
      actions: 'Actions',
      edit: 'Edit',
      cancel: 'Cancel',
      saving: 'Saving...',
      accessDenied: 'Access Denied',
      userManagementAccessRequired: 'You need administrator or medical director privileges to manage users.',
      errorLoadingUsers: 'Error loading users',
      userCreatedSuccessfully: 'User created successfully',
      userUpdatedSuccessfully: 'User updated successfully',
      userStatusUpdated: 'User status updated successfully',
      errorSavingUser: 'Error saving user',
      errorUpdatingStatus: 'Error updating user status',
      noUsersFound: 'No Users Found',
      noUsersFoundDescription: 'No users match your current search criteria.',
      user: 'User',
      enterFirstName: 'Enter first name',
      enterLastName: 'Enter last name',
      enterSecurePassword: 'Enter secure password',
      passwordRequirements: 'Minimum 8 characters required',
      selectRole: 'Select Role',


	      // RBAC
	      rolesAndPermissions: 'Roles & Permissions',
	      advanced: 'Advanced',
	      permission: 'Permission',
	      notImplementedYet: 'Not implemented yet',

  // Role Descriptions (names already provided from API; keys allow UI fallback & consistency)
  role_admin_description: 'Full practice management and system administration',
  role_medical_director_description: 'Clinical oversight and medical staff management',
  role_doctor_description: 'Patient care, diagnosis, and treatment',
  role_doctor_specialist_description: 'Specialized medical care and consultations',
  role_nurse_rn_description: 'Patient care coordination and clinical support',
  role_nurse_lpn_description: 'Basic patient care under RN supervision',
  role_secretary_description: 'Administrative support and patient coordination',
  role_billing_description: 'Financial operations and insurance processing',
  role_lab_tech_description: 'Laboratory operations and result management',

  // Permission / Capability Keys (English)
  permissions: 'Permissions',
  medical_supervision: 'Medical Supervision',
  clinical_protocols: 'Clinical Protocols',
  quality_assurance: 'Quality Assurance',
  medical_audit: 'Medical Audit',
  user_management: 'User Management',
  practice_config: 'Practice Configuration',
  billing: 'Billing',
  audit: 'Audit',
  emergency_access: 'Emergency Access',
  patient_full_access: 'Patient Full Access',
  prescriptions: 'Prescriptions',
  medical_history: 'Medical History',
  ai_tools: 'AI Tools',
  consultations: 'Consultations',
  patient_limited_access: 'Patient Limited Access',
  specialist_notes: 'Specialist Notes',
  diagnostics: 'Diagnostics',
  referrals: 'Referrals',
  patient_demographics: 'Patient Demographics',
  vital_signs: 'Vital Signs',
  nursing_notes: 'Nursing Notes',
  medication_admin: 'Medication Administration',
  care_plans: 'Care Plans',
  patient_basic_info: 'Patient Basic Info',
  vital_signs_entry: 'Vital Signs Entry',
  basic_documentation: 'Basic Documentation',
  scheduling: 'Scheduling',
  demographics: 'Demographics',
  document_upload: 'Document Upload',
  insurance: 'Insurance',
  communication: 'Communication',
  billing_info: 'Billing Info',
  insurance_claims: 'Insurance Claims',
  financial_reports: 'Financial Reports',
  patient_financial: 'Patient Financial',
  lab_orders: 'Lab Orders',
  test_results: 'Test Results',
  quality_control: 'Quality Control',
  equipment_maintenance: 'Equipment Maintenance',

      // Enhanced User Form
      selectRole: 'Select Role',
      enterFirstName: 'Enter first name',
      enterLastName: 'Enter last name',
      enterSecurePassword: 'Enter secure password',
      passwordRequirements: 'Minimum 8 characters required',
      updateUserDetails: 'Update user details and permissions',
  // Role Names
  admin: 'Administrator',
  medical_director: 'Medical Director',
  doctor: 'Doctor',
  doctor_specialist: 'Specialist Doctor',
  nurse_rn: 'Registered Nurse',
  nurse_lpn: 'Practical Nurse',
  secretary: 'Secretary',
  billing: 'Billing',
  lab_tech: 'Lab Technician',
      createNewUserAccount: 'Create a new user account with role and permissions',

      // MFA (Multi-Factor Authentication)
      mfaSetupFor: 'MFA Setup for',
      mfaEnabled: 'MFA Enabled',
      setupMFA: 'Setup MFA',
      twoFactorAuthentication: 'Two-Factor Authentication',
      twoFactorVerification: 'Two-Factor Verification',
      enableMFA: 'Enable MFA',
      disableMFA: 'Disable MFA',
      mfaStatus: 'MFA Status',
      enabled: 'Enabled',
      disabled: 'Disabled',
      scanQRCode: 'Scan QR Code',
      scanWithAuthenticator: 'Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)',
      manualEntryKey: 'Manual Entry Key',
      enterVerificationCode: 'Enter Verification Code',
      verificationCode: 'Verification Code',
      backupCodes: 'Backup Codes',
      backupCodesWarning: 'Save these backup codes securely. Each code can only be used once.',
      downloadBackupCodes: 'Download Backup Codes',
      mfaSetupComplete: 'MFA Setup Complete',
      accountMoreSecure: 'Your account is now more secure with two-factor authentication.',
      backupCodesRemaining: 'Backup codes remaining',
      invalidTokenFormat: 'Please enter a valid 6-digit token',
      mfaSetupFailed: 'MFA setup failed',
      mfaEnableFailed: 'Failed to enable MFA',
      failedToLoadMFAStatus: 'Failed to load MFA status',
      verificationFor: 'Verification required for',
      useBackupCode: 'Use backup code instead',
      useTOTPCode: 'Use authenticator app instead',
      invalidMFAToken: 'Invalid MFA token',
      manageMFA: 'Manage MFA',

      // Role Permissions
      user_management: 'User Management',
      practice_config: 'Practice Configuration',
      billing: 'Billing',
      audit: 'Audit',
      emergency_access: 'Emergency Access',
      medical_supervision: 'Medical Supervision',
      clinical_protocols: 'Clinical Protocols',
      quality_assurance: 'Quality Assurance',
      medical_audit: 'Medical Audit',
      patient_full_access: 'Full Patient Access',
      prescriptions: 'Prescriptions',
      medical_history: 'Medical History',
      ai_tools: 'AI Tools',
      consultations: 'Consultations',
      patient_limited_access: 'Limited Patient Access',
      specialist_notes: 'Specialist Notes',
      diagnostics: 'Diagnostics',
      referrals: 'Referrals',
      patient_demographics: 'Patient Demographics',
      vital_signs: 'Vital Signs',
      nursing_notes: 'Nursing Notes',
      medication_admin: 'Medication Administration',
      care_plans: 'Care Plans',
      patient_basic_info: 'Basic Patient Info',
      vital_signs_entry: 'Vital Signs Entry',
      basic_documentation: 'Basic Documentation',
      scheduling: 'Scheduling',
      document_management: 'Document Management',
      insurance_verification: 'Insurance Verification',
      billing_operations: 'Billing Operations',
      financial_reporting: 'Financial Reporting',
      lab_orders: 'Lab Orders',
      test_results: 'Test Results',
      quality_control: 'Quality Control',
      equipment_maintenance: 'Equipment Maintenance',

      // RBAC Permission Names
      read_patients: 'Read Patients',
      write_patients: 'Write Patients',
      delete_patients: 'Delete Patients',
      export_patients: 'Export Patients',
      read_documents: 'Read Documents',
      write_documents: 'Write Documents',
      delete_documents: 'Delete Documents',
      export_documents: 'Export Documents',
      manage_users: 'Manage Users',
      assign_roles: 'Assign Roles',
      view_reports: 'View Reports',
      system_admin: 'System Admin',
      manage_practice_settings: 'Manage Practice Settings',
      manage_billing: 'Manage Billing',
      view_audit_logs: 'View Audit Logs',
      orders_create: 'Create Orders',
      orders_manage_results: 'Manage Results',

      // RBAC Permission Descriptions
      read_patients_description: 'View patient demographics and clinical data',
      write_patients_description: 'Create or update patient data and visits',
      delete_patients_description: 'Delete patient records (soft delete)',
      export_patients_description: 'Export patient data (CSV/JSON)',
      read_documents_description: 'View uploaded documents',
      write_documents_description: 'Upload and edit documents',
      delete_documents_description: 'Delete documents (soft delete)',
      export_documents_description: 'Export documents metadata',
      manage_users_description: 'Create, edit, and deactivate users',
      assign_roles_description: 'Assign roles to users',
      view_reports_description: 'Access reporting dashboards',
      system_admin_description: 'Full administrative access',
      manage_practice_settings_description: 'Update practice configuration',
      manage_billing_description: 'Billing, insurance, and finances',
      view_audit_logs_description: 'View HIPAA audit logs',
      orders_create_description: 'Create lab/radiology orders',
      orders_manage_results_description: 'Enter and validate lab results',

      // RBAC UI Enhancement
      selectRoleToManagePermissions: 'Select a role to manage permissions',
      chooseRoleFromDropdown: 'Choose a role from the dropdown above to view and edit its permissions',
      patients: 'Patients',
      documents: 'Documents',
      admin: 'Administration',
      compliance: 'Compliance',
      orders: 'Orders',
      practice: 'Practice',
      other: 'Other',
      save: 'Save',
      saving: 'Saving...',
      saved: 'Saved',
      cancel: 'Cancel',
      practiceName: 'Practice',
      currentClinic: 'Current Practice',
      systemAdministrator: 'System Administrator',
      practice: 'Practice',
      developmentClinic: 'Development Practice',

      // Security warnings
      securityWarningTitle: 'Security Warning',
      securityWarningMessage: 'You will be automatically logged out due to inactivity for security reasons.',
      securityWarningBrowserClose: 'You are logged into a medical system. Are you sure you want to leave?',
      extendSession: 'Continue Working',
      logoutNow: 'Logout Now',
      medicalSystemWarning: 'Medical System Warning',
      browserCloseWarningMessage: 'You are logged into a medical system with sensitive patient information. Closing the browser will log you out for security reasons.',
      stayInSystem: 'Stay in System',
      logoutAndClose: 'Logout and Close',
      securityNotice: 'Security Notice',
      medicalDataProtection: 'Medical data protected under HIPAA laws and security requirements',
      adminRoleProtected: 'Admin role permissions are protected and cannot be modified',

      // Practice Deletion (Danger Zone)
      dangerZone: 'Danger Zone',
      dangerZoneDescription: 'Irreversible and destructive actions',
      deleteClinic: 'Delete Practice',
      deleteClinicWarning: 'This will permanently delete the entire practice, all users, patients, documents, and data. This action cannot be undone.',
      deleteClinicButton: 'Delete Practice',
      confirmDeleteClinic: 'Confirm Practice Deletion',
      deleteClinicFinalWarning: 'This action will permanently delete everything and cannot be undone.',
      typeToConfirm: 'Type the practice subdomain to confirm',
      deleteClinicPermanently: 'Delete Permanently',
      deleting: 'Deleting...',
      deleteConfirmationMismatch: 'Confirmation text does not match',
      errorDeletingClinic: 'Failed to delete practice',
      show: 'Show',
      hide: 'Hide',

      // Password Reset & Email Change
      passwordManagement: 'Password Management',
      resetPassword: 'Reset Password',
      newPassword: 'New Password',
      enterNewPassword: 'Enter new password',
      confirmNewPassword: 'Confirm New Password',
      updatePassword: 'Update Password',
      resetPasswordFailed: 'Failed to reset password',
      invalidResetLink: 'Invalid Reset Link',
      resetLinkExpired: 'This reset link is invalid or has expired. Please request a new one.',
      requestNewResetLink: 'Request New Reset Link',
      validatingResetLink: 'Validating reset link...',
      redirectingToLogin: 'Redirecting to login...',
      passwordUpdatedSuccessfully: 'Password updated successfully',
      errorUpdatingPassword: 'Failed to update password',
      emailManagement: 'Email Management',
      changeEmail: 'Change Email',
      currentEmail: 'Current Email',
      newEmailAddress: 'New Email Address',
      enterNewEmail: 'Enter new email address',
      updateEmail: 'Update Email',
      emailUpdatedSuccessfully: 'Email updated successfully',
      errorUpdatingEmail: 'Failed to update email',
      updating: 'Updating...',
      sessionExpired: 'Session expired. Please log in again.',
      sendLoginLink: 'Send Login Link',
      sendingLoginLink: 'Sending Login Link...',
      invalidLoginLink: 'Invalid or expired login link',
      loginSuccessful: 'Login successful! Redirecting...',
      processingLogin: 'Processing Login...',
      pleaseWait: 'Please wait while we log you in.',
      backToLogin: 'Back to Login',

      // Patient Management Enhanced
      analytics: 'Analytics',
      export: 'Export',
      patientAnalytics: 'Patient Analytics',
      totalPatients: 'Total Patients',
      averageAge: 'Average Age',
      newThisMonth: 'New This Month',
      genderDistribution: 'Gender Distribution',
      male: 'Male',
      female: 'Female',
      other: 'Other',
      loadingAnalytics: 'Loading analytics...',
      errorLoadingAnalytics: 'Error loading analytics',
      exportCompleted: 'Export completed successfully',
      errorExporting: 'Error exporting data',
      failedToFetchPatients: 'Failed to fetch patients',

      // Document Management Enhanced
      documentAnalytics: 'Document Analytics',
      totalDocuments: 'Total Documents',
      analysisRate: 'Analysis Rate',
      avgConfidence: 'Avg Confidence',
      documentTypes: 'Document Types',
      documentCategories: 'Document Categories',
      loadingAnalytics: 'Loading analytics...',

      // Landing Page
      intelligentMedicalAssistant: 'Advanced Agentic Medical Platform',

      // Navigation
      userDisplayFormat: 'Dr. {name}',

      // Navigation
      userDisplayFormat: 'Dr. {name}',

      // Home Page
      homePageTitle: 'IntelliCare Advanced Autonomous Medical System',
      welcome: 'Welcome',
      diagnosisDescription: 'Get AI-powered medical diagnosis and treatment recommendations',
      patientsDescription: 'Manage your patient records and medical history',
      medicalRecords: 'Medical Records',
      medicalRecordsDescription: 'Access and manage comprehensive medical documentation',
      analytics: 'Analytics',
      analyticsDescription: 'View insights and analytics from medical data',
      settings: 'Settings',
      settingsDescription: 'Configure your account and system preferences',
      help: 'Help',
      helpDescription: 'Get support and learn how to use the platform',

      // New Visit
      newVisit: 'New Visit',
      visitDate: 'Visit Date',
      visitTime: 'Visit Time',
      visitType: 'Visit Type',
      routineVisit: 'Routine Visit',
      emergencyVisit: 'Emergency Visit',
      followUpVisit: 'Follow-up Visit',
      consultationVisit: 'Consultation',
      visitNotes: 'Additional Notes',
      followUpDate: 'Follow-up Date',
      saveVisit: 'Save Visit',
      symptomsPlaceholder: 'Describe the patient\'s symptoms...',
      diagnosisPlaceholder: 'Enter the diagnosis...',
      treatmentPlaceholder: 'Describe the treatment plan...',
      notesPlaceholder: 'Any additional notes or observations...',
      saving: 'Saving...',

      // New Visit Form Sections
      visitInformation: 'Visit Information',
      vitalSigns: 'Vital Signs',
      bloodPressure: 'Blood Pressure',
      heartRate: 'Heart Rate',
      temperature: 'Temperature',
      weight: 'Weight',
      clinicalInformation: 'Clinical Information',
      chiefComplaint: 'Chief Complaint',
      chiefComplaintPlaceholder: 'Main reason for visit...',
      assessmentAndPlan: 'Assessment & Plan',
      additionalInformation: 'Additional Information',
      fieldRequired: 'This field is required',
      selectDate: 'Select date...',
      followUp: 'Follow-up',
      landingDescription: 'Advanced AI-powered medical diagnosis and patient management system designed for healthcare professionals',
      getStarted: 'Get Started',
      smartDiagnosis: 'Smart Diagnosis',
      smartDiagnosisDesc: 'AI-powered diagnostic assistance with high accuracy',
      patientManagement: 'Patient Management',
      patientManagementDesc: 'Comprehensive patient records and history management',
      secureData: 'Secure Data',
      secureDataDesc: 'HIPAA-compliant secure medical data storage',
      backToHome: 'Back to Home',

      // Company Landing Page
      home: 'Home',
      about: 'About',
      company: 'Company',
      contact: 'Contact',
      login: 'Login',
      logout: 'Logout',
      founderCEO: 'Founder & CEO',
      eranGross: 'Eran Gross',
      companyMission: 'Our Mission',
      missionStatement: 'To revolutionize healthcare through intelligent AI-powered medical diagnosis and patient management systems, making quality healthcare accessible and efficient for medical professionals worldwide.',
      aboutCompany: 'About IntelliCare',
      companyDescription: 'IntelliCare is a cutting-edge medical technology company founded in 2024, dedicated to transforming healthcare through artificial intelligence. Our advanced diagnostic systems help medical professionals make faster, more accurate decisions, ultimately saving lives and improving patient outcomes.',
      whyChooseUs: 'Why Choose IntelliCare?',
      aiPowered: 'AI-Powered',
      aiPoweredDesc: 'Advanced machine learning algorithms trained on vast medical datasets',
      secure: 'Secure & Compliant',
      secureDesc: 'HIPAA-compliant security ensuring patient data protection',
      accurate: 'Highly Accurate',
      accurateDesc: 'Proven diagnostic accuracy with continuous learning capabilities',
      support: '24/7 Support',
      supportDesc: 'Round-the-clock technical support for healthcare professionals',
      getStartedToday: 'Get Started Today',
      joinThousands: 'Join thousands of healthcare professionals already using IntelliCare',
      startFreeTrial: 'Start Free Trial',
      contactSales: 'Contact Sales',
      learnMore: 'Learn More',

      // About Page
      ourStory: 'Our Story',
      aboutCompanyText1: 'Founded with a vision to transform healthcare through artificial intelligence, IntelliCare combines cutting-edge technology with deep medical expertise to create solutions that truly make a difference in patient care.',
      aboutCompanyText2: 'IntelliCare combines advanced technology with deep medical expertise to create solutions that truly make a difference in patient care.',
      ourValues: 'Our Values',
      innovation: 'Innovation',
      innovationDesc: 'Continuously pushing the boundaries of medical AI technology',
      trust: 'Trust',
      trustDesc: 'Building reliable, transparent systems that healthcare professionals can depend on',
      excellence: 'Excellence',
      excellenceDesc: 'Committed to the highest standards in medical accuracy and patient safety',
      ourTechnology: 'Our Technology',
      technologyDesc: 'Our platform leverages state-of-the-art machine learning models, natural language processing, and medical knowledge graphs to provide intelligent diagnostic assistance that learns and improves over time.',
      futureVision: 'We envision a future where AI-powered healthcare tools are seamlessly integrated into medical practice, enhancing human expertise rather than replacing it, and making quality healthcare accessible to everyone, everywhere.',

      // Contact Page
      contactUs: 'Contact Us',
      ourLocation: 'Our Location',
      addressStreet: '16 David Lando Street',
      addressCity: 'Ness Ziona, Israel',
      zipCode: 'Zip Code',
      email: 'Email',
      phone: 'Phone',
      phonenumber:'+972-0000000',
      businessHours: 'Business Hours',
      officeHours: 'Office Hours',
      sunday: 'Sunday',
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      closed: 'Closed',
      onlineSupport: 'Online Support',
      available24_7: 'Available 24/7',
      responseTime: 'Response Time',
      hours: 'hours',
      getInTouch: 'Get In Touch',
      contactDescription: 'We\'re here to help you transform your medical practice with intelligent AI solutions. Reach out to us for support, questions, or to learn more about IntelliCare.',

      // About Page - Fixed duplicates and proper organization
      ourStory: 'Our Story',
      aboutCompanyText1: 'Founded with a vision to transform healthcare through artificial intelligence, IntelliCare combines cutting-edge technology with deep medical expertise to create solutions that truly make a difference in patient care.',
      ourValues: 'Our Values',
      innovation: 'Innovation',
      innovationDesc: 'Continuously pushing the boundaries of medical AI technology',
      trust: 'Trust',
      trustDesc: 'Building reliable, transparent systems that healthcare professionals can depend on',
      excellence: 'Excellence',
      excellenceDesc: 'Committed to the highest standards in medical accuracy and patient safety',
      ourTechnology: 'Our Technology',
      technologyDesc: 'Our platform leverages state-of-the-art machine learning models, natural language processing, and medical knowledge graphs to provide intelligent diagnostic assistance that learns and improves over time.',
      futureVision: 'We envision a future where AI-powered healthcare tools are seamlessly integrated into medical practice, enhancing human expertise rather than replacing it, and making quality healthcare accessible to everyone, everywhere.',

      // Diagnosis
      medicalDiagnosisTitle: 'Medical Diagnosis',
      aiPoweredDiagnosis: 'AI-powered medical diagnosis assistance',
      patientAssessment: 'Patient Assessment',
      selectExistingPatient: 'Select Existing Patient (Optional)',
      searchPatients: 'Search patients by name...',
      clearSelection: 'Clear selection (manual entry)',
      currentSymptoms: 'Current Symptoms',
      describeSymptoms: 'Describe patient symptoms (e.g., fever, cough, headache)',
      describeCurrentSymptoms: 'Describe current symptoms for the selected patient (e.g., fever, cough, headache)',
      patientAge: 'Patient age',
      medicalHistory: 'Medical History',
      relevantMedicalHistory: 'Relevant medical history (optional)',
      medicalHistoryAutoPopulated: 'Medical history auto-populated from patient records (you can edit if needed)',
      patientDataLoaded: 'Patient data loaded. You can now enter current symptoms for diagnosis.',
      enterCurrentSymptoms: 'Enter the current symptoms you want to diagnose for this patient',
      enterCurrentSymptomsForPatient: 'Enter the current symptoms you want to diagnose for this patient',
      medicalHistoryPopulated: 'Medical history populated from patient records',
      medicalHistoryPopulatedFromRecords: 'Medical history populated from patient records',

      // Processing Diagnosis
      processingDiagnosis: 'Processing Diagnosis',
      processingSteps: 'Processing Steps',
      initializingDiagnosisRequest: 'Initializing diagnosis request...',
      validatingPatientInformation: 'Validating patient information...',
      connectingToMediPhiModel: 'Connecting to MediGemma AI model...',
      processingComprehensiveMedicalHistory: 'Processing comprehensive medical history...',
      aiModelAnalyzingSymptoms: 'AI model analyzing symptoms and medical data...',
      generatingTreatmentRecommendations: 'Generating treatment recommendations...',
      finalizingDiagnosisResults: 'Finalizing diagnosis results...',
      diagnosisCompletedSuccessfully: 'Diagnosis completed successfully!',
      resumingDiagnosis: 'Resuming diagnosis...',
      checkingForActiveSession: 'Checking for active diagnosis...',
      pleaseWait: 'Please wait...',
      unableToTrackProgress: 'Unable to track diagnosis progress. Please try again.',
      unableToResumeDiagnosis: 'Unable to resume diagnosis. Please try again.',
      diagnosisCompletedButNoResults: 'Diagnosis completed but results are not available. Please try again.',
      diagnosisCompletedButResultsNotAvailable: 'Diagnosis completed but results could not be retrieved.',
      pleaseWaitAnalyzing: 'Please wait: The AI model is analyzing your patient\'s comprehensive medical history. This process may take 1-2 minutes for complex cases.',

      // Error Messages & UI Actions
      errorOccurredDuringProcessing: 'Error occurred during diagnosis processing',
      failedToGetDiagnosis: 'Failed to get diagnosis. Please try again.',
      diagnosisTimeout: 'Diagnosis request timed out. Please try again.',
      diagnosisStopped: 'Diagnosis stopped. You can start a new diagnosis anytime.',
      collapseDetails: 'Collapse details',
      expandDetails: 'Expand details',

      // Results Page
      diagnosisResults: 'Diagnosis Results',
      newAnalysis: 'New Analysis',
      overallDiagnosis: 'Overall Diagnosis',
      riskLevel: 'Risk Level',
      confidence: 'Confidence',
      treatmentRecommendations: 'Treatment Recommendations',
      importantDisclaimer: 'Important: This is an AI-assisted diagnosis. Please consult with a healthcare professional for final diagnosis and treatment.',
      getDiagnosis: 'Get Diagnosis',
      analyzingSymptoms: 'Analyzing Symptoms...',
      processingDiagnosis: 'Processing Diagnosis',
      loadingPatients: 'Loading patients...',
      noPatientFound: 'No patients found matching',
      diagnosisResults: 'Diagnosis Results',
      newAnalysis: 'New Analysis',
      overallDiagnosis: 'Overall Diagnosis',
      riskLevel: 'Risk Level',
      confidence: 'Confidence',
      treatmentRecommendations: 'Treatment Recommendations',
      showLess: 'Show Less',
      showMorePoints: 'Show {count} More Points',
      pleaseWait: 'Please wait: The AI model is analyzing your patient\'s comprehensive medical history. This process may take 1-2 minutes for complex cases.',
      stopDiagnosis: 'Stop Diagnosis',

      // Patient Detail
      patientDetails: 'Patient Details',
      backToPatients: 'Back to Patients',
      uploadFiles: 'Upload Files',
      uploading: 'Uploading...',
      editPatient: 'Edit Patient',
      savePatient: 'Save',
      cancelEdit: 'Cancel',
      patientInformation: 'Patient Information',
      registrationDate: 'Registration Date',
      doctorsSummary: 'Doctor\'s Summary',
      noDoctorSummary: 'No doctor\'s summary available',
      clickEditToAdd: 'Click "Edit Patient" to add initial assessment',
      doctorsAssessment: 'Doctor\'s Assessment',
      latestMedicalHistory: 'Latest Medical History',
      recentMedicalEntry: 'Recent Medical Entry',
      viewCompleteMedicalHistory: 'View complete medical history →',
      uploadDocumentsInstructions: 'Upload medical documents in the Documents tab to generate medical history entries.',
      medicalHistoryTitle: 'Medical History',
      noMedicalHistoryAvailable: 'No Medical History Available',
      medicalHistoryWillAppear: 'Medical history will appear here when documents are uploaded and processed.',
      uploadDocumentsInstructions: 'Upload medical documents in the Documents tab to generate medical history entries.',
      patientActivityTimeline: 'Patient Activity Timeline',
      patientRegistration: 'Patient Registration',
      patientWasRegistered: 'Patient was registered in the IntelliCare system and medical record was created',
      symptomsAnalyzed: 'Symptoms Analyzed',
      expand: 'Expand',
      collapse: 'Collapse',
      detailedAnalysis: 'Detailed Analysis',
      aiAnalysisRecommendations: 'AI Analysis & Recommendations',
      viewAllAnalyses: 'View all AI-powered medical analyses and treatment recommendations for this patient.',
      loadingAnalyses: 'Loading analyses...',
      analysisDate: 'Analysis Date',
      symptomsAnalysisRecommendations: 'Symptoms Analysis & Recommendations',
      symptomsAnalysisWithExplanations: 'Symptoms Analysis with Detailed Explanations',
      noAiAnalysesAvailable: 'No AI Analyses Available',
      noAnalysesPerformed: 'No AI-powered medical analyses have been performed for this patient yet.',
      toCreateAnalysis: 'To create an analysis, go to the Medical Diagnosis page, select this patient, enter symptoms, and run a diagnosis.',
      createNewAnalysis: 'Create New Analysis',
      professionalTreatmentRecommendations: 'professional treatment recommendations',

      // Document Viewer
      documentsFor: 'Documents for',
      totalDocuments: 'Total Documents',
      manageViewDocuments: 'Manage and view all patient documents and medical files',
      documents: 'documents',
      folders: 'folders',
      searchDocuments: 'Search documents...',
      allFolders: 'All Folders',
      allTypes: 'All Types',
      noDocumentsFound: 'No documents found',
      adjustSearchCriteria: 'Try adjusting your search criteria or filters',
      noDocumentsUploaded: 'No documents have been uploaded for this patient yet.',
      viewDocument: 'View Document',
      view: 'View',
      download: 'Download',
      details: 'Details',
      hide: 'Hide',
      deleteDocument: 'Delete',
      fileType: 'File Type',
      mimeType: 'MIME Type',
      folder: 'Folder',
      aiClassification: 'AI Classification',
      medicalInsights: 'Medical Insights',
      recommendations: 'Recommendations',
      processingStatus: 'Processing Status',
      completed: 'Completed',
      processing: 'Processing',
      failed: 'Failed',
      confirmDeleteDocument: 'Are you sure you want to delete this document?',

      // File Types
      image: 'Image',
      pdf: 'PDF',
      document: 'Document',
      spreadsheet: 'Spreadsheet',
      medical_imaging: 'Medical Imaging',
      other: 'Other',

      // Common UI Elements
      loadingPatientsEllipsis: 'Loading patients...',
      loadingDocuments: 'Loading documents...',
      errorLoadingPatient: 'Error Loading Patient',
      failedToFetchPatient: 'Failed to fetch patient',
      unknownPatient: 'Unknown Patient',
      notProvided: 'Not provided',
      unknown: 'Unknown',
      unknownDate: 'Unknown Date',
      yearsOld: 'years old',

      // Messages
      successMessage: 'Operation completed successfully',
      errorMessage: 'An error occurred',
      confirmDelete: 'Are you sure you want to delete this item?',
      itemDeleted: 'Item deleted successfully',
      itemRestored: 'Item restored successfully',

      // Medical History Section
      latestMedicalHistoryTitle: 'Latest Medical History',
      medicalHistoryMainTitle: 'Medical History',
      entryDate: 'Entry Date',
      date: 'Date',
      treatment: 'Treatment',
      medicalEntry: 'Medical Entry',
      treatmentPlan: 'Treatment Plan',

      // Medical History Modal and Views
      viewAllEntries: 'View All Entries',
      completeHistory: 'Complete History',
      recentEntries: 'Recent Entries',
      noEntriesFound: 'No entries found',
      entriesTotal: 'entries total',
      cardView: 'Card View',
      lineView: 'Line View',

      // Delete and Restore Actions
      deleteEntry: 'Delete Entry',
      confirmDelete: 'Confirm Delete',
      restoreEntry: 'Restore Entry',
      recentlyDeleted: 'Recently Deleted',
      permanentDelete: 'Permanent Delete',
      softDelete: 'Move to Trash',
      deleteConfirmMessage: 'Are you sure you want to delete this entry?',
      restoreConfirmMessage: 'Restore this entry to medical history?',

      // Edit Medical History
      editEntry: 'Edit Entry',
      editMedicalHistory: 'Edit Medical History',
      saveChanges: 'Save Changes',
      cancelEdit: 'Cancel Edit',
      editDate: 'Edit Date',
      editSymptoms: 'Edit Symptoms',
      editDiagnosis: 'Edit Diagnosis',
      editTreatment: 'Edit Treatment',
      editNotes: 'Edit Notes',

      // Voice Interface
      voiceAssistant: 'Voice Assistant',
      clickToSpeak: 'Click to speak',
      recording: 'Recording...',
      processingVoice: 'Processing...',
      youSaid: 'You said:',
      assistantResponse: 'Assistant:',
      microphoneAccessError: 'Microphone access denied',
      voiceProcessingError: 'Voice processing failed',
      audioNotSupported: 'Audio not supported',

      // Patient Activity Timeline
      patientActivityTimelineTitle: 'Patient Activity Timeline',
      patientRegistrationTitle: 'Patient Registration',
      patientRegistrationDescription: 'Patient was registered in the IntelliCare system and medical record was created',

      // Medical Conditions - English
      hypertension: 'Hypertension',
      diabetes: 'Diabetes',
      hyperlipidemia: 'Hyperlipidemia',
      heart_disease: 'Heart Disease',
      cardiac_surgery: 'Cardiac Surgery',
      dyspnea: 'Shortness of Breath',
      edema: 'Swelling',
      heart_failure: 'Heart Failure',
      smoking: 'Smoking History',
      asthma: 'Asthma',
      depression: 'Depression',
      anxiety: 'Anxiety',
      cancer: 'Cancer',
      stroke: 'Stroke',
      copd: 'COPD',
      arthritis: 'Arthritis',

      // Medical Condition Descriptions - English
      hypertensionDesc: 'High blood pressure requiring medication and lifestyle modifications',
      diabetesDesc: 'Elevated blood glucose levels requiring ongoing monitoring and management',
      hyperlipidemiaDesc: 'Elevated cholesterol levels requiring dietary changes and medication',
      heartDiseaseDesc: 'Cardiovascular condition requiring cardiac monitoring and treatment',
      cardiacSurgeryDesc: 'Previous cardiac surgical intervention with ongoing follow-up care',
      dyspneaDesc: 'Difficulty breathing or shortness of breath requiring evaluation',
      edemaDesc: 'Fluid retention and swelling requiring medical attention',
      heartFailureDesc: 'Reduced heart function requiring specialized cardiac care',
      smokingDesc: 'History of tobacco use with associated health risks',

      // Snake case versions for compatibility
      heart_diseaseDesc: 'Cardiovascular condition requiring cardiac monitoring and treatment',
      cardiac_surgeryDesc: 'Previous cardiac surgical intervention with ongoing follow-up care',
      heart_failureDesc: 'Reduced heart function requiring specialized cardiac care',

      // Document Details Labels
      fileType: 'File Type',
      mimeType: 'MIME Type',
      folder: 'Category',
      aiClassification: 'AI Classification',
      medicalInsights: 'Medical Insights',
      recommendations: 'Recommendations',
      confidence: 'confidence',

      // Document Types
      document: 'Document',

      // Document Categories/Folders
      'documents/text': 'Text Documents',
      'documents/pdf': 'PDF Documents',
      'medical_imaging': 'Medical Imaging',
      'lab_results': 'Laboratory Results',
      'prescriptions': 'Prescriptions',
      'discharge_summary': 'Discharge Summary',
      'consultation_notes': 'Consultation Notes',
      'consent_forms': 'Consent Forms',
      'vaccination_records': 'Vaccination Records',
      'referrals': 'Referrals',
      'medical_certificate': 'Medical Certificate',
      'medical_procedures': 'Medical Procedures',

      // Category display names
      medicalProcedures: 'Medical Procedures',

      // AI Classification Types
      consultation_notes: 'Consultation Notes',
      lab_results_type: 'Laboratory Results',
      prescriptions_type: 'Prescriptions',
      discharge_summary_type: 'Discharge Summary',
      medical_history_type: 'Medical History',
      imaging_reports: 'Imaging Reports',

      // Medical Insights Text
      medicalDocumentReview: 'Medical document requiring clinical review and interpretation',
      manualReviewProvider: 'Manual review by healthcare provider',
      updatePatientRecord: 'Update patient medical record',
      labResultsInsight: 'Laboratory results document with test values and reference ranges',
      prescriptionInsight: 'Prescription document containing medication information and dosing instructions',
      dischargeInsight: 'Hospital discharge summary with treatment details and follow-up instructions',
      consultationInsight: 'Consultation notes detected. Contains clinical assessment and recommendations',

      // MIME Type Formats
      'PDF Document': 'PDF Document',
      'Word Document (.docx)': 'Word Document (.docx)',
      'Word Document (.doc)': 'Word Document (.doc)',
      'Excel Spreadsheet (.xlsx)': 'Excel Spreadsheet (.xlsx)',
      'Excel Spreadsheet (.xls)': 'Excel Spreadsheet (.xls)',
      'PowerPoint Presentation (.pptx)': 'PowerPoint Presentation (.pptx)',
      'PowerPoint Presentation (.ppt)': 'PowerPoint Presentation (.ppt)',
      'JPEG Image': 'JPEG Image',
      'PNG Image': 'PNG Image',
      'GIF Image': 'GIF Image',
      'BMP Image': 'BMP Image',
      'TIFF Image': 'TIFF Image',
      'Text File': 'Text File',
      'CSV File': 'CSV File',
      'JSON File': 'JSON File',
      'XML File': 'XML File',
      'HTML File': 'HTML File',

      // Additional medical insights that might appear
      'Medical document requiring clinical review and interpretation.': 'Medical document requiring clinical review and interpretation',
      'Manual review by healthcare provider': 'Manual review by healthcare provider',
      'Update patient medical record': 'Update patient medical record',
      asthmaDesc: 'Respiratory condition with airway inflammation and breathing difficulties',
      depressionDesc: 'Mood disorder requiring psychological support and treatment',
      anxietyDesc: 'Anxiety disorder requiring management and support',
      cancerDesc: 'Malignant condition requiring oncological care and monitoring',
      strokeDesc: 'Cerebrovascular event requiring neurological care and rehabilitation',
      copdDesc: 'Chronic obstructive pulmonary disease affecting breathing',
      arthritisDesc: 'Joint inflammation causing pain and reduced mobility',

      // Practice Setup Wizard - English
      clinicBasicInfo: 'Practice Basic Information',
      practiceName: 'Practice Name',
      enterClinicName: 'Enter practice name',
      subdomain: 'Subdomain',
      clinicWebsiteAddress: 'Your Practice Website Address',
      subdomainExplanation: 'This will be your unique web address where you and your staff will access IntelliCare',
      enterSubdomain: 'Enter subdomain',
      enterSubdomainExample: 'e.g., drsmith, familyclinic, telavivmedical',
      subdomainAvailable: 'Available',
      subdomainTaken: 'Already taken',
      checking: 'Checking...',
      yourWebsiteWillBe: 'Your website will be',
      pleaseChooseDifferent: 'Please choose a different name',
      examples: 'Examples',
      address: 'Address',

      addressAndCountry: 'Address & Country',
      country: 'Country',
      israel: 'Israel',
      unitedStates: 'United States',
      canada: 'Canada',
      unitedKingdom: 'United Kingdom',
      streetAddress: 'Street Address',
      enterStreetAddress: 'Enter street address',
      city: 'City',
      enterCity: 'Enter city',
      postalCode: 'Postal Code',
      enterPostalCode: 'Enter postal code',
      phone: 'Phone',
      enterPhoneNumber: 'Enter phone number',
      optional: 'Optional',

      adminUserCreation: 'Admin User Creation',
      firstName: 'First Name',
      enterFirstName: 'Enter first name',
      lastName: 'Last Name',
      enterLastName: 'Enter last name',
      title: 'Title',
      doctor: 'Dr.',
      professor: 'Prof.',
      mister: 'Mr.',
      miss: 'Ms.',
      emailAddress: 'Email Address',
      enterEmailAddress: 'Enter email address',
      password: 'Password',
      enterPassword: 'Enter password',
      confirmPassword: 'Confirm Password',
      passwordsDoNotMatch: 'Passwords do not match',

      practiceSettings: 'Practice Settings',
      language: 'Language',
      hebrew: 'Hebrew',
      english: 'English',
      timezone: 'Timezone',
      israelTime: 'Israel Time',
      easternTime: 'Eastern Time (US)',
      canadianTime: 'Canadian Time',
      ukTime: 'UK Time',
      patientIdFormat: 'Patient ID Format',
      israeliId: 'Israeli ID',
      usSsn: 'US Social Security Number',
      canadianHealth: 'Canadian Health Card',
      ukNhs: 'UK NHS Number',
      note: 'Note',
      settingsCanBeChangedLater: 'These settings can be changed later',

      confirmAndCreate: 'Confirm & Create',
      clinicSummary: 'Practice Summary',
      adminEmail: 'Admin Email',
      ready: 'Ready',
      clickCreateToFinish: 'Click "Create Practice" to finish',
      createClinic: 'Create Practice',
      creating: 'Creating...',
      clinicCreationFailed: 'Practice creation failed',

      // Navigation
      previous: 'Previous',
      next: 'Next',
      back: 'Back',
      pleaseCompleteAllFields: 'Please complete all required fields',

      // Additional UI
      or: 'or',
      createNewClinic: 'Create New Practice',

      // Self-Registration to Existing Practice
      joiningExistingClinic: 'Joining Existing Practice',
      basicPermissionsNote: 'You will start with basic permissions',
      adminCanUpgradeNote: 'Administrator can upgrade your access level',
      secureAccessNote: 'Secure, controlled access to protect patient data',
      signupFailed: 'Signup failed. Please try again.',
      existingClinicRedirectNote: 'If you select an existing practice, you will be able to register as a new staff member with basic permissions.',

      // Role Selection for Existing Practice Signup
      yourRole: 'Your Role',
      selectYourRole: 'Select your role',
      doctor: 'Doctor',
      nurse: 'Nurse',
      receptionist: 'Receptionist',
      administrator: 'Administrator',
      technician: 'Technician',
      other: 'Other',
      roleSelectionNote: 'Select your role in this practice. The administrator can adjust your permissions later if needed.'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  he: {
    language: 'he',
    languageName: 'עברית',
    isRTL: true,
    version: '1.0.0',
    category: 'ui',
    translations: {
      // Navigation
      home: 'בית',
      date: 'תאריך',
      diagnosis: 'אבחון',
      patients: 'מטופלים',
  user: 'משתמש',
      chatAgent: 'סוכן צ\'אט',
      logout: 'התנתק',
      login: 'התחבר',
      signup: 'הרשם',

      // Chat Interface
      newChat: 'שיחה חדשה',
      searchHistory: 'חיפוש בהיסטוריה...',
      voiceInput: 'הקלטה קולית',
      textToSpeech: 'הקראה קולית',
      typeMessage: 'הקלד הודעה...',
      send: 'שלח',
      processing: 'מעבד...',
      loading: 'טוען...',
      messages: 'הודעות',
      medicalChatAgent: 'סוכן צ\'אט רפואי',
      helloMessage: 'שלום! איך אני יכול לעזור לך היום?',
      exampleCommands: 'דוגמאות לפקודות:',
      uploadingFiles: 'מעלה קבצים...',
      uploadDocuments: 'העלה מסמכים',
      documentAnalyzed: 'המסמך נותח בהצלחה',

      // Patient Details
      patientDetails: 'פרטי מטופל',
      overview: 'סקירה כללית',
      documents: 'מסמכים',
      history: 'היסטוריה רפואית',
      analysis: 'ניתוח',
      labResults: 'תוצאות מעבדה',
      labResultsDetails: 'פרטי תוצאות מעבדה',
      symptoms: 'תסמינים',
      loading: 'טוען...',
      error: 'אירעה שגיאה',
      medicalData: 'מידע רפואי',
      errorParsingData: 'שגיאה בפענוח מידע רפואי',
      noDataAvailable: 'אין מידע זמין',
      medicalRecord: 'רשומה רפואית',
      comprehensiveMedicalRecords: 'רשומות רפואיות מקיפות',
      patientActivityTimelineTitle: 'ציר זמן פעילות המטופל',
      patientRegistrationTitle: 'רישום מטופל',
      patientRegisteredInSystem: 'המטופל נרשם במערכת',
      andBecamePartOfOurMedicalNetwork: 'והפך לחלק מהרשת הרפואית שלנו',
      symptoms: 'תסמינים',
      treatment: 'טיפול',

      // Medical Categories
      labResults: 'תוצאות מעבדה',
      imagingStudies: 'בדיקות הדמיה',
      imagingReports: 'דוחות הדמיה',
      prescriptions: 'מרשמים',
      visitNotes: 'הערות ביקור',
      consultationNotes: 'רשומות ייעוץ',
      consultation_notes: 'רשומות ייעוץ',
      dischargeSummary: 'מכתב שחרור',
      specialistReports: 'דוחות מומחים',
      vaccinationRecords: 'אישורי חיסונים',
      vaccination_records: 'אישורי חיסונים',
      referrals: 'הפניות',
      medicalCertificate: 'אישור מחלה',
      medical_certificate: 'אישור מחלה',
      medical_procedures: 'פרוצדורות רפואיות',

      // Structured Data Labels - Hebrew
      labResultsDetails: 'פרטי תוצאות מעבדה',
      testName: 'שם הבדיקה',
      testValues: 'ערכי הבדיקה',
      referenceRange: 'טווח נורמלי',
      abnormalFindings: 'ממצאים חריגים',
      prescriptionDetails: 'פרטי המרשם',
      medicationName: 'שם התרופה',
      dosage: 'מינון',
      frequency: 'תדירות',
      instructions: 'הוראות',
      vaccinationDetails: 'פרטי החיסון',
      vaccinationRecord: 'רשומת חיסון',
      referralDetails: 'פרטי ההפניה',
      referralDocument: 'מסמך הפניה',
      certificateDetails: 'פרטי האישור',
      medicalCertificateDocument: 'מסמך אישור רפואי',
      aiAnalysis: 'ניתוח בינה מלאכותית',

      // Error Messages - Hebrew
      duplicateFileDetected: 'קובץ כפול זוהה',
      duplicateFileMessage: 'קובץ עם השם הזה כבר קיים עבור המטופל הזה. אנא מחק את הקובץ הקיים תחילה או שנה את שם הקובץ.',
      uploadFailed: 'העלאה נכשלה',
      fileTooLarge: 'קובץ גדול מדי',
      fileTooLargeMessage: 'קובץ אחד או יותר חורגים ממגבלת הגודל של 10MB',
      tooManyFiles: 'יותר מדי קבצים',
      tooManyFilesMessage: 'מותר להעלות עד 10 קבצים בכל פעם',
      noFilesUploaded: 'לא הועלו קבצים',
      noFilesUploadedMessage: 'אנא בחר קבצים להעלאה',
      fileTypeNotAllowed: 'סוג קובץ לא מותר',
      uploadSuccess: 'העלאה הצליחה',
      uploadError: 'שגיאת העלאה',

      // Medical History Modal - Hebrew
      editMedicalHistoryEntry: 'עריכת רשומה רפואית',
      viewMedicalHistoryEntry: 'צפייה ברשומה רפואית',
      medicalHistoryEntries: 'רשומות היסטוריה רפואית',
      enterDiagnosis: 'הזן אבחנה...',
      enterSymptoms: 'הזן תסמינים...',
      enterTreatment: 'הזן טיפול...',
      enterNotes: 'הזן הערות נוספות...',
      errorUpdatingEntry: 'שגיאה בעדכון רשומה רפואית',
      errorDeletingEntry: 'שגיאה במחיקת רשומה רפואית',
      confirmDeleteEntry: 'האם אתה בטוח שברצונך למחוק רשומה רפואית זו?',
      deleteAllRecords: 'מחק את כל הרשומות',
      confirmDeleteAllInCategory: 'האם אתה בטוח שברצונך למחוק את כל הרשומות בקטגוריה זו?',
      saving: 'שומר...',
      date: 'תאריך',
      notes: 'הערות',
      entries: 'רשומות',
      close: 'סגור',
      viewAll: 'צפה בהכל',
      deleted: 'נמחק',
      recentlyDeleted: 'נמחקו לאחרונה',
      deletedOn: 'נמחק ב',
      restore: 'שחזר',
      deletePermanently: 'מחק לצמיתות',
      confirmPermanentDelete: 'האם אתה בטוח שברצונך למחוק רשומה זו לצמיתות? פעולה זו לא ניתנת לביטול.',
      errorRestoringEntry: 'שגיאה בשחזור רשומה רפואית',
      noDeletedEntries: 'אין רשומות שנמחקו לאחרונה',
      noRecordsInCategory: 'אין רשומות בקטגוריה זו',
      noEntriesForCategory: 'לא נמצאו רשומות בקטגוריה זו',
      cards: 'כרטיסים',
      lines: 'שורות',

      // Patient Timeline - Hebrew
      patientTimeline: 'ציר זמן של המטופל',
      patientRegistered: 'מטופל נרשם',
      patientRegisteredDescription: 'חשבון מטופל נוצר במערכת',
      medicalRecord: 'רשומה רפואית',
      medicalRecordAdded: 'רשומה רפואית נוספה להיסטוריית המטופל',
      documentUploaded: 'מסמך הועלה',
      documentProcessed: 'מסמך הועלה ועובד',
      analysisCompleted: 'ניתוח הושלם',
      aiAnalysisFinished: 'ניתוח AI הושלם בהצלחה',
      noTimelineEvents: 'אין אירועי ציר זמן זמינים',
      event: 'אירוע',
      events: 'אירועים',

      // AI Processing
      aiProcessing: 'עיבוד בינה מלאכותית...',
      aiAnalysisComplete: 'ניתוח בינה מלאכותית הושלם',
      processingDocument: 'מעבד מסמך',

      // Home Page
      welcomeTitle: 'ברוכים הבאים ל-IntelliCare',
      welcomeSubtitle: 'מערכת אבחון רפואי חכמה המופעלת על ידי בינה מלאכותית וניהול מטופלים',
      medicalDiagnosis: 'אבחון רפואי',
      medicalDiagnosisDesc: 'קבל סיוע אבחוני מופעל על ידי בינה מלאכותית על בסיס תסמיני המטופל',
      patientManagement: 'ניהול מטופלים',
      patientManagementDesc: 'נהל רשומות מטופלים והיסטוריה רפואית במקום אחד',
      medicalKnowledge: 'ידע רפואי',
      medicalKnowledgeDesc: 'גישה למאגרי מידע רפואיים ומחקרים נרחבים',
      tryDiagnosis: 'נסה אבחון',
      viewPatients: 'צפה במטופלים',
      learnMore: 'למד עוד',
      aboutIntelliCare: 'אודות IntelliCare',
      companyName: 'IntelliCare',
      doctorTitle: 'דוקטור',
      aboutDescription1: 'IntelliCare היא מערכת בינה מלאכותית רפואית מתקדמת המשלבת מספר מודלים רפואיים בקוד פתוח כדי לספק סיוע אבחוני חכם ויכולות ניהול מטופלים. המערכת שלנו עוזרת לאנשי מקצוע רפואיים לקבל החלטות מושכלות יותר על ידי מתן תובנות מבוססות נתונים והצלת חיים באמצעות בריאות מופעלת בינה מלאכותית.',
      aboutDescription2: 'באמצעות עיבוד שפה טבעית ומודלים של למידת מכונה מתקדמים, IntelliCare יכול לנתח תסמיני מטופלים, היסטוריה רפואית וגורמים רלוונטיים אחרים כדי לספק הצעות אבחון והמלצות טיפול בדיוק חכם.',

      // Patient List
      patientRecords: 'רשומות מטופלים',
      deletedPatients: 'מטופלים שנמחקו',
      addNewPatient: 'הוסף מטופל חדש',
      showActivePatients: 'הצג מטופלים פעילים',
      showDeletedPatients: 'הצג מטופלים שנמחקו',
      totalPatients: 'סך הכל מטופלים',
      malePatients: 'מטופלים גברים',
      femalePatients: 'מטופלות נשים',
      newThisMonth: 'חדשים החודש',
      noPatients: 'אין מטופלים עדיין',
      noPatientsDesc: 'התחל על ידי הוספת המטופל הראשון שלך כדי להתחיל לנהל את הרשומות הרפואיות שלהם.',
      addFirstPatient: 'הוסף את המטופל הראשון שלך',
      noDeletedPatients: 'אין מטופלים שנמחקו',
      noDeletedPatientsDesc: 'עדיין לא נמחקו מטופלים. מטופלים שנמחקו יופיעו כאן וניתן יהיה לשחזר אותם במידת הצורך.',
      deletedBy: 'נמחק על ידי',


      //Diagnostic processing
      processingDiagnosis: "עיבוד אבחון",
      processingSteps: "שלבי עיבוד",
      initializingDiagnosisRequest: "מאתחל בקשת אבחון...",
      validatingPatientInformation: "מאמת מידע על המטופל...",
      connectingToMediPhiModel: "מתחבר למודל הבינה המלאכותית MediGemma...",
      processingComprehensiveMedicalHistory: "מעבד היסטוריה רפואית מקיפה...",
      aiModelAnalyzingSymptoms: "מודל הבינה המלאכותית מנתח תסמינים ונתונים רפואיים...",
      generatingTreatmentRecommendations: "מייצר המלצות לטיפול...",
      finalizingDiagnosisResults: "מסיים את תוצאות האבחון...",
      diagnosisCompletedSuccessfully: "האבחון הושלם בהצלחה!",
      pleaseWaitAnalyzing: "נא המתן: מודל הבינה המלאכותית מנתח את ההיסטוריה הרפואית המקיפה של המטופל שלך. תהליך זה עשוי להימשך 1-2 דקות במקרים מורכבים.",

      // Patient Form
      addNewPatientTitle: 'הוסף מטופל חדש',
      fullName: 'שם מלא',
      fullNamePlaceholder: 'שם מלא של המטופל',
      age: 'גיל',
      agePlaceholder: 'גיל המטופל',
      gender: 'מין',
      email: 'אימייל',
      emailPlaceholder: 'כתובת האימייל של המטופל',
      phone: 'טלפון',
      phonePlaceholder: 'מספר הטלפון של המטופל',
      doctorSummary: 'סיכום רופא',
      doctorSummaryPlaceholder: 'הזן הערכה ראשונית, תלונה עיקרית, היסטוריה רפואית או כל הערה רלוונטית...',
      medicalHistory: 'היסטוריה רפואית',
      selectGender: 'בחר מין',
      male: 'זכר',
      female: 'נקבה',
      other: 'אחר',
      medicalDocuments: 'מסמכים ותמונות רפואיים',
      general_images: 'תמונות כלליות',
      uploadFiles: 'לחץ להעלאה או גרור ושחרר',
      uploadDescription: 'PDF, DOC, XLS, תמונות, MRI, CT, צילום רנטגן (עד 50MB כל אחד)',
      uploadedFiles: 'קבצים שהועלו',
      cancel: 'ביטול',
      save: 'שמור',
      addPatient: 'הוסף מטופל',
      updatePatient: 'עדכן מטופל',
      editPatient: 'ערוך מטופל',
      requiredField: 'אנא מלא את כל שדות החובה',

      // Patient Actions
      view: 'צפה',
      edit: 'ערוך',
      delete: 'מחק',
      restore: 'שחזר',
      permanentDelete: 'מחיקה קבועה',
      deleteSelected: 'מחק נבחרים',
      actions: 'פעולות',
      contact: 'פרטי קשר',
      deletedDate: 'תאריך מחיקה',

      // Delete Modal
      deletePatient: 'מחק מטופל',
      deletePatients: 'מחק {count} מטופלים',
      deletePatientConfirmation: 'האם אתה בטוח שברצונך למחוק את {name}? ניתן לבטל פעולה זו על ידי שחזור המטופל מרשימת המטופלים שנמחקו.',
      deletePatientsConfirmation: 'האם אתה בטוח שברצונך למחוק {count} מטופלים נבחרים? ניתן לבטל פעולה זו על ידי שחזור המטופלים מרשימת המטופלים שנמחקו.',
      reasonForDeletion: 'סיבת מחיקה (אופציונלי):',
      enterReasonForDeletion: 'הזן סיבת מחיקה...',
      cancel: 'ביטול',
      delete: 'מחק',

      // Patient Card
      years: 'שנים',
      registered: 'נרשם',
      status: 'סטטוס',
      active: 'פעיל',
      lastUpdated: 'עודכן לאחרונה',

      // Modal tabs
      details: 'פרטים',
      timeline: 'ציר זמן',
      actions: 'פעולות',
      basicInfo: 'מידע בסיסי',
      medicalInformation: 'מידע רפואי',
      notSpecified: 'לא צוין',
      medicalTimeline: 'ציר זמן רפואי',
      recordCreated: 'רשומה רפואית נוצרה',
      availableActions: 'פעולות זמינות',
      category: 'קטגוריה',
      selectDate: 'בחר תאריך',
      select: 'בחר',

      // Calendar days
      sun: 'א',
      mon: 'ב',
      tue: 'ג',
      wed: 'ד',
      thu: 'ה',
      fri: 'ו',
      sat: 'ש',
      male: 'זכר',
      female: 'נקבה',
      other: 'אחר',
      age: 'גיל',
      gender: 'מין',
      phone: 'טלפון',
      email: 'אימייל',
      delete: 'מחק',
      edit: 'ערוך',
      view: 'צפה',

      // View modes
      cards: 'כרטיסים',
      list: 'רשימה',
      lines: 'שורות',
      patientListView: 'תצוגת רשימת מטופלים',
      patientName: 'שם המטופל',
      record: 'רשומה',
      records: 'רשומות',
      andMore: 'ועוד {{count}}',

      // Common
      yes: 'כן',
      no: 'לא',
      confirm: 'אשר',
      back: 'חזור',
      next: 'הבא',
      submit: 'שלח',
      close: 'סגור',
      search: 'חפש',
      filter: 'סנן',
      sort: 'מיין',

      // Login & Signup
      signInToIntelliCare: 'התחבר ל-IntelliCare',
      useMedicalAccount: 'השתמש בחשבון הרפואי המקצועי שלך',
      emailAddress: 'כתובת אימייל',
      password: 'סיסמה',
      rememberMe: 'זכור אותי',
      forgotPassword: 'שכחת את הסיסמה?',
      forgotPasswordSubtitle: 'הזן את האימייל שלך כדי לקבל קישור איפוס סיסמה',
      sendResetLink: 'שלח קישור איפוס',
      sending: 'שולח...',
      enterEmailAddress: 'הזן את כתובת האימייל שלך',
      forgotPasswordFailed: 'נכשל בשליחת קישור איפוס',
      signingIn: 'מתחבר...',
      loggingIn: 'מתחבר...',
      signIn: 'התחבר',
      dontHaveAccount: 'אין לך חשבון?',
      signUp: 'הרשם',
      createAccount: 'צור את החשבון שלך',
      joinIntelliCare: 'הצטרף ל-IntelliCare כדי להתחיל לספק פתרונות בריאות חכמים',
      confirmPassword: 'אשר סיסמה',
      creatingAccount: 'יוצר חשבון...',
      alreadyHaveAccount: 'כבר יש לך חשבון?',
      passwordsDoNotMatch: 'הסיסמאות אינן תואמות',
      passwordMinLength: 'הסיסמה חייבת להיות באורך של לפחות 6 תווים',

      // Practice Selection
      selectClinic: 'בחר את המרפאה שלך',
      enterClinicSubdomain: 'הזן את תת-הדומיין של המרפאה שלך כדי להמשיך',
      clinicSubdomainPlaceholder: 'שם-מרפאה',
      clinicSubdomainRequired: 'תת-דומיין המרפאה נדרש',
      clinicNotFound: 'המרפאה לא נמצאה או לא פעילה',
      validating: 'מאמת...',
      continue: 'המשך',
      clinicSubdomainHelp: 'פנה למנהל המרפאה שלך אם אתה זקוק לעזרה במציאת תת-הדומיין',
      selectedClinic: 'מרפאה נבחרת',
      changeClinic: 'שנה מרפאה',

      // User Management

	      // RBAC
	      rolesAndPermissions: 'תפקידים והרשאות',
	      advanced: 'מתקדם',
	      permission: 'הרשאה',
	      notImplementedYet: 'עדיין לא ממומש',

      userManagement: 'ניהול משתמשים',
      addNewUser: 'הוסף משתמש חדש',
      editUser: 'ערוך משתמש',
      createUser: 'צור משתמש',
      updateUser: 'עדכן משתמש',
      searchUsers: 'חפש משתמשים...',
      allRoles: 'כל התפקידים',
      allStatuses: 'כל הסטטוסים',
      active: 'פעיל',
      inactive: 'לא פעיל',
      suspended: 'מושעה',
      firstName: 'שם פרטי',
      lastName: 'שם משפחה',
      title: 'תואר',
      titlePlaceholder: 'דוקטור, אח/ות, וכו\'',
      roles: 'תפקידים',
      status: 'סטטוס',
      actions: 'פעולות',
      edit: 'ערוך',
      cancel: 'ביטול',
      saving: 'שומר...',
      accessDenied: 'גישה נדחתה',
      userManagementAccessRequired: 'אתה זקוק להרשאות מנהל או מנהל רפואי כדי לנהל משתמשים.',
      errorLoadingUsers: 'שגיאה בטעינת משתמשים',
      userCreatedSuccessfully: 'משתמש נוצר בהצלחה',
      userUpdatedSuccessfully: 'משתמש עודכן בהצלחה',
      userStatusUpdated: 'סטטוס המשתמש עודכן בהצלחה',
      errorSavingUser: 'שגיאה בשמירת המשתמש',
      errorUpdatingStatus: 'שגיאה בעדכון סטטוס המשתמש',
      noUsersFound: 'לא נמצאו משתמשים',
      noUsersFoundDescription: 'אין משתמשים התואמים לקריטריוני החיפוש הנוכחיים.',
      user: 'משתמש',
      enterFirstName: 'הכנס שם פרטי',
      enterLastName: 'הכנס שם משפחה',
      enterSecurePassword: 'הכנס סיסמה מאובטחת',
      passwordRequirements: 'נדרשים לפחות 8 תווים',
      selectRole: 'בחר תפקיד',

      // MFA (Multi-Factor Authentication) - Hebrew
      mfaSetupFor: 'הגדרת MFA עבור',
      mfaEnabled: 'MFA מופעל',
      setupMFA: 'הגדר MFA',
      twoFactorAuthentication: 'אימות דו-שלבי',
      twoFactorVerification: 'אימות דו-שלבי',
      enableMFA: 'הפעל MFA',
      disableMFA: 'השבת MFA',
      mfaStatus: 'סטטוס MFA',
      enabled: 'מופעל',
      disabled: 'מושבת',
      scanQRCode: 'סרוק קוד QR',
      scanWithAuthenticator: 'סרוק את קוד QR זה עם אפליקציית האימות שלך (Google Authenticator, Authy וכו\')',
      manualEntryKey: 'מפתח הזנה ידנית',
      enterVerificationCode: 'הזן קוד אימות',
      verificationCode: 'קוד אימות',
      backupCodes: 'קודי גיבוי',
      backupCodesWarning: 'שמור את קודי הגיבוי האלה במקום בטוח. כל קוד יכול לשמש פעם אחת בלבד.',
      downloadBackupCodes: 'הורד קודי גיבוי',
      mfaSetupComplete: 'הגדרת MFA הושלמה',
      accountMoreSecure: 'החשבון שלך מאובטח יותר כעת עם אימות דו-שלבי.',
      backupCodesRemaining: 'קודי גיבוי נותרו',
      invalidTokenFormat: 'אנא הזן טוקן בן 6 ספרות חוקי',
      mfaSetupFailed: 'הגדרת MFA נכשלה',
      mfaEnableFailed: 'הפעלת MFA נכשלה',
      failedToLoadMFAStatus: 'טעינת סטטוס MFA נכשלה',
      verificationFor: 'נדרש אימות עבור',
      useBackupCode: 'השתמש בקוד גיבוי במקום',
      useTOTPCode: 'השתמש באפליקציית האימות במקום',
      invalidMFAToken: 'טוקן MFA לא חוקי',
      manageMFA: 'נהל MFA',

  // Role Descriptions (Hebrew)
  role_admin_description: 'ניהול מרפאה מלא וניהול מערכת',
  role_medical_director_description: 'פיקוח קליני וניהול צוות רפואי',
  role_doctor_description: 'טיפול במטופלים, אבחון וטיפול',
  role_doctor_specialist_description: 'טיפול רפואי מתמחה וייעוץ',
  role_nurse_rn_description: 'תיאום טיפול במטופלים ותמיכה קלינית',
  role_nurse_lpn_description: 'טיפול בסיסי במטופלים תחת פיקוח אחות מוסמכת',
  role_secretary_description: 'תמיכה אדמיניסטרטיבית ותיאום מטופלים',
  role_billing_description: 'פעולות פיננסיות ועיבוד ביטוח',
  role_lab_tech_description: 'פעולות מעבדה וניהול תוצאות',

  // Permission / Capability Keys (Hebrew)
  permissions: 'הרשאות',
  medical_supervision: 'פיקוח רפואי',
  clinical_protocols: 'פרוטוקולים קליניים',
  quality_assurance: 'הבטחת איכות',
  medical_audit: 'ביקורת רפואית',
  user_management: 'ניהול משתמשים',
  practice_config: 'הגדרות מרפאה',
  billing: 'חיוב',
  audit: 'ביקורת',
  emergency_access: 'גישה בחירום',
  patient_full_access: 'גישה מלאה למידע מטופל',
  prescriptions: 'מרשמים',
  medical_history: 'היסטוריה רפואית',
  ai_tools: 'כלי בינה מלאכותית',
  consultations: 'ייעוצים',
  patient_limited_access: 'גישה מוגבלת למטופל',
  specialist_notes: 'הערות מומחה',
  diagnostics: 'דיאגנוסטיקה',
  referrals: 'הפניות',
  patient_demographics: 'פרטי אוכלוסין של מטופל',
  vital_signs: 'מדדים חיוניים',
  nursing_notes: 'הערות סיעוד',
  medication_admin: 'מתן תרופות',
  care_plans: 'תוכניות טיפול',
  patient_basic_info: 'מידע בסיסי על מטופל',
  vital_signs_entry: 'הזנת מדדים חיוניים',
  basic_documentation: 'תיעוד בסיסי',
  scheduling: 'תזמון',
  demographics: 'דמוגרפיה',
  document_upload: 'העלאת מסמכים',
  insurance: 'ביטוח',
  communication: 'תקשורת',
  billing_info: 'מידע חיוב',
  insurance_claims: 'תביעות ביטוח',
  financial_reports: 'דוחות פיננסיים',
  patient_financial: 'מידע פיננסי של מטופל',
  lab_orders: 'הזמנות מעבדה',
  test_results: 'תוצאות בדיקות',
  quality_control: 'בקרת איכות',
  equipment_maintenance: 'תחזוקת ציוד',

      // Enhanced User Form
      selectRole: 'בחר תפקיד',
      enterFirstName: 'הכנס שם פרטי',
      enterLastName: 'הכנס שם משפחה',
      enterSecurePassword: 'הכנס סיסמה מאובטחת',
      passwordRequirements: 'נדרשים לפחות 8 תווים',
      updateUserDetails: 'עדכן פרטי משתמש והרשאות',
  // Role Names
  admin: 'מנהל מערכת',
  medical_director: 'מנהל רפואי',
  doctor: 'רופא',
  doctor_specialist: 'רופא מומחה',
  nurse_rn: 'אחות מוסמכת',
  nurse_lpn: 'אחות מעשית',
  secretary: 'מזכירה',
  billing: 'גבייה',
  lab_tech: 'טכנאי מעבדה',
      createNewUserAccount: 'צור חשבון משתמש חדש עם תפקיד והרשאות',

      // Role Permissions
      user_management: 'ניהול משתמשים',
      practice_config: 'הגדרות מרפאה',
      billing: 'חיוב',
      audit: 'ביקורת',
      emergency_access: 'גישה חירום',
      medical_supervision: 'פיקוח רפואי',
      clinical_protocols: 'פרוטוקולים קליניים',
      quality_assurance: 'בטחון איכות',
      medical_audit: 'ביקורת רפואית',
      patient_full_access: 'גישה מלאה למטופלים',
      prescriptions: 'מרשמים',
      medical_history: 'היסטוריה רפואית',
      ai_tools: 'כלי בינה מלאכותית',
      consultations: 'ייעוצים',
      patient_limited_access: 'גישה מוגבלת למטופלים',
      specialist_notes: 'הערות מומחה',
      diagnostics: 'אבחונים',
      referrals: 'הפניות',
      patient_demographics: 'נתונים דמוגרפיים',
      vital_signs: 'סימנים חיוניים',
      nursing_notes: 'הערות סיעוד',
      medication_admin: 'מתן תרופות',
      care_plans: 'תוכניות טיפול',
      patient_basic_info: 'מידע בסיסי על מטופל',
      vital_signs_entry: 'הזנת סימנים חיוניים',
      basic_documentation: 'תיעוד בסיסי',
      scheduling: 'תזמון',
      document_management: 'ניהול מסמכים',
      insurance_verification: 'אימות ביטוח',
      billing_operations: 'פעולות חיוב',
      financial_reporting: 'דיווח כספי',
      lab_orders: 'הזמנות מעבדה',
      test_results: 'תוצאות בדיקות',
      quality_control: 'בקרת איכות',
      equipment_maintenance: 'תחזוקת ציוד',

      // RBAC Permission Names (Hebrew)
      read_patients: 'קריאת מטופלים',
      write_patients: 'כתיבת מטופלים',
      delete_patients: 'מחיקת מטופלים',
      export_patients: 'ייצוא מטופלים',
      read_documents: 'קריאת מסמכים',
      write_documents: 'כתיבת מסמכים',
      delete_documents: 'מחיקת מסמכים',
      export_documents: 'ייצוא מסמכים',
      manage_users: 'ניהול משתמשים',
      assign_roles: 'הקצאת תפקידים',
      view_reports: 'צפייה בדוחות',
      system_admin: 'מנהל מערכת',
      manage_practice_settings: 'ניהול הגדרות מרפאה',
      manage_billing: 'ניהול חיוב',
      view_audit_logs: 'צפייה ברישומי ביקורת',
      orders_create: 'יצירת הזמנות',
      orders_manage_results: 'ניהול תוצאות',

      // RBAC Permission Descriptions (Hebrew)
      read_patients_description: 'צפייה בנתונים דמוגרפיים וקליניים של מטופלים',
      write_patients_description: 'יצירה או עדכון של נתוני מטופלים וביקורים',
      delete_patients_description: 'מחיקת רשומות מטופלים (מחיקה רכה)',
      export_patients_description: 'ייצוא נתוני מטופלים (CSV/JSON)',
      read_documents_description: 'צפייה במסמכים שהועלו',
      write_documents_description: 'העלאה ועריכה של מסמכים',
      delete_documents_description: 'מחיקת מסמכים (מחיקה רכה)',
      export_documents_description: 'ייצוא מטא-נתונים של מסמכים',
      manage_users_description: 'יצירה, עריכה והשבתה של משתמשים',
      assign_roles_description: 'הקצאת תפקידים למשתמשים',
      view_reports_description: 'גישה ללוחות מחוונים של דיווחים',
      system_admin_description: 'גישה מנהלית מלאה',
      manage_practice_settings_description: 'עדכון הגדרות מרפאה',
      manage_billing_description: 'חיוב, ביטוח ופיננסים',
      view_audit_logs_description: 'צפייה ברישומי ביקורת HIPAA',
      orders_create_description: 'יצירת הזמנות מעבדה/רדיולוגיה',
      orders_manage_results_description: 'הזנה ואימות תוצאות מעבדה',

      // RBAC UI Enhancement (Hebrew)
      selectRoleToManagePermissions: 'בחר תפקיד לניהול הרשאות',
      chooseRoleFromDropdown: 'בחר תפקיד מהרשימה הנפתחת למעלה כדי לצפות ולערוך את ההרשאות שלו',
      patients: 'מטופלים',
      documents: 'מסמכים',
      admin: 'מנהל מערכת',
      compliance: 'עמידה ברגולוציה',
      orders: 'הזמנות',
      practice: 'מרפאה',
      other: 'אחר',
      save: 'שמור',
      saving: 'שומר...',
      saved: 'שמור',
      cancel: 'ביטול',
      practiceName: 'מרפאה',
      currentClinic: 'מרפאה נוכחית',
      systemAdministrator: 'מנהל מערכת',
      practice: 'מרפאה',
      developmentClinic: 'המרפאה של הפיתוח',

      // Security warnings
      securityWarningTitle: 'אזהרת אבטחה',
      securityWarningMessage: 'תתנתק אוטומטית עקב חוסר פעילות מסיבות אבטחה.',
      securityWarningBrowserClose: 'אתה מחובר למערכת רפואית. האם אתה בטוח שברצונך לעזוב?',
      extendSession: 'המשך לעבוד',
      logoutNow: 'התנתק עכשיו',
      medicalSystemWarning: 'אזהרת מערכת רפואית',
      browserCloseWarningMessage: 'אתה מחובר למערכת רפואית עם מידע רגיש של מטופלים. סגירת הדפדפן תנתק אותך מהמערכת מסיבות אבטחה.',
      stayInSystem: 'הישאר במערכת',
      logoutAndClose: 'התנתק וסגור',
      securityNotice: 'הודעת אבטחה',
      medicalDataProtection: 'מידע רפואי מוגן על פי חוקי HIPAA ודרישות אבטחה',
      adminRoleProtected: 'הרשאות תפקיד מנהל מערכת מוגנות ולא ניתן לשנותן',

      // Practice Deletion (Danger Zone) - Hebrew
      dangerZone: 'אזור סכנה',
      dangerZoneDescription: 'פעולות בלתי הפיכות והרסניות',
      deleteClinic: 'מחק מרפאה',
      deleteClinicWarning: 'פעולה זו תמחק לצמיתות את כל המרפאה, כל המשתמשים, המטופלים, המסמכים והנתונים. לא ניתן לבטל פעולה זו.',
      deleteClinicButton: 'מחק מרפאה',
      confirmDeleteClinic: 'אשר מחיקת מרפאה',
      deleteClinicFinalWarning: 'פעולה זו תמחק לצמיתות את הכל ולא ניתן לבטלה.',
      typeToConfirm: 'הקלד את תת-הדומיין של המרפאה לאישור',
      deleteClinicPermanently: 'מחק לצמיתות',
      deleting: 'מוחק...',
      deleteConfirmationMismatch: 'טקסט האישור אינו תואם',
      errorDeletingClinic: 'נכשל במחיקת המרפאה',
      show: 'הצג',
      hide: 'הסתר',

      // Password Reset & Email Change - Hebrew
      passwordManagement: 'ניהול סיסמה',
      resetPassword: 'איפוס סיסמה',
      newPassword: 'סיסמה חדשה',
      enterNewPassword: 'הזן סיסמה חדשה',
      confirmNewPassword: 'אשר סיסמה חדשה',
      updatePassword: 'עדכן סיסמה',
      resetPasswordFailed: 'נכשל באיפוס הסיסמה',
      invalidResetLink: 'קישור איפוס לא תקין',
      resetLinkExpired: 'קישור איפוס זה לא תקין או פג תוקף. אנא בקש חדש.',
      requestNewResetLink: 'בקש קישור איפוס חדש',
      validatingResetLink: 'מאמת קישור איפוס...',
      redirectingToLogin: 'מפנה להתחברות...',
      passwordUpdatedSuccessfully: 'הסיסמה עודכנה בהצלחה',
      errorUpdatingPassword: 'נכשל בעדכון הסיסמה',
      emailManagement: 'ניהול אימייל',
      changeEmail: 'שנה אימייל',
      currentEmail: 'אימייל נוכחי',
      newEmailAddress: 'כתובת אימייל חדשה',
      enterNewEmail: 'הזן כתובת אימייל חדשה',
      updateEmail: 'עדכן אימייל',
      emailUpdatedSuccessfully: 'האימייל עודכן בהצלחה',
      errorUpdatingEmail: 'נכשל בעדכון האימייל',
      updating: 'מעדכן...',
      sessionExpired: 'הפגישה פגה. אנא התחבר שוב.',
      sendLoginLink: 'שלח קישור התחברות',
      sendingLoginLink: 'שולח קישור התחברות...',
      invalidLoginLink: 'קישור התחברות לא תקין או פג תוקף',
      loginSuccessful: 'התחברות הצליחה! מפנה...',
      processingLogin: 'מעבד התחברות...',
      pleaseWait: 'אנא המתן בזמן שאנו מחברים אותך.',
      backToLogin: 'חזור להתחברות',

      // Patient Management Enhanced
      analytics: 'אנליטיקה',
      export: 'ייצוא',
      patientAnalytics: 'אנליטיקת מטופלים',
      totalPatients: 'סך הכל מטופלים',
      averageAge: 'גיל ממוצע',
      newThisMonth: 'חדשים החודש',
      genderDistribution: 'התפלגות מגדר',
      male: 'זכר',
      female: 'נקבה',
      other: 'אחר',
      loadingAnalytics: 'טוען אנליטיקה...',
      errorLoadingAnalytics: 'שגיאה בטעינת אנליטיקה',
      exportCompleted: 'הייצוא הושלם בהצלחה',
      errorExporting: 'שגיאה בייצוא נתונים',
      failedToFetchPatients: 'נכשל בטעינת מטופלים',

      // Document Management Enhanced
      documentAnalytics: 'אנליטיקת מסמכים',
      totalDocuments: 'סך הכל מסמכים',
      analysisRate: 'שיעור ניתוח',
      avgConfidence: 'ביטחון ממוצע',
      documentTypes: 'סוגי מסמכים',
      documentCategories: 'קטגוריות מסמכים',
      loadingAnalytics: 'טוען אנליטיקה...',

      // Landing Page
      intelligentMedicalAssistant: 'פלטפורמה רפואית אוטונומית מתקדמת',

      // Navigation
      userDisplayFormat: 'דוקטור {name}',

      // Home Page
      homePageTitle: 'IntelliCare - פלטפורמה רפואית אוטונומית מתקדמת',
      welcome: 'ברוכים הבאים',
      diagnosisDescription: 'קבלו אבחון רפואי מבוסס בינה מלאכותית והמלצות טיפול',
      patientsDescription: 'נהלו את רשומות המטופלים וההיסטוריה הרפואית',
      medicalRecords: 'רשומות רפואיות',
      medicalRecordsDescription: 'גישה וניהול של תיעוד רפואי מקיף',
      analytics: 'אנליטיקה',
      analyticsDescription: 'צפו בתובנות ואנליטיקה מנתונים רפואיים',
      settings: 'הגדרות',
      settingsDescription: 'הגדירו את החשבון והעדפות המערכת שלכם',
      help: 'עזרה',
      helpDescription: 'קבלו תמיכה ולמדו כיצד להשתמש בפלטפורמה',

      // New Visit
      newVisit: 'ביקור חדש',
      visitDate: 'תאריך הביקור',
      visitTime: 'שעת הביקור',
      visitType: 'סוג הביקור',
      routineVisit: 'ביקור שגרתי',
      emergencyVisit: 'ביקור חירום',
      followUpVisit: 'ביקור מעקב',
      consultationVisit: 'ייעוץ',
      visitNotes: 'הערות נוספות',
      followUpDate: 'תאריך מעקב',
      saveVisit: 'שמור ביקור',
      symptomsPlaceholder: 'תאר את התסמינים של המטופל...',
      diagnosisPlaceholder: 'הכנס את האבחנה...',
      treatmentPlaceholder: 'תאר את תוכנית הטיפול...',
      notesPlaceholder: 'הערות או תצפיות נוספות...',
      saving: 'שומר...',

      // New Visit Form Sections
      visitInformation: 'מידע על הביקור',
      vitalSigns: 'סימנים חיוניים',
      bloodPressure: 'לחץ דם',
      heartRate: 'דופק',
      temperature: 'טמפרטורה',
      weight: 'משקל',
      clinicalInformation: 'מידע קליני',
      chiefComplaint: 'תלונה עיקרית',
      chiefComplaintPlaceholder: 'הסיבה העיקרית לביקור...',
      assessmentAndPlan: 'הערכה ותוכנית',
      additionalInformation: 'מידע נוסף',
      fieldRequired: 'שדה זה נדרש',
      selectDate: 'בחר תאריך...',
      followUp: 'למעקב',
      landingDescription: 'מערכת אבחון רפואי מתקדמת המופעלת על ידי בינה מלאכותית וניהול מטופלים המיועדת לאנשי מקצוע רפואיים',
      getStarted: 'התחל',
      smartDiagnosis: 'אבחון חכם',
      smartDiagnosisDesc: 'סיוע אבחוני מופעל על ידי בינה מלאכותית עם דיוק גבוה',
      patientManagement: 'ניהול מטופלים',
      patientManagementDesc: 'ניהול מקיף של רשומות מטופלים והיסטוריה',
      secureData: 'נתונים מאובטחים',
      secureDataDesc: 'אחסון נתונים רפואיים מאובטח התואם HIPAA',
      backToHome: 'חזור לעמוד הבית',

      // Company Landing Page
      home: 'בית',
      about: 'אודות',
      company: 'החברה',
      contact: 'צור קשר',
      login: 'התחבר',
      logout: 'התנתק',
      founderCEO: 'מייסד ומנכ"ל',
      eranGross: 'ערן גרוס',
      companyMission: 'המשימה שלנו',
      missionStatement: 'לחולל מהפכה בתחום הבריאות באמצעות מערכות אבחון רפואי חכמות המופעלות על ידי בינה מלאכותית וניהול מטופלים, תוך הפיכת בריאות איכותית לנגישה ויעילה עבור אנשי מקצוע רפואיים ברחבי העולם.',
      aboutCompany: 'אודות IntelliCare',
      companyDescription: 'IntelliCare היא חברת טכנולוגיה רפואית חדשנית שנוסדה בשנת 2024, המוקדשת לשינוי תחום הבריאות באמצעות בינה מלאכותית. מערכות האבחון המתקדמות שלנו עוזרות לאנשי מקצוע רפואיים לקבל החלטות מהירות ומדויקות יותר, ובסופו של דבר להציל חיים ולשפר תוצאות מטופלים.',
      whyChooseUs: 'למה לבחור ב-IntelliCare?',
      aiPowered: 'מופעל על ידי בינה מלאכותית',
      aiPoweredDesc: 'אלגוריתמי למידת מכונה מתקדמים המאומנים על מאגרי נתונים רפואיים נרחבים',
      secure: 'מאובטח ותואם תקנות',
      secureDesc: 'אבטחה תואמת HIPAA המבטיחה הגנה על נתוני מטופלים',
      accurate: 'דיוק גבוה',
      accurateDesc: 'דיוק אבחוני מוכח עם יכולות למידה מתמשכות',
      support: 'תמיכה 24/7',
      supportDesc: 'תמיכה טכנית מסביב לשעון עבור אנשי מקצוע רפואיים',
      getStartedToday: 'התחל היום',
      joinThousands: 'הצטרף לאלפי אנשי מקצוע רפואיים שכבר משתמשים ב-IntelliCare',
      startFreeTrial: 'התחל ניסיון חינם',
      contactSales: 'צור קשר עם המכירות',
      learnMore: 'למד עוד',

      // Diagnosis
      medicalDiagnosisTitle: 'אבחון רפואי',
      aiPoweredDiagnosis: 'סיוע אבחוני מופעל על ידי בינה מלאכותית',
      patientAssessment: 'הערכת מטופל',
      selectExistingPatient: 'בחר מטופל קיים (אופציונלי)',
      searchPatients: 'חפש מטופלים לפי שם...',
      clearSelection: 'נקה בחירה (הזנה ידנית)',
      currentSymptoms: 'תסמינים נוכחיים',
      describeSymptoms: 'תאר תסמיני המטופל (למשל, חום, שיעול, כאב ראש)',
      describeCurrentSymptoms: 'תאר תסמינים נוכחיים עבור המטופל הנבחר (למשל, חום, שיעול, כאב ראש)',
      patientAge: 'גיל המטופל',
      relevantMedicalHistory: 'היסטוריה רפואית רלוונטית (אופציונלי)',
      medicalHistoryAutoPopulated: 'היסטוריה רפואית מולאה אוטומטית מרשומות המטופל (ניתן לערוך במידת הצורך)',
      patientDataLoaded: 'נתוני המטופל נטענו. כעת תוכל להזין תסמינים נוכחיים לאבחון.',
      enterCurrentSymptoms: 'הזן את התסמינים הנוכחיים שברצונך לאבחן עבור מטופל זה',
      enterCurrentSymptomsForPatient: 'הזן את התסמינים הנוכחיים שברצונך לאבחן עבור מטופל זה',
      medicalHistoryPopulated: 'היסטוריה רפואית מולאה מרשומות המטופל',
      medicalHistoryPopulatedFromRecords: '✓ היסטוריה רפואית מולאה מרשומות המטופל',
      enterCurrentSymptomsForPatient:'הזן את התסמינים הנוכחיים שברצונך לאבחן עבור מטופל זה',

      // Processing Diagnosis
      processingDiagnosis: 'מעבד אבחון',
      processingSteps: 'שלבי עיבוד',
      initializingDiagnosisRequest: 'מאתחל בקשת אבחון...',
      validatingPatientInformation: 'מאמת מידע מטופל...',
      connectingToMediPhiModel: 'מתחבר למודל MediGemma AI...',
      processingComprehensiveMedicalHistory: 'מעבד היסטוריה רפואית מקיפה...',
      aiModelAnalyzingSymptoms: 'מודל AI מנתח תסמינים ונתונים רפואיים...',
      generatingTreatmentRecommendations: 'מייצר המלצות טיפול...',
      finalizingDiagnosisResults: 'מסיים תוצאות אבחון...',
      diagnosisCompletedSuccessfully: 'האבחון הושלם בהצלחה!',
      resumingDiagnosis: 'מחדש אבחון...',
      checkingForActiveSession: 'בודק אבחון פעיל...',
      pleaseWait: 'אנא המתן...',
      unableToTrackProgress: 'לא ניתן לעקוב אחר התקדמות האבחון. אנא נסה שוב.',
      unableToResumeDiagnosis: 'לא ניתן לחדש את האבחון. אנא נסה שוב.',
      diagnosisCompletedButNoResults: 'האבחון הושלם אך התוצאות אינן זמינות. אנא נסה שוב.',
      diagnosisCompletedButResultsNotAvailable: 'האבחון הושלם אך לא ניתן היה לאחזר את התוצאות.',
      pleaseWaitAnalyzing: 'אנא המתן: מודל הבינה המלאכותית מנתח את ההיסטוריה הרפואית המקיפה של המטופל שלך. תהליך זה עשוי לקחת 1-2 דקות עבור מקרים מורכבים.',

      // Error Messages & UI Actions
      errorOccurredDuringProcessing: 'אירעה שגיאה במהלך עיבוד האבחון',
      failedToGetDiagnosis: 'נכשל בקבלת אבחון. אנא נסה שוב.',
      diagnosisTimeout: 'בקשת האבחון פג זמנה. אנא נסה שוב.',
      diagnosisStopped: 'האבחון נעצר. תוכל להתחיל אבחון חדש בכל עת.',
      collapseDetails: 'כווץ פרטים',
      expandDetails: 'הרחב פרטים',

      // Results Page
      diagnosisResults: 'תוצאות אבחון',
      newAnalysis: 'ניתוח חדש',
      overallDiagnosis: 'אבחון כללי',
      riskLevel: 'רמת סיכון',
      confidence: 'רמת ביטחון',
      treatmentRecommendations: 'המלצות טיפול',
      importantDisclaimer: 'חשוב: זהו אבחון בסיוע בינה מלאכותית. אנא התייעץ עם איש מקצוע רפואי לאבחון וטיפול סופיים.',
      getDiagnosis: 'קבל אבחון',
      analyzingSymptoms: 'מנתח תסמינים...',
      processingDiagnosis: 'מעבד אבחון',
      noPatientFound: 'לא נמצאו מטופלים התואמים ל',
      diagnosisResults: 'תוצאות אבחון',
      newAnalysis: 'ניתוח חדש',
      overallDiagnosis: 'אבחון כללי',
      riskLevel: 'רמת סיכון',
      confidence: 'רמת ביטחון',
      treatmentRecommendations: 'המלצות טיפול',
      showLess: 'הצג פחות',
      showMorePoints: 'הצג נקודות נוספות',
      pleaseWait: 'אנא המתן: מודל הבינה המלאכותית מנתח את ההיסטוריה הרפואית המקיפה של המטופל שלך. תהליך זה עשוי לקחת 1-2 דקות עבור מקרים מורכבים.',
      stopDiagnosis: 'עצור אבחון',

      // Patient Detail
      backToPatients: 'חזור למטופלים',
      uploading: 'מעלה...',
      savePatient: 'שמור',
      cancelEdit: 'בטל',
      patientInformation: 'מידע על המטופל',
      registrationDate: 'תאריך רישום',
      doctorsSummary: 'סיכום הרופא',
      noDoctorSummary: 'אין סיכום רופא זמין',
      clickEditToAdd: 'לחץ על "ערוך מטופל" כדי להוסיף הערכה ראשונית',
      doctorsAssessment: 'הערכת הרופא',
      latestMedicalHistory: 'היסטוריה רפואית אחרונה',
      recentMedicalEntry: 'רשומה רפואית אחרונה',
      viewCompleteMedicalHistory: 'צפה בהיסטוריה רפואית מלאה',
      medicalHistoryTitle: 'היסטוריה רפואית',
      noMedicalHistoryAvailable: 'אין היסטוריה רפואית זמינה',
      medicalHistoryWillAppear: 'היסטוריה רפואית תופיע כאן כאשר מסמכים יועלו ויעובדו.',
      uploadMedicalDocuments: 'העלה מסמכים רפואיים בלשונית המסמכים כדי ליצור רשומות היסטוריה רפואית.',
      patientActivityTimeline: 'ציר זמן פעילות המטופל',
      patientRegistration: 'רישום מטופל',
      patientWasRegistered: 'המטופל נרשם במערכת IntelliCare ונוצרה רשומה רפואית',
      symptomsAnalyzed: 'תסמינים שנותחו',
      expand: 'הרחב',
      collapse: 'כווץ',
      detailedAnalysis: 'ניתוח מפורט',
      aiAnalysisRecommendations: 'ניתוח והמלצות בינה מלאכותית',
      viewAllAnalyses: 'צפה בכל הניתוחים הרפואיים המופעלים על ידי בינה מלאכותית והמלצות הטיפול עבור מטופל זה.',
      loadingAnalyses: 'טוען ניתוחים...',
      analysisDate: 'תאריך ניתוח',
      symptomsAnalysisRecommendations: 'ניתוח תסמינים והמלצות',
      symptomsAnalysisWithExplanations: 'ניתוח תסמינים עם הסברים מפורטים',
      noAiAnalysesAvailable: 'אין ניתוחי בינה מלאכותית זמינים',
      noAnalysesPerformed: 'עדיין לא בוצעו ניתוחים רפואיים מופעלי בינה מלאכותית עבור מטופל זה.',
      toCreateAnalysis: 'כדי ליצור ניתוח, עבור לעמוד האבחון הרפואי, בחר מטופל זה, הזן תסמינים והפעל אבחון.',
      createNewAnalysis: 'צור ניתוח חדש',
      professionalTreatmentRecommendations: 'המלצות טיפול מקצועיות',

      // Document Viewer
      documentsFor: 'מסמכים עבור',
      totalDocuments: 'סך הכל מסמכים',
      manageViewDocuments: 'נהל וצפה בכל מסמכי המטופל וקבצים רפואיים',
      documents: 'מסמכים',
      folders: 'תיקיות',
      searchDocuments: 'חפש מסמכים...',
      allFolders: 'כל התיקיות',
      allTypes: 'כל הסוגים',
      noDocumentsFound: 'לא נמצאו מסמכים',
      adjustSearchCriteria: 'נסה להתאים את קריטריוני החיפוש או המסננים',
      noDocumentsUploaded: 'עדיין לא הועלו מסמכים עבור מטופל זה.',
      viewDocument: 'צפה במסמך',
      view: 'צפה',
      download: 'הורד',
      details: 'פרטים',
      hide: 'הסתר',
      deleteDocument: 'מחק',
      fileType: 'סוג קובץ',
      mimeType: 'סוג MIME',
      folder: 'תיקייה',
      aiClassification: 'סיווג בינה מלאכותית',
      medicalInsights: 'תובנות רפואיות',
      recommendations: 'המלצות',
      processingStatus: 'סטטוס עיבוד',
      completed: 'הושלם',
      processing: 'מעבד',
      failed: 'נכשל',
      confirmDeleteDocument: 'האם אתה בטוח שברצונך למחוק מסמך זה?',

      // File Types
      image: 'תמונה',
      pdf: 'מסמך PDF',
      document: 'מסמך',
      spreadsheet: 'גיליון אלקטרוני',
      medical_imaging: 'הדמיה רפואית',
      other: 'אחר',

      documentSize: 'גודל מסמך',
      uploadDate: 'תאריך העלאה',
      lastModified: 'שונה לאחרונה',
      noPreviewAvailable: 'אין תצוגה מקדימה זמינה',
      clickToDownload: 'לחץ להורדה',
      documentInfo: 'מידע מסמך',
      classification: 'סיווג',
      insights: 'תובנות',
      medicalRecommendations: 'המלצות רפואיות',
      analysisResults: 'תוצאות ניתוח',
      documentPreview: 'תצוגה מקדימה',
      openInNewTab: 'פתח בלשונית חדשה',
      fileSize: 'גודל קובץ',
      uploadedOn: 'הועלה ב',
      modifiedOn: 'שונה ב',
      createdOn: 'נוצר ב',
      documentActions: 'פעולות מסמך',
      documentList: 'רשימת מסמכים',
      groupByFolder: 'קבץ לפי תיקייה',
      sortBy: 'מיין לפי',
      sortByName: 'מיין לפי שם',
      sortByDate: 'מיין לפי תאריך',
      sortBySize: 'מיין לפי גודל',
      filterByType: 'סנן לפי סוג',
      showAll: 'הצג הכל',
      documentType: 'סוג מסמך',
      medicalReport: 'דוח רפואי',
      labResults: 'תוצאות מעבדה',
      imagingStudy: 'מחקר הדמיה',
      prescription: 'מרשם',
      referral: 'הפניה',
      generalDocument: 'מסמך כללי',
      unknownType: 'סוג לא ידוע',

      // Common UI Elements
      loadingPatientsEllipsis: 'טוען מטופלים...',
      loadingDocuments: 'טוען מסמכים...',
      errorLoadingPatient: 'שגיאה בטעינת מטופל',
      failedToFetchPatient: 'נכשל בטעינת מטופל',
      unknownPatient: 'מטופל לא ידוע',
      notProvided: 'לא סופק',
      unknown: 'לא ידוע',
      unknownDate: 'תאריך לא ידוע',
      yearsOld: 'שנים',

      // Messages
      successMessage: 'הפעולה הושלמה בהצלחה',
      errorMessage: 'אירעה שגיאה',
      confirmDelete: 'האם אתה בטוח שברצונך למחוק פריט זה?',
      itemDeleted: 'הפריט נמחק בהצלחה',
      itemRestored: 'הפריט שוחזר בהצלחה',

      // Patient Detail Page - Missing translations
      editPatient: 'ערוך מטופל',
      uploadFiles: 'העלה קבצים',
      backToPatients: 'חזור למטופלים',
      overview: 'סקירה כללית',
      documents: 'מסמכים',
      history: 'היסטוריה',
      analysis: 'ניתוח',
      analysisDate: 'תאריך ניתוח',
      confidence: 'רמת ביטחון',
      risk: 'סיכון',
      riskHigh: 'גבוה',
      riskMedium: 'בינוני',
      riskLow: 'נמוך',
      symptomsAnalysisRecommendations: 'ניתוח תסמינים והמלצות',
      collapse: 'כווץ',
      expand: 'הרחב',
      symptomsAnalysis: 'ניתוח תסמינים',
      symptomsAnalysisWithExplanations: 'ניתוח תסמינים עם הסברים מפורטים',
      treatmentRecommendations: 'המלצות טיפול',
      professionalTreatmentRecommendations: 'המלצות טיפול מקצועיות',
      aiAnalysisDisclaimer: 'זהו ניתוח בעזרת בינה מלאכותית. אנא התייעץ עם איש מקצוע רפואי לאבחון וטיפול סופיים.',
      noAnalysesAvailable: 'אין ניתוחי בינה מלאכותית זמינים',
      noAnalysesDescription: 'עדיין לא בוצעו ניתוחים רפואיים מבוססי בינה מלאכותית עבור מטופל זה.',
      createAnalysisInstructions: 'ליצירת ניתוח, עבור לעמוד האבחון הרפואי, בחר מטופל זה, הזן תסמינים והפעל אבחון.',
      createNewAnalysis: 'צור ניתוח חדש',
      showLess: 'הצג פחות',
      showMorePoints: 'הצג {count} נקודות נוספות',
      detailedAnalysis: 'ניתוח מפורט',
      at: 'בשעה',
      medicalEntry: 'רשומה רפואית',
      entryDate: 'תאריך רשומה',
      symptomsAnalyzed: 'תסמינים שנותחו',
      date: 'תאריך',
      symptoms: 'תסמינים',
      treatment: 'טיפול',
      unknownDate: 'תאריך לא ידוע',
      patientInformation: 'פרטי המטופל',
      doctorsSummary: 'סיכום הרופא',
      latestMedicalHistory: 'היסטוריה רפואית אחרונה',
      medicalHistory: 'היסטוריה רפואית',
      patientActivityTimeline: 'ציר זמן פעילות המטופל',
      patientRegistration: 'רישום מטופל',
      patientRegistrationDescription: 'המטופל נרשם במערכת אינטליקייר ונוצרה רשומה רפואית',
      noMedicalHistoryAvailable: 'אין היסטוריה רפואית זמינה',
      medicalHistoryWillAppear: 'היסטוריה רפואית תופיע כאן כאשר מסמכים יועלו ויעובדו.',
      uploadDocumentsInstructions: 'העלה מסמכים רפואיים בלשונית המסמכים כדי ליצור רשומות היסטוריה רפואית.',
      fullName: 'שם מלא',
      age: 'גיל',
      gender: 'מין',
      email: 'אימייל',
      phone: 'טלפון',
      registrationDate: 'תאריך רישום',
      yearsOld: 'שנים',
      notProvided: 'לא סופק',
      unknown: 'לא ידוע',
      male: 'זכר',
      female: 'נקבה',
      other: 'אחר',
      selectGender: 'בחר מין',
      name: 'שם',
      save: 'שמור',
      cancel: 'בטל',
      noDoctorsSummaryAvailable: 'אין סיכום רופא זמין',
      clickEditToAddAssessment: 'לחץ על "ערוך מטופל" כדי להוסיף הערכה ראשונית',
      enterDoctorsSummary: 'הזן סיכום רופא, הערכה ראשונית או הערות...',
      doctorsAssessment: 'הערכת הרופא',
      recentMedicalEntry: 'רשומה רפואית אחרונה',
      viewCompleteMedicalHistory: 'צפה בהיסטוריה רפואית מלאה →',
      uploadDocumentsInstructions: 'העלה מסמכים רפואיים בלשונית המסמכים כדי ליצור רשומות היסטוריה רפואית.',
      loadingPatientDetails: 'טוען פרטי מטופל...',
      errorLoadingPatient: 'שגיאה בטעינת המטופל',
      failedToFetchPatient: 'נכשל בטעינת המטופל',
      failedToUpdatePatient: 'נכשל בעדכון המטופל',
      failedToUploadFiles: 'נכשל בהעלאת קבצים',
      uploading: 'מעלה...',
      waitingForAiProcessing: 'ממתין לעיבוד בינה מלאכותית...',
      refreshingPatientData: 'מרענן נתוני מטופל...',
      patientDataRefreshed: 'נתוני המטופל רועננו - בדוק את לשונית ההיסטוריה!',
      loadingAnalyses: 'טוען ניתוחים...',

      // Voice Interface - Hebrew
      voiceAssistant: 'עוזר קולי',
      clickToSpeak: 'לחץ כדי לדבר',
      recording: 'מקליט...',
      processingVoice: 'מעבד...',
      youSaid: 'אמרת:',
      assistantResponse: 'עוזר:',
      microphoneAccessError: 'גישה למיקרופון נדחתה',
      voiceProcessingError: 'עיבוד קולי נכשל',
      audioNotSupported: 'אודיו לא נתמך',

      // Field labels
      phoneLabel: 'טלפון:',
      emailLabel: 'אימייל:',
      genderLabel: 'מין:',
      ageLabel: 'גיל:',
      fullNameLabel: 'שם מלא:',
      registrationDateLabel: 'תאריך רישום:',
      doctorsSummaryTitle: 'סיכום הרופא',
      doctorsAssessmentTitle: 'הערכת הרופא',
      professionalMedicalAssessment: 'הערכה רפואית מקצועית והערות',

      // Medical History Section
      latestMedicalHistoryTitle: 'היסטוריה רפואית אחרונה',
      medicalHistoryMainTitle: 'היסטוריה רפואית',
      entryDate: 'תאריך רשומה',
      date: 'תאריך',
      treatment: 'טיפול',
      medicalEntry: 'רשומה רפואית',
      treatmentPlan: 'תכנית טיפול',

      // Medical History Modal and Views
      viewAllEntries: 'צפה בכל הרשומות',
      completeHistory: 'היסטוריה מלאה',
      recentEntries: 'רשומות אחרונות',
      noEntriesFound: 'לא נמצאו רשומות',
      entriesTotal: 'רשומות בסך הכל',
      cardView: 'תצוגת כרטיסים',
      lineView: 'תצוגת שורות',

      // Delete and Restore Actions
      deleteEntry: 'מחק רשומה',
      confirmDelete: 'אשר מחיקה',
      restoreEntry: 'שחזר רשומה',
      recentlyDeleted: 'נמחק לאחרונה',
      permanentDelete: 'מחיקה סופית',
      softDelete: 'העבר לפח',
      deleteConfirmMessage: 'האם אתה בטוח שברצונך למחוק רשומה זו?',
      restoreConfirmMessage: 'לשחזר רשומה זו להיסטוריה הרפואית?',

      // Edit Medical History
      editEntry: 'ערוך רשומה',
      editMedicalHistory: 'ערוך היסטוריה רפואית',
      saveChanges: 'שמור שינויים',
      cancelEdit: 'בטל עריכה',
      editDate: 'ערוך תאריך',
      editSymptoms: 'ערוך תסמינים',
      editDiagnosis: 'ערוך אבחנה',
      editTreatment: 'ערוך טיפול',
      editNotes: 'ערוך הערות',

      // Patient Activity Timeline
      patientActivityTimelineTitle: 'ציר זמן פעילות המטופל',
      patientRegistrationTitle: 'רישום מטופל',
      patientRegistrationDescription: 'המטופל נרשם במערכת IntelliCare ונוצרה רשומה רפואית',

      // Missing translations from screenshots
      ourStory: 'הסיפור שלנו',
      aboutCompanyText1: 'IntelliCare היא חברת טכנולוגיה רפואית חדשנית שנוסדה בשנת 2024, המוקדשת לשינוי תחום הבריאות באמצעות בינה מלאכותית. מערכות האבחון המתקדמות שלנו עוזרות לאנשי מקצוע רפואיים לקבל החלטות מהירות ומדויקות יותר, ובסופו של דבר להציל חיים ולשפר תוצאות מטופלים.',
      aboutCompanyText2: 'IntelliCare משלבת טכנולוגיה מתקדמת עם מומחיות רפואית עמוקה כדי ליצור פתרונות שבאמת עושים הבדל בטיפול במטופלים.',
      ourValues: 'הערכים שלנו',
      innovation: 'חדשנות',
      innovationDesc: 'דוחפים ללא הרף את הגבולות של טכנולוגיית בינה מלאכותית רפואית',
      trust: 'אמון',
      trustDesc: 'בונים מערכות אמינות ושקופות שאנשי מקצוע רפואיים יכולים לסמוך עליהן',
      excellence: 'מצוינות',
      excellenceDesc: 'מחויבים לסטנדרטים הגבוהים ביותר בדיוק רפואי ובטיחות מטופלים',
      ourTechnology: 'הטכנולוגיה שלנו',
      technologyDesc: 'הפלטפורמה שלנו מנצלת מודלים מתקדמים של למידת מכונה, עיבוד שפה טבעית וגרפי ידע רפואי כדי לספק סיוע אבחוני חכם הלומד ומשתפר עם הזמן.',
      futureVision: 'אנו רואים עתיד שבו כלי בריאות מופעלי בינה מלאכותית משולבים בצורה חלקה בפרקטיקה הרפואית, משפרים את המומחיות האנושית במקום להחליף אותה, והופכים בריאות איכותית לנגישה לכולם, בכל מקום.',

      // Contact page missing translations
      contactUs: 'צור קשר',
      ourLocation: 'המיקום שלנו',
      addressStreet: 'רחוב דוד לנדו 16',
      addressCity: 'נס ציונה, ישראל',
      zipCode: 'מיקוד',
      phonenumber:'972-0000000+',
      officeHours: 'שעות המשרד',
      sunday: 'ראשון',
      thursday: 'חמישי',
      friday: 'שישי',
      saturday: 'שבת',
      closed: 'סגור',
      onlineSupport: 'תמיכה מקוונת',
      available24_7: 'זמין 24/7',
      responseTime: 'זמן תגובה',
      hours: 'שעות',
      getInTouch: 'צור קשר',
      businessHours: 'שעות פתיחה',
      contactDescription: 'אנחנו כאן כדי לעזור לך לשנות את הפרקטיקה הרפואית שלך עם פתרונות בינה מלאכותית חכמים. פנה אלינו לתמיכה, שאלות או כדי ללמוד עוד על IntelliCare.',

      // Medical Conditions - Hebrew
      hypertension: 'יתר לחץ דם',
      diabetes: 'סוכרת',
      hyperlipidemia: 'היפרליפידמיה',
      heart_disease: 'מחלת לב',
      cardiac_surgery: 'ניתוח לב',
      dyspnea: 'קוצר נשימה',
      edema: 'נפיחות',
      heart_failure: 'אי ספיקת לב',
      smoking: 'היסטוריית עישון',
      asthma: 'אסתמה',
      depression: 'דיכאון',
      anxiety: 'חרדה',
      cancer: 'סרטן',
      stroke: 'שבץ',
      copd: 'מחלת ריאות חסימתית כרונית',
      arthritis: 'דלקת פרקים',

      // Medical Condition Descriptions - Hebrew
      hypertensionDesc: 'לחץ דם גבוה הדורש תרופות ושינויי אורח חיים',
      diabetesDesc: 'רמות גלוקוז גבוהות בדם הדורשות מעקב וטיפול מתמשך',
      hyperlipidemiaDesc: 'רמות כולסטרול גבוהות הדורשות שינויים תזונתיים ותרופות',
      heartDiseaseDesc: 'מצב קרדיווסקולרי הדורש מעקב לבבי וטיפול',
      cardiacSurgeryDesc: 'התערבות כירורגית לבבית קודמת עם מעקב מתמשך',
      dyspneaDesc: 'קושי בנשימה או קוצר נשימה הדורש הערכה',
      edemaDesc: 'צבירת נוזלים ונפיחות הדורשת טיפול רפואי',
      heartFailureDesc: 'תפקוד לב מופחת הדורש טיפול לבבי מיוחד',
      smokingDesc: 'היסטוריה של שימוש בטבק עם סיכונים בריאותיים נלווים',

      // Snake case versions for compatibility
      heart_diseaseDesc: 'מצב קרדיווסקולרי הדורש מעקב לבבי וטיפול',
      cardiac_surgeryDesc: 'התערבות כירורגית לבבית קודמת עם מעקב מתמשך',
      heart_failureDesc: 'תפקוד לב מופחת הדורש טיפול לבבי מיוחד',

      // Document Details Labels - Hebrew
      fileType: 'סוג קובץ',
      mimeType: 'סוג MIME',
      folder: 'קטגוריה',
      aiClassification: 'סיווי בינה מלאכותית',
      medicalInsights: 'תובנות רפואיות',
      recommendations: 'המלצות',
      confidence: 'רמת ביטחון',

      // Document Types - Hebrew
      document: 'מסמך',

      // Document Categories/Folders - Hebrew
      'documents/text': 'מסמכי טקסט',
      'documents/pdf': 'מסמכי PDF',
      'medical_imaging': 'הדמיה רפואית',
      'lab_results': 'תוצאות מעבדה',
      'prescriptions': 'מרשמים',
      'discharge_summary': 'סיכום שחרור',
      'consultation_notes': 'רשומות ייעוץ',
      'consent_forms': 'טפסי הסכמה',
      'vaccination_records': 'אישורי חיסונים',
      'referrals': 'הפניות',
      'medical_certificate': 'אישור מחלה',
      'medical_procedures': 'פרוצדורות רפואיות',

      // Category display names - Hebrew
      medicalProcedures: 'פרוצדורות רפואיות',

      // AI Classification Types - Hebrew
      consultation_notes: 'רשומות ייעוץ',
      lab_results_type: 'תוצאות מעבדה',
      prescriptions_type: 'מרשמים',
      discharge_summary_type: 'סיכום שחרור',
      medical_history_type: 'היסטוריה רפואית',
      imaging_reports: 'דוחות הדמיה',

      // Medical Insights Text - Hebrew
      medicalDocumentReview: 'מסמך רפואי הדורש סקירה קלינית ופרשנות',
      manualReviewProvider: 'סקירה ידנית על ידי ספק שירותי בריאות',
      updatePatientRecord: 'עדכון רשומה רפואית של המטופל',
      labResultsInsight: 'מסמך תוצאות מעבדה עם ערכי בדיקות וטווחי ייחוס',
      prescriptionInsight: 'מסמך מרשם המכיל מידע על תרופות והוראות מינון',
      dischargeInsight: 'סיכום שחרור מבית חולים עם פרטי טיפול והוראות מעקב',
      consultationInsight: 'רשימות יעוץ זוהו. מכילות הערכה קלינית והמלצות',

      // Additional medical insights that might appear - Hebrew
      'Medical document requiring clinical review and interpretation.': 'מסמך רפואי הדורש סקירה קלינית ופרשנות',
      'Manual review by healthcare provider': 'סקירה ידנית על ידי ספק שירותי בריאות',
      'Update patient medical record': 'עדכון רשומה רפואית של המטופל',

      // MIME Type Formats - Hebrew
      'PDF Document': 'מסמך PDF',
      'Word Document (.docx)': 'מסמך Word (.docx)',
      'Word Document (.doc)': 'מסמך Word (.doc)',
      'Excel Spreadsheet (.xlsx)': 'גיליון Excel (.xlsx)',
      'Excel Spreadsheet (.xls)': 'גיליון Excel (.xls)',
      'PowerPoint Presentation (.pptx)': 'מצגת PowerPoint (.pptx)',
      'PowerPoint Presentation (.ppt)': 'מצגת PowerPoint (.ppt)',
      'JPEG Image': 'תמונת JPEG',
      'PNG Image': 'תמונת PNG',
      'GIF Image': 'תמונת GIF',
      'BMP Image': 'תמונת BMP',
      'TIFF Image': 'תמונת TIFF',
      'Text File': 'קובץ טקסט',
      'CSV File': 'קובץ CSV',
      'JSON File': 'קובץ JSON',
      'XML File': 'קובץ XML',
      'HTML File': 'קובץ HTML',
      asthmaDesc: 'מצב נשימתי עם דלקת דרכי נשימה וקשיי נשימה',
      depressionDesc: 'הפרעת מצב רוח הדורשת תמיכה פסיכולוגית וטיפול',
      anxietyDesc: 'הפרעת חרדה הדורשת ניהול ותמיכה',
      cancerDesc: 'מצב ממאיר הדורש טיפול אונקולוגי ומעקב',
      strokeDesc: 'אירוע מוחי-וסקולרי הדורש טיפול נוירולוגי ושיקום',
      copdDesc: 'מחלת ריאות חסימתית כרונית המשפיעה על הנשימה',
      arthritisDesc: 'דלקת פרקים הגורמת לכאב ולהפחתת ניידות',

      // Practice Setup Wizard - Hebrew
      clinicBasicInfo: 'מידע בסיסי על המרפאה',
      practiceName: 'שם המרפאה',
      enterClinicName: 'הזן שם מרפאה',
      subdomain: 'תת-דומיין',
      clinicWebsiteAddress: 'כתובת האתר של המרפאה שלך',
      subdomainExplanation: 'זו תהיה הכתובת הייחודית שלך באינטרנט שבה אתה והצוות שלך תגשו ל-IntelliCare',
      enterSubdomain: 'הזן תת-דומיין',
      enterSubdomainExample: 'לדוגמה: דרכהן, מרפאתמשפחה, רפואתתלאביב',
      subdomainAvailable: 'זמין',
      subdomainTaken: 'כבר תפוס',
      checking: 'בודק...',
      yourWebsiteWillBe: 'האתר שלך יהיה',
      pleaseChooseDifferent: 'אנא בחר שם אחר',
      examples: 'דוגמאות',
      address: 'כתובת',

      addressAndCountry: 'כתובת ומדינה',
      country: 'מדינה',
      israel: 'ישראל',
      unitedStates: 'ארצות הברית',
      canada: 'קנדה',
      unitedKingdom: 'בריטניה',
      streetAddress: 'כתובת רחוב',
      enterStreetAddress: 'הזן כתובת רחוב',
      city: 'עיר',
      enterCity: 'הזן עיר',
      postalCode: 'מיקוד',
      enterPostalCode: 'הזן מיקוד',
      phone: 'טלפון',
      enterPhoneNumber: 'הזן מספר טלפון',
      optional: 'אופציונלי',

      adminUserCreation: 'יצירת משתמש מנהל',
      firstName: 'שם פרטי',
      enterFirstName: 'הזן שם פרטי',
      lastName: 'שם משפחה',
      enterLastName: 'הזן שם משפחה',
      title: 'תואר',
      doctor: 'דוקטור',
      professor: 'פרופ׳',
      mister: 'מר',
      miss: 'גב׳',
      emailAddress: 'כתובת אימייל',
      enterEmailAddress: 'הזן כתובת אימייל',
      password: 'סיסמה',
      enterPassword: 'הזן סיסמה',
      confirmPassword: 'אשר סיסמה',
      passwordsDoNotMatch: 'הסיסמאות אינן תואמות',

      practiceSettings: 'הגדרות מרפאה',
      language: 'שפה',
      hebrew: 'עברית',
      english: 'אנגלית',
      timezone: 'אזור זמן',
      israelTime: 'שעון ישראל',
      easternTime: 'שעון מזרח ארה"ב',
      canadianTime: 'שעון קנדה',
      ukTime: 'שעון בריטניה',
      patientIdFormat: 'פורמט זהות מטופל',
      israeliId: 'תעודת זהות ישראלית',
      usSsn: 'מספר ביטוח לאומי אמריקאי',
      canadianHealth: 'כרטיס בריאות קנדי',
      ukNhs: 'מספר NHS בריטי',
      note: 'הערה',
      settingsCanBeChangedLater: 'ניתן לשנות הגדרות אלה מאוחר יותר',

      confirmAndCreate: 'אישור ויצירה',
      clinicSummary: 'סיכום המרפאה',
      adminEmail: 'אימייל מנהל',
      ready: 'מוכן',
      clickCreateToFinish: 'לחץ על "צור מרפאה" כדי לסיים',
      createClinic: 'צור מרפאה',
      creating: 'יוצר...',
      clinicCreationFailed: 'יצירת המרפאה נכשלה',

      // Navigation
      previous: 'קודם',
      next: 'הבא',
      back: 'חזור',
      pleaseCompleteAllFields: 'אנא השלם את כל השדות הנדרשים',

      // Additional UI
      or: 'או',
      createNewClinic: 'צור מרפאה חדשה',

      // Self-Registration to Existing Practice
      joiningExistingClinic: 'הצטרפות למרפאה קיימת',
      basicPermissionsNote: 'תתחיל עם הרשאות בסיסיות',
      adminCanUpgradeNote: 'המנהל יכול לשדרג את רמת הגישה שלך',
      secureAccessNote: 'גישה מאובטחת ומבוקרת להגנה על נתוני המטופלים',
      signupFailed: 'הרישום נכשל. אנא נסה שוב.',
      existingClinicRedirectNote: 'אם תבחר במרפאה קיימת, תוכל להירשם כחבר צוות חדש עם הרשאות בסיסיות.'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
};

async function populateTranslations() {
  let client;

  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();

    const db = client.db(DATABASE_NAME);
    const translationsCollection = db.collection('translations');
    const promptsCollection = db.collection('ai_prompts');

    console.log('📝 Populating translations...');

    // Insert or update English translations
    await translationsCollection.updateOne(
      { language: 'en' },
      { $set: translations.en },
      { upsert: true }
    );
    console.log('✅ English translations updated');

    // Insert or update Hebrew translations
    await translationsCollection.updateOne(
      { language: 'he' },
      { $set: translations.he },
      { upsert: true }
    );
    console.log('✅ Hebrew translations updated');

    console.log('📝 Populating AI prompts...');

    // Insert or update English AI prompts
    await promptsCollection.updateOne(
      { language: 'en' },
      { $set: aiPrompts.en },
      { upsert: true }
    );
    console.log('✅ English AI prompts updated');

    // Insert or update Hebrew AI prompts
    await promptsCollection.updateOne(
      { language: 'he' },
      { $set: aiPrompts.he },
      { upsert: true }
    );
    console.log('✅ Hebrew AI prompts updated');

    // Verify the data
    const translationCount = await translationsCollection.countDocuments();
    const promptCount = await promptsCollection.countDocuments();
    console.log(`📊 Total translation documents: ${translationCount}`);
    console.log(`📊 Total AI prompt documents: ${promptCount}`);

    const languages = await translationsCollection.find({}, { projection: { language: 1, languageName: 1, isRTL: 1 } }).toArray();
    console.log('🌐 Available languages:');
    languages.forEach(lang => {
      console.log(`  - ${lang.languageName} (${lang.language}) ${lang.isRTL ? '[RTL]' : '[LTR]'}`);
    });

    const promptLanguages = await promptsCollection.find({}, { projection: { language: 1, languageName: 1 } }).toArray();
    console.log('🤖 Available AI prompt languages:');
    promptLanguages.forEach(lang => {
      console.log(`  - ${lang.languageName} (${lang.language})`);
    });

    console.log('🎉 Translation and AI prompt population completed successfully!');

  } catch (error) {
    console.error('❌ Error populating translations:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  populateTranslations();
}

module.exports = { populateTranslations };
