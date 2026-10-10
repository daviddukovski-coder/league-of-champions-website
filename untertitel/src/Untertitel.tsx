import "@fontsource/montserrat/800.css";
import { fitText } from "@remotion/layout-utils";
import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { buildChunks, Chunk, CaptionsFile } from "./captions";

export type UntertitelProps = { data: CaptionsFile; greenScreen: boolean };

const FONT_FAMILY = "Montserrat";
const FONT_WEIGHT = "800";
const MAX_FONT_SIZE = 84;
const MIN_FONT_SIZE = 66; // darunter wird lieber umgebrochen statt verkleinert
const TEXT_WIDTH = 940; // 1080 minus Rand

const useFontLoaded = () => {
  const [handle] = useState(() => delayRender("Schrift laden"));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    document.fonts.load(`${FONT_WEIGHT} 80px ${FONT_FAMILY}`).then(() => {
      setLoaded(true);
      continueRender(handle);
    });
  }, [handle]);
  return loaded;
};

const CaptionLine: React.FC<{ chunk: Chunk; orange: string }> = ({ chunk, orange }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const startFrame = Math.round(chunk.start * fps);
  const pop = spring({ frame: frame - startFrame, fps, config: { damping: 200 }, durationInFrames: 6 });

  const text = chunk.words.map((w) => w.text).join(" ");
  const { fontSize } = fitText({ text, withinWidth: TEXT_WIDTH, fontFamily: FONT_FAMILY, fontWeight: FONT_WEIGHT });

  return (
    <div
      style={{
        fontFamily: FONT_FAMILY,
        fontWeight: FONT_WEIGHT,
        fontSize: Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, fontSize)),
        maxWidth: TEXT_WIDTH,
        color: "#FFFFFF",
        textAlign: "center",
        textWrap: "balance",
        lineHeight: 1.15,
        textShadow: "0 3px 10px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.55)",
        opacity: pop,
        transform: `scale(${interpolate(pop, [0, 1], [0.92, 1])})`,
      }}
    >
      {chunk.words.map((w, i) => (
        <span key={i} style={w.orange ? { color: orange } : undefined}>
          {w.text}
          {i < chunk.words.length - 1 ? " " : ""}
        </span>
      ))}
    </div>
  );
};

export const Untertitel: React.FC<UntertitelProps> = ({ data, greenScreen }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fontLoaded = useFontLoaded();
  const time = frame / fps;
  const chunks = buildChunks(data);
  const active = chunks.find((c) => time >= c.start && time < c.end);

  return (
    <AbsoluteFill style={{ backgroundColor: greenScreen ? "#00FF00" : "transparent" }}>
      {/* unteres Drittel: Zeile sitzt mittig bei ca. 73 % der Höhe */}
      <AbsoluteFill style={{ top: 1280, height: 520, justifyContent: "center", alignItems: "center" }}>
        {fontLoaded && active ? <CaptionLine chunk={active} orange={data.orangeColor ?? "#FF7A00D5"} /> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
