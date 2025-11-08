import { RangeKey } from "@libs/contracts/crypto-data-worker";

export const RangeToButton: Record<RangeKey, string> = {
  h24: '#range-24h',
  d7: '#range-7d',
  d30: '#range-30d',
  d90: '#range-90d',
  d365: '#range-1y',
  max: '#range-max',
};

export const RangeToPriceChartsFile: Record<RangeKey, string> = {
  h24: '24_hours.json',
  d7: '7_days.json',
  d30: '30_days.json',
  d90: '90_days.json',
  d365: '365_days.json',
  max: 'max.json',
};

export const RangeToDaysParam: Record<RangeKey, string> = {
  h24: '1',
  d7: '7',
  d30: '30',
  d90: '90',
  d365: '365',
  max: 'max',
};