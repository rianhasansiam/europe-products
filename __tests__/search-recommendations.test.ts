import { describe, expect, it } from "vitest";

import {
  buildSearchRecommendations,
  shouldRequestCatalogSearch,
} from "@/lib/catalog/search-recommendations";

describe("buildSearchRecommendations", () => {
  it("returns a trimmed, case-insensitive unique list for an empty query", () => {
    expect(
      buildSearchRecommendations([
        "  Servo Motors ",
        "PLCs",
        "servo motors",
        "",
      ]),
    ).toEqual(["Servo Motors", "PLCs"]);
  });

  it("prioritizes prefix matches while the customer types", () => {
    expect(
      buildSearchRecommendations(
        ["Industrial Sensors", "Sensor Cables", "Pressure Sensors"],
        "sensor",
      ),
    ).toEqual(["Sensor Cables", "Industrial Sensors", "Pressure Sensors"]);
  });

  it("respects the requested result limit", () => {
    expect(buildSearchRecommendations(["A", "B", "C"], "", 2)).toEqual([
      "A",
      "B",
    ]);
    expect(buildSearchRecommendations(["A"], "", 0)).toEqual([]);
  });

  it("requires two non-whitespace characters before requesting the API", () => {
    expect(shouldRequestCatalogSearch(" ")).toBe(false);
    expect(shouldRequestCatalogSearch("a")).toBe(false);
    expect(shouldRequestCatalogSearch("  ab ")).toBe(true);
  });
});
