export type Emotion = "happy" | "sad" | "confused" | "overjoyed" | "angry" | "idea" | "thinking" | "sleeping";
interface StickManProps {
    emotion: Emotion;
    size?: number;
    speaking?: boolean;
}
export default function StickMan({ emotion, size, speaking }: StickManProps): import("react/jsx-runtime").JSX.Element;
export {};
