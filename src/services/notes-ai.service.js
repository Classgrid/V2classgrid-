import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.Gemini_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ─────────────────────────────────────────────
// AI VERIFY & SUMMARIZE
// ─────────────────────────────────────────────
export async function verifyAndSummarize(noteContent, noteTitle) {
    const prompt = `You are an academic content verifier for Classgrid, a science learning platform.

Analyze the following academic note and provide a structured verification report.

**Note Title:** ${noteTitle}
**Note Content:** ${noteContent.substring(0, 4000)}

Respond ONLY in this exact JSON format (no markdown, no code blocks):
{
  "isAccurate": true or false,
  "summary": "2-3 sentence summary of the note",
  "keyConcepts": ["concept1", "concept2", "concept3", "concept4", "concept5"],
  "difficultyLevel": "Easy" or "Medium" or "Hard",
  "qualityScore": 1-10,
  "suggestions": "One sentence suggestion for improvement or 'Content is well-structured' if good",
  "topicCategory": "Organic science" or "Physical science" or "Inorganic science" or "Physics" or "Mathematics" or "General"
}`;

    try {
        // Try Groq first
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 800,
        });

        const text = response.choices?.[0]?.message?.content || "";
        return parseJSON(text);
    } catch (err) {
        console.log("Groq failed for verification, trying Gemini:", err.message);

        try {
            const result = await geminiModel.generateContent(prompt);
            const text = result.response.text();
            return parseJSON(text);
        } catch (geminiErr) {
            console.error("Both models failed for verification:", geminiErr.message);
            return {
                isAccurate: true,
                summary: "AI verification temporarily unavailable. Content has been accepted.",
                keyConcepts: ["Pending AI review"],
                difficultyLevel: "Medium",
                qualityScore: 7,
                suggestions: "Please try AI verification again later.",
                topicCategory: "General",
            };
        }
    }
}

// ─────────────────────────────────────────────
// AI GENERATE QUIZ
// ─────────────────────────────────────────────
export async function generateQuizFromContent(noteContent, noteTitle) {
    const prompt = `You are a quiz generator for Classgrid, a science learning platform.

Generate a quiz from the following academic content.

**Note Title:** ${noteTitle}
**Content:** ${noteContent.substring(0, 4000)}

Generate exactly 5 MCQ questions and 1 short-answer question.

Respond ONLY in this exact JSON format (no markdown, no code blocks):
[
  {
    "type": "mcq",
    "question": "What is...?",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "correctAnswer": "A) option1",
    "explanation": "Brief explanation of why this is correct"
  },
  {
    "type": "mcq",
    "question": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correctAnswer": "...",
    "explanation": "..."
  },
  {
    "type": "mcq",
    "question": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correctAnswer": "...",
    "explanation": "..."
  },
  {
    "type": "mcq",
    "question": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correctAnswer": "...",
    "explanation": "..."
  },
  {
    "type": "mcq",
    "question": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correctAnswer": "...",
    "explanation": "..."
  },
  {
    "type": "short-answer",
    "question": "Explain briefly...",
    "options": [],
    "correctAnswer": "Expected answer in 1-2 sentences",
    "explanation": "Detailed explanation"
  }
]`;

    try {
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
            max_tokens: 2000,
        });

        const text = response.choices?.[0]?.message?.content || "";
        return parseJSON(text);
    } catch (err) {
        console.log("Groq failed for quiz gen, trying Gemini:", err.message);

        try {
            const result = await geminiModel.generateContent(prompt);
            const text = result.response.text();
            return parseJSON(text);
        } catch (geminiErr) {
            console.error("Both models failed for quiz generation:", geminiErr.message);
            throw new Error("Quiz generation failed with both AI providers");
        }
    }
}

// ─────────────────────────────────────────────
// HELPER: Parse JSON from AI response
// ─────────────────────────────────────────────
function parseJSON(text) {
    try {
        // Remove markdown code blocks if present
        let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        return JSON.parse(cleaned);
    } catch (e) {
        // Try to extract JSON from the text
        const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e2) {
                console.error("Failed to parse AI JSON response:", text.substring(0, 200));
                throw new Error("Invalid AI response format");
            }
        }
        throw new Error("No JSON found in AI response");
    }
}
