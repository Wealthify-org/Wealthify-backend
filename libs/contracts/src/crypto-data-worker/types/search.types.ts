import { SearchAssetDto } from "../dto/search-asset.dto";

export type SearchAssetsParams = {
  query: string;
  limit?: number;
}


export type SearchAssetsHttpResponse = {
  items: SearchAssetDto[];
};