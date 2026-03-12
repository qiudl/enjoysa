import type { Attraction } from '../types';
import { adelaideAttractions } from './adelaide';
import { adelaideHillsAttractions } from './adelaide-hills';
import { barossaAttractions } from './barossa';
import { fleurieuAttractions } from './fleurieu';
import { kangarooIslandAttractions } from './kangaroo-island';
import { murrayRiverAttractions } from './murray-river';
import { limestoneCoastAttractions } from './limestone-coast';

const allAttractions: Attraction[] = [
  ...adelaideAttractions,
  ...adelaideHillsAttractions,
  ...barossaAttractions,
  ...fleurieuAttractions,
  ...kangarooIslandAttractions,
  ...murrayRiverAttractions,
  ...limestoneCoastAttractions,
];

export function getAllAttractions(): Attraction[] {
  return allAttractions;
}

export function getAttractionsByRegion(regionId: string): Attraction[] {
  return allAttractions.filter((a) => a.regionId === regionId);
}

export function getAttractionById(id: string): Attraction | undefined {
  return allAttractions.find((a) => a.id === id);
}

export {
  adelaideAttractions,
  adelaideHillsAttractions,
  barossaAttractions,
  fleurieuAttractions,
  kangarooIslandAttractions,
  murrayRiverAttractions,
  limestoneCoastAttractions,
};
