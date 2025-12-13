export type SearchAssetDto = {
  id: number;
  name: string;
  ticker: string;
  logoUrlLocal: string | null;
  rank: number | null;
  currentPriceUsd: number | null;
  change24HUsdPct: number | null;
  categories: string | null;
  contractAddress: string | null;
};