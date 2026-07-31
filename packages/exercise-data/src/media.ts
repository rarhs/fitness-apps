/** GitHub Pages deployment of rarhs/exercises-dataset — serves data + media. */
export const DEFAULT_MEDIA_BASE = 'https://rarhs.github.io/exercises-dataset';

/** All media is © Gym Visual, redistributed with permission at 180×180 only.
 * Every app UI that shows exercise media must display this attribution. */
export const DATASET_ATTRIBUTION = '© Gym visual — https://gymvisual.com/';

export function imageUrl(ex: { image: string }, base: string = DEFAULT_MEDIA_BASE): string {
  return `${base}/${ex.image}`;
}

export function gifUrl(ex: { gif_url: string }, base: string = DEFAULT_MEDIA_BASE): string {
  return `${base}/${ex.gif_url}`;
}
