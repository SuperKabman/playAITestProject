"use client";

// voice data type
interface Voice {
  name: string;
  accent: string;
  language: string;
  languageCode: string;
  value: string;
  sample: string;
  gender: string;
  style: string;
}

interface VoiceSelectorProps {
  voices: Voice[];
  selectedVoice: Voice;
  onVoiceChange: (voice: Voice) => void;
}

// creates a dropdown to pick different voices
export default function VoiceSelector({ 
  voices, 
  selectedVoice, 
  onVoiceChange 
}: VoiceSelectorProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Select Voice
      </label>
      <div className="relative">
        <select 
          className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-800 rounded-md"
          value={selectedVoice.name}
          onChange={(e) => {
            const selected = voices.find(voice => voice.name === e.target.value);
            if (selected) onVoiceChange(selected);
          }}
        >
          {voices.map((voice) => (
            <option key={voice.name} value={voice.name}>
              {voice.name} ({voice.gender}, {voice.style})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}