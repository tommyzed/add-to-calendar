/// <reference types="vite/client" />

declare const process: {
    env: {
        GEMINI_APP_KEY: string;
        GEMINI_MODEL: string;
        GOOGLE_CLIENT_ID: string;
        NODE_ENV: string;
    }
}
