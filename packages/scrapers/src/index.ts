export { BaseScraper } from "./base"
export { LeboncoinScraper } from "./mock/leboncoin"
export { BandOfBoatsScraper } from "./mock/bandofboats"
export { YachtWorldScraper } from "./mock/yachtworld"
export { FacebookScraper } from "./mock/facebook"
export { YouboatScraper } from "./mock/youboat"

import { LeboncoinScraper } from "./mock/leboncoin"
import { BandOfBoatsScraper } from "./mock/bandofboats"
import { YachtWorldScraper } from "./mock/yachtworld"
import { FacebookScraper } from "./mock/facebook"
import { YouboatScraper } from "./mock/youboat"
import type { BaseScraper } from "./base"

export function getAllScrapers(): BaseScraper[] {
  return [
    new LeboncoinScraper(),
    new BandOfBoatsScraper(),
    new YachtWorldScraper(),
    new FacebookScraper(),
    new YouboatScraper(),
  ]
}
