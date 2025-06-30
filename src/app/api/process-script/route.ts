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
    // Alternative regex for bracket format: [Speaker] Text
    const bracketRegex = /^\s*\[([^\]]+)\]\s*(.*)$/;

    for (const line of lines) {
        // Skip empty lines
        if (!line.trim()) continue;

        // Try different speaker formats
        const matchColon = line.match(speakerRegex);
        const matchBracket = line.match(bracketRegex);
        const match = matchColon || matchBracket;

        if (match) {
            // If we already have a speaker, add the current dialogue to results
            if (currentSpeaker) {
                dialogues.push({
                    speaker: currentSpeaker.trim(),
                    text: currentText.trim()
                });
            }

            // Start a new dialogue
            currentSpeaker = match[1].trim();
            currentText = match[2];
        } else if (currentSpeaker) {
            // This is a continuation of the current dialogue
            // Don't add newlines for stage directions
            const isStageDirection = line.trim().startsWith('(') && line.trim().endsWith(')');

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