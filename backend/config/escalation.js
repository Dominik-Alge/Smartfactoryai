// =========================================================================
// ESKALATIONSSTUFEN
// -------------------------------------------------------------------------
// Einzige Stelle, an der die Stufen definiert sind. Cockpit und Action
// Engine holen sie über /api/action-config vom Server.
//
// "after" = ab wie viel Arbeitszeit seit der Meldung diese Stufe
// VORGESCHLAGEN wird. Eskaliert wird nie automatisch – ein Mensch
// bestätigt oder begründet, warum nicht.
//   hours    → Arbeitsstunden
//   workdays → Arbeitstage (1 Tag = Zeitfenster des Maschinen-Kalenders)
// =========================================================================

export const ESCALATION_LEVELS = [
  { name: 'Mitarbeiter (Lvl 1)', short: 'Mitarbeiter', after: { hours: 0 } },
  { name: 'Gruppenleiter (Lvl 2)', short: 'Gruppenleiter', after: { hours: 2 } },
  { name: 'Inselleiter (Lvl 3)', short: 'Inselleiter', after: { hours: 6 } }, // 2 h + ½ Schicht (4 h)
  { name: 'Produktionsleiter (Lvl 4)', short: 'Produktionsleiter', after: { workdays: 2 } },
  { name: 'Geschäftsleitung (Lvl 5)', short: 'Geschäftsleitung', after: { workdays: 5 } } // 1 Woche
];

// Alte Bezeichnungen aus Version 1 → neue Stufe (Index in ESCALATION_LEVELS).
// So bleiben bestehende Tickets lesbar.
export const LEGACY_LEVEL_NAMES = {
  'Shopfloor (Lvl 1)': 0,
  'Schichtleitung (Lvl 2)': 1,
  'Produktionsleitung (Lvl 3)': 3,
  'Werksleitung (Lvl 4)': 4
};
