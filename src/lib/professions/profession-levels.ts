export type ProfessionLevelThreshold = {
  level: number;
  experienceRequired: number;
};

/**
 * Exact shared cumulative EXP table supplied for Milestone 13.
 * Future Profession actions or sources may award EXP against this shared
 * curve; no player-progress or planner system exists yet.
 */
export const PROFESSION_LEVEL_THRESHOLDS = [
  { level: 1, experienceRequired: 0 },
  { level: 2, experienceRequired: 83 },
  { level: 3, experienceRequired: 174 },
  { level: 4, experienceRequired: 276 },
  { level: 5, experienceRequired: 388 },
  { level: 6, experienceRequired: 512 },
  { level: 7, experienceRequired: 650 },
  { level: 8, experienceRequired: 801 },
  { level: 9, experienceRequired: 969 },
  { level: 10, experienceRequired: 1154 },
  { level: 11, experienceRequired: 1358 },
  { level: 12, experienceRequired: 1584 },
  { level: 13, experienceRequired: 1833 },
  { level: 14, experienceRequired: 2107 },
  { level: 15, experienceRequired: 2411 },
  { level: 16, experienceRequired: 2746 },
  { level: 17, experienceRequired: 3115 },
  { level: 18, experienceRequired: 3523 },
  { level: 19, experienceRequired: 3973 },
  { level: 20, experienceRequired: 4470 },
  { level: 21, experienceRequired: 5018 },
  { level: 22, experienceRequired: 5624 },
  { level: 23, experienceRequired: 6291 },
  { level: 24, experienceRequired: 7028 },
  { level: 25, experienceRequired: 7842 },
  { level: 26, experienceRequired: 8740 },
  { level: 27, experienceRequired: 9730 },
  { level: 28, experienceRequired: 10824 },
  { level: 29, experienceRequired: 12031 },
  { level: 30, experienceRequired: 13363 },
  { level: 31, experienceRequired: 14833 },
  { level: 32, experienceRequired: 16456 },
  { level: 33, experienceRequired: 18247 },
  { level: 34, experienceRequired: 20224 },
  { level: 35, experienceRequired: 22406 },
  { level: 36, experienceRequired: 24815 },
  { level: 37, experienceRequired: 27473 },
  { level: 38, experienceRequired: 30408 },
  { level: 39, experienceRequired: 33648 },
  { level: 40, experienceRequired: 37224 },
  { level: 41, experienceRequired: 41171 },
  { level: 42, experienceRequired: 45529 },
  { level: 43, experienceRequired: 50339 },
  { level: 44, experienceRequired: 55649 },
  { level: 45, experienceRequired: 61512 },
  { level: 46, experienceRequired: 67983 },
  { level: 47, experienceRequired: 75127 },
  { level: 48, experienceRequired: 83014 },
  { level: 49, experienceRequired: 91721 },
  { level: 50, experienceRequired: 101333 },
  { level: 51, experienceRequired: 111945 },
  { level: 52, experienceRequired: 123660 },
  { level: 53, experienceRequired: 136594 },
  { level: 54, experienceRequired: 150872 },
  { level: 55, experienceRequired: 166636 },
  { level: 56, experienceRequired: 184040 },
  { level: 57, experienceRequired: 203254 },
  { level: 58, experienceRequired: 224466 },
  { level: 59, experienceRequired: 247886 },
  { level: 60, experienceRequired: 273742 },
  { level: 61, experienceRequired: 302288 },
  { level: 62, experienceRequired: 333804 },
  { level: 63, experienceRequired: 368599 },
  { level: 64, experienceRequired: 407015 },
  { level: 65, experienceRequired: 449428 },
  { level: 66, experienceRequired: 496254 },
  { level: 67, experienceRequired: 547953 },
  { level: 68, experienceRequired: 605032 },
  { level: 69, experienceRequired: 668051 },
  { level: 70, experienceRequired: 737627 },
  { level: 71, experienceRequired: 814445 },
  { level: 72, experienceRequired: 899257 },
  { level: 73, experienceRequired: 992895 },
  { level: 74, experienceRequired: 1096278 },
  { level: 75, experienceRequired: 1210421 },
  { level: 76, experienceRequired: 1336443 },
  { level: 77, experienceRequired: 1475581 },
  { level: 78, experienceRequired: 1629200 },
  { level: 79, experienceRequired: 1798808 },
  { level: 80, experienceRequired: 1986068 },
  { level: 81, experienceRequired: 2192818 },
  { level: 82, experienceRequired: 2421087 },
  { level: 83, experienceRequired: 2673114 },
  { level: 84, experienceRequired: 2951373 },
  { level: 85, experienceRequired: 3258594 },
  { level: 86, experienceRequired: 3597792 },
  { level: 87, experienceRequired: 3972294 },
  { level: 88, experienceRequired: 4385776 },
  { level: 89, experienceRequired: 4842295 },
  { level: 90, experienceRequired: 5346332 },
  { level: 91, experienceRequired: 5902831 },
  { level: 92, experienceRequired: 6517253 },
  { level: 93, experienceRequired: 7195629 },
  { level: 94, experienceRequired: 7944614 },
  { level: 95, experienceRequired: 8771558 },
  { level: 96, experienceRequired: 9684577 },
  { level: 97, experienceRequired: 10692629 },
  { level: 98, experienceRequired: 11805606 },
  { level: 99, experienceRequired: 13034431 },
  { level: 100, experienceRequired: 14391160 },
] as const satisfies readonly ProfessionLevelThreshold[];

export type ProfessionLevelProgressionRow = ProfessionLevelThreshold & {
  experienceFromPrevious: number | null;
  experienceToNext: number | null;
};

export function withProfessionLevelDifferences(
  thresholds: readonly ProfessionLevelThreshold[]
): ProfessionLevelProgressionRow[] {
  return thresholds.map((threshold, index) => ({
    ...threshold,
    experienceFromPrevious:
      index === 0
        ? null
        : threshold.experienceRequired -
          thresholds[index - 1].experienceRequired,
    experienceToNext:
      index === thresholds.length - 1
        ? null
        : thresholds[index + 1].experienceRequired -
          threshold.experienceRequired,
  }));
}
