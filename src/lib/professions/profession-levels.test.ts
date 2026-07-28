import { describe, expect, it } from "vitest";
import {
  PROFESSION_LEVEL_THRESHOLDS,
  PROFESSION_LEVEL_TRANSITION_EXPERIENCE,
  professionThresholdsMatchExpectedTable,
  withProfessionLevelDifferences,
} from "@/lib/professions/profession-levels";

describe("shared Profession level thresholds", () => {
  it("contains exactly the supplied 100 continuous levels", () => {
    expect(PROFESSION_LEVEL_THRESHOLDS).toHaveLength(100);
    expect(PROFESSION_LEVEL_THRESHOLDS.map(({ level }) => level)).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1)
    );
  });

  it("preserves every supplied cumulative threshold exactly", () => {
    expect(professionThresholdsMatchExpectedTable()).toBe(true);
    expect(
      PROFESSION_LEVEL_THRESHOLDS.map(({ experienceRequired }) =>
        experienceRequired
      )
    ).toEqual([
      0, 83, 174, 276, 388, 512, 650, 801, 969, 1154, 1358, 1584, 1833,
      2107, 2411, 2746, 3115, 3523, 3973, 4470, 5018, 5624, 6291, 7028,
      7842, 8740, 9730, 10824, 12031, 13363, 14833, 16456, 18247, 20224,
      22406, 24815, 27473, 30408, 33648, 37224, 41171, 45529, 50339,
      55649, 61512, 67983, 75127, 83014, 91721, 101333, 111945, 123660,
      136594, 150872, 166636, 184040, 203254, 224466, 247886, 273742,
      302288, 333804, 368599, 407015, 449428, 496254, 547953, 605032,
      668051, 737627, 814445, 899257, 992895, 1096278, 1210421, 1336443,
      1475581, 1629200, 1798808, 1986068, 2192818, 2421087, 2673114,
      2951373, 3258594, 3597792, 3972294, 4385776, 4842295, 5346332,
      5902831, 6517253, 7195629, 7944614, 8771558, 9684577, 10692629,
      11805606, 13034431, 14391160,
    ]);
  });

  it("preserves every supplied level-transition value exactly", () => {
    expect(PROFESSION_LEVEL_TRANSITION_EXPERIENCE).toEqual([
      83, 91, 102, 112, 124, 138, 151, 168, 185, 204, 226, 249, 274, 304,
      335, 369, 408, 450, 497, 548, 606, 667, 737, 814, 898, 990, 1094,
      1207, 1332, 1470, 1623, 1791, 1977, 2182, 2409, 2658, 2935, 3240,
      3576, 3947, 4358, 4810, 5310, 5863, 6471, 7144, 7887, 8707, 9612,
      10612, 11715, 12934, 14278, 15764, 17404, 19214, 21212, 23420,
      25856, 28546, 31516, 34795, 38416, 42413, 46826, 51699, 57079,
      63019, 69576, 76818, 84812, 93638, 103383, 114143, 126022, 139138,
      153619, 169608, 187260, 206750, 228269, 252027, 278259, 307221,
      339198, 374502, 413482, 456519, 504037, 556499, 614422, 678376,
      748985, 826944, 913019, 1008052, 1112977, 1228825, 1356729,
    ]);
    expect(PROFESSION_LEVEL_TRANSITION_EXPERIENCE).toHaveLength(99);

    const progression = withProfessionLevelDifferences(
      PROFESSION_LEVEL_THRESHOLDS
    );
    expect(progression.slice(0, -1).map((row) => row.experienceToNext)).toEqual(
      [...PROFESSION_LEVEL_TRANSITION_EXPERIENCE]
    );
  });

  it("strictly increases after level 1", () => {
    expect(PROFESSION_LEVEL_THRESHOLDS[0].experienceRequired).toBe(0);
    expect(PROFESSION_LEVEL_THRESHOLDS[99].experienceRequired).toBe(14391160);
    for (let index = 1; index < PROFESSION_LEVEL_THRESHOLDS.length; index += 1) {
      expect(PROFESSION_LEVEL_THRESHOLDS[index].experienceRequired).toBeGreaterThan(
        PROFESSION_LEVEL_THRESHOLDS[index - 1].experienceRequired
      );
    }
  });

  it("computes adjacent differences with the required boundaries", () => {
    const progression = withProfessionLevelDifferences(
      PROFESSION_LEVEL_THRESHOLDS
    );

    expect(progression[0]).toMatchObject({
      level: 1,
      experienceFromPrevious: null,
      experienceToNext: 83,
    });
    expect(progression[1]).toMatchObject({
      level: 2,
      experienceFromPrevious: 83,
      experienceToNext: 91,
    });
    expect(progression[99]).toMatchObject({
      level: 100,
      experienceFromPrevious: 1356729,
      experienceToNext: null,
    });

    for (let index = 1; index < progression.length; index += 1) {
      const difference =
        progression[index].experienceRequired -
        progression[index - 1].experienceRequired;
      expect(progression[index].experienceFromPrevious).toBe(difference);
      expect(progression[index - 1].experienceToNext).toBe(difference);
    }
  });
});
