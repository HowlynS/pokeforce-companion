import { describe, expect, it } from "vitest";
import {
  positionFromPointerDrag,
  serializeScenicPosition,
} from "@/lib/appearance/position";

describe("positionFromPointerDrag", () => {
  it("converts rendered pointer movement into clamped percentage movement", () => {
    expect(
      positionFromPointerDrag({
        start: { x: 55, y: 60 },
        deltaX: -100,
        deltaY: 50,
        width: 1000,
        height: 500,
      })
    ).toEqual({ x: 65, y: 50 });
  });

  it("clamps both axes and leaves the value unchanged for invalid geometry", () => {
    expect(
      positionFromPointerDrag({
        start: { x: 50, y: 50 },
        deltaX: 1000,
        deltaY: -1000,
        width: 100,
        height: 100,
      })
    ).toEqual({ x: 0, y: 100 });
    expect(
      positionFromPointerDrag({
        start: { x: 25, y: 75 },
        deltaX: 10,
        deltaY: 10,
        width: 0,
        height: 0,
      })
    ).toEqual({ x: 25, y: 75 });
  });
});

describe("serializeScenicPosition", () => {
  it("keeps precision bounded for CSS and form values", () => {
    expect(serializeScenicPosition({ x: 55.5555, y: 60.001 })).toBe(
      "55.56% 60%"
    );
  });
});
