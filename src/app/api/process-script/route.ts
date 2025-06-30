// src/app/api/process-script/route.ts
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { script } = await req.json();

        if (!script || typeof script !== 'string') {
            return new Response(
                JSON.stringify({ error: "Valid script content is required" }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const dialogues = parseScript(script);

        return new Response(
            JSON.stringify(dialogues),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error("Error processing script:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to process script";

        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

function parseScript(script: string): { speaker: string; text: string }[] {
    const dialogues: { speaker: string; text: string }[] = [];
    const lines = script.split('\n');

    let currentSpeaker = "";
    let currentText = "";

    // Improved regex to handle various script formats
    // This handles formats like "Speaker: Text", "Speaker - Text", "[Speaker] Text", etc.
    const speakerRegex = /^\s*(?:\*\*)?([^:[\]()]+)(?:\*\*)?\s*:\s*(.*)$/;
    // Alternative regex for bracket format: [Speaker] Text (requires text after bracket)
    const bracketRegex = /^\s*\[([^\]]+)\]\s+(.+)$/;

    for (const line of lines) {
        // Skip empty lines
        if (!line.trim()) continue;

        // Try different speaker formats
        const matchColon = line.match(speakerRegex);
        const matchBracket = line.match(bracketRegex);
        const match = matchColon || matchBracket;

        if (match) {
            const candidateSpeaker = match[1].trim();
            const candidateText = match[2].trim();
            const startsWithNumber = /^[0-9£$]/.test(candidateText);
            const isLikelySpeaker =
                candidateText.length > 0 &&
                candidateSpeaker.split(/\s+/).length <= 3 &&
                !startsWithNumber;

            if (isLikelySpeaker) {
                if (currentSpeaker) {
                    dialogues.push({
                        speaker: currentSpeaker.trim(),
                        text: currentText.trim(),
                    });
                }

                currentSpeaker = candidateSpeaker;
                currentText = candidateText;
                continue;
            }
        }

        if (currentSpeaker) {
            // This is a continuation of the current dialogue
            // Don't add newlines for stage directions
            const trimmed = line.trim();
            const isStageDirection =
                (trimmed.startsWith('(') && trimmed.endsWith(')')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']'));

            if (isStageDirection) {
                // For stage directions, add them inline
                currentText += " " + line.trim();
            } else {
                // For regular text continuation, preserve paragraphs with spaces
                currentText += (currentText ? " " : "") + line.trim();
            }
        } else {
            // If there's no current speaker but we have text, treat it as narrator
            currentSpeaker = "Narrator";
            currentText = line.trim();
        }
    }

    // Add the last dialogue if there is one
    if (currentSpeaker) {
        dialogues.push({
            speaker: currentSpeaker.trim(),
            text: currentText.trim()
        });
    }

    // If no dialogues were found, create one with the entire script as narrator
    if (dialogues.length === 0 && script.trim()) {
        dialogues.push({
            speaker: "Narrator",
            text: script.trim()
        });
    }

    return dialogues;
}