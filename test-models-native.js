
const fs = require('fs');
const path = require('path');

function getApiKey() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return null;
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/GOOGLE_GEMINI_API_KEY=(.*)/);
    return match ? match[1].trim() : null;
}

const key = getApiKey();

async function listModels() {
    console.log("--- Checking available models ---");
    if (!key) {
        console.error("API Key not found in .env.local");
        return;
    }

    try {
        const v1Url = `https://generativelanguage.googleapis.com/v1/models?key=${key}`;
        const v1betaUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

        console.log("Fetching V1...");
        const v1Res = await fetch(v1Url);
        const v1Data = await v1Res.json();
        if (v1Data.models) {
            console.log("V1 Models found:", v1Data.models.map(m => m.name).join(', '));
        } else {
            console.log("V1 Error:", v1Data);
        }

        console.log("\nFetching V1BETA...");
        const vbRes = await fetch(v1betaUrl);
        const vbData = await vbRes.json();
        if (vbData.models) {
            console.log("V1BETA Models found:", vbData.models.map(m => m.name).join(', '));
        } else {
            console.log("V1BETA Error:", vbData);
        }
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

listModels();
