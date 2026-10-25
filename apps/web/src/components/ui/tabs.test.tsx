import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

describe("Tabs with Swipeable mobile navigation", () => {
  it("renders tabs and active content in SSR/server mode", () => {
    const html = renderToString(
      <Tabs defaultValue="hub">
        <TabsList variant="line">
          <TabsTrigger value="hub" variant="line">
            Main Hub
          </TabsTrigger>
          <TabsTrigger value="solar" variant="line">
            Solar Array
          </TabsTrigger>
          <TabsTrigger value="battery" variant="line">
            Battery Pack
          </TabsTrigger>
        </TabsList>
        <TabsContent value="hub">Hub Content</TabsContent>
        <TabsContent value="solar">Solar Content</TabsContent>
        <TabsContent value="battery">Battery Content</TabsContent>
      </Tabs>
    );

    expect(html).toContain("Main Hub");
    expect(html).toContain("Solar Array");
    expect(html).toContain("Battery Pack");
    expect(html).toContain("Hub Content");
  });

  it("TabsList variant line includes no-scrollbar, flex-nowrap, and overflow-x-auto", () => {
    const html = renderToString(
      <Tabs defaultValue="hub">
        <TabsList variant="line">
          <TabsTrigger value="hub" variant="line">
            Main Hub
          </TabsTrigger>
        </TabsList>
      </Tabs>
    );

    expect(html).toContain("no-scrollbar");
    expect(html).toContain("flex-nowrap");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("scroll-smooth");
  });

  it("TabsTrigger includes shrink-0 and data-value attribute for touch gestures", () => {
    const html = renderToString(
      <Tabs defaultValue="hub">
        <TabsList variant="line">
          <TabsTrigger value="hub" variant="line">
            Main Hub
          </TabsTrigger>
          <TabsTrigger value="solar" variant="line">
            Solar Array
          </TabsTrigger>
        </TabsList>
      </Tabs>
    );

    expect(html).toContain('data-value="hub"');
    expect(html).toContain('data-value="solar"');
    expect(html).toContain("shrink-0");
  });
});
