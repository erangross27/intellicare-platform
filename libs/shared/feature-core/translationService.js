const serviceAccountManager = require('../../../backend/services/serviceAccountManager');
/**
 * Translation Service for Hebrew-English medical text translation
 * Supports the MediPhi microservice by handling Hebrew translations
 */

const axios = require('axios');
const secureConfigService = require('../../compliance-security/feature-encryption/secureConfigService');
const SecureDataAccess = require('../../compliance-security/feature-data-access/secureDataAccess');

class TranslationService {
    constructor() {
        this.serviceToken = null;
        this.initialized = false;
        // You can configure different translation providers here
        this.provider = 'google'; // or 'azure', 'aws', etc.
        this.translationCache = new Map();
    }

    async initialize() {
        if (this.initialized) return;
        this.serviceToken = await serviceAccountManager.authenticate('translation-service');
        this.initialized = true;
        return this;
    }

    /**
     * Get service context for SecureDataAccess operations
     */
    getServiceContext(practiceId = 'global') {
        return {
            serviceId: 'translationService',
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            practiceId: practiceId
        };
    }

    /**
     * Get translation from database by key and language
     */
    async getTranslation(key, language = 'en') {
        try {
            // Check cache first
            const cacheKey = `${language}:${key}`;
            if (this.translationCache.has(cacheKey)) {
                return this.translationCache.get(cacheKey);
            }

            // Use SecureDataAccess for translation cache
            const context = this.getServiceContext();
            const translationDocs = await SecureDataAccess.query(
                'translation_cache',
                { language: language },
                { limit: 1 },
                context
            );

            const translationDoc = translationDocs[0];

            if (!translationDoc || !translationDoc.translations) {
                throw new Error(`No translations found for language: ${language}`);
            }

            // Look for the key in translations
            const translation = translationDoc.translations[key];
            if (!translation) {
                throw new Error(`Translation key '${key}' not found for language: ${language}`);
            }

            // Cache the result
            this.translationCache.set(cacheKey, translation);

            return translation;
        } catch (error) {
            console.error(`❌ Failed to get translation for key '${key}' in language '${language}':`, error.message);
            throw error;
        }
    }

    /**
     * Get multiple translations at once
     */
    async getTranslations(keys, language = 'en') {
        try {
            // Use SecureDataAccess for translation cache
            const context = this.getServiceContext();
            const translationDocs = await SecureDataAccess.query(
                'translation_cache',
                { language: language },
                { limit: 1 },
                context
            );

            const translationDoc = translationDocs[0];

            if (!translationDoc || !translationDoc.translations) {
                throw new Error(`No translations found for language: ${language}`);
            }

            const results = {};
            for (const key of keys) {
                if (translationDoc.translations[key]) {
                    results[key] = translationDoc.translations[key];
                    // Cache individual translations
                    const cacheKey = `${language}:${key}`;
                    this.translationCache.set(cacheKey, translationDoc.translations[key]);
                }
            }

            return results;
        } catch (error) {
            console.error(`❌ Failed to get translations for language '${language}':`, error.message);
            throw error;
        }
    }

    /**
     * Translate text using Google Translate API (free tier)
     * Note: For production, consider using paid translation services
     */
    async translateText(text, fromLang, toLang) {
        try {
            // Using Google Translate via unofficial API
            // For production, use official Google Cloud Translation API
            const response = await axios.get('https://translate.googleapis.com/translate_a/single', {
                params: {
                    client: 'gtx',
                    sl: fromLang,
                    tl: toLang,
                    dt: 't',
                    q: text
                },
                timeout: 10000
            });

            if (response.data && response.data[0] && response.data[0][0]) {
                return response.data[0][0][0];
            }
            
            throw new Error('Translation response format unexpected');
            
        } catch (error) {
            console.error('❌ Translation error:', error.message);
            // 🔒 SECURITY: No fallbacks - translation failure must be handled explicitly
            throw new Error(`Translation service failure - no fallbacks allowed on medical platform: ${error.message}`);
        }
    }

    /**
     * Translate Hebrew medical input to English for MediPhi processing
     */
    async translateHebrewToEnglish(hebrewText) {
        console.log('🔄 Translating Hebrew to English:', hebrewText.substring(0, 100) + '...');
        
        try {
            const englishText = await this.translateText(hebrewText, 'he', 'en');
            console.log('✅ Hebrew to English translation completed');
            console.log('📝 English result:', englishText.substring(0, 100) + '...');
            return englishText;
        } catch (error) {
            console.error('❌ Hebrew to English translation failed:', error.message);
            return hebrewText; // Return original if translation fails
        }
    }

    /**
     * Translate English medical response back to Hebrew
     */
    async translateEnglishToHebrew(englishText) {
        console.log('🔄 Translating English to Hebrew:', englishText.substring(0, 100) + '...');
        
        try {
            const hebrewText = await this.translateText(englishText, 'en', 'he');
            console.log('✅ English to Hebrew translation completed');
            console.log('📝 Hebrew result:', hebrewText.substring(0, 100) + '...');
            return hebrewText;
        } catch (error) {
            console.error('❌ English to Hebrew translation failed:', error.message);
            return englishText; // Return original if translation fails
        }
    }

    /**
     * Translate patient data from Hebrew to English for MediPhi
     */
    async translatePatientDataToEnglish(patientData) {
        console.log('🔄 Translating patient data to English...');
        
        const translatedData = { ...patientData };
        
        try {
            // Translate symptoms
            if (patientData.symptoms) {
                translatedData.symptoms = await this.translateHebrewToEnglish(patientData.symptoms);
            }
            
            // Translate medical history
            if (patientData.history && patientData.history.trim()) {
                translatedData.history = await this.translateHebrewToEnglish(patientData.history);
            }
            
            // Set language to English for MediPhi processing
            translatedData.language = 'en';
            translatedData.preferredLanguage = 'english';
            
            console.log('✅ Patient data translation to English completed');
            return translatedData;
            
        } catch (error) {
            console.error('❌ Patient data translation failed:', error.message);
            return patientData; // Return original if translation fails
        }
    }

    /**
     * Check if text contains Hebrew characters
     */
    isHebrew(text) {
        if (!text) return false;
        // Check if text contains Hebrew characters (Unicode range 0590-05FF)
        const hebrewRegex = /[\u0590-\u05FF]/;
        return hebrewRegex.test(text);
    }

    /**
     * Get medical condition translation with fallback to predefined mappings
     */
    async getMedicalConditionTranslation(condition, language = 'en') {
        try {
            // First try to get from database
            return await this.getTranslation(condition, language);
        } catch (error) {
            // 🔒 SECURITY: No fallbacks - medical translation failure must be handled explicitly
            console.error(`❌ Medical translation failed for condition: ${condition}`, error.message);
            throw new Error(`Medical translation service failure - no fallbacks allowed on medical platform: ${error.message}`);
        }
    }

    /**
     * Fallback medical condition translations
     */
    getFallbackMedicalTranslation(condition, language) {
        const medicalTranslations = {
            'he': {
                'hypertension': 'יתר לחץ דם',
                'diabetes': 'סוכרת',
                'diabetes_mellitus_type_2': 'סוכרת מליטוס סוג 2',
                'hyperlipidemia': 'היפרליפידמיה',
                'cardiovascular_disease': 'מחלות לב וכלי דם',
                'heart_disease': 'מחלות לב',
                'cardiac_surgery': 'ניתוח לב',
                'heart_failure': 'אי ספיקת לב',
                'dyspnea': 'קוצר נשימה',
                'edema': 'בצקת',
                'smoking': 'עישון',
                'chest_pain': 'כאבים בחזה',
                'shortness_of_breath': 'קוצר נשימה',
                'high_blood_pressure': 'לחץ דם גבוה',
                'elevated_cholesterol': 'כולסטרול גבוה'
            },
            'en': {
                'hypertension': 'Hypertension',
                'diabetes': 'Diabetes',
                'diabetes_mellitus_type_2': 'Diabetes Mellitus Type 2',
                'hyperlipidemia': 'Hyperlipidemia',
                'cardiovascular_disease': 'Cardiovascular Disease',
                'heart_disease': 'Heart Disease',
                'cardiac_surgery': 'Cardiac Surgery',
                'heart_failure': 'Heart Failure',
                'dyspnea': 'Dyspnea',
                'edema': 'Edema',
                'smoking': 'Smoking',
                'chest_pain': 'Chest Pain',
                'shortness_of_breath': 'Shortness of Breath',
                'high_blood_pressure': 'High Blood Pressure',
                'elevated_cholesterol': 'Elevated Cholesterol'
            }
        };

        const normalizedCondition = condition.toLowerCase().replace(/\s+/g, '_');
        const translations = medicalTranslations[language] || medicalTranslations['en'];

        return translations[normalizedCondition] || condition;
    }

    /**
     * Get translation from database by key and language
     */
    async getTranslation(key, language = 'en') {
        try {
            // Check cache first
            const cacheKey = `${language}:${key}`;
            if (this.translationCache.has(cacheKey)) {
                return this.translationCache.get(cacheKey);
            }

            // Use SecureDataAccess for translation cache
            const context = this.getServiceContext();
            const translationDocs = await SecureDataAccess.query(
                'translation_cache',
                { language: language },
                { limit: 1 },
                context
            );

            const translationDoc = translationDocs[0];

            if (!translationDoc || !translationDoc.translations) {
                throw new Error(`No translations found for language: ${language}`);
            }

            // Look for the key in translations
            const translation = translationDoc.translations[key];
            if (!translation) {
                throw new Error(`Translation key '${key}' not found for language: ${language}`);
            }

            // Cache the result
            this.translationCache.set(cacheKey, translation);

            return translation;
        } catch (error) {
            console.error(`❌ Failed to get translation for key '${key}' in language '${language}':`, error.message);
            throw error;
        }
    }

    /**
     * Get multiple translations at once
     */
    async getTranslations(keys, language = 'en') {
        try {
            // Use SecureDataAccess for translation cache
            const context = this.getServiceContext();
            const translationDocs = await SecureDataAccess.query(
                'translation_cache',
                { language: language },
                { limit: 1 },
                context
            );

            const translationDoc = translationDocs[0];

            if (!translationDoc || !translationDoc.translations) {
                throw new Error(`No translations found for language: ${language}`);
            }

            const results = {};
            for (const key of keys) {
                if (translationDoc.translations[key]) {
                    results[key] = translationDoc.translations[key];
                    // Cache individual translations
                    const cacheKey = `${language}:${key}`;
                    this.translationCache.set(cacheKey, translationDoc.translations[key]);
                }
            }

            return results;
        } catch (error) {
            console.error(`❌ Failed to get translations for language '${language}':`, error.message);
            throw error;
        }
    }

    /**
     * Determine if translation is needed based on request language
     */
    needsTranslation(requestData) {
        const language = requestData.language || '';
        const preferredLanguage = requestData.preferredLanguage || '';
        const symptoms = requestData.symptoms || '';

        // Check if Hebrew is requested or Hebrew text is detected
        return (
            language === 'he' ||
            preferredLanguage === 'hebrew' ||
            this.isHebrew(symptoms)
        );
    }
}

module.exports = new TranslationService();
