import type { Food } from './engine';

// Richtwerte pro 100 g (bzw. 100 ml), gängige Durchschnittswerte.
// [id, Name, kcal, Protein, Kohlenhydrate, Fett, Portion-Label, Portion-g]
type Row = [string, string, number, number, number, number, string?, number?];

const ROWS: Row[] = [
  // Eiweiß
  ['hbrust', 'Hähnchenbrust (roh)', 110, 23, 0, 1.5, 'Filet', 150],
  ['hbrust-g', 'Hähnchenbrust (gegart)', 165, 31, 0, 3.6, 'Portion', 150],
  ['pute', 'Putenbrust (roh)', 105, 24, 0, 1, 'Schnitzel', 150],
  ['rindhack', 'Rinderhack mager (roh)', 137, 21, 0, 5.5],
  ['lachs', 'Lachs (roh)', 208, 20, 0, 13, 'Filet', 150],
  ['thunfisch', 'Thunfisch in Wasser (Dose)', 110, 25, 0, 1, 'Dose abgetropft', 130],
  ['ei', 'Ei (Größe M)', 143, 12.6, 0.7, 9.5, '1 Ei', 60],
  ['eiklar', 'Eiklar', 48, 11, 0.7, 0.2, '1 Eiklar', 33],
  ['whey', 'Whey-Protein (Pulver)', 400, 80, 8, 6, '1 Messlöffel', 30],
  ['magerquark', 'Magerquark', 67, 12, 4, 0.3, 'Becher', 250],
  ['skyr', 'Skyr natur', 63, 11, 4, 0.2, 'Becher', 150],
  ['gjoghurt', 'Griechischer Joghurt (10 %)', 120, 5, 4, 10, 'Becher', 150],
  ['njoghurt', 'Naturjoghurt (3,5 %)', 66, 3.5, 4.7, 3.8, 'Becher', 150],
  ['huettenkaese', 'Hüttenkäse', 98, 11, 3.4, 4.3, 'Becher', 200],
  ['tofu', 'Tofu natur', 120, 13, 1.9, 7],
  ['linsen', 'Linsen (gekocht)', 116, 9, 20, 0.4],
  ['kichererbsen', 'Kichererbsen (gekocht)', 164, 9, 27, 2.6],
  ['kochschinken', 'Kochschinken', 107, 19, 1, 3, 'Scheibe', 25],
  // Kohlenhydrate
  ['reis-r', 'Reis (roh)', 350, 7, 77, 0.6],
  ['reis-g', 'Reis (gekocht)', 130, 2.7, 28, 0.3],
  ['nudeln-r', 'Nudeln (roh)', 350, 12, 70, 1.5],
  ['nudeln-g', 'Nudeln (gekocht)', 158, 5.8, 31, 0.9],
  ['kartoffeln', 'Kartoffeln (gekocht)', 77, 2, 17, 0.1],
  ['suesskartoffel', 'Süßkartoffel', 86, 1.6, 20, 0.1],
  ['haferflocken', 'Haferflocken', 372, 13.5, 59, 7, 'Portion', 60],
  ['vollkornbrot', 'Vollkornbrot', 220, 8, 40, 2, 'Scheibe', 50],
  ['broetchen', 'Weizenbrötchen', 265, 9, 52, 1.2, '1 Brötchen', 60],
  ['toast', 'Toastbrot', 265, 8, 49, 3.5, 'Scheibe', 25],
  ['muesli', 'Müsli (ungesüßt)', 360, 10, 62, 6, 'Portion', 60],
  ['cornflakes', 'Cornflakes', 375, 7, 84, 0.9, 'Portion', 40],
  ['reiswaffel', 'Reiswaffel', 387, 8, 82, 3, '1 Stück', 9],
  ['couscous', 'Couscous (roh)', 360, 12, 73, 1.8],
  ['quinoa', 'Quinoa (roh)', 368, 14, 64, 6],
  ['honig', 'Honig', 304, 0.4, 82, 0, '1 TL', 10],
  // Obst
  ['banane', 'Banane', 89, 1.1, 23, 0.3, '1 Banane', 120],
  ['apfel', 'Apfel', 52, 0.3, 14, 0.2, '1 Apfel', 180],
  ['orange', 'Orange', 47, 0.9, 12, 0.1, '1 Orange', 150],
  ['beeren', 'Beerenmix', 45, 0.8, 10, 0.3, 'Portion', 100],
  ['blaubeeren', 'Blaubeeren', 57, 0.7, 14, 0.3, 'Portion', 100],
  ['erdbeeren', 'Erdbeeren', 32, 0.7, 7.7, 0.3, 'Portion', 150],
  ['trauben', 'Weintrauben', 69, 0.7, 18, 0.2, 'Portion', 100],
  ['ananas', 'Ananas', 50, 0.5, 13, 0.1],
  ['mango', 'Mango', 60, 0.8, 15, 0.4],
  ['datteln', 'Datteln (getrocknet)', 282, 2.5, 75, 0.4, '1 Dattel', 8],
  ['rosinen', 'Rosinen', 299, 3, 79, 0.5, 'Handvoll', 30],
  // Gemüse
  ['brokkoli', 'Brokkoli', 34, 2.8, 7, 0.4],
  ['karotten', 'Karotten', 41, 0.9, 10, 0.2, '1 Karotte', 70],
  ['tomaten', 'Tomaten', 18, 0.9, 3.9, 0.2, '1 Tomate', 100],
  ['gurke', 'Gurke', 15, 0.7, 3.6, 0.1],
  ['paprika', 'Paprika', 31, 1, 6, 0.3, '1 Paprika', 150],
  ['spinat', 'Spinat', 23, 2.9, 3.6, 0.4],
  ['zucchini', 'Zucchini', 17, 1.2, 3.1, 0.3],
  ['salat', 'Blattsalat', 15, 1.4, 2, 0.2, 'Portion', 80],
  ['zwiebel', 'Zwiebel', 40, 1.1, 9, 0.1, '1 Zwiebel', 80],
  ['champignons', 'Champignons', 22, 3.1, 3.3, 0.3],
  ['avocado', 'Avocado', 160, 2, 9, 15, '½ Avocado', 100],
  // Fette
  ['olivenoel', 'Olivenöl', 884, 0, 0, 100, '1 EL', 10],
  ['butter', 'Butter', 741, 0.7, 0.6, 82, '1 TL', 5],
  ['erdnussbutter', 'Erdnussbutter', 600, 25, 12, 50, '1 EL', 15],
  ['mandeln', 'Mandeln', 579, 21, 22, 50, 'Handvoll', 25],
  ['walnuesse', 'Walnüsse', 654, 15, 14, 65, 'Handvoll', 25],
  ['cashew', 'Cashewkerne', 553, 18, 30, 44, 'Handvoll', 25],
  ['nuesse', 'Nussmischung', 600, 18, 20, 50, 'Handvoll', 30],
  // Milch & Käse
  ['milch15', 'Milch 1,5 %', 47, 3.4, 4.9, 1.5, 'Glas', 200],
  ['milch35', 'Milch 3,5 %', 64, 3.3, 4.8, 3.5, 'Glas', 200],
  ['hafermilch', 'Hafermilch', 45, 0.5, 6.7, 1.5, 'Glas', 200],
  ['mozzarella', 'Mozzarella', 250, 18, 1, 20, 'Kugel', 125],
  ['gouda', 'Gouda', 356, 25, 0, 28, 'Scheibe', 25],
  ['parmesan', 'Parmesan', 392, 36, 0, 26, '1 EL', 10],
  ['feta', 'Feta', 264, 14, 4, 21],
  // Sonstiges
  ['dunkleschoko', 'Zartbitterschokolade (70 %)', 560, 8, 35, 40, 'Rippe', 10],
  ['milchschoko', 'Milchschokolade', 535, 7, 57, 30, 'Rippe', 10],
  ['proteinriegel', 'Proteinriegel', 367, 33, 35, 12, '1 Riegel', 60],
  ['gummibaerchen', 'Gummibärchen', 343, 6.9, 77, 0.2, 'Handvoll', 30],
  ['chips', 'Kartoffelchips', 536, 6, 53, 33, 'Portion', 30],
  ['pommes', 'Pommes frites', 312, 3.4, 41, 15, 'Portion', 150],
  ['pizza', 'Pizza Margherita', 250, 11, 33, 8, 'Pizza', 350],
  ['hummus', 'Hummus', 166, 8, 14, 9.6, '1 EL', 25],
  ['marmelade', 'Marmelade', 250, 0.4, 60, 0.1, '1 TL', 15],
  ['nutella', 'Nuss-Nougat-Creme', 539, 6.3, 57.5, 30.9, '1 TL', 15],
  ['ketchup', 'Ketchup', 100, 1.5, 25, 0.1, '1 EL', 15],
  ['cola', 'Cola', 42, 0, 10.6, 0, 'Glas', 250],
  ['oSaft', 'Orangensaft', 45, 0.7, 10, 0.2, 'Glas', 200],
  ['bier', 'Bier', 43, 0.5, 3.6, 0, 'Glas', 330],
  ['wein', 'Wein', 85, 0.1, 2.6, 0, 'Glas', 150],
  ['kaffee', 'Kaffee (schwarz)', 2, 0.1, 0, 0, 'Tasse', 200],
  ['iso', 'Sportgetränk (isotonisch)', 25, 0, 6, 0, 'Flasche', 500],
  ['gel', 'Energie-Gel', 225, 0, 55, 0, '1 Gel', 40],
];

export const BUILTIN_FOODS: Food[] = ROWS.map(([id, name, kcal, p, c, f, label, g]) => ({
  id: `b-${id}`,
  name,
  kcal,
  p,
  c,
  f,
  ...(label && g ? { serving: { label, g } } : {}),
}));

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss');

/** Alle Suchwörter müssen im Namen vorkommen; Treffer am Wortanfang zuerst. */
export function searchFoods(query: string, pool: Food[], limit = 30): Food[] {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const scored: { f: Food; score: number }[] = [];
  for (const f of pool) {
    const name = norm(`${f.name} ${f.brand ?? ''}`);
    if (!tokens.every((t) => name.includes(t))) continue;
    const starts = tokens.some((t) => name.startsWith(t) || name.includes(' ' + t));
    scored.push({ f, score: (starts ? 0 : 10) + name.length / 100 });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((x) => x.f);
}

export type Precision = 'weigh' | 'loose' | 'normal';

/** Wie genau muss man bei diesem Lebensmittel sein? Kalorienreiches wiegen, Gemüse schätzen. */
export function precisionOf(f: Pick<Food, 'kcal'>): Precision {
  return f.kcal >= 350 ? 'weigh' : f.kcal <= 60 ? 'loose' : 'normal';
}
