
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

        // Initialize model locally to ensure correct versioning/config
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

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
            // Use native JSON mode if available or ensure clean text
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                }
            });
            const response = await result.response;
            const text = response.text();

            return JSON.parse(text) as AIAnalysisResult;
        } catch (error: any) {
            console.error("AIService: Error calling Gemini API:", error);
            // More descriptive error
            throw new Error(`Gemini API Error (${model.model}): ${error.message || 'Unknown error'}`);
        }
    }
}
