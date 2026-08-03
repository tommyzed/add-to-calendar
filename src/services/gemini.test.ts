import { describe, it, expect, vi, beforeEach } from 'vitest';

// We must use vi.hoisted to define the mocked methods so they are available inside the hoisted vi.mock factory.
const { mockGenerateContent, mockGetGenerativeModel } = vi.hoisted(() => {
    const mockGenContent = vi.fn();
    const mockGetGenModel = vi.fn(() => ({
        generateContent: mockGenContent,
    }));
    return {
        mockGenerateContent: mockGenContent,
        mockGetGenerativeModel: mockGetGenModel,
    };
});

// Mock the GoogleGenerativeAI module.
// In TypeScript/ESM, `@google/generative-ai` exports `GoogleGenerativeAI` as a named export.
vi.mock('@google/generative-ai', () => {
    class MockGoogleGenerativeAI {
        getGenerativeModel = mockGetGenerativeModel;
    }
    return {
        GoogleGenerativeAI: MockGoogleGenerativeAI,
    };
});

import { parseImage } from './gemini';

describe('parseImage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully parse a valid image and return parsed event details', async () => {
        // Setup FileReader mock
        const originalFileReader = window.FileReader;

        class MockFileReader {
            result = 'data:image/png;base64,mockBase64DataString';
            onloadend: (() => void) | null = null;
            onerror: ((err: Error) => void) | null = null;
            readAsDataURL() {
                if (this.onloadend) {
                    this.onloadend();
                }
            }
        }

        window.FileReader = MockFileReader as unknown as typeof FileReader;

        // Setup Gemini API response mock
        const mockEventDetails = {
            summary: 'Tech Conference 2025',
            start_datetime: '2025-10-15T09:00:00Z',
            end_datetime: '2025-10-15T17:00:00Z',
            location: 'San Francisco, CA',
            description: 'Annual technology conference with guest speakers.',
        };

        mockGenerateContent.mockResolvedValueOnce({
            response: {
                text: () => JSON.stringify(mockEventDetails),
            },
        });

        const imageFile = new File(['dummy content'], 'event-flyer.png', { type: 'image/png' });
        const result = await parseImage(imageFile);

        expect(result).toEqual(mockEventDetails);
        expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: expect.any(String) });
        expect(mockGenerateContent).toHaveBeenCalledWith([
            expect.stringContaining('Extract event details from this image'),
            { inlineData: { data: 'mockBase64DataString', mimeType: 'image/png' } },
        ]);

        // Restore original FileReader
        window.FileReader = originalFileReader;
    });

    it('should clean up markdown formatting if present in the model response', async () => {
        const originalFileReader = window.FileReader;

        class MockFileReader {
            result = 'data:image/png;base64,mockBase64DataString';
            onloadend: (() => void) | null = null;
            onerror: ((err: Error) => void) | null = null;
            readAsDataURL() {
                if (this.onloadend) {
                    this.onloadend();
                }
            }
        }

        window.FileReader = MockFileReader as unknown as typeof FileReader;

        const mockEventDetails = {
            summary: 'Concert in the Park',
            start_datetime: '2025-06-20T18:00:00Z',
            end_datetime: '2025-06-20T21:00:00Z',
            location: 'Central Park',
        };

        // Response text wrapped in markdown block
        const responseTextWithMarkdown = `\`\`\`json\n${JSON.stringify(mockEventDetails)}\n\`\`\``;

        mockGenerateContent.mockResolvedValueOnce({
            response: {
                text: () => responseTextWithMarkdown,
            },
        });

        const imageFile = new File(['dummy content'], 'concert.png', { type: 'image/png' });
        const result = await parseImage(imageFile);

        expect(result).toEqual(mockEventDetails);

        window.FileReader = originalFileReader;
    });

    it('should throw Gemini API Error if the generation process fails', async () => {
        const originalFileReader = window.FileReader;

        class MockFileReader {
            result = 'data:image/png;base64,mockBase64DataString';
            onloadend: (() => void) | null = null;
            onerror: ((err: Error) => void) | null = null;
            readAsDataURL() {
                if (this.onloadend) {
                    this.onloadend();
                }
            }
        }

        window.FileReader = MockFileReader as unknown as typeof FileReader;

        mockGenerateContent.mockRejectedValueOnce(new Error('Quota exceeded'));

        const imageFile = new File(['dummy content'], 'concert.png', { type: 'image/png' });
        await expect(parseImage(imageFile)).rejects.toThrow('Gemini API Error: Quota exceeded');

        window.FileReader = originalFileReader;
    });

    it('should handle FileReader onerror failures correctly', async () => {
        const originalFileReader = window.FileReader;

        class MockFileReader {
            onloadend: (() => void) | null = null;
            onerror: ((err: Error) => void) | null = null;
            readAsDataURL() {
                if (this.onerror) {
                    this.onerror(new Error('File reading failed'));
                }
            }
        }

        window.FileReader = MockFileReader as unknown as typeof FileReader;

        const imageFile = new File(['dummy content'], 'concert.png', { type: 'image/png' });
        await expect(parseImage(imageFile)).rejects.toThrow('Gemini API Error: File reading failed');

        window.FileReader = originalFileReader;
    });
});
