// =========================================================================
// E-MAIL-EMPFÄNGER
// -------------------------------------------------------------------------
// 1. criterionContacts: wer eine Mail bekommt, wenn eine Zelle ROT wird.
//    "label" ist zugleich der zuständige Bereich, den Cockpit und Action
//    Engine als «verantwortlich» anzeigen. Ohne Eintrag gilt die Person der
//    aktuellen Eskalationsstufe. Leere E-Mail = Anzeige ja, aber keine Mail.
// 2. escalationContacts: wer eine Mail bekommt, wenn ein Ticket auf eine
//    Stufe eskaliert wird. Schlüssel = Stufe (Index aus config/escalation.js).
//    Adressen können per Umgebungsvariable überschrieben werden
//    (MAIL_LVL_2 … MAIL_LVL_5), damit keine Adressen im Code stehen müssen.
//    Leere Adresse = keine Mail für diese Stufe.
// =========================================================================

export const criterionContacts = {
  Maschine: { email: 'dominik.alge@bruderer.com', label: 'Technische Instandhaltung' },
  AVOR: { email: 'dominik.alge@bruderer.com', label: 'Arbeitsvorbereitung' },
  DISPO: { email: 'dominik.alge@bruderer.com', label: 'Materialdisposition' },
  NCP: { email: 'dominik.alge@bruderer.com', label: 'NC-Programmierung' },
  Qualität: { email: 'dominik.alge@bruderer.com', label: 'Qualitätssicherung' },
  Material: { email: 'dominik.alge@bruderer.com', label: 'Logistik & Lager' },
  Werkzeug: { email: 'dominik.alge@bruderer.com', label: 'Werkzeugbau' },
  Personal: { email: '', label: 'Gruppenleiter' } // nur Anzeige, keine Mail
};

export const escalationContacts = {
  1: { label: 'Gruppenleiter', email: process.env.MAIL_LVL_2 || 'dominik.alge@bruderer.com' },
  2: { label: 'Inselleiter', email: process.env.MAIL_LVL_3 || 'dominik.alge@bruderer.com' },
  3: { label: 'Produktionsleiter', email: process.env.MAIL_LVL_4 || 'dominik.alge@bruderer.com' },
  4: { label: 'Geschäftsleitung', email: process.env.MAIL_LVL_5 || 'dominik.alge@bruderer.com' }
};
