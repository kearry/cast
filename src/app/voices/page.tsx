'use client';

const VOICES = [
  'Achernar',
  'Achird',
  'Algenib',
  'Algieba',
  'Alnilam',
  'Aoede',
  'Autonoe',
  'Callirrhoe',
  'Charon',
  'Despina',
  'Enceladus',
  'Erinome',
  'Fenrir',
  'Gacrux',
  'Iapetus',
  'Kore',
  'Laomedeia',
  'Leda',
  'Orus',
  'Puck',
  'Pulcherrima',
  'Rasalgethi',
  'Sadachbia',
  'Sadaltager',
  'Schedar',
  'Sulafat',
  'Umbriel',
  'Vindemiatrix',
  'Zephyr',
  'Zubenelgenubi',
];

export default function VoicesPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Voice Demos</h1>
        <div className="grid gap-6 sm:grid-cols-2">
          {VOICES.map((voice) => (
            <div
              key={voice}
              className="bg-white shadow rounded-md p-4 flex flex-col"
            >
              <h2 className="text-lg font-semibold mb-2">{voice}</h2>
              <audio
                className="w-full"
                controls
                src={`/voices/${voice}.wav`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

