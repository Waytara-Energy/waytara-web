"use client";

import * as React from "react";
import type { SettingsTab } from "@/lib/account-health";

interface Nav {
  /** opens another tab of the settings page */
  go: (tab: SettingsTab) => void;
}

const NavContext = React.createContext<Nav>({ go: () => undefined });

export const SettingsNavProvider = NavContext.Provider;

/** Lets a card send the person to another tab ("Add a photo" on the Account tab opens Profile). */
export const useSettingsNav = (): Nav => React.useContext(NavContext);
