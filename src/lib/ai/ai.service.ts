
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

        // Using confirmed discovered models for this account.
        const primaryModel = "gemini-2.0-flash";
        const fallbackModel = "gemini-flash-latest";

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
        2. EXTRACCIÓN DE DATOS (Prioridad CRÍTICA):
           - "phone": Busca números de 7 a 15 dígitos. "celular", "teléfono", "móvil", "whatsapp" son lo mismo.
           - "email": Busca patrones de correo electrónico (ej. nombre@dominio.com).
           - "first_name"/"last_name": Busca nombres propios. Si el usuario dice "Soy [Nombre]", "Me llamo [Nombre]" o similares.
           - "company": Busca nombres de empresas u organizaciones.
           - "budget": Busca montos de dinero o rangos.
        3. No inventes datos. Si no encuentras algo, ponlo como null (sin comillas).
        4. Genera etiquetas útiles (ej: #Interesado, #Urgente, #LeadCalificado).
        5. Define el sentimiento del mensaje (positive, neutral, negative).
        6. Crea un resumen cortísimo (máximo 15 palabras).
        
        RESPONDE ÚNICAMENTE EN FORMATO JSON SIGUIENDO ESTA ESTRUCTURA:
        {
          "intent": "string",
          "tags": ["string"],
          "sentiment": "positive|neutral|negative",
          "extracted_data": {
            "first_name": "string | null",
            "last_name": "string | null",
            "email": "string | null",
            "phone": "string | null",
            "company": "string | null",
            "budget": "string | null",
            "summary": "string"
          }
        }
        `;

        const maxRetries = 2;
        let attempt = 0;

        while (attempt <= maxRetries) {
            try {
                console.log(`AI: Requesting analysis from ${modelName} (Attempt ${attempt + 1})...`);
                const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1" });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();

                const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
                return JSON.parse(jsonText) as AIAnalysisResult;
            } catch (error: any) {
                console.warn(`AI: Primary model ${modelName} failed. Reason: ${error.message}`);

                // If it's a 503, retry after a short delay
                if (error.message.includes('503') && attempt < maxRetries) {
                    attempt++;
                    const delay = 1000 * attempt;
                    console.log(`AI: 503 error, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                try {
                    console.log(`AI: Attempting fallback to ${fallbackName}...`);
                    const fallbackModel = genAI.getGenerativeModel({ model: fallbackName }, { apiVersion: "v1beta" });
                    const result = await fallbackModel.generateContent(prompt);
                    const response = await result.response;
                    const text = response.text();

                    const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
                    return JSON.parse(jsonText) as AIAnalysisResult;
                } catch (fallbackError: any) {
                    if (fallbackError.message.includes('429')) {
                        throw new Error(`[QUOTA_ERROR] Revisa los límites de tu llave en AI Studio.`);
                    }
                    throw new Error(`[AI_FAILURE] Primary (${modelName}) & Fallback (${fallbackName}) failed. Last error: ${fallbackError.message}`);
                }
            }
        }
        throw new Error("AI: Internal loop error");
    }
    async getSalesAdvice(message: string, currentData: any = {}, businessContext: string = ""): Promise<any> {
        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            throw new Error("GOOGLE_GEMINI_API_KEY is not set in environment variables.");
        }

        const modelName = "gemini-2.0-flash";
        const prompt = `
        Eres un Sales Coach experto de NexusCRM. Tu objetivo es ayudar al asesor a cerrar una venta analizando el mensaje del cliente.
        
        CONOCIMIENTO DE LA EMPRESA (CONTEXTO):
        ${businessContext || "No hay contexto específico configurado. Sé profesional y utiliza técnicas de venta genéricas."}

        CONTEXTO DEL CLIENTE ACTUAL: ${JSON.stringify(currentData)}
        
        MENSAJE ACTUAL DEL CLIENTE:
        "${message}"
        
        TU TAREA:
        1. Identifica el "Insights del Cliente": ¿Qué quiere realmente? ¿Tiene prisa? ¿Tiene dudas?
        2. "Próximo Paso Sugerido": ¿Qué acción concreta debe tomar el asesor ahora basado en el contexto de la empresa?
        3. "Manejo de Objeciones": Si hay dudas de precio o confianza, sugiere cómo resolverlas usando lo que sabes de la empresa.
        4. "Sugerencias de Respuesta": Crea 2 opciones de respuesta corta y profesional (estilo WhatsApp) listas para copiar.
        
        RESPONDE ÚNICAMENTE EN FORMATO JSON:
        {
          "insights": "string",
          "next_step": "string",
          "objection_handling": "string o null",
          "suggested_replies": [
            "opción 1",
            "opción 2"
          ]
        }
        `;

        const maxRetries = 2;
        let attempt = 0;

        while (attempt <= maxRetries) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1" });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();

                const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
                return JSON.parse(jsonText);
            } catch (error: any) {
                if (error.message.includes('503') && attempt < maxRetries) {
                    attempt++;
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }
                throw error;
            }
        }
    }
}
