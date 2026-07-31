import { describe, expect, it } from 'vitest';
import {
  DATASET_ATTRIBUTION,
  DEFAULT_MEDIA_BASE,
  gifUrl,
  imageUrl,
  instructionSteps,
  type Exercise,
} from '@fitness-apps/exercise-data';

describe('media URLs', () => {
  it('joins the media base with the record-relative paths', () => {
    expect(imageUrl({ image: 'images/0001-2gPfomN.jpg' })).toBe(
      `${DEFAULT_MEDIA_BASE}/images/0001-2gPfomN.jpg`,
    );
    expect(gifUrl({ gif_url: 'videos/0001-2gPfomN.gif' })).toBe(
      `${DEFAULT_MEDIA_BASE}/videos/0001-2gPfomN.gif`,
    );
  });

  it('accepts a custom base for self-hosted media', () => {
    expect(imageUrl({ image: 'images/x.jpg' }, 'https://cdn.example.com')).toBe(
      'https://cdn.example.com/images/x.jpg',
    );
  });
});

describe('instructionSteps', () => {
  const ex = {
    instruction_steps: { en: ['step one', 'step two'], es: ['paso uno'] },
  } as unknown as Exercise;

  it('returns the requested language when present', () => {
    expect(instructionSteps(ex, 'es')).toEqual(['paso uno']);
  });

  it('falls back to English, then to empty', () => {
    expect(instructionSteps(ex, 'de')).toEqual(['step one', 'step two']);
    expect(instructionSteps({ instruction_steps: {} } as unknown as Exercise, 'de')).toEqual([]);
  });
});

describe('attribution', () => {
  it('carries the Gym Visual notice every media surface must show', () => {
    expect(DATASET_ATTRIBUTION).toContain('Gym visual');
    expect(DATASET_ATTRIBUTION).toContain('https://gymvisual.com/');
  });
});
