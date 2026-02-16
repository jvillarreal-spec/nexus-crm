
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
     * Consolidates Analysis and Sales Advice into a single API call to save quota (15 RPM free tier).
     */
    async processFullEnrichment(message: string, currentData: any = {}, businessContext: string = ""): Promise<any> {
        const prompt = `
        Eres un experto en CRM y Sales Coaching de NexusCRM.
        Analiza el siguiente mensaje y genera UN SOLO JSON con la extracción de datos y consejos de venta.

        CONTEXTO EMPRESA:
        ${businessContext || "Genérico."}

        DATOS ACTUALES CONTACTO: ${JSON.stringify(currentData)}

        MENSAJE CLIENTE:
        "${message}"

        TU TAREA:
        1. Extrae: intent, tags, first_name, last_name, email, phone, company, budget, summary.
        2. Genera Coaching: insights, next_step, objection_handling, suggested_replies (2 opciones).

        RESPONDE ÚNICAMENTE CON ESTE FORMATO JSON:
        {
          "analysis": {
             "intent": "string",
             "tags": ["string"],
             "sentiment": "positive|neutral|negative",
             "extracted_data": {
                "first_name": "string|null", "last_name": "string|null", "email": "string|null", 
                "phone": "string|null", "company": "string|null", "budget": "string|null", "summary": "string"
             }
          },
          "advice": {
             "insights": "string",
             "next_step": "string",
             "objection_handling": "string|null",
             "suggested_replies": ["string", "string"]
          }
        }
        `;

        return this.generateWithRetry(prompt, "gemini-1.5-flash");
    }

    private async generateWithRetry(prompt: string, modelName: string, attempt: number = 0): Promise<any> {
        const maxRetries = 3;
        try {
            const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1beta" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(jsonText);
        } catch (error: any) {
            const isQuota = error.message.includes('429');
            const isServer = error.message.includes('503') || error.message.includes('500');

            if ((isQuota || isServer) && attempt < maxRetries) {
                const delay = isQuota ? 5000 * (attempt + 1) : 2000 * (attempt + 1);
                console.warn(`AI: ${isQuota ? 'Quota' : 'Server'} error. Retrying in ${delay}ms... (Attempt ${attempt + 1})`);
                await new Promise(r => setTimeout(r, delay));
                return this.generateWithRetry(prompt, modelName, attempt + 1);
            }

            if (isQuota) throw new Error("[QUOTA_ERROR] Revisa los límites de tu llave en AI Studio.");
            throw error;
        }
    }

    /**
     * Legacy methods kept for compatibility but now use the retry helper
     */
    async analyzeMessage(message: string, currentData: any = {}): Promise<AIAnalysisResult> {
        // Implementation moved to generateWithRetry pattern if needed, 
        // but recommendation is to use processFullEnrichment.
        const result = await this.processFullEnrichment(message, currentData);
        return result.analysis;
    }

    async getSalesAdvice(message: string, currentData: any = {}, businessContext: string = ""): Promise<any> {
        const result = await this.processFullEnrichment(message, currentData, businessContext);
        return result.advice;
    }
}
