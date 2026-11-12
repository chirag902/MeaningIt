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
          background: 'linear-gradient(135deg, #141A17, #1C2420)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 132, fontWeight: 800, letterSpacing: -3 }}>
        Meaning<span style={{ color: '#F08A70' }}>It</span>
        </div>

        <div style={{ display: 'flex', fontSize: 38, marginTop: 20, color: '#AAB2AA' }}>
  Translate text, voice, conversations and images
</div>

<div style={{ display: 'flex', fontSize: 28, marginTop: 44, color: '#F08A70' }}>
  Hello · Hola · Bonjour · Ciao · Hallo
</div>
      </div>
    ),
    { ...size },
  );
}