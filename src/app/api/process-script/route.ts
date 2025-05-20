// src/app/api/process-script/route.ts
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { script } = await req.json();
        const dialogues = parseScript(script);

        return new Response(JSON.stringify(dialogues));
    } catch (error) {
        console.error("Error processing script:", error);
        return new Response("Failed to process script", { status: 500 });
    }
}

function parseScript(script: string): { speaker: string; text: string }[] {
    const dialogues: { speaker: string; text: string }[] = [];
    const lines = script.split('\n');

    let currentSpeaker = "";
    let currentText = "";

    for (const line of lines) {
        const match = line.match(/^\s*(\S+):\s*(.*)$/); //  <-- Improved regex

        if (match) {
            if (currentSpeaker) {
                dialogues.push({ speaker: currentSpeaker, text: currentText.trim() });
            }
            currentSpeaker = match[1];
            currentText = match[2];
        } else if (currentSpeaker) { // Improved handling for multi-line dialogues & actions
            currentText += (currentText ? " " : "") + line.trim();  // Handles actions like (Chuckles) correctly           
        }
    }

    if (currentSpeaker) {
        dialogues.push({ speaker: currentSpeaker, text: currentText.trim() });
    }

    return dialogues;
}