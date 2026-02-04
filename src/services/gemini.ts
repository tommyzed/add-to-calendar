import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_APP_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const genAI = new GoogleGenerativeAI(API_KEY);

export interface EventDetails {
    summary: string;
    start_datetime: string; // ISO 8601
    end_datetime?: string; // ISO 8601
    location?: string;
    description?: string;
    error?: string;
}

export async function parseImage(imageFile: File): Promise<EventDetails> {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `Extract event details from this image. Return ONLY a JSON object with: summary, start_datetime (ISO), end_datetime (ISO, or +1hr if not found), location, and description (optional). If no event is found, return {"error": "none"}. Do not include markdown or conversational text.`;

    try {
        const start = Date.now();
        // Convert File to base64
        const base64Data = await fileToGenerativePart(imageFile);

        const result = await model.generateContent([prompt, base64Data]);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        console.log("Gemini processing time:", Date.now() - start, "ms");
        return JSON.parse(cleanText) as EventDetails;
    } catch (error: any) {
        console.error("Gemini Parse Error:", error);
        const errorMessage = error.message || error.toString();
        throw new Error(`Gemini API Error: ${errorMessage}`);
    }
}

async function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve({
                inlineData: {
                    data: base64String,
                    mimeType: file.type,
                },
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
