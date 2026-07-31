import { useNavigate } from 'react-router';
import { gifUrl, imageUrl, type ExerciseIndexEntry } from '@fitness-apps/exercise-data';
import { useAppState } from '../state';
import { Media } from './Media';

interface ExerciseCardProps {
  exercise: ExerciseIndexEntry;
  /** Show "category · equipment" (library) instead of equipment alone (home). */
  showCategory?: boolean;
}

export function ExerciseCard({ exercise, showCategory }: ExerciseCardProps) {
  const navigate = useNavigate();
  const { prefs } = useAppState();
  const animateThumbs = prefs[1] ?? false;
  return (
    <button className="ex-card" onClick={() => navigate(`/exercise/${exercise.id}`)}>
      <div className="media-box">
        <Media src={animateThumbs ? gifUrl(exercise) : imageUrl(exercise)} alt={exercise.name} />
        <span className="media-id">{exercise.id}</span>
      </div>
      <div style={{ padding: '11px 12px 13px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 14,
            lineHeight: 1.25,
            textTransform: 'capitalize',
          }}
        >
          {exercise.name}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'color-mix(in srgb, var(--color-text) 50%, transparent)',
            textTransform: 'capitalize',
          }}
        >
          {showCategory ? (
            <>
              <span>{exercise.body_part}</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{exercise.equipment}</span>
            </>
          ) : (
            <span>{exercise.equipment}</span>
          )}
        </div>
      </div>
    </button>
  );
}
