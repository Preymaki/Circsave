import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI = null;
let model = null;

export const initializeAI = () => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.warn('⚠️  GEMINI_API_KEY not found. AI features will be disabled.');
            return false;
        }

        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        console.log('✅ Google Gemini AI initialized');
        return true;
    } catch (error) {
        console.error(`❌ AI Initialization Error: ${error.message}`);
        return false;
    }
};

export const getAIModel = () => {
    if (!model) {
        throw new Error('AI model not initialized. Please check your GEMINI_API_KEY.');
    }
    return model;
};

export { genAI };
