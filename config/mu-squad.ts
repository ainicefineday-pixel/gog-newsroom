export type SquadPosition = "Goalkeeper" | "Defender" | "Midfielder" | "Forward";

export type SquadPlayer = {
  id: string;
  number: number;
  name: string;
  shortName: string;
  position: SquadPosition;
};

export const MU_SQUAD_SOURCE = "https://www.manutd.com/en/players-and-staff/first-team";
export const MU_SQUAD_VERIFIED_AT = "2026-08-09T00:00:00+07:00";

// Baseline squad numbers are transcribed from Manchester United's official
// men's first-team directory. The tactics UI keeps local editorial edits
// separate so a planned XI is never presented as a confirmed team sheet.
export const MU_FIRST_TEAM_SQUAD: readonly SquadPlayer[] = [
  { id: "altay-bayindir", number: 1, name: "Altay Bayindir", shortName: "Bayindir", position: "Goalkeeper" },
  { id: "karl-darlow", number: 12, name: "Karl Darlow", shortName: "Darlow", position: "Goalkeeper" },
  { id: "tom-heaton", number: 22, name: "Tom Heaton", shortName: "Heaton", position: "Goalkeeper" },
  { id: "senne-lammens", number: 31, name: "Senne Lammens", shortName: "Lammens", position: "Goalkeeper" },
  { id: "dermot-mee", number: 45, name: "Dermot Mee", shortName: "Mee", position: "Goalkeeper" },

  { id: "diogo-dalot", number: 2, name: "Diogo Dalot", shortName: "Dalot", position: "Defender" },
  { id: "noussair-mazraoui", number: 3, name: "Noussair Mazraoui", shortName: "Mazraoui", position: "Defender" },
  { id: "matthijs-de-ligt", number: 4, name: "Matthijs de Ligt", shortName: "De Ligt", position: "Defender" },
  { id: "harry-maguire", number: 5, name: "Harry Maguire", shortName: "Maguire", position: "Defender" },
  { id: "lisandro-martinez", number: 6, name: "Lisandro Martinez", shortName: "Martinez", position: "Defender" },
  { id: "patrick-dorgu", number: 13, name: "Patrick Dorgu", shortName: "Dorgu", position: "Defender" },
  { id: "leny-yoro", number: 15, name: "Leny Yoro", shortName: "Yoro", position: "Defender" },
  { id: "luke-shaw", number: 23, name: "Luke Shaw", shortName: "Shaw", position: "Defender" },
  { id: "ayden-heaven", number: 26, name: "Ayden Heaven", shortName: "Heaven", position: "Defender" },
  { id: "tyler-fredricson", number: 33, name: "Tyler Fredricson", shortName: "Fredricson", position: "Defender" },
  { id: "harry-amass", number: 41, name: "Harry Amass", shortName: "Amass", position: "Defender" },

  { id: "mason-mount", number: 7, name: "Mason Mount", shortName: "Mount", position: "Midfielder" },
  { id: "bruno-fernandes", number: 8, name: "Bruno Fernandes", shortName: "Bruno", position: "Midfielder" },
  { id: "andrey-santos", number: 17, name: "Andrey Santos", shortName: "Santos", position: "Midfielder" },
  { id: "youri-tielemans", number: 18, name: "Youri Tielemans", shortName: "Tielemans", position: "Midfielder" },
  { id: "manuel-ugarte", number: 25, name: "Manuel Ugarte", shortName: "Ugarte", position: "Midfielder" },
  { id: "kobbie-mainoo", number: 37, name: "Kobbie Mainoo", shortName: "Mainoo", position: "Midfielder" },
  { id: "jack-fletcher", number: 38, name: "Jack Fletcher", shortName: "J. Fletcher", position: "Midfielder" },
  { id: "tyler-fletcher", number: 39, name: "Tyler Fletcher", shortName: "T. Fletcher", position: "Midfielder" },
  { id: "toby-collyer", number: 43, name: "Toby Collyer", shortName: "Collyer", position: "Midfielder" },
  { id: "dan-gore", number: 44, name: "Dan Gore", shortName: "Gore", position: "Midfielder" },

  { id: "matheus-cunha", number: 10, name: "Matheus Cunha", shortName: "Cunha", position: "Forward" },
  { id: "joshua-zirkzee", number: 11, name: "Joshua Zirkzee", shortName: "Zirkzee", position: "Forward" },
  { id: "amad", number: 16, name: "Amad", shortName: "Amad", position: "Forward" },
  { id: "bryan-mbeumo", number: 19, name: "Bryan Mbeumo", shortName: "Mbeumo", position: "Forward" },
  { id: "benjamin-sesko", number: 30, name: "Benjamin Sesko", shortName: "Sesko", position: "Forward" },
  { id: "chido-obi", number: 32, name: "Chido Obi", shortName: "Obi", position: "Forward" },
  { id: "ethan-wheatley", number: 36, name: "Ethan Wheatley", shortName: "Wheatley", position: "Forward" },
  { id: "shea-lacey", number: 61, name: "Shea Lacey", shortName: "Lacey", position: "Forward" },
] as const;
