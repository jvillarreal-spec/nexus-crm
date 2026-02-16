
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
    }

export class AIService {
    /**
     * Analyzes a message or conversation to extract CRM-ready data.
     */
    async analyzeMessage(message: string, currentData: any = {}): Promise<AIAnalysisResult> {
        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            throw new Error("GOOGLE_GEMINI_API_KEY is not set in environment variables.");
        }

        // Try primary model first, fallback if it fails
        const primaryModel = "gemini-1.5-flash";
        const fallbackModel = "gemini-pro";

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
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                }
            });
            const response = await result.response;
            return JSON.parse(response.text()) as AIAnalysisResult;
        } catch (error: any) {
            console.warn(`Primary model ${modelName} failed:`, error.message);

            // If it's a 404 or specific model error, try fallback
            if (error.message.includes('404') || error.message.includes('not found')) {
                try {
                    console.log(`Attempting fallback to ${fallbackName}...`);
                    const fallbackModel = genAI.getGenerativeModel({ model: fallbackName });
                    const result = await fallbackModel.generateContent(prompt); // Older models might not support JSON mode config
                    const response = await result.response;
                    const text = response.text();
                    const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
                    return JSON.parse(jsonText) as AIAnalysisResult;
                } catch (fallbackError: any) {
                    throw new Error(`Both ${modelName} and ${fallbackName} failed. Last error: ${fallbackError.message}`);
                }
            }
            throw error;
        }
    }
}
