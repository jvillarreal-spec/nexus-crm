
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
    async analyzeMessage(message: string, currentData: any = {}): Promise<AIAnalysisResult | null> {
        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            console.error("AIService: GOOGLE_GEMINI_API_KEY is not set.");
            return null;
        }

        const prompt = `
        Eres un asistente experto en CRM (NexusCRM). Tu tarea es analizar el mensaje de un cliente y extraer información estructurada para alimentar la base de datos.
        
        Información actual del contacto (si existe): ${JSON.stringify(currentData)}
        
        MENSAJE DEL CLIENTE:
        "${message}"
        
        INSTRUCCIONES:
        1. Analiza la intención (ventas, soporte, información, queja, saludo).
        2. Extrae datos personales si se mencionan (nombre, email, empresa, teléfono, presupuesto).
        3. Genera etiquetas útiles (ej: #Interesado, #Urgente, #LeadCalificado).
        4. Define el sentimiento del mensaje.
        5. Crea un resumen cortísimo (máximo 15 palabras) de lo que quiere el cliente.
        
        RESPONDE ÚNICAMENTE EN FORMATO JSON SIGUIENDO ESTA ESTRUCTURA:
        {
          "intent": "string",
          "tags": ["string"],
          "sentiment": "positive|neutral|negative",
          "extracted_data": {
            "first_name": "string o null",
            "last_name": "string o null",
            "email": "string o null",
            "company": "string o null",
            "budget": "string o null",
            "summary": "string"
          }
        }
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean the response in case it includes markdown code blocks
            const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(jsonText) as AIAnalysisResult;
        } catch (error) {
            console.error("AIService: Error calling Gemini API:", error);
            return null;
        }
    }
}
