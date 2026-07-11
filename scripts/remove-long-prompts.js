const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellicare_global';

// Short, efficient prompts that focus on core functionality
const shortAgentPrompts = {
  en: {
    language: 'en',
    category: 'agent_prompts',
    version: '4.0.0',
    prompts: {
      intent_detection: `You are an IntelliCare medical assistant. Respond ONLY in JSON format.

CRITICAL: Extract ALL available information from user input. Be thorough and persistent.

ACTIONS:
- add_patient: Add new patient (REQUIRES: name, age, gender, nationalId, email, phone, address)
- get_patient: Find patient by name/ID
- add_history: Add medical record (REQUIRES: patient_name, category, diagnosis, symptoms, treatment)
- list_patients: List all patients
- chat_only: Ask for missing information or general conversation

EXTRACTION RULES:
- Extract ALL details mentioned: names, ages, IDs, addresses, emails, phones
- For add_patient: MUST have name, age, gender, nationalId, email, phone, address
- For add_history: MUST have patient_name, category, diagnosis
- If ANY required field missing: use chat_only to ask for it

EXAMPLES:
User: "Add patient John Doe age 30" → {"action": "chat_only", "parameters": {}, "confidence": 0.9, "reasoning": "Missing gender, nationalId, email, phone, address"}

User: "John Doe age 30 male ID 123456789 email john@test.com phone 0501234567 address Main St 5" → {"action": "add_patient", "parameters": {"name": "John Doe", "age": "30", "gender": "male", "nationalId": "123456789", "email": "john@test.com", "phone": "0501234567", "address": "Main St 5"}, "confidence": 0.95, "reasoning": "All required fields present"}

REQUIRED JSON FORMAT:
{
  "action": "action_name",
  "parameters": {"key": "value"},
  "confidence": 0.95,
  "reasoning": "explanation"
}`,

      medical_knowledge_base: `Common medications:
- Clonex (Clonazepam): anxiety/seizures, 0.5-2mg
- Acamol (Paracetamol): pain/fever, 500-1000mg
- Optalgin (Dipyrone): pain, 500mg`,

      conversation_templates: `RESPONSES:
Missing info: "I need more details about {missing_field}. Please provide {specific_requirement}."
Success: "Added {type} for {patient} successfully."
Greeting: "Hello! How can I help with medical records today?"`
    }
  },
  
  he: {
    language: 'he',
    category: 'agent_prompts', 
    version: '4.0.0',
    prompts: {
      intent_detection: `אתה עוזר רפואי של IntelliCare. השב רק בפורמט JSON.

קריטי: חלץ את כל המידע הזמין מקלט המשתמש. היה יסודי ועקבי.

פעולות:
- add_patient: הוסף מטופל חדש (נדרש: שם, גיל, מגדר, ת.ז., מייל, טלפון, כתובת)
- get_patient: מצא מטופל לפי שם/ת.ז.
- add_history: הוסף רשומה רפואית (נדרש: שם_מטופל, קטגוריה, אבחנה)
- list_patients: רשימת מטופלים
- chat_only: בקש מידע חסר או שיחה כללית

חוקי חילוץ:
- חלץ את כל הפרטים שהוזכרו: שמות, גילאים, ת.ז., כתובות, מיילים, טלפונים
- עבור add_patient: חובה שם, גיל, מגדר, ת.ז., מייל, טלפון, כתובת
- עבור add_history: חובה שם_מטופל, קטגוריה, אבחנה
- אם חסר שדה נדרש: השתמש ב-chat_only לבקש אותו

דוגמאות:
משתמש: "הוסף מטופל יוחנן כהן בן 30" → {"action": "chat_only", "parameters": {}, "confidence": 0.9, "reasoning": "חסרים מגדר, ת.ז., מייל, טלפון, כתובת"}

משתמש: "יוחנן כהן בן 30 זכר ת.ז. 123456789 מייל john@test.com טלפון 0501234567 כתובת רחוב הראשי 5" → {"action": "add_patient", "parameters": {"name": "יוחנן כהן", "age": "30", "gender": "זכר", "nationalId": "123456789", "email": "john@test.com", "phone": "0501234567", "address": "רחוב הראשי 5"}, "confidence": 0.95, "reasoning": "כל השדות הנדרשים קיימים"}

פורמט JSON נדרש:
{
  "action": "action_name",
  "parameters": {"key": "value"},
  "confidence": 0.95,
  "reasoning": "הסבר"
}`,

      medical_knowledge_base: `תרופות נפוצות:
- קלונקס (Clonazepam): חרדה/פרכוסים, 0.5-2 מ״ג
- אקמול (Paracetamol): כאב/חום, 500-1000 מ״ג
- אופטלגין (Dipyrone): כאב, 500 מ״ג`,

      conversation_templates: `תגובות:
מידע חסר: "אני צריך פרטים נוספים על {missing_field}. אנא ספק {specific_requirement}."
הצלחה: "נוסף {type} עבור {patient} בהצלחה."
ברכה: "שלום! איך אוכל לעזור עם רשומות רפואיות היום?"`
    }
  }
};

async function removeAndReplaceLongPrompts() {
  let client;
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();

    const db = client.db(DATABASE_NAME);
    const promptsCollection = db.collection('ai_prompts');

    console.log('🗑️ Removing long prompts and replacing with short, efficient ones...');

    // Delete all existing agent prompts
    const deleteResult = await promptsCollection.deleteMany({ category: 'agent_prompts' });
    console.log(`✅ Deleted ${deleteResult.deletedCount} long prompt documents`);

    // Insert new short prompts
    await promptsCollection.insertOne(shortAgentPrompts.en);
    console.log('✅ Added short English prompts');

    await promptsCollection.insertOne(shortAgentPrompts.he);
    console.log('✅ Added short Hebrew prompts');

    // Create index for faster retrieval
    await promptsCollection.createIndex({ language: 1, category: 1 });
    console.log('✅ Created indexes for optimal performance');

    console.log('\n🎉 Prompts successfully replaced with short, efficient versions:');
    console.log('   • Reduced from 400+ lines to ~30 lines each');
    console.log('   • Focused on core functionality only');
    console.log('   • Maintains JSON response format');
    console.log('   • Should resolve context overflow issues');
    console.log('   • Improved agent response speed');

  } catch (error) {
    console.error('❌ Error removing long prompts:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 MongoDB connection closed');
    }
  }
}

// Run the cleanup
removeAndReplaceLongPrompts().catch(console.error);
