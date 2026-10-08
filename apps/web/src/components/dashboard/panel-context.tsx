"use client";

import * as React from "react";

// A chart panel moves its description from under the title to under the chart (the caption); the chart reads it from here and draws it
// below its x axis, so the line under the title is free for the value being pointed at.
const PanelCaptionContext = React.createContext<string | null>(null);

export const PanelCaptionProvider = PanelCaptionContext.Provider;
export const usePanelCaption = (): string | null => React.useContext(PanelCaptionContext);
