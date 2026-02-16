
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

export interface AIAnalysisResult {
    intent: string;
    tags: string[];
    extracted_data: {
        first_name?: string;
        last_name?: string;
        email?: string;
        phone?: string;
        company?: string;
        budget?: string;
        summary?: string;
    };
    sentiment: 'positive' | 'neutral' | 'negative';
}

export class AIService {
    /**
     * Analyzes a message or conversation to extract CRM-ready data.
     */
    async analyzeMessage(message: string, currentData: any = {}): Promise<AIAnalysisResult> {
        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            throw new Error("GOOGLE_GEMINI_API_KEY is not set in environment variables.");
        }

        // Switching to EXPLICIT versioned names on the STABLE v1 API.
        // This avoids the 'gemini-3-pro' mapping issue seen with aliases.
        const primaryModel = "gemini-1.5-flash";
        const fallbackModel = "gemini-1.0-pro";

        return this.generateWithFallback(primaryModel, fallbackModel, message, currentData);
    }

    private async generateWithFallback(
        modelName: string,
        fallbackName: string,
        message: string,
        currentData: any
    ): Promise<AIAnalysisResult> {
        const prompt = `
        Eres un asistente experto en CRM (NexusCRM). Tu tarea es analizar el mensaje de un cliente y extraer información estructurada.
        
        Información actual del contacto (si existe): ${JSON.stringify(currentData)}
        
        MENSAJE DEL CLIENTE:
        "${message}"
        
        INSTRUCCIONES:
        1. Analiza la intención (ventas, soporte, información, queja, saludo).
        2. Extrae datos personales. 
           CRÍTICO: "celular", "teléfono", "móvil", "whatsapp" son sinónimos. Si detectas un número de 7 a 15 dígitos, regístralo en "phone".
        3. Extrae nombre, email, empresa, presupuesto si se mencionan.
        4. Genera etiquetas útiles (ej: #Interesado, #Urgente, #LeadCalificado).
        5. Define el sentimiento del mensaje (positive, neutral, negative).
        6. Crea un resumen cortísimo (máximo 15 palabras).
        
        RESPONDE ÚNICAMENTE EN FORMATO JSON SIGUIENDO ESTA ESTRUCTURA:
        {
          "intent": "string",
          "tags": ["string"],
          "sentiment": "positive|neutral|negative",
          "extracted_data": {
            "first_name": "string o null",
            "last_name": "string o null",
            "email": "string o null",
            "phone": "string o null",
            "company": "string o null",
            "budget": "string o null",
            "summary": "string"
          }
        }
        `;

        try {
            console.log(`AI: Requesting analysis from ${modelName} (v1)...`);
            // Explicitly use v1 stable endpoint to avoid experimental mappings
            const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(jsonText) as AIAnalysisResult;
        } catch (error: any) {
            console.warn(`AI: Primary model ${modelName} failed. Reason: ${error.message}`);

            try {
                console.log(`AI: Attempting fallback to ${fallbackName} (v1)...`);
                const fallbackModel = genAI.getGenerativeModel({ model: fallbackName }, { apiVersion: "v1" });
                const result = await fallbackModel.generateContent(prompt);
                const response = await result.response;
                const text = response.text();

                const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
                return JSON.parse(jsonText) as AIAnalysisResult;
            } catch (fallbackError: any) {
                // If it's a 429 Limit 0, provide the recovery hint
                if (fallbackError.message.includes('429') && fallbackError.message.includes('limit: 0')) {
                    throw new Error(`[QUOTA_EXHAUSTED] Tu proyecto de Google no tiene cuota gratuita habilitada (Limit: 0). Por favor revisa la Guía de Recuperación en el CRM.`);
                }
                throw new Error(`[AI_FAILURE] Primary (${modelName}) & Fallback (${fallbackName}) failed. Last error: ${fallbackError.message}`);
            }
        }
    }
}
