
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy-key",
});

// Version tag: 2026-02-16-v5-OPENAI-FORCE
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
     * Consolidates Analysis and Sales Advice into a single API call.
     * Prefers OpenAI (GPT-4o mini) if OPENAI_API_KEY is detected.
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
        1. Extrae: intent (ventas, soporte, info, saludo), tags (array), first_name, last_name, email, phone, company, budget, summary.
        2. Genera Coaching: insights (qué quiere realmente), next_step (acción sugerida), objection_handling (si aplica), suggested_replies (2 opciones cortas estilo WhatsApp).

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

        // PROVIDER CHOICE (Robust detection)
        const openAIKey = process.env.OPENAI_API_KEY;
        const isUsingOpenAI = openAIKey && openAIKey.startsWith('sk-');

        if (isUsingOpenAI) {
            console.log("AI: Using OPENAI Provider (Primary)");
            return this.generateWithOpenAI(prompt);
        } else {
            console.log("AI: Using GEMINI Provider (Fallback)");
            return this.generateWithGemini(prompt, "gemini-2.0-flash");
        }
    }

    /**
     * OpenAI Provider Logic
     */
    private async generateWithOpenAI(prompt: string, attempt: number = 0): Promise<any> {
        const maxRetries = 2;
        try {
            console.log(`AI: Requesting from OpenAI (Attempt ${attempt + 1})...`);
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Eres un asistente de NexusCRM que solo responde en JSON válido." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0].message.content;
            if (!content) throw new Error("OpenAI returned empty content");
            return JSON.parse(content);
        } catch (error: any) {
            console.error("OpenAI Error:", error.message);
            if (attempt < maxRetries && (error.status === 429 || error.status >= 500)) {
                const delay = 2000 * (attempt + 1);
                await new Promise(r => setTimeout(r, delay));
                return this.generateWithOpenAI(prompt, attempt + 1);
            }
            throw new Error(`[OPENAI_ERROR] ${error.message}`);
        }
    }

    /**
     * Gemini Provider Logic (Legacy/Fallback)
     */
    private async generateWithGemini(prompt: string, modelName: string, attempt: number = 0): Promise<any> {
        const maxRetries = 3;
        try {
            console.log(`AI: Requesting from Gemini ${modelName} (Attempt ${attempt + 1})...`);
            const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1" });
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
                console.warn(`AI: Gemini error. Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                return this.generateWithGemini(prompt, modelName, attempt + 1);
            }

            if (isQuota) throw new Error("[QUOTA_ERROR] Se agotó la cuota de Gemini. Por favor configura OpenAI para mayor estabilidad.");
            throw error;
        }
    }

    /**
     * Compatibility helpers
     */
    async analyzeMessage(message: string, currentData: any = {}): Promise<AIAnalysisResult> {
        const result = await this.processFullEnrichment(message, currentData);
        return result.analysis;
    }

    async getSalesAdvice(message: string, currentData: any = {}, businessContext: string = ""): Promise<any> {
        const result = await this.processFullEnrichment(message, currentData, businessContext);
        return result.advice;
    }
}
