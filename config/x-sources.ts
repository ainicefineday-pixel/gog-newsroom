export const X_SOURCE_HANDLES = [
  "jacobsben",
  "andymitten",
  "telegraphducker",
  "david_ornstein",
  "fabrizioromano",
  "theathleticfc",
  "sistoney67",
  "statszone",
  "statmandave",
  "gradient_sports",
  "lauriewhitwell",
  "lukeedwardstele",
  "jamespearcelfc",
  "howardnurse",
  "simonpeach",
] as const;

export type XSourceHandle = (typeof X_SOURCE_HANDLES)[number];
