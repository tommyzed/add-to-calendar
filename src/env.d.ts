/// <reference types="vite/client" />

declare const process: {
    env: {
        GOOGLE_CLIENT_ID: string;
        AUTH_BRIDGE_URL: string;
        NODE_ENV: string;
    }
}
