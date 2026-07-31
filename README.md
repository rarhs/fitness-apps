# fitness-apps

Monorepo of fitness apps built on the [exercises-dataset](https://github.com/rarhs/exercises-dataset) (1,324 exercises, multilingual instructions, 180×180 media).

## Structure

```
fitness-apps/
├── packages/
│   └── exercise-data/   # shared data layer: types, slim exercise index,
│                        # media URL helpers, runtime dataset fetch
└── apps/
    └── vault/           # exercise library, routine builder and session
                         # logger (Vite + React, localStorage persistence)
```

## Quickstart

```sh
npm install        # root, once — npm workspaces
npm run sync-data  # regenerate the exercise index from the dataset
npm run check      # type-check all workspaces
```

## Data source

`@fitness-apps/exercise-data` bundles a slim index of all exercises (no instruction text) generated from the dataset by `npm run sync-data`. Everything heavier loads at runtime from the dataset's GitHub Pages deployment:

- Full dataset: `https://rarhs.github.io/exercises-dataset/data/exercises.json`
- Media: `https://rarhs.github.io/exercises-dataset/images/…` and `…/videos/…`

## Licensing

Code is MIT. Exercise **media is © [Gym Visual](https://gymvisual.com/)**, redistributed with permission at 180×180 only — apps must display the attribution wherever media is shown and must not upscale or re-host it.
