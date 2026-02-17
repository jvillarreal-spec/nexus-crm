
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

async function listModels() {
    console.log("--- Checking available models ---");
    try {
        // We test with v1 first
        const v1Models = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${process.env.GOOGLE_GEMINI_API_KEY}`).then(r => r.json());
        console.log("V1 Models:", JSON.stringify(v1Models, null, 2));

        // Then v1beta
        const v1betaModels = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_GEMINI_API_KEY}`).then(r => r.json());
        console.log("V1BETA Models:", JSON.stringify(v1betaModels, null, 2));
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
