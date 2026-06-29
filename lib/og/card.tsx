import { ImageResponse } from 'next/og';

// Shared 1200x630 social card for Verdact's public surfaces, so a link dropped in
// a Reddit/X/Slack thread unfurls as a branded card instead of a bare URL. Plain
// Satori-safe JSX (every multi-child node sets display:flex, explicit px sizes,
// inline styles). Uses next/og's built-in default font for reliability; brand
// font (Schibsted Grotesk) on the card is a deferred polish item.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

const INK = '#0C1311';
const PAPER = '#F7F6F2';
const GREEN = '#3BD89A';
const MUTED = '#9DB3AC';

interface OgCardOptions {
  eyebrow: string;
  title: string;
  sub: string;
}

export function verdactOgCard({ eyebrow, title, sub }: OgCardOptions): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: INK,
          padding: '72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              background: GREEN,
              marginRight: '16px',
            }}
          />
          <div
            style={{
              display: 'flex',
              color: PAPER,
              fontSize: '30px',
              fontWeight: 700,
              letterSpacing: '-0.5px',
            }}
          >
            Verdact
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              color: GREEN,
              fontSize: '24px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              marginBottom: '22px',
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: 'flex',
              color: PAPER,
              fontSize: '62px',
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: '-1.5px',
              maxWidth: '1000px',
              marginBottom: '24px',
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: 'flex',
              color: MUTED,
              fontSize: '29px',
              fontWeight: 400,
              lineHeight: 1.3,
              maxWidth: '960px',
            }}
          >
            {sub}
          </div>
        </div>

        <div style={{ display: 'flex', color: MUTED, fontSize: '24px', fontWeight: 500 }}>
          verdact.io
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
