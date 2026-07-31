import { DATASET_ATTRIBUTION } from '@fitness-apps/exercise-data';

/** Attribution is a licensing requirement: all exercise media is © Gym Visual,
 * redistributed with permission at 180×180 only. Shown on every page. */
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>Vault — built on the open exercises-dataset.</span>
        <span>
          Exercise media{' '}
          <a href="https://gymvisual.com/" target="_blank" rel="noreferrer">
            {DATASET_ATTRIBUTION}
          </a>{' '}
          · 180×180, redistributed with permission
        </span>
      </div>
    </footer>
  );
}
