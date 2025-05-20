// src/app/page.tsx
'use client';
import { useState } from 'react';
import axios from 'axios';
import styles from './page.module.css'; // Import CSS module

export default function Home() {
  const [script, setScript] = useState('');
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null); // Clear any previous errors
    setAudioPath(null);


    try {
      const response = await axios.post('/api/process-script', { script });
      const dialogues: { speaker: string; text: string }[] = response.data;

      const enhancedScript = dialogues.map(d => `${d.speaker}: ${d.text}`).join('\n');

      const generateAudioResponse = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: enhancedScript, voice: 'onyx' }),
      });

      if (!generateAudioResponse.ok) {
        const errorData = await generateAudioResponse.json();
        const errorMessage = errorData.error || generateAudioResponse.statusText;
        console.error("Error generating audio:", errorMessage);
        throw new Error(errorMessage); // Throw error for catch block
      }

      const generateAudioData = await generateAudioResponse.json();
      setAudioPath(generateAudioData.audioPath);

    } catch (err: unknown) {  // Catch and display error
      console.error("handleSubmit error:", err);
      if (err instanceof Error)
      setError(err.message);  // Set error message to state
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Podcast Generator</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <textarea
          className={styles.textarea}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Enter your podcast script here..."
          rows={10}
        />
        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Podcast'}
        </button>
      </form>


      {loading && <p className={styles.loading}>Generating Podcast...</p>}
      {error && <p className={styles.error}>{error}</p>} {/* Display error message */}

      {audioPath && (
        <div className={styles.audioPlayer}>
          <audio src={audioPath} controls />
        </div>
      )}
    </div>
  );
}