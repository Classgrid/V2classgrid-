import dotenv from "dotenv";
import Groq from "groq-sdk";

// Load local .env
dotenv.config();

async function testAIKeys() {
    console.log("=== Testing AI API Keys ===\n");

    try {
        console.log("Testing openai/gpt-oss-20b...");
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const groqResponse1 = await groq.chat.completions.create({
            messages: [{ role: "user", content: "Say '20b works!'" }],
            model: "openai/gpt-oss-20b",
            max_tokens: 10
        });
        console.log("✅ Groq 20b Success! Response:", groqResponse1.choices[0]?.message?.content);
    } catch (err) {
        console.error("❌ Groq 20b Failed:", err.message);
    }

    console.log("\n-----------------------------------\n");

    try {
        console.log("Testing openai/gpt-oss-120b...");
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const groqResponse2 = await groq.chat.completions.create({
            messages: [{ role: "user", content: "Say '120b works!'" }],
            model: "openai/gpt-oss-120b",
            max_tokens: 10
        });
        console.log("✅ Groq 120b Success! Response:", groqResponse2.choices[0]?.message?.content);
    } catch (err) {
        console.error("❌ Groq 120b Failed:", err.message);
    }

    console.log("\n=== Test Complete ===");
}

testAIKeys();
