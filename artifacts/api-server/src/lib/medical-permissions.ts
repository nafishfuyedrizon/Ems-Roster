const RANK_ORDER = [
  "Director",
  "Deputy Director",
  "Assistant Director",
  "Captain",
  "Lieutenant",
  "Sergeant First Class",
  "Sergeant",
  "Senior Specialist",
  "Specialist",
  "Senior Paramedic",
  "Paramedic",
  "EMT",
  "EMS Student",
] as const;

export function getRankWeight(rank: string): number {
  const index = RANK_ORDER.indexOf(rank.trim() as (typeof RANK_ORDER)[number]);
  return index === -1 ? RANK_ORDER.length + 10 : index;
}

export function rankMeetsRequirement(rank: string, requiredRank: string | null | undefined): boolean {
  if (!requiredRank) return true;
  return getRankWeight(rank) <= getRankWeight(requiredRank);
}

export function explainRankRequirement(requiredRank: string | null | undefined): string | null {
  if (!requiredRank) return null;
  return `Requires ${requiredRank} or above`;
}
