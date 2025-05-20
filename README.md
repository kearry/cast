# AI Podcast Generator

A Next.js application that converts text scripts into podcast-style audio using AI voices from OpenAI and Google Text-to-Speech.

## Features

- Convert text scripts to audio with different AI voices
- Automatically identify speakers in the script
- Process dialogue with special handling for actions/sound effects
- Use different voices for different speakers
- Download generated podcasts as MP3 files

## Getting Started

### Prerequisites

- Node.js 16.x or later
- npm or yarn
- OpenAI API key
- (Optional) Google Cloud Text-to-Speech API credentials

### Environment Setup

1. Clone the repository
2. Create a `.env.local` file in the root directory with the following variables:

```
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
```

### Installation

```bash
# Install dependencies
npm install
# or
yarn install

# Run the development server
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Using the App

1. Enter your podcast script in the text area
   - Format each line with the speaker name followed by a colon (e.g., "Host: Welcome to the show!")
   - For actions or sound effects, use parentheses (e.g., "Host: (laughs) That was funny!")

2. Select a default voice for most speakers
   - Any speaker named "Kevin" will use a different voice

3. Click "Generate Podcast" to create your audio

4. Listen to your podcast in the browser or download it as an MP3 file

## Example Script Format

```
Host: Welcome to our podcast on AI technology!

Kevin: (enthusiastically) I'm excited to be here. Today we're discussing the future of AI.

Host: Let's start with the basics. What is artificial intelligence?

Kevin: Simply put, it's the simulation of human intelligence by machines.
```

## Technical Details

- Frontend: Next.js, React, Tailwind CSS
- API: Next.js API routes
- Text-to-Speech: OpenAI TTS API and Google Cloud Text-to-Speech
- Audio Processing: Buffer manipulation for combining audio segments

## License

This project is licensed under the MIT License - see the LICENSE file for details.