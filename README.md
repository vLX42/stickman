# StickMan

An animated SVG stick-figure React component built with [Framer Motion](https://www.framer.com/motion/). Inspired by Clippy — a friendly, expressive character that reacts to user actions, indicates loading states, or conveys emotion in your UI.

![StickMan emotions](https://raw.githubusercontent.com/vLX42/stickman/main/public/preview.png)

## Features

- 8 emotions with fully animated transitions: `happy`, `sad`, `confused`, `overjoyed`, `angry`, `idea`, `thinking`, `sleeping`
- Spring-physics transitions on every body part (arms, legs, body, head, eyes, brows, mouth)
- Lightbulb overlay for `idea`, thought-cloud for `thinking`, floating Zzz for `sleeping`
- Optional speaking animation (mouth loop)
- Configurable size
- TypeScript-first — `Emotion` type exported

## Installation

```bash
npm install @vlx42/stickman framer-motion
# or
pnpm add @vlx42/stickman framer-motion
# or
yarn add @vlx42/stickman framer-motion
```

`framer-motion` is a peer dependency — install it alongside the package.

### GitHub Packages registry

The package is published to GitHub Packages. Add the following to your `.npmrc`:

```
@vlx42:registry=https://npm.pkg.github.com
```

## Usage

```tsx
import StickMan, { type Emotion } from '@vlx42/stickman';

export default function App() {
  return (
    <StickMan
      emotion="happy"
      size={200}
      speaking={false}
    />
  );
}
```

### Next.js (App Router)

The component uses Framer Motion hooks, so it must run on the client. Add `"use client"` to any file that imports it, or wrap it in a client boundary:

```tsx
// components/MyClientWidget.tsx
'use client';
import StickMan from '@vlx42/stickman';

export function MyClientWidget({ emotion }: { emotion: string }) {
  return <StickMan emotion={emotion} size={150} />;
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `emotion` | `Emotion` | — | **Required.** The character's current emotion. |
| `size` | `number` | `200` | Width in px. Height is always `size × 2` (1:2 aspect ratio). |
| `speaking` | `boolean` | `false` | Triggers a subtle mouth open/close loop. |

## Emotions

| Value | Description |
|-------|-------------|
| `"happy"` | Smile, rosy cheeks, gentle bounce |
| `"sad"` | Droopy eyelids, inner brows raised, arms hanging low |
| `"confused"` | Asymmetric brows, head tilt, right arm raised (scratching head) |
| `"overjoyed"` | Eyes nearly closed, huge smile, arms raised, fast bouncing |
| `"angry"` | X eyes, furrowed brows, arms on hips, head shake on enter |
| `"idea"` | Animated lightbulb above head, wide eyes, brows raised |
| `"thinking"` | Thought-cloud upper-right, side-glancing pupils, head tilted |
| `"sleeping"` | Eyes shut, head drooped, staggered Zzz floating upward |

```tsx
import StickMan, { type Emotion } from '@vlx42/stickman';

const emotions: Emotion[] = [
  'happy', 'sad', 'confused', 'overjoyed',
  'angry', 'idea', 'thinking', 'sleeping',
];
```

## Interactive example

Switch emotions dynamically and the character will spring-animate between states:

```tsx
'use client';
import { useState } from 'react';
import StickMan, { type Emotion } from '@vlx42/stickman';

export default function Demo() {
  const [emotion, setEmotion] = useState<Emotion>('happy');

  return (
    <div>
      <StickMan emotion={emotion} size={200} />
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {(['happy', 'sad', 'angry', 'idea', 'sleeping'] as Emotion[]).map((e) => (
          <button key={e} onClick={() => setEmotion(e)}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
```

## SVG architecture

The component renders a `viewBox="0 0 100 200"` SVG at the requested `size`. It uses `overflow: visible` so eyebrows, limbs, and overlays (lightbulb, Zzz) can extend outside the bounding box without clipping. The eyes use SVG `<clipPath>` to contain pupils and eyelids within the eye circles.

## Development

```bash
git clone https://github.com/vLX42/stickman.git
cd stickman
npm install
npm run dev        # interactive demo at http://localhost:3000
npm run build:pkg  # build the publishable package into dist/
```

## License

MIT
