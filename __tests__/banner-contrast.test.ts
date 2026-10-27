import { describe, expect, it } from "vitest";

import { hasPotentialBannerContrastIssue } from "@/features/admin-banners/contrast";

const lightText = Object.freeze({ foreground: "#30212B", body: "#56444F", primary: "#8B2F55" });
const darkText = Object.freeze({ foreground: "#FFF0F6", body: "#E2CDD7", primary: "#E7A2BE" });

describe("banner contrast advisory", () => {
  it("warns about a dark saved background with the light theme's text colors", () => {
    const background = Object.freeze({ bgType: "solid" as const, bgColor: "#111111" });
    expect(hasPotentialBannerContrastIssue(background, lightText)).toBe(true);
    expect(hasPotentialBannerContrastIssue({ bgType: "solid", bgColor: "#FFF8FB" }, lightText)).toBe(false);
  });

  it("uses the supplied dark theme colors rather than assuming a light theme", () => {
    expect(hasPotentialBannerContrastIssue({ bgType: "solid", bgColor: "#20171D" }, darkText)).toBe(false);
    expect(hasPotentialBannerContrastIssue({ bgType: "solid", bgColor: "#FFFFFF" }, darkText)).toBe(true);
  });

  it.each(["bgFrom", "bgVia", "bgTo"] as const)("checks the configured %s gradient stop", (stop) => {
    expect(hasPotentialBannerContrastIssue({
      bgType: "gradient", bgFrom: "#FFF8FB", bgVia: "#FFFFFF", bgTo: "#F6E4EC", [stop]: "#111111",
    }, lightText)).toBe(true);
  });

  it("accepts legacy palette classes and an omitted middle stop", () => {
    expect(hasPotentialBannerContrastIssue({ bgType: "gradient", bgFrom: "from-rose-50", bgTo: "to-rose-100" }, lightText)).toBe(false);
    expect(hasPotentialBannerContrastIssue({ bgType: "solid", bgColor: "bg-slate-950" }, lightText)).toBe(true);
  });

  it("checks body text at 4.5 and large heading/accent text at 3", () => {
    expect(hasPotentialBannerContrastIssue({ bgType: "solid", bgColor: "#FFFFFF" }, {
      foreground: "#888888", body: "#111111", primary: "#888888",
    })).toBe(false);
    expect(hasPotentialBannerContrastIssue({ bgType: "solid", bgColor: "#FFFFFF" }, {
      foreground: "#111111", body: "#888888", primary: "#111111",
    })).toBe(true);
  });

  it("requests a preview for transparent stops and ignores incomplete colors", () => {
    expect(hasPotentialBannerContrastIssue({ bgType: "solid", bgColor: "#FFF8FB80" }, lightText)).toBe(true);
    expect(hasPotentialBannerContrastIssue({ bgType: "gradient", bgFrom: "#F", bgTo: "" }, lightText)).toBe(false);
  });
});
