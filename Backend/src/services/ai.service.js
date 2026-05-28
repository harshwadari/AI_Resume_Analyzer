const dotenv = require("dotenv");
dotenv.config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GEN_API_KEY
});


function cleanAndParseJSON(rawText) {
    if (!rawText) throw new Error("Empty AI response");

    let cleaned = rawText.replace(/```json|```/g, "").trim();

    try {
        return JSON.parse(cleaned);
    } catch (err) {
        console.error("❌ JSON parse failed. Raw response:");
        console.log(cleaned);
        throw new Error("Invalid JSON from AI");
    }
}


function normalizeObjectArray(arr, requiredKeys) {
    if (!Array.isArray(arr)) return [];

    return arr.filter(item => {
        if (typeof item !== "object" || item === null) return false;
        // ensure all required keys exist
        return requiredKeys.every(key => key in item);
    });
}


async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    if (!jobDescription || (!resume && !selfDescription)) {
        throw new Error("jobDescription and either resume or selfDescription are required");
    }

    const prompt = `
You are an expert interview coach. Analyze the resume, self description, and job description below.
Return a single JSON object. No markdown. No backticks. No explanation. Just raw JSON.

The JSON must follow this EXACT structure:

{
  "matchScore": 72,
  "overallSummary": "3 to 5 sentence summary here.",
  "strengths": ["strength one", "strength two", "strength three"],
  "technicalQuestions": [
    { "question": "Question text here?", "answer": "Ideal answer here.", "intention": "Why this is asked." },
    { "question": "Question text here?", "answer": "Ideal answer here.", "intention": "Why this is asked." }
  ],
  "behavioralQuestions": [
    { "question": "Tell me about a time...", "answer": "Use STAR method...", "intention": "Checks teamwork." },
    { "question": "Tell me about a time...", "answer": "Use STAR method...", "intention": "Checks leadership." }
  ],
  "skillGaps": [
    { "skill": "Docker", "severity": "high", "recommendation": "Complete a Docker beginner course." },
    { "skill": "System Design", "severity": "medium", "recommendation": "Study HLD patterns." }
  ],
  "preparationPlan": [
    { "day": 1, "focus": "DSA Basics", "tasks": ["Revise arrays", "Solve 5 LeetCode easy"], "resources": ["LeetCode", "GeeksforGeeks"] },
    { "day": 2, "focus": "System Design", "tasks": ["Study load balancing", "Practice HLD"], "resources": ["Designing Data-Intensive Applications"] },
    { "day": 3, "focus": "Behavioral Prep", "tasks": ["Write 3 STAR stories"], "resources": ["STAR method guide"] },
    { "day": 4, "focus": "Skill Gap: Docker", "tasks": ["Docker tutorial", "Build sample container"], "resources": ["Docker docs", "YouTube"] },
    { "day": 5, "focus": "Mock Interview", "tasks": ["Full mock interview", "Review answers"], "resources": ["Pramp", "Interviewing.io"] }
  ]
}

RULES:
- matchScore must be a number between 0 and 100
- strengths must be an array of plain strings
- technicalQuestions: exactly 5 objects, each with "question", "answer", "intention"
- behavioralQuestions: exactly 4 objects, each with "question", "answer", "intention"
- skillGaps: 2 to 5 objects, each with "skill", "severity" (low/medium/high), "recommendation"
- preparationPlan: exactly 5 objects, each with "day" (number), "focus" (string), "tasks" (array of strings), "resources" (array of strings)
- Title : The title of the job for which the interview report is generated 
- Do NOT nest arrays inside arrays
- Do NOT add extra keys
- Do NOT return anything outside the JSON object

Resume:
${resume}

Self Description:
${selfDescription}

Job Description:
${jobDescription}
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json"
                // 🔥 removed responseSchema — it was causing field mixing
            }
        });

        const rawText =
            response.text ||
            response.candidates?.[0]?.content?.parts?.[0]?.text;

        const parsed = cleanAndParseJSON(rawText);

        // Validate and normalize each field strictly
        const normalized = {
            matchScore: typeof parsed.matchScore === "number" ? parsed.matchScore : 0,
            overallSummary: typeof parsed.overallSummary === "string" ? parsed.overallSummary : "",
            strengths: Array.isArray(parsed.strengths)
                ? parsed.strengths.filter(s => typeof s === "string")
                : [],
            technicalQuestions: normalizeObjectArray(parsed.technicalQuestions, ["question", "answer", "intention"]),
            behavioralQuestions: normalizeObjectArray(parsed.behavioralQuestions, ["question", "answer", "intention"]),
            skillGaps: normalizeObjectArray(parsed.skillGaps, ["skill", "severity", "recommendation"]),
            preparationPlan: normalizeObjectArray(parsed.preparationPlan, ["day", "focus", "tasks", "resources"]),
            title: typeof parsed.title === "string"
                ? parsed.title
                : (typeof parsed.Title === "string" ? parsed.Title : "Interview Preparation Plan")
        };

        // Safety guards
        if (normalized.technicalQuestions.length === 0) throw new Error("AI returned no technicalQuestions");
        if (normalized.behavioralQuestions.length === 0) throw new Error("AI returned no behavioralQuestions");
        if (normalized.preparationPlan.length === 0) throw new Error("AI returned malformed preparationPlan");

        console.log("✅ Interview report generated. Match score:", normalized.matchScore);
        return normalized;

    } catch (error) {
        console.error("❌ AI Service Error:", error.message);
        throw error;
    }
}

module.exports = generateInterviewReport;
