import { Config } from "@remotion/cli/config";

// PNG-Frames, damit der Alphakanal (Transparenz) erhalten bleibt.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
