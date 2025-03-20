// utils/api.ts

// available voices to choose from
export const PLAYAI_VOICES = [
    {
      name: 'Angelo',
      accent: 'american',
      language: 'English (US)',
      languageCode: 'EN-US',
      value: 's3://voice-cloning-zero-shot/baf1ef41-36b6-428c-9bdf-50ba54682bd8/original/manifest.json',
      sample: 'https://peregrine-samples.s3.us-east-1.amazonaws.com/parrot-samples/Angelo_Sample.wav',
      gender: 'male',
      style: 'Conversational',
    },
    {
      name: 'Deedee',
      accent: 'american',
      language: 'English (US)',
      languageCode: 'EN-US',
      value: 's3://voice-cloning-zero-shot/e040bd1b-f190-4bdb-83f0-75ef85b18f84/original/manifest.json',
      sample: 'https://peregrine-samples.s3.us-east-1.amazonaws.com/parrot-samples/Deedee_Sample.wav',
      gender: 'female',
      style: 'Conversational',
    },
    {
      name: 'Jennifer',
      accent: 'american',
      language: 'English (US)',
      languageCode: 'EN-US',
      value: 's3://voice-cloning-zero-shot/801a663f-efd0-4254-98d0-5c175514c3e8/jennifer/manifest.json',
      sample: 'https://peregrine-samples.s3.amazonaws.com/parrot-samples/jennifer.wav',
      gender: 'female',
      style: 'Conversational',
    },
    {
      name: 'Briggs',
      accent: 'american',
      language: 'English (US)',
      languageCode: 'EN-US',
      value: 's3://voice-cloning-zero-shot/71cdb799-1e03-41c6-8a05-f7cd55134b0b/original/manifest.json',
      sample: 'https://peregrine-samples.s3.us-east-1.amazonaws.com/parrot-samples/Briggs_Sample.wav',
      gender: 'male',
      style: 'Narrative',
    },
    {
      name: 'Samara',
      accent: 'american',
      language: 'English (US)',
      languageCode: 'EN-US',
      value: 's3://voice-cloning-zero-shot/90217770-a480-4a91-b1ea-df00f4d4c29d/original/manifest.json',
      sample: 'https://parrot-samples.s3.amazonaws.com/gargamel/Samara.wav',
      gender: 'female',
      style: 'Conversational',
    }
  ];
  
// api connection details from environment variables
const API_KEY = process.env.NEXT_PUBLIC_PLAYAI_API_KEY || '';
const USER_ID = process.env.NEXT_PUBLIC_PLAYAI_USER_ID || '';
const TTS_API_URL = process.env.NEXT_PUBLIC_PLAYAI_TTS_API_URL || 'https://api.play.ai/api/v1/tts/stream';

// show warning if env variables are missing
if (!API_KEY || !USER_ID) {
  console.warn('PlayAI API credentials missing. Please check your .env file.');
}
  
export interface TtsOptions {
  text: string;
  voice: string;
  temperature?: number;
  speed?: number;
}

// sends text to the api and gets back audio
export async function generateSpeech({ text, voice, temperature = 0.5, speed = 1 }: TtsOptions): Promise<string> {
  const trimmedText = text.trim();
    
  if (!trimmedText) {
    return Promise.reject(new Error("Empty text cannot be processed"));
  }
    
  console.log(`Generating speech for text (${trimmedText.length} chars): "${trimmedText.substring(0, 50)}..."`);
    
  try {
    // set timeot for 30 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
      
    const response = await fetch(TTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'X-User-Id': USER_ID
      },
      body: JSON.stringify({
        text: trimmedText,
        voice,
        temperature,
        speed,
        model: "PlayDialog"
      }),
      signal: controller.signal
    });
  
    clearTimeout(timeoutId);
      
    console.log('TTS API Response status:', response.status);
      
    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API Error response:', errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
  
    const blob = await response.blob();
      
    if (blob.size === 0) {
      console.error('Received empty audio blob from API');
      throw new Error('API returned empty audio data');
    }
      
    console.log('Received audio blob:', blob.size, 'bytes,', blob.type);
      
    const audioUrl = URL.createObjectURL(blob);
    return audioUrl;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('TTS request timed out after 30 seconds');
      throw new Error('TTS request timed out after 30 seconds');
    }
    console.error('Error generating speech:', error);
    throw error;
  }
}