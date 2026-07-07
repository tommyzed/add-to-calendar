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

const MARKDOWN_JSON_REGEX = /```json/g;
const MARKDOWN_BLOCK_REGEX = /```/g;

export async function parseImage(imageFile: File): Promise<EventDetails> {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const currentYear = new Date().getFullYear();
    const prompt = `Extract event details from this image. Assume the event is in the future, using the current year (${currentYear}) or later if no year is specified. Return ONLY a JSON object with: summary, start_datetime (ISO), end_datetime (ISO, or +1hr if not found), location, and description (optional). If the image is not a clear event, set the "error" field to "UNABLE_TO_DETERMINE" but still return the JSON with any partial details or empty strings. Do not include markdown.`;

    try {
        const start = Date.now();
        // Convert File to base64
        const base64Data = await fileToGenerativePart(imageFile);

        const result = await model.generateContent([prompt, base64Data]);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const cleanText = text.replace(MARKDOWN_JSON_REGEX, '').replace(MARKDOWN_BLOCK_REGEX, '').trim();

        console.log("Gemini processing time:", Date.now() - start, "ms");

        const parsed = JSON.parse(cleanText);

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error("Invalid response: Expected a JSON object");
        }

        if (typeof parsed.summary !== 'string') {
            throw new Error("Invalid response: 'summary' must be a string");
        }
        if (typeof parsed.start_datetime !== 'string') {
            throw new Error("Invalid response: 'start_datetime' must be a string");
        }

        const eventDetails: EventDetails = {
            summary: parsed.summary,
            start_datetime: parsed.start_datetime,
        };

        if (parsed.end_datetime !== undefined) {
            if (typeof parsed.end_datetime !== 'string') throw new Error("Invalid response: 'end_datetime' must be a string");
            eventDetails.end_datetime = parsed.end_datetime;
        }
        if (parsed.location !== undefined) {
            if (typeof parsed.location !== 'string') throw new Error("Invalid response: 'location' must be a string");
            eventDetails.location = parsed.location;
        }
        if (parsed.description !== undefined) {
            if (typeof parsed.description !== 'string') throw new Error("Invalid response: 'description' must be a string");
            eventDetails.description = parsed.description;
        }
        if (parsed.error !== undefined) {
            if (typeof parsed.error !== 'string') throw new Error("Invalid response: 'error' must be a string");
            eventDetails.error = parsed.error;
        }

        return eventDetails;
    } catch (error: unknown) {
        console.error("Gemini Parse Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
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
