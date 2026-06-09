import { BaseScraper } from "../base"
import type { BoatListing, ScraperResult, SearchQuery } from "@voilierscope/types"

const MOCK_LISTINGS: Partial<BoatListing>[] = [
  {
    id: "youboat-5001",
    source: "youboat",
    title: "Bénéteau Idylle 15.50 - Classique - Côte Bretonne",
    price: 28000,
    currency: "EUR",
    year: 1995,
    lengthM: 10.5,
    beam: 3.6,
    draft: 1.65,
    brand: "Bénéteau",
    model: "Idylle 15.50",
    hull: "monohull",
    location: "Saint-Malo, Ille-et-Vilaine",
    latitude: 48.65,
    longitude: -2.01,
    cabins: 3,
    berths: 6,
    engineBrand: "Volvo",
    engineHours: 2400,
    enginePower: 18,
    photos: [
      "https://images.unsplash.com/photo-1486218119243-13301e8e21b9?w=800",
    ],
    url: "https://www.youboat.fr/annonces/5001",
    description:
      "Bénéteau Idylle 15.50 en bon état général, entretenu régulièrement. Idéal pour la navigation côtière en Bretagne ou Normandie. Bateau familial confortable avec 3 cabines.",
    condition: "Bon état",
    equipment: {
      autopilot: false,
      windlass: false,
      vhf: true,
      depthSounder: true,
      windInstruments: true,
      sprayhood: true,
      furlingHeadsail: true,
    },
    relevanceScore: 58,
    cruisingScore: 55,
    blueWaterScore: 28,
  },
  {
    id: "youboat-5002",
    source: "youboat",
    title: "Sun Fizz 40 - Ketch habitable - Atlantique",
    price: 52000,
    currency: "EUR",
    year: 1988,
    lengthM: 12.0,
    beam: 3.95,
    draft: 1.65,
    brand: "Jeanneau",
    model: "Sun Fizz 40",
    hull: "monohull",
    location: "Brest, Finistère",
    latitude: 48.39,
    longitude: -4.49,
    cabins: 3,
    berths: 6,
    engineBrand: "Perkins",
    engineHours: 4800,
    enginePower: 30,
    photos: [
      "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=800",
    ],
    url: "https://www.youboat.fr/annonces/5002",
    description:
      "Sun Fizz 40 ketch de 1988, voilier de croisière hauturier par excellence. Plusieurs traversées atlantiques, bien armé. Chauffage diesel, dessalinisateur, panneaux solaires. Bateau à vivre.",
    condition: "Entretenu",
    equipment: {
      autopilot: true,
      windlass: true,
      radar: true,
      ais: true,
      solarPanels: true,
      waterMaker: true,
      generator: false,
      heating: true,
      dinghy: true,
      vhf: true,
      chartplotter: true,
      depthSounder: true,
      windInstruments: true,
      lifeRaft: true,
      epirb: true,
      sprayhood: true,
      furlingHeadsail: true,
    },
    relevanceScore: 80,
    cruisingScore: 78,
    blueWaterScore: 82,
  },
  {
    id: "youboat-5003",
    source: "youboat",
    title: "Dufour 40 Performance - 2012 - Voilier sportif",
    price: 118000,
    currency: "EUR",
    year: 2012,
    lengthM: 12.35,
    beam: 4.1,
    draft: 2.15,
    brand: "Dufour",
    model: "40 Performance",
    hull: "monohull",
    location: "La Grande-Motte, Hérault",
    latitude: 43.56,
    longitude: 4.07,
    cabins: 3,
    berths: 6,
    engineBrand: "Yanmar",
    engineHours: 820,
    enginePower: 40,
    photos: [
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800",
    ],
    url: "https://www.youboat.fr/annonces/5003",
    description:
      "Dufour 40 Performance de 2012 en excellent état. Voilier performant et confortable. Bien équipé avec pilote, chartplotter tactile, AIS. Idéal pour les régates et la croisière.",
    condition: "Excellent état",
    equipment: {
      autopilot: true,
      windlass: true,
      ais: true,
      solarPanels: false,
      waterMaker: false,
      heating: false,
      dinghy: false,
      vhf: true,
      chartplotter: true,
      depthSounder: true,
      windInstruments: true,
      lifeRaft: true,
      sprayhood: true,
      bimini: false,
      furlingHeadsail: true,
      furlingMainsail: false,
    },
    relevanceScore: 81,
    cruisingScore: 76,
    blueWaterScore: 65,
  },
]

export class YouboatScraper extends BaseScraper {
  readonly name = "youboat"
  readonly displayName = "Youboat"
  readonly baseUrl = "https://www.youboat.fr"

  async search(query: SearchQuery): Promise<ScraperResult> {
    const start = Date.now()
    await this.delay(500 + Math.random() * 700)

    const listings = MOCK_LISTINGS.filter((l) =>
      this.matchesQuery(l as BoatListing, query)
    ) as BoatListing[]

    return {
      source: this.name,
      listings,
      totalFound: listings.length,
      scrapedAt: new Date(),
      durationMs: Date.now() - start,
    }
  }
}
