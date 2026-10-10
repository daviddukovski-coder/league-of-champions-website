import { Composition } from "remotion";
import captionsFile from "../captions.json";
import { Untertitel, UntertitelProps } from "./Untertitel";
import { CaptionsFile } from "./captions";

const FPS = 30;
const data = captionsFile as CaptionsFile;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Untertitel"
      component={Untertitel}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={FPS}
      defaultProps={{ data, greenScreen: false } satisfies UntertitelProps}
      // Videolänge = Ende der letzten Untertitelzeile (+ 0,5 s Puffer)
      calculateMetadata={({ props }) => {
        const lastEnd = Math.max(0, ...props.data.captions.map((c) => c.end));
        return { durationInFrames: Math.max(1, Math.ceil((lastEnd + 0.5) * FPS)) };
      }}
    />
  );
};
