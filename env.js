import dotenv from "dotenv";

// Only load .env file in local development
// On Vercel, env vars are set via the dashboard — don't override them
if (!process.env.VERCEL) {
    dotenv.config();
}

console.log("✅ ENV loaded");
console.log("=================================");
console.log("MONGO_URI:", process.env.MONGO_URI ? "SET" : "MISSING");
console.log("AWS SES HOST:", process.env.AWS_SES_SMTP_HOST || "MISSING");
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "SET" : "MISSING");
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "SET (first 10 chars)" : "MISSING");
console.log("GOOGLE_CALLBACK_URL_PROD:", process.env.GOOGLE_CALLBACK_URL_PROD || "MISSING");
console.log("GITHUB_CLIENT_ID:", process.env.GITHUB_CLIENT_ID ? "SET" : "MISSING");
console.log("GITHUB_CLIENT_SECRET:", process.env.GITHUB_CLIENT_SECRET ? "SET" : "MISSING");
console.log("FACEBOOK_CLIENT_ID:", process.env.FACEBOOK_CLIENT_ID ? "SET" : "MISSING");
console.log("FACEBOOK_CLIENT_SECRET:", process.env.FACEBOOK_CLIENT_SECRET ? "SET" : "MISSING");
console.log("LINKEDIN_CLIENT_ID:", process.env.LINKEDIN_CLIENT_ID ? "SET" : "MISSING");
console.log("LINKEDIN_CLIENT_SECRET:", process.env.LINKEDIN_CLIENT_SECRET ? "SET" : "MISSING");
console.log("NODE_ENV:", process.env.NODE_ENV || "MISSING");
console.log("VERCEL:", process.env.VERCEL || "FALSE");
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "SET" : "MISSING");
console.log("GROQ_API_KEY:", process.env.GROQ_API_KEY ? "SET" : "MISSING");
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "SET" : "MISSING");
console.log("HUGGINGFACE_API_KEY:", process.env.HUGGINGFACE_API_KEY ? "SET" : "MISSING");
console.log("=================================");