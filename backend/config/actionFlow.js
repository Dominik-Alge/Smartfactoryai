// =========================================================================
// ABLAUF EINES TICKETS (PDCA mit vorgeschalteter Sofortmassnahme)
// -------------------------------------------------------------------------
//   0  Sofortmassnahme   – Schaden begrenzen, Maschine wieder sicher
//   P  Ursache           – 5× Warum bis zur wahren Ursache
//   D  Abstellmassnahme  – Tasks mit Verantwortlichem und Termin
//   C  Wirksamkeit       – Hat die Massnahme gewirkt? (ISO 9001, 10.2)
//   A  Standard          – Lessons Learned, Standard anpassen, abschliessen
//
// Ist eine Massnahme nicht wirksam, springt das Ticket zurück auf "Ursache".
// =========================================================================

export const PHASES = [
  { id: 'sofort', short: '0', label: 'Sofortmassnahme' },
  { id: 'ursache', short: 'P', label: 'Ursache' },
  { id: 'massnahme', short: 'D', label: 'Abstellmassnahme' },
  { id: 'wirksamkeit', short: 'C', label: 'Wirksamkeit' },
  { id: 'standard', short: 'A', label: 'Standard' }
];

export const CLOSED_STATUS = 'Geschlossen';

// Auswahl "Verantwortlich" bei Tasks
export const TASK_OWNERS = [
  'Instandhaltung',
  'Prozesstechnik / CAM',
  'Werkzeugbau',
  'Gruppenleiter',
  'Inselleiter',
  'Produktionsleitung',
  'AVOR / KVP',
  'Qualitätssicherung',
  'Logistik / Lager',
  'Einkauf / Material',
  'IT / Shopfloor-Support'
];
