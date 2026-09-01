const AUTH_BRIDGE_URL = import.meta.env.DEV
    ? '/api/auth'
    : (process.env.AUTH_BRIDGE_URL || import.meta.env.VITE_AUTH_BRIDGE_URL || 'https://auth-bridge-785229654842.europe-west1.run.app');

export interface EventDetails {
    summary: string;
    start_datetime: string; // ISO 8601
    end_datetime?: string; // ISO 8601
    location?: string;
    description?: string;
    error?: string;
}

export async function parseImage(imageFile: File): Promise<EventDetails> {
    try {
        const start = Date.now();
        const base64Data = await fileToBase64(imageFile);

        const response = await fetch(AUTH_BRIDGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'parse',
                image: base64Data,
                mimeType: imageFile.type,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            try {
                const parsed = JSON.parse(errorText);
                throw new Error(parsed.message || parsed.error || `Server error: ${response.status}`);
            } catch {
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }
        }

        const data = await response.json() as EventDetails;
        console.log("Gemini parse response time:", Date.now() - start, "ms");
        return data;
    } catch (error: unknown) {
        console.error("Gemini Parse Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(errorMessage);
    }
}

async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
