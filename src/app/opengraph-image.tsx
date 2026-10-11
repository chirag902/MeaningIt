import { ImageResponse } from 'next/og';

export const alt = 'MeaningIt — AI-Powered Multilingual Translator';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f0a1f 0%, #2e1065 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 132, fontWeight: 800, letterSpacing: -3 }}>
          Meaning<span style={{ color: '#a78bfa' }}>It</span>
        </div>

        <div style={{ display: 'flex', fontSize: 38, marginTop: 20, color: '#ddd6fe' }}>
          Translate text, voice, conversations and images
        </div>

        <div style={{ display: 'flex', fontSize: 28, marginTop: 44, color: '#a78bfa' }}>
          Hello · Hola · Bonjour · Ciao · Hallo
        </div>
      </div>
    ),
    { ...size },
  );
}