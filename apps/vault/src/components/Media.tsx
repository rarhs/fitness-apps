import { useEffect, useState } from 'react';

interface MediaProps {
  src: string;
  alt: string;
  contain?: boolean;
  dimmed?: boolean;
}

/** Exercise media through the design system's `.lighten` treatment; hides
 * itself on load failure so the media-box placeholder shows through. */
export function Media({ src, alt, contain, dimmed }: MediaProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      className="lighten"
      loading="lazy"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: contain ? 'contain' : 'cover',
        opacity: dimmed ? 0.55 : undefined,
      }}
      onError={() => setFailed(true)}
    />
  );
}
