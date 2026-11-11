import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { D, fontFamily } from "./theme";
import { Background } from "./ui";
import { Connect, Control, End, Hook, LogoReveal, Monitor, Optimise, Segments } from "./scenes";

/** The whole film: one backdrop, and the eight scenes one after the other. */
export const Promo: React.FC = () => (
  <AbsoluteFill style={{ fontFamily }}>
    <Background />
    <Series>
      <Series.Sequence durationInFrames={D.hook}>
        <Hook />
      </Series.Sequence>
      <Series.Sequence durationInFrames={D.logo}>
        <LogoReveal />
      </Series.Sequence>
      <Series.Sequence durationInFrames={D.connect}>
        <Connect />
      </Series.Sequence>
      <Series.Sequence durationInFrames={D.monitor}>
        <Monitor />
      </Series.Sequence>
      <Series.Sequence durationInFrames={D.control}>
        <Control />
      </Series.Sequence>
      <Series.Sequence durationInFrames={D.optimise}>
        <Optimise />
      </Series.Sequence>
      <Series.Sequence durationInFrames={D.segments}>
        <Segments />
      </Series.Sequence>
      <Series.Sequence durationInFrames={D.end}>
        <End />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
