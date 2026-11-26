# Action Engine v2 – Kurzdokumentation

## Ablauf eines Tickets

Wird eine Zelle im Shopfloor Panel **ROT**, entsteht automatisch ein Ticket.
Es durchläuft fünf Phasen. Weiter geht es erst, wenn die Phase ausgefüllt ist.

| Phase | Inhalt | Bedingung für «weiter» |
|---|---|---|
| 0 Sofortmassnahme | Schaden begrenzen | Sofortmassnahme beschrieben |
| P Ursache | 5× Warum, wahre Ursache | Ursache festgehalten |
| D Abstellmassnahme | Tasks mit Verantwortlichem und Termin | mind. 1 Task, alle erledigt |
| C Wirksamkeit | Wirkt die Massnahme? | «Wirksam» bestätigt. «Nicht wirksam» führt zurück zu P |
| A Standard | Lessons Learned | Lessons Learned festgehalten → Ticket geschlossen |

## Eskalation

Die Uhr zählt **Arbeitszeit seit der Meldung**, nur im Zeitfenster der Maschine.
Wochenenden, Thurgauer Feiertage und Betriebsferien zählen nicht.

| Stufe | Vorgeschlagen ab |
|---|---|
| Mitarbeiter | sofort |
| Gruppenleiter | 2 h |
| Inselleiter | 6 h (2 h + ½ Schicht) |
| Produktionsleiter | 2 Arbeitstage |
| Geschäftsleitung | 5 Arbeitstage |

Das System **schlägt nur vor**. Eskalieren, nicht eskalieren und Stufe
zurücknehmen brauchen jeweils eine Begründung. Beim Eskalieren erhält die
neue Stufe eine Mail.

## Historie & Auswertung

Filter wie im Cockpit, die Filter bleiben im Browser gespeichert:
Zeitraum (Monat, 30/90 Tage, Jahr, 12 Monate, alles, frei), Gruppe, Maschine,
Kriterium, offen/geschlossen, mindestens erreichte Stufe, «mind. einmal nicht
wirksam» und Volltext über Vorfall, Ursache, 5× Warum, Massnahmen und
Lessons Learned.

Angezeigt werden Kennzahlen (Anzahl, Ø Dauer in Arbeitszeit, Eskalationsquote,
Wiederholer, nicht wirksame Massnahmen), Aufschlüsselung nach Maschine,
Kriterium, Ursache und Stufe (ein Klick setzt den Filter), der Verlauf je
Woche oder Monat, die Wiederholer (gleiche Maschine + Kriterium innerhalb
90 Tagen) und eine sortierbare Trefferliste. «CSV für Excel» exportiert die
gefilterte Liste.

## Was der Betrieb anpassen kann

| Datei | Inhalt |
|---|---|
| `backend/config/escalation.js` | Stufen und Zeitschwellen |
| `backend/config/calendar.js` | Schichtzeiten, Feiertage, Betriebsferien und Vorholzeit |
| `backend/config/actionFlow.js` | Phasen, Liste «Verantwortlich» |
| `backend/config/notifications.js` | Mail-Empfänger |
| Action Engine → «Kalender & Stufen» | Ein- oder Zweischicht je Maschine |

## Bestehende Daten

Beim ersten Start mit Version 2 legt der Server **automatisch eine Kopie**
der Datendatei an (`shopfloor_data/shopfloor_storage.backup-v1-<Zeit>.json`)
und ergänzt die alten Tickets um die neuen Felder. Vorhandene Inhalte werden
nicht verändert oder gelöscht. Alte Stufennamen werden umgeschrieben
(z. B. «Schichtleitung (Lvl 2)» → «Gruppenleiter (Lvl 2)»).

**Vor dem Update auf dem Firmenserver trotzdem den Ordner
`backend/shopfloor_data` von Hand sichern.**

## Postausgang

Jede Mail (Alarm bei ROT, Eskalation) erscheint unter «Postausgang» mit einer
Vorschau, wie sie beim Empfänger ankommt – auch wenn der Versand noch nicht
freigegeben ist. Der Postausgang hält die letzten 30 Mails im Arbeitsspeicher
und ist nach einem Neustart leer.

## Umgebungsvariablen

Siehe `backend/.env.example`. Wichtig für den Firmenserver: Ohne `SMTP_HOST`
werden **keine Mails** verschickt (in Version 1 war `mail.bruderer.com` fest
im Code hinterlegt).

## Tests

```
cd backend
npm test
```

Prüft Schichtkalender (Nacht, Wochenende, Feiertage, Sommerzeit),
Eskalationsvorschläge, Phasenregeln und die Umwandlung alter Tickets.

## Vorführung (Render)

Mit `DEMO_DATA=true` legt der Server beim Start Beispieltickets an, sofern noch
keine existieren. Auf Render gehen alle Daten bei jedem Neustart verloren.
