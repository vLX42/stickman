"use client";

import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { useEffect } from "react";

export type Emotion = "happy" | "sad" | "confused" | "overjoyed" | "angry" | "idea" | "thinking" | "sleeping" | "dead";

interface StickManProps {
  emotion: Emotion;
  size?: number;
  speaking?: boolean;
}

// ── Emotion configurations ─────────────────────────────────────────────────
interface EmotionConfig {
  // Eyebrows [left, right]: { y offset from base, rotate degrees }
  leftBrow: { y: number; rotate: number; scaleX: number };
  rightBrow: { y: number; rotate: number; scaleX: number };
  // Eyes: scaleY (0=closed, 1=open)
  leftEyeScaleY: number;
  rightEyeScaleY: number;
  // Pupils offset
  pupilOffset: { x: number; y: number };
  // Mouth: Q control point Y (higher number = bigger smile in SVG coords)
  mouthCtrlY: number;
  mouthWidth: number;
  // Arms: endpoint coords [x, y] and control point
  leftArm: { cx: number; cy: number; ex: number; ey: number };
  rightArm: { cx: number; cy: number; ex: number; ey: number };
  // Legs spread
  leftLeg: { cx: number; cy: number; ex: number; ey: number };
  rightLeg: { cx: number; cy: number; ex: number; ey: number };
  // Head tilt
  headRotate: number;
  // Blush opacity
  blush: number;
  // Eye style: normal pupils | red pulsating glow | black X
  eyeStyle: "normal" | "angry" | "dead";
  // Body sway
  bodySway: number;
  // Bounce speed (0 = no bounce extra)
  bounceAmplitude: number;
  bounceSpeed: number;
}

const EMOTIONS: Record<Emotion, EmotionConfig> = {
  happy: {
    leftBrow: { y: -2, rotate: 5, scaleX: 1 },
    rightBrow: { y: -2, rotate: -5, scaleX: 1 },
    leftEyeScaleY: 1,
    rightEyeScaleY: 1,
    pupilOffset: { x: 0, y: 1 },
    mouthCtrlY: 66,
    mouthWidth: 1,
    leftArm: { cx: 36, cy: 102, ex: 20, ey: 118 },
    rightArm: { cx: 64, cy: 102, ex: 80, ey: 118 },
    leftLeg: { cx: 46, cy: 145, ex: 35, ey: 175 },
    rightLeg: { cx: 54, cy: 145, ex: 65, ey: 175 },
    headRotate: 0,
    blush: 0.55,
    eyeStyle: "normal",
    bodySway: 0,
    bounceAmplitude: 3,
    bounceSpeed: 2.5,
  },
  sad: {
    // inner corners up: left rotate -, right rotate +
    leftBrow: { y: 1, rotate: -10, scaleX: 1 },
    rightBrow: { y: 1, rotate: 10, scaleX: 1 },
    leftEyeScaleY: 0.5,
    rightEyeScaleY: 0.5,
    pupilOffset: { x: 0, y: 3 },
    mouthCtrlY: 42,
    mouthWidth: 0.8,
    leftArm: { cx: 42, cy: 105, ex: 30, ey: 130 },
    rightArm: { cx: 58, cy: 105, ex: 70, ey: 130 },
    leftLeg: { cx: 47, cy: 143, ex: 38, ey: 172 },
    rightLeg: { cx: 53, cy: 143, ex: 62, ey: 172 },
    headRotate: -4,
    blush: 0,
    eyeStyle: "normal",
    bodySway: 0,
    bounceAmplitude: 1,
    bounceSpeed: 3.5,
  },
  confused: {
    // left: raised questioning arch; right: slight skeptical press
    leftBrow: { y: -2, rotate: 14, scaleX: 1.05 },
    rightBrow: { y: 2, rotate: -8, scaleX: 0.85 },
    leftEyeScaleY: 1,
    rightEyeScaleY: 0.45,
    pupilOffset: { x: -2, y: 0 },
    mouthCtrlY: 52,
    mouthWidth: 0.7,
    leftArm: { cx: 40, cy: 103, ex: 22, ey: 122 },
    rightArm: { cx: 62, cy: 98, ex: 74, ey: 72 },
    leftLeg: { cx: 46, cy: 144, ex: 34, ey: 173 },
    rightLeg: { cx: 54, cy: 144, ex: 66, ey: 173 },
    headRotate: 8,
    blush: 0,
    eyeStyle: "normal",
    bodySway: 2,
    bounceAmplitude: 2,
    bounceSpeed: 3,
  },
  overjoyed: {
    // brows raised high (clamped to MIN_BROW_Y inside the face)
    leftBrow: { y: -2, rotate: -8, scaleX: 1.15 },
    rightBrow: { y: -2, rotate: 8, scaleX: 1.15 },
    leftEyeScaleY: 0.08,
    rightEyeScaleY: 0.08,
    pupilOffset: { x: 0, y: 0 },
    mouthCtrlY: 70,
    mouthWidth: 1.2,
    leftArm: { cx: 34, cy: 98, ex: 14, ey: 80 },
    rightArm: { cx: 66, cy: 98, ex: 86, ey: 80 },
    leftLeg: { cx: 45, cy: 144, ex: 30, ey: 176 },
    rightLeg: { cx: 55, cy: 144, ex: 70, ey: 176 },
    headRotate: 0,
    blush: 0.9,
    eyeStyle: "normal",
    bodySway: 0,
    bounceAmplitude: 14,
    bounceSpeed: 0.5,
  },
  angry: {
    leftBrow: { y: 2, rotate: 20, scaleX: 1.05 },
    rightBrow: { y: 2, rotate: -20, scaleX: 1.05 },
    leftEyeScaleY: 0.7,
    rightEyeScaleY: 0.7,
    pupilOffset: { x: 0, y: 2 },
    mouthCtrlY: 38,
    mouthWidth: 0.85,
    leftArm: { cx: 38, cy: 104, ex: 18, ey: 108 },
    rightArm: { cx: 62, cy: 104, ex: 82, ey: 108 },
    leftLeg: { cx: 46, cy: 144, ex: 34, ey: 174 },
    rightLeg: { cx: 54, cy: 144, ex: 66, ey: 174 },
    headRotate: 0,
    blush: 0,
    eyeStyle: "angry",
    bodySway: 0,
    bounceAmplitude: 2,
    bounceSpeed: 0.8,
  },
  idea: {
    leftBrow: { y: -2, rotate: -4, scaleX: 1 },
    rightBrow: { y: -2, rotate: 4, scaleX: 1 },
    leftEyeScaleY: 1,
    rightEyeScaleY: 1,
    pupilOffset: { x: 0, y: -1 },
    mouthCtrlY: 68,
    mouthWidth: 1.05,
    leftArm: { cx: 36, cy: 102, ex: 20, ey: 118 },
    rightArm: { cx: 64, cy: 102, ex: 80, ey: 118 },
    leftLeg: { cx: 46, cy: 145, ex: 35, ey: 175 },
    rightLeg: { cx: 54, cy: 145, ex: 65, ey: 175 },
    headRotate: 0,
    blush: 0.4,
    eyeStyle: "normal",
    bodySway: 0,
    bounceAmplitude: 3,
    bounceSpeed: 2.5,
  },
  thinking: {
    leftBrow: { y: -2, rotate: -8, scaleX: 1 },
    rightBrow: { y: 2, rotate: 6, scaleX: 0.9 },
    leftEyeScaleY: 0.85,
    rightEyeScaleY: 0.6,
    pupilOffset: { x: 3, y: -1 },
    mouthCtrlY: 50,
    mouthWidth: 0.65,
    leftArm: { cx: 42, cy: 105, ex: 30, ey: 125 },
    rightArm: { cx: 62, cy: 95, ex: 76, ey: 78 },
    leftLeg: { cx: 46, cy: 144, ex: 35, ey: 174 },
    rightLeg: { cx: 54, cy: 144, ex: 65, ey: 174 },
    headRotate: 6,
    blush: 0,
    eyeStyle: "normal",
    bodySway: 1,
    bounceAmplitude: 1.5,
    bounceSpeed: 3,
  },
  sleeping: {
    leftBrow: { y: 2, rotate: 5, scaleX: 0.9 },
    rightBrow: { y: 2, rotate: -5, scaleX: 0.9 },
    leftEyeScaleY: 0,
    rightEyeScaleY: 0,
    pupilOffset: { x: 0, y: 0 },
    mouthCtrlY: 49,
    mouthWidth: 0.7,
    leftArm: { cx: 43, cy: 106, ex: 32, ey: 130 },
    rightArm: { cx: 57, cy: 106, ex: 68, ey: 130 },
    leftLeg: { cx: 47, cy: 143, ex: 38, ey: 172 },
    rightLeg: { cx: 53, cy: 143, ex: 62, ey: 172 },
    headRotate: -8,
    blush: 0,
    eyeStyle: "normal",
    bodySway: 0,
    bounceAmplitude: 0.5,
    bounceSpeed: 4,
  },
  dead: {
    leftBrow: { y: 2, rotate: 0, scaleX: 1 },
    rightBrow: { y: 2, rotate: 0, scaleX: 1 },
    leftEyeScaleY: 1,
    rightEyeScaleY: 1,
    pupilOffset: { x: 0, y: 0 },
    mouthCtrlY: 50,
    mouthWidth: 0.6,
    leftArm: { cx: 44, cy: 108, ex: 28, ey: 138 },
    rightArm: { cx: 56, cy: 108, ex: 72, ey: 138 },
    leftLeg: { cx: 46, cy: 145, ex: 34, ey: 174 },
    rightLeg: { cx: 54, cy: 145, ex: 66, ey: 174 },
    headRotate: 14,
    blush: 0,
    eyeStyle: "dead",
    bodySway: 0,
    bounceAmplitude: 0.2,
    bounceSpeed: 6,
  },
};

// Spring transition used for all body part animations
const SPRING = { type: "spring", stiffness: 280, damping: 24 } as const;

export default function StickMan({ emotion, size = 200, speaking = false }: StickManProps) {
  const cfg = EMOTIONS[emotion];
  const headShake = useAnimation();

  // Trigger head shake on angry
  useEffect(() => {
    if (emotion === "angry") {
      headShake.start({
        x: [-4, 5, -4, 4, -2, 2, 0],
        transition: { duration: 0.55, ease: "easeInOut" },
      });
    } else {
      headShake.start({ x: 0, transition: SPRING });
    }
  }, [emotion, headShake]);

  // Bounce animation for overjoyed vs idle float
  const bodyFloat =
    emotion === "overjoyed"
      ? {
          y: [0, -cfg.bounceAmplitude, 0],
          transition: { duration: cfg.bounceSpeed, repeat: Infinity, ease: "easeInOut" as const },
        }
      : {
          y: [0, -cfg.bounceAmplitude, 0],
          transition: { duration: cfg.bounceSpeed, repeat: Infinity, ease: "easeInOut" as const },
        };

  // Brow Y = absolute SVG viewport Y of the brow's top edge (= CSS translateY since SVG y={0}).
  // Head rounded corners (rx=22) mean brows must be ≥ y=11 to stay inside the face at x=23/77.
  // Eye top = cy(36) - r(9) = 27. Hard rule: browY + 3.5 ≤ 25 (2.5 unit gap to eye top).
  const BROW_BASE_Y = 13;
  const MIN_BROW_Y = 11; // keeps brow inside head rounded corners at x=23/77
  const MAX_BROW_Y = 21; // brow bottom at 24.5, 2.5 units above eye top (27)
  const leftBrowY = Math.max(MIN_BROW_Y, Math.min(BROW_BASE_Y + cfg.leftBrow.y, MAX_BROW_Y));
  const rightBrowY = Math.max(MIN_BROW_Y, Math.min(BROW_BASE_Y + cfg.rightBrow.y, MAX_BROW_Y));

  // Mouth path: always same structure M x Q cx,cy x
  const mouthScale = cfg.mouthWidth;
  const mx1 = 50 - 16 * mouthScale;
  const mx2 = 50 + 16 * mouthScale;
  const mouthPath = `M ${mx1},54 Q 50,${cfg.mouthCtrlY} ${mx2},54`;

  // Speaking wobble on mouth ctrl y
  const speakCtrlY = speaking ? cfg.mouthCtrlY - 5 : cfg.mouthCtrlY;

  // Body path: slightly S-curved for organic feel
  const bodyPath = `M 50,75 C ${48 + cfg.bodySway},92 ${52 - cfg.bodySway},112 50,130`;

  return (
    <motion.svg
      viewBox="0 0 100 200"
      width={size}
      height={size * (200 / 100)}
      style={{ overflow: "visible", display: "block" }}
      animate={bodyFloat}
    >
      {/* ── Defs: clip paths for eyes (circle-shaped) ── */}
      <defs>
        <clipPath id="leftEyeClip">
          <circle cx="32" cy="36" r="9" />
        </clipPath>
        <clipPath id="rightEyeClip">
          <circle cx="68" cy="36" r="9" />
        </clipPath>
      </defs>

      {/* ── Whole figure group (for head shake on angry) ── */}
      <motion.g animate={headShake}>

        {/* ── Shadow ── */}
        <motion.ellipse
          cx={50}
          cy={198}
          rx={18}
          ry={4}
          fill="rgba(0,0,0,0.18)"
          animate={{ rx: emotion === "overjoyed" ? [18, 12, 18] : 18 }}
          transition={
            emotion === "overjoyed"
              ? { duration: cfg.bounceSpeed, repeat: Infinity, ease: "easeInOut" }
              : SPRING
          }
        />

        {/* ── Legs ── */}
        <motion.path
          d={`M 50,130 C ${cfg.leftLeg.cx},${cfg.leftLeg.cy} ${cfg.leftLeg.cx - 2},${cfg.leftLeg.cy + 15} ${cfg.leftLeg.ex},${cfg.leftLeg.ey}`}
          stroke="#2a1a0e"
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
          animate={{
            d: `M 50,130 C ${cfg.leftLeg.cx},${cfg.leftLeg.cy} ${cfg.leftLeg.cx - 2},${cfg.leftLeg.cy + 15} ${cfg.leftLeg.ex},${cfg.leftLeg.ey}`,
          }}
          transition={SPRING}
        />
        <motion.path
          d={`M 50,130 C ${cfg.rightLeg.cx},${cfg.rightLeg.cy} ${cfg.rightLeg.cx + 2},${cfg.rightLeg.cy + 15} ${cfg.rightLeg.ex},${cfg.rightLeg.ey}`}
          stroke="#2a1a0e"
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
          animate={{
            d: `M 50,130 C ${cfg.rightLeg.cx},${cfg.rightLeg.cy} ${cfg.rightLeg.cx + 2},${cfg.rightLeg.cy + 15} ${cfg.rightLeg.ex},${cfg.rightLeg.ey}`,
          }}
          transition={SPRING}
        />

        {/* ── Arms (organic: cp1 near shoulder, cp2 near hand) ── */}
        <motion.path
          d={`M 50,90 C ${cfg.leftArm.cx},${90 + (cfg.leftArm.cy - 90) * 0.4} ${cfg.leftArm.ex + (cfg.leftArm.cx - cfg.leftArm.ex) * 0.3},${cfg.leftArm.ey - 5} ${cfg.leftArm.ex},${cfg.leftArm.ey}`}
          stroke="#2a1a0e"
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
          animate={{
            d: `M 50,90 C ${cfg.leftArm.cx},${90 + (cfg.leftArm.cy - 90) * 0.4} ${cfg.leftArm.ex + (cfg.leftArm.cx - cfg.leftArm.ex) * 0.3},${cfg.leftArm.ey - 5} ${cfg.leftArm.ex},${cfg.leftArm.ey}`,
          }}
          transition={SPRING}
        />
        <motion.path
          d={`M 50,90 C ${cfg.rightArm.cx},${90 + (cfg.rightArm.cy - 90) * 0.4} ${cfg.rightArm.ex + (cfg.rightArm.cx - cfg.rightArm.ex) * 0.3},${cfg.rightArm.ey - 5} ${cfg.rightArm.ex},${cfg.rightArm.ey}`}
          stroke="#2a1a0e"
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
          animate={{
            d: `M 50,90 C ${cfg.rightArm.cx},${90 + (cfg.rightArm.cy - 90) * 0.4} ${cfg.rightArm.ex + (cfg.rightArm.cx - cfg.rightArm.ex) * 0.3},${cfg.rightArm.ey - 5} ${cfg.rightArm.ex},${cfg.rightArm.ey}`,
          }}
          transition={SPRING}
        />

        {/* ── Body ── */}
        <motion.path
          d={bodyPath}
          stroke="#2a1a0e"
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
          animate={{ d: bodyPath }}
          transition={SPRING}
        />

        {/* ── Head (CRT TV shape) ── */}
        <motion.g animate={{ rotate: cfg.headRotate }} style={{ originX: "50px", originY: "44px" }} transition={SPRING}>
          {/* Head fill */}
          <motion.rect
            x={14}
            y={5}
            width={72}
            height={62}
            rx={22}
            ry={22}
            fill="#f0d090"
            stroke="#2a1a0e"
            strokeWidth={2.8}
          />

          {/* ── Cheek blush ── */}
          <motion.ellipse
            cx={22}
            cy={50}
            rx={6}
            ry={4}
            fill="#f07090"
            animate={{ opacity: cfg.blush }}
            transition={SPRING}
          />
          <motion.ellipse
            cx={78}
            cy={50}
            rx={6}
            ry={4}
            fill="#f07090"
            animate={{ opacity: cfg.blush }}
            transition={SPRING}
          />

          {/* ── Left Eye ── */}
          <motion.g style={{ originX: "32px", originY: "36px" }}>
            {/* Angry outer glow — rendered before white base so it sits behind the eye ring */}
            <AnimatePresence>
              {cfg.eyeStyle === "angry" && (
                <motion.circle
                  key="left-glow"
                  cx={32} cy={36} r={11}
                  fill="#ff2200"
                  initial={{ opacity: 0 }}
                  animate={{ r: [10, 13, 10], opacity: [0.25, 0.06, 0.25] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </AnimatePresence>
            <circle cx={32} cy={36} r={9} fill="#fff" />
            <g clipPath="url(#leftEyeClip)">
              {/* Normal pupils */}
              {cfg.eyeStyle === "normal" && (
                <>
                  <motion.circle cx={32} cy={36} r={4} fill="#2a1a0e"
                    animate={{ cx: 32 + cfg.pupilOffset.x, cy: 36 + cfg.pupilOffset.y }}
                    transition={SPRING}
                  />
                  <motion.circle cx={34} cy={33} r={1.4} fill="#fff"
                    animate={{ cx: 34 + cfg.pupilOffset.x, cy: 33 + cfg.pupilOffset.y }}
                    transition={SPRING}
                  />
                </>
              )}
              {/* Angry: red pulsating fill */}
              {cfg.eyeStyle === "angry" && (
                <>
                  <motion.circle cx={32} cy={36} r={8}
                    fill="#bb1100"
                    animate={{ r: [7.5, 9, 7.5], opacity: [1, 0.75, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.circle cx={32} cy={37} r={4}
                    fill="#ff3300"
                    animate={{ r: [3.5, 5, 3.5] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <circle cx={34} cy={33} r={1.5} fill="#ff8866" opacity={0.9} />
                </>
              )}
              {/* Eyelid overlay */}
              <motion.rect
                x={22} y={26} width={20} rx={0}
                fill="#f0d090"
                animate={{ height: (1 - cfg.leftEyeScaleY) * 16 + 1 }}
                transition={SPRING}
              />
              {/* Dead: black X */}
              <AnimatePresence>
                {cfg.eyeStyle === "dead" && (
                  <motion.g key="left-dead-x"
                    initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.25 }}
                    style={{ originX: "32px", originY: "36px" }}
                  >
                    <line x1="25" y1="29" x2="39" y2="43" stroke="#111" strokeWidth={3} strokeLinecap="round" />
                    <line x1="39" y1="29" x2="25" y2="43" stroke="#111" strokeWidth={3} strokeLinecap="round" />
                  </motion.g>
                )}
              </AnimatePresence>
            </g>
            <circle cx={32} cy={36} r={9} fill="none" stroke="#2a1a0e" strokeWidth={1.5} />
          </motion.g>

          {/* ── Right Eye ── */}
          <motion.g style={{ originX: "68px", originY: "36px" }}>
            <AnimatePresence>
              {cfg.eyeStyle === "angry" && (
                <motion.circle
                  key="right-glow"
                  cx={68} cy={36} r={11}
                  fill="#ff2200"
                  initial={{ opacity: 0 }}
                  animate={{ r: [10, 13, 10], opacity: [0.25, 0.06, 0.25] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </AnimatePresence>
            <circle cx={68} cy={36} r={9} fill="#fff" />
            <g clipPath="url(#rightEyeClip)">
              {cfg.eyeStyle === "normal" && (
                <>
                  <motion.circle cx={68} cy={36} r={4} fill="#2a1a0e"
                    animate={{ cx: 68 + cfg.pupilOffset.x, cy: 36 + cfg.pupilOffset.y }}
                    transition={SPRING}
                  />
                  <motion.circle cx={70} cy={33} r={1.4} fill="#fff"
                    animate={{ cx: 70 + cfg.pupilOffset.x, cy: 33 + cfg.pupilOffset.y }}
                    transition={SPRING}
                  />
                </>
              )}
              {cfg.eyeStyle === "angry" && (
                <>
                  <motion.circle cx={68} cy={36} r={8}
                    fill="#bb1100"
                    animate={{ r: [7.5, 9, 7.5], opacity: [1, 0.75, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.circle cx={68} cy={37} r={4}
                    fill="#ff3300"
                    animate={{ r: [3.5, 5, 3.5] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <circle cx={70} cy={33} r={1.5} fill="#ff8866" opacity={0.9} />
                </>
              )}
              <motion.rect
                x={58} y={26} width={20} rx={0}
                fill="#f0d090"
                animate={{ height: (1 - cfg.rightEyeScaleY) * 16 + 1 }}
                transition={SPRING}
              />
              <AnimatePresence>
                {cfg.eyeStyle === "dead" && (
                  <motion.g key="right-dead-x"
                    initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.25 }}
                    style={{ originX: "68px", originY: "36px" }}
                  >
                    <line x1="61" y1="29" x2="75" y2="43" stroke="#111" strokeWidth={3} strokeLinecap="round" />
                    <line x1="75" y1="29" x2="61" y2="43" stroke="#111" strokeWidth={3} strokeLinecap="round" />
                  </motion.g>
                )}
              </AnimatePresence>
            </g>
            <circle cx={68} cy={36} r={9} fill="none" stroke="#2a1a0e" strokeWidth={1.5} />
          </motion.g>

          {/* ── Mouth ── */}
          <motion.path
            d={mouthPath}
            stroke="#2a1a0e"
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
            animate={{ d: speaking ? `M ${mx1},54 Q 50,${speakCtrlY} ${mx2},54` : mouthPath }}
            transition={
              speaking
                ? { duration: 0.18, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
                : SPRING
            }
          />

          {/* ── Eyebrows ── */}
          {/* SVG y={0}: CSS translateY IS the absolute visual position.
              originX/Y in SVG viewport coords: x=30/70 = brow centre, y=1.75 = rect
              half-height — constant because the rect's SVG origin is always at y=0. */}
          <motion.rect
            x={23}
            y={0}
            width={14}
            height={3.5}
            rx={2}
            fill="#2a1a0e"
            initial={{ y: leftBrowY }}
            animate={{
              y: leftBrowY,
              rotate: cfg.leftBrow.rotate,
              scaleX: cfg.leftBrow.scaleX,
            }}
            style={{ originX: "30px", originY: "1.75px" }}
            transition={SPRING}
          />
          <motion.rect
            x={63}
            y={0}
            width={14}
            height={3.5}
            rx={2}
            fill="#2a1a0e"
            initial={{ y: rightBrowY }}
            animate={{
              y: rightBrowY,
              rotate: cfg.rightBrow.rotate,
              scaleX: cfg.rightBrow.scaleX,
            }}
            style={{ originX: "70px", originY: "1.75px" }}
            transition={SPRING}
          />
        </motion.g>

      </motion.g>

      {/* ── Idea: lightbulb above head ── */}
      <AnimatePresence>
        {emotion === "idea" && (
          <motion.g
            key="lightbulb"
            initial={{ opacity: 0, y: 10, scale: 0.6 }}
            animate={{ opacity: 1, y: [0, -4, 0], scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ opacity: { duration: 0.3 }, scale: { duration: 0.3 }, y: { duration: 1.8, repeat: Infinity, ease: "easeInOut" as const } }}
          >
            {/* Bulb glow */}
            <circle cx={50} cy={-22} r={11} fill="#ffe066" opacity={0.25} />
            {/* Bulb body */}
            <circle cx={50} cy={-22} r={8} fill="#ffe066" stroke="#c8a800" strokeWidth={1.2} />
            {/* Filament lines */}
            <path d="M 46,-26 Q 48,-24 46,-22 Q 48,-20 46,-18" stroke="#c8a800" strokeWidth={1} fill="none" strokeLinecap="round" />
            <path d="M 54,-26 Q 52,-24 54,-22 Q 52,-20 54,-18" stroke="#c8a800" strokeWidth={1} fill="none" strokeLinecap="round" />
            {/* Base cap */}
            <rect x={46} y={-14.5} width={8} height={2.5} rx={1} fill="#c8a800" />
            <rect x={46.5} y={-12.5} width={7} height={2} rx={1} fill="#c8a800" />
            {/* Shine */}
            <circle cx={46} cy={-25} r={1.8} fill="#fff" opacity={0.6} />
          </motion.g>
        )}
      </AnimatePresence>

      {/* ── Thinking: thought bubbles upper-right ── */}
      <AnimatePresence>
        {emotion === "thinking" && (
          <motion.g
            key="thinking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Small dots rising */}
            <motion.circle cx={72} cy={10} r={2} fill="#aaa" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity, delay: 0 }} />
            <motion.circle cx={79} cy={1} r={3} fill="#aaa" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity, delay: 0.2 }} />
            {/* Main thought cloud */}
            <motion.g animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.6, repeat: Infinity, delay: 0.4 }}>
              <circle cx={84} cy={-8} r={5.5} fill="#e8e8e8" stroke="#bbb" strokeWidth={0.8} />
              <circle cx={93} cy={-10} r={4.5} fill="#e8e8e8" stroke="#bbb" strokeWidth={0.8} />
              <circle cx={89} cy={-16} r={5} fill="#e8e8e8" stroke="#bbb" strokeWidth={0.8} />
              <circle cx={98} cy={-16} r={4} fill="#e8e8e8" stroke="#bbb" strokeWidth={0.8} />
              <circle cx={94} cy={-21} r={3.5} fill="#e8e8e8" stroke="#bbb" strokeWidth={0.8} />
              {/* Dots inside cloud */}
              <circle cx={88} cy={-12} r={1.2} fill="#999" />
              <circle cx={93} cy={-13} r={1.2} fill="#999" />
              <circle cx={90.5} cy={-9} r={1.2} fill="#999" />
            </motion.g>
          </motion.g>
        )}
      </AnimatePresence>

      {/* ── Sleeping: Zzz ── */}
      <AnimatePresence>
        {emotion === "sleeping" && (
          <motion.g
            key="sleeping"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.text
              x={72} y={5}
              fontSize={7} fontWeight="bold" fill="#7ab" fontFamily="system-ui, sans-serif"
              animate={{ opacity: [0, 1, 1, 0], y: [8, 5, 5, 2] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: 0, times: [0, 0.2, 0.8, 1] }}
            >Z</motion.text>
            <motion.text
              x={79} y={-4}
              fontSize={9} fontWeight="bold" fill="#7ab" fontFamily="system-ui, sans-serif"
              animate={{ opacity: [0, 1, 1, 0], y: [-1, -4, -4, -7] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: 0.6, times: [0, 0.2, 0.8, 1] }}
            >Z</motion.text>
            <motion.text
              x={88} y={-14}
              fontSize={12} fontWeight="bold" fill="#7ab" fontFamily="system-ui, sans-serif"
              animate={{ opacity: [0, 1, 1, 0], y: [-11, -14, -14, -18] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: 1.2, times: [0, 0.2, 0.8, 1] }}
            >Z</motion.text>
          </motion.g>
        )}
      </AnimatePresence>

    </motion.svg>
  );
}
