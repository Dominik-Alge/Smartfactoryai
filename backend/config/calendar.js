// =========================================================================
// ARBEITSKALENDER
// -------------------------------------------------------------------------
// Die Eskalationsuhr zählt nur Arbeitszeit. Was als Arbeitszeit gilt, steht
// hier. Jede Maschine bekommt einen der Kalender unten zugewiesen
// (Auswahl in der Action Engine unter "Kalender").
//
// Alle Zeiten sind Schweizer Ortszeit (Europe/Zurich).
// =========================================================================

export const TIME_ZONE = 'Europe/Zurich';

// Ein Arbeitstag = das Zeitfenster eines Kalenders. Pausen zählen mit.
export const SHIFT_CALENDARS = {
  einschicht: { label: 'Einschicht 07:00–17:00', start: '07:00', end: '17:00' },
  zweischicht: { label: 'Zweischicht 05:00–22:30', start: '05:00', end: '22:30' }
};

// Kalender für Maschinen, denen noch keiner zugewiesen ist
export const DEFAULT_CALENDAR = 'zweischicht';

// Arbeitstage: 1 = Montag … 5 = Freitag (6 = Samstag, 0 = Sonntag)
export const WORKDAYS = [1, 2, 3, 4, 5];

// Feiertage Kanton Thurgau (Ruhetagsgesetz). Bewegliche Feiertage werden aus
// dem Osterdatum berechnet. Bitte einmal mit dem Firmenkalender abgleichen.
export const FIXED_HOLIDAYS = [
  { date: '01-01', label: 'Neujahr' },
  { date: '01-02', label: 'Berchtoldstag' },
  { date: '05-01', label: 'Tag der Arbeit' },
  { date: '08-01', label: 'Bundesfeier' },
  { date: '12-25', label: 'Weihnachten' },
  { date: '12-26', label: 'Stephanstag' }
];

// Abstand in Tagen zum Ostersonntag
export const EASTER_HOLIDAYS = [
  { offset: -2, label: 'Karfreitag' },
  { offset: 1, label: 'Ostermontag' },
  { offset: 39, label: 'Auffahrt' },
  { offset: 50, label: 'Pfingstmontag' }
];

// Betriebsferien: In diesen Zeiträumen steht die Eskalationsuhr still.
// Format JJJJ-MM-TT, beide Tage eingeschlossen.
// BEISPIELWERTE – bitte durch die echten Betriebsferien ersetzen.
export const COMPANY_HOLIDAYS = [
  { from: '2026-12-24', to: '2027-01-03', label: 'Weihnachten / Neujahr (Beispiel)' },
  { from: '2027-07-19', to: '2027-07-30', label: 'Sommerferien (Beispiel)' }
];
