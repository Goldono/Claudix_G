# Projekt-Regeln für Claude Code

### UHAHAHAHAHA
UHAHAHAHAHA UHAHAHAHAHA UHAHAHAHAHA

## Sprache & Kommunikation
Antworte IMMER auf Deutsch. Technische Begriffe und Code-Bezeichner bleiben im Original.

**WICHTIG — Der User ist KEIN Programmierer.** Er steuert die Entwicklung über KI-Assistenten (wie dich). Das bedeutet:
- **JEDE Erklärung** (Fragen, Zwischenstände, Pläne, Problembeschreibungen, Abschlussberichte) muss so formuliert sein, dass ein Nicht-Programmierer sie sofort versteht.
- Verwende Alltagssprache und Vergleiche. Statt "wir müssen den State im Store initialisieren" → "wir müssen dafür sorgen, dass die App sich den aktuellen Stand merkt".
- Wenn du technische Begriffe verwenden MUSST (z.B. in Plänen), erkläre sie kurz in Klammern: "Store (= das Gedächtnis der App)".
- Frage dich bei JEDER Nachricht: "Würde jemand ohne Programmierkenntnisse verstehen, was ich gerade sage?" Wenn nein → umformulieren.

---

### REVERT-TEST R4-1: Oben (nach Sprache & Kommunikation)
Erster Test-Absatz aus Runde 4. Steht ganz oben in der Datei, direkt nach dem Kommunikations-Abschnitt. Hiermit wird geprueft, ob die neue Rueckgaengig-Funktion (ohne Git, mit gespeichertem Dateiinhalt) korrekt funktioniert.

## GRUNDLEGENDES VERHALTEN BEI NEUEN AUFGABEN

### REGEL 1: Ganzheitliches Projektverständnis
Bei jedem neuen Chat oder einer völlig neuen Aufgabe: Nutze dein Kontextfenster, um das Projekt vollständig zu durchdringen. Erarbeite dir erst den Überblick über bestehende Patterns, bevor du lokal eingreifst, öffne erst jede gesendete Datei und hol dir alle zusammenhängenden Datei udn lies Sie vollständig, du hast ein 1 Mio Kontext Fenster und kannst große Projektstrukturen verstehen.

### REGEL 2: Kritische Vorab-Klärung (Iterativer Deep Dive!)
Egal wie die Aufgabe lautet (außer bei absoluten Minimal-Korrekturen): Anstatt voreilig Lösungen zu präsentieren, erwarte ich einen **tiefgehenden Q&A-Dialog**.
- Stelle Fragen in **verständlicher Alltagssprache** (REGEL 10). Frage nach dem WAS und WARUM, nicht nach technischen Interna. Statt "Soll ich einen neuen IPC-Handler oder den bestehenden erweitern?" → "Soll das Feature als eigener Ablauf funktionieren oder sich in den bestehenden Ablauf einfügen?"
- **Gehe zwingend in 4-5 Iterationen (Frage -> Antwort -> Folgefrage)**, bis wirklich absolut jedes Detail glasklar ist.
- Im Zweifel: Ein längerer Dialog im Vorfeld ist ausdrücklich GEWÜNSCHT. Nichts darf auf bloßen Annahmen basieren!

### TEST-ABSATZ 4: Vor dem ersten Test-Block
Dieser Absatz wurde als vierter Test eingefuegt und steht direkt VOR Test-Absatz 1. So kann man pruefen, ob zwei aufeinanderfolgende Einfuegungen korrekt zurueckgesetzt werden koennen — einzeln oder zusammen.

### TEST-ABSATZ 1: Zum Testen des Zurucksetzens
Dies ist der erste Test-Absatz, der zum Testen der Revert-Funktion eingefugt wurde. Er steht hier zwischen den Regeln, damit man gut pruefen kann, ob das Zurucksetzen einzelner Aenderungen funktioniert. Wenn dieser Absatz nach dem Revert verschwunden ist, hat alles geklappt.

### TEST-ABSATZ 1: Zum Testen des Zurucksetzens
Dies ist der erste Test-Absatz, der zum Testen der Revert-Funktion eingefugt wurde. Er steht hier zwischen den Regeln, damit man gut pruefen kann, ob das Zurucksetzen einzelner Aenderungen funktioniert. Wenn dieser Absatz nach dem Revert verschwunden ist, hat alles geklappt.

### REGEL 3: Aufgaben-Triage & Automatischer Plan-Modus
Bewerte jede Aufgabe vor Beginn:
- **Quick Fix:** (1-2 Dateien, z.B. Tippfehler, minimale UI-Anpassung). Nach kurzer Klärung direkt umsetzen.
- **Komplexe Aufgabe:** (3+ Dateien, neue Architektur, unklare Anforderungen). Rufe SOFORT und zwingend das **`EnterPlanMode`-Tool** auf, BEVOR du irgendetwas implementierst. Warte NICHT darauf, dass der User manuell in den Plan-Modus wechselt — du wechselst eigenständig. Danach folge dem **DEEP PLANNING WORKFLOW** (siehe unten).

### REVERT-TEST R5-1: Nach Regel 3 (oberes Drittel)
Erster Test-Absatz aus Runde 5. Steht direkt nach Regel 3, noch im oberen Bereich der Datei. Dieser Absatz sollte nach erfolgreichem Rueckgaengig-Machen wieder verschwunden sein.

---

## QUALITÄT & VERIFIKATION

### NEUER TEST-ABSATZ Z1: Anfang des Qualitaets-Bereichs
Erster von vier neuen Test-Absaetzen (Runde 3). Er sitzt direkt am Anfang des Qualitaets-Abschnitts, zwischen der Trennlinie und Regel 4. Damit wird getestet, ob Aenderungen am Anfang eines Abschnitts zuverlaessig zurueckgesetzt werden.

### REGEL 4: Pflicht-Verifikation vor Abschluss
**NIEMALS eine Aufgabe als erledigt melden ohne vorherige Punkt-für-Punkt-Verifikation.**
1. **VOR dem Abschluss:** Erstelle eine interne Checkliste aller konkreten Unterpunkte aus dem Plan.
2. **Prüfe JEDEN Unterpunkt einzeln** — nicht "sollte passen", sondern mit Grep/Read verifizieren, dass der Code TATSÄCHLICH vorhanden und korrekt ist.
3. **Wenn ein Unterpunkt fehlt:** Implementiere ihn, BEVOR du die Aufgabe als erledigt markierst.

### REGEL 5: Import ≠ Verwendung
Ein `import` einer Komponente bedeutet NICHT, dass sie auch gerendert wird.
Nach jedem Import IMMER prüfen:
- Wird die Komponente auch im JSX/Return verwendet?
- Wird sie conditional gerendert, wo sie hingehört?

### TEST-ABSATZ A: Erster neuer Testblock
Dieser Absatz wurde zwischen Regel 5 und Regel 6 eingefuegt. Er dient zum Testen der Zuruecksetz-Funktion. Wenn das Zuruecksetzen funktioniert, sollte dieser Text danach wieder verschwunden sein. Position: oberes Drittel der Datei.

### NEUER TEST-ABSATZ X1: Erster Revert-Test (obere Mitte)
Dieser Absatz wurde als erster von drei neuen Test-Absaetzen eingefuegt. Er befindet sich zwischen Regel 5 und Regel 6, also im oberen Mittelbereich der Datei. Wenn das Zuruecksetzen korrekt funktioniert, sollte dieser Text danach wieder verschwunden sein.

### REGEL 6: Farbschema ist bindend
Wenn ein Plan ein Farbschema definiert (z.B. "Lila für Wissens-Schritte", "Gelb für Kataloge"):
- Diese Farben MÜSSEN im Code umgesetzt werden.
- Nicht nur in neuen Panels, sondern auch in bestehenden Render-Funktionen.

### REGEL 7: Große Dateien = besondere Sorgfalt
Bei Dateien > 2000 Zeilen:
- Nicht versuchen, alles in einem Durchgang zu machen.
- Nach jeder Änderung: Kurze Verifikation, ob die Änderung auch greift.
- Besonders bei Conditional Rendering: Prüfen, ob ALLE Bedingungen korrekt sind.

### TEST-ABSATZ 5: Vor dem zweiten Test-Block
Fuenfter Test-Absatz, platziert direkt vor Test-Absatz 2. Hiermit laesst sich testen, ob das Zuruecksetzen auch funktioniert, wenn mehrere Einfuegungen dicht beieinander in der Mitte der Datei liegen.

### TEST-ABSATZ 2: Zweiter Test-Block fuer Revert
Hier ist der zweite Test-Absatz. Er befindet sich ungefaehr in der Mitte der Datei und dient ebenfalls zum Testen. Man kann damit pruefen, ob auch Aenderungen in der Mitte einer Datei korrekt zurueckgesetzt werden koennen. Dieser Text sollte nach einem erfolgreichen Revert nicht mehr sichtbar sein.

### TEST-ABSATZ 2: Zweiter Test-Block fuer Revert
Hier ist der zweite Test-Absatz. Er befindet sich ungefaehr in der Mitte der Datei und dient ebenfalls zum Testen. Man kann damit pruefen, ob auch Aenderungen in der Mitte einer Datei korrekt zurueckgesetzt werden koennen. Dieser Text sollte nach einem erfolgreichen Revert nicht mehr sichtbar sein.

### REGEL 8: Ehrliche Selbstprüfung & Finale 100%-Kontrolle
- **Kritischer Abschluss:** Bevor du eine Aufgabe endgültig abschließt, tritt einen Schritt zurück. Prüfe das große Ganze extrem kritisch. Sei brutal ehrlich zu dir selbst: Fehlt noch etwas? Gibt es unbedachte Seiteneffekte? **Schließe die Aufgabe erst ab, wenn du dir zu 100% sicher bist, dass alles absolut korrekt ist.** Lieber noch eine Extra-Runde prüfen, als einen Fehler zu übersehen.
- **Nicht raten:** "Sollte funktionieren" ist NICHT akzeptabel — nur "habe verifiziert, dass es funktioniert".
- **Maximal 2 Versuche:** Wenn ein Befehl zweimal denselben Fehler wirft, stoppen und nachdenken.
- **Kein blindes Einlesen:** Nicht massenhaft ganze Dateien laden. Gezielt suchen.
- **Im Zweifel fragen:** Wenn du feststeckst — User fragen statt raten. Bei Feedback wie "prüfe nochmal": Sofort jeden Punkt einzeln mit Grep verifizieren.

### NEUER TEST-ABSATZ X2: Zweiter Revert-Test (exakte Mitte)
Hier ist der zweite neue Test-Absatz. Er sitzt zwischen Regel 8 und Regel 9, also ziemlich genau in der Mitte der Datei. Damit laesst sich pruefen, ob auch Aenderungen im Kern der Datei zuverlaessig erkannt und rueckgaengig gemacht werden koennen.

### REGEL 9: Datei lesen VOR jeder Änderung — PFLICHT
**VOR jeder Datei-Änderung MUSS die Datei mit dem Read-Tool frisch eingelesen werden** — auch wenn sie im selben Chat bereits einmal gelesen wurde.
- **Niemals annehmen**, wie eine Datei gerade aussieht. Dateien können sich zwischen zwei Schritten geändert haben (durch Linter, Formatter, vorherige fehlgeschlagene Edits etc.).
- **Der genaue Text im Edit-Tool** (das `old_string`-Feld) muss 1:1 mit dem aktuellen Dateiinhalt übereinstimmen — kein Raten, kein "sollte so sein".
- **Bei einem fehlgeschlagenen Edit:** Datei sofort neu lesen, dann erst erneut versuchen. NIEMALS denselben String ein zweites Mal blind verwenden.
- **Kurzformel:** Lesen → Exakten Text kopieren → Ersetzen. Immer in dieser Reihenfolge.

### REVERT-TEST R5-2: Nach Regel 9 (Mitte)
Zweiter Test-Absatz aus Runde 5. Platziert nach der Datei-Lese-Regel, mitten in der Datei. Dient zum Testen, ob das Rueckgaengig-Machen in der Dateimitte zuverlaessig funktioniert.

### NEUER TEST-ABSATZ Z2: Zwischen Regel 9 und Regel 10
Zweiter neuer Test-Absatz (Runde 3). Platziert zwischen der Datei-Lese-Regel und der Kommunikations-Regel, also mitten im Herzen der Datei. Wenn dieser Absatz nach dem Zuruecksetzen weg ist, funktioniert der Revert in der Dateimitte korrekt.

### REGEL 10: Verständliche Kommunikation — IMMER, nicht nur am Ende
**Gilt für JEDE Nachricht an den User** — Fragen, Zwischenstände, Problembeschreibungen, Pläne UND Abschlussberichte.

**Grundprinzip:** Der User ist kein Programmierer. Er versteht, WAS die App tun soll, aber nicht WIE der Code intern funktioniert. Kommuniziere auf der Ebene von Funktionen und Verhalten, nicht auf der Ebene von Code-Details.

- **Abschlussbericht:** Kurzer, freundlicher Einleitungstext (1-2 Sätze) + Stichpunkte der erreichten Ziele.
- **Fragen im Q&A-Dialog:** Nicht "Soll der State im Store oder via Context gehalten werden?" → Stattdessen: "Soll sich die App den Fortschritt auch nach einem Neustart merken, oder reicht es wenn er nur während der Nutzung gespeichert wird?"
- **Probleme beschreiben:** Nicht "Der IPC-Handler wirft einen TypeError" → Stattdessen: "Die Verbindung zwischen Benutzeroberfläche und Hintergrund-Logik funktioniert gerade nicht richtig — ich schaue mir an, warum."
- **Verbot:** KEINE Dateinamen, KEINE Variablen, KEIN Entwickler-Jargon in der Kommunikation mit dem User (im Code und in Plänen natürlich schon).
- **Falsch:** "State im appStore für vorbereitungMessages und IPC-Listener hinzugefügt."
- **Richtig:** "Der Chatverlauf für die Vorbereitung wird nun zuverlässig gespeichert und kann live mitgelesen werden."

### TEST-ABSATZ B: Zweiter neuer Testblock
Hier ist der zweite eingefuegte Test-Absatz. Er sitzt zwischen Regel 10 und Regel 11, also ungefaehr in der Mitte der Datei. Auch dieser Text sollte nach einem erfolgreichen Zuruecksetzen nicht mehr sichtbar sein. Position: mittleres Drittel der Datei.

### REGEL 11: Tiefgreifende Plan-Prüfung (End-to-End-Verifikation)
Wenn der User bittet, einen Plan zu prüfen, gelten folgende **unverhandelbare** Regeln:
1. **NICHTS annehmen:** Gehe NIEMALS davon aus, dass etwas umgesetzt wurde. Der Plan-Status ("completed", Häkchen) ist KEIN Beweis. Nur der tatsächliche Code zählt.
2. **JEDE Datei selbst holen:** Du bekommst nur den Plan. Hole dir JEDE einzelne Datei, die im Plan erwähnt wird, mit dem Read-Tool. Keine Ausnahmen. Keine Abkürzungen.
3. **Vollständige End-to-End-Prüfung pro Checklisten-Punkt:**
   - Ist der Code tatsächlich vorhanden? (Read + Grep verifizieren)
   - Ist die Logik korrekt? (Nicht nur "steht da irgendwas Ähnliches", sondern: Funktioniert die Logik-Kette wirklich?)
   - Werden Imports auch tatsächlich verwendet? (REGEL 5)
   - Werden Abhängigkeiten korrekt verdrahtet? (Store ↔ Component ↔ Backend)
   - Gibt es fehlende Stellen? (z.B. Reset-Logik, Save/Load, Error-Handling)
4. **Logik-Ketten durchdenken:** Verfolge den Datenfluss End-to-End. Beispiel: Button-Klick → Handler → Store-Update → Backend-Call → Rückgabe → UI-Update. Jedes Glied der Kette einzeln prüfen.
5. **Fehlende Aspekte aktiv suchen:** Prüfe nicht nur was im Plan steht, sondern auch was FEHLEN KÖNNTE:
   - Werden neue State-Felder auch in Save/Load/Reset berücksichtigt?
   - Gibt es Backend-Gegenstücke (Handler, IPC-Listener) die angepasst werden müssten?
   - Kompiliert der Code? (TypeScript-Check wenn möglich)
6. **Ehrliches Ergebnis:** Bei jedem Punkt klar sagen: ✅ verifiziert ODER ❌ fehlt/fehlerhaft mit konkreter Begründung. NIEMALS pauschal alles als ✅ markieren.

### NEUER TEST-ABSATZ X3: Dritter Revert-Test (untere Mitte)
Der dritte und letzte neue Test-Absatz. Er wurde zwischen Regel 11 und Regel 12 platziert, also im unteren Mittelbereich. Mit drei Absaetzen an unterschiedlichen Positionen kann man gut testen, ob das Zuruecksetzen in allen Bereichen der Datei funktioniert.

### REGEL 12: Plan-Abschluss-Validierung
Wenn eine Plan-basierte Aufgabe abgeschlossen wird, MUSS vor dem Abschlussbericht folgendes geprüft werden:
1. **Datei-Vollständigkeit:** Sind ALLE im Plan aufgelisteten Dateien (geändert/neu/gelöscht) auch tatsächlich angefasst worden? Keine vergessene Datei?
2. **Checkliste 100%:** Ist JEDER einzelne Punkt in "Konkret zu tun" abgehakt? Fehlende Häkchen = Aufgabe NICHT erledigt.
3. **Plan-Datei aktualisieren:** Die `.plan.md`-Datei MUSS am Ende aktualisiert werden:
   - Alle `- [ ]` zu `- [x]` ändern (nur tatsächlich erledigte Punkte!)
   - `status: draft/in-progress` → `status: completed` (nur wenn wirklich alles erledigt)
   - Eventuelle Abweichungen oder zusätzliche Änderungen im Plan dokumentieren
4. **Gegenkontrolle:** Prüfe ob es Dateien gibt, die geändert wurden, aber NICHT im Plan stehen. Falls ja → Plan nachträglich ergänzen.

### TEST-ABSATZ 7: Zwischen Regel 12 und Regel 13
Siebter und letzter Test-Absatz. Er sitzt zwischen zwei Regeln weiter unten in der Datei. Damit hast du insgesamt sieben Testpunkte an verschiedenen Stellen verteilt — ideal, um das Zuruecksetzen in allen Bereichen der Datei zu pruefen.

### REGEL 13: Bestehende Muster wiederverwenden — Über den Tellerrand schauen
**NIEMALS das Rad neu erfinden.** Bevor du irgendetwas Neues baust, prüfe ZUERST:
1. **Gibt es im Projekt schon einen ähnlichen Ablauf?** Wenn ja → Verwende das gleiche Muster. Beispiel: Wenn es schon einen Upload-Dialog für Kataloge gibt, bau keinen komplett neuen, sondern erweitere den bestehenden oder kopiere sein Muster.
2. **Gibt es schon eine ähnliche Struktur?** (z.B. eine ähnliche Ansicht, einen ähnlichen Button, einen ähnlichen Verarbeitungs-Ablauf) → Orientiere dich daran. Gleiche Probleme = gleiche Lösung.
3. **Über den Tellerrand schauen:** Betrachte nicht nur die unmittelbare Aufgabe, sondern auch:
   - Was passiert VOR und NACH dem neuen Feature? Passt es in den Gesamtablauf?
   - Gibt es bestehende Funktionen, die man mitnutzen kann, statt alles von Grund auf zu bauen?
   - Könnte die Änderung bestehende Abläufe beeinflussen oder verbessern?
4. **Konsistenz geht vor Perfektion:** Ein Ablauf, der genauso funktioniert wie die bestehenden, ist BESSER als ein theoretisch "schönerer" Ablauf, der sich anders anfühlt. Der User soll die App als einheitliches Ganzes erleben.

**Kurzformel:** Erst schauen was es schon gibt → dann darauf aufbauen → nur wenn wirklich NICHTS passt, etwas Neues erfinden.

### REVERT-TEST R4-2: Mitte (nach Regel 13)
Zweiter Test-Absatz aus Runde 4. Sitzt in der Mitte der Datei, zwischen Regel 13 und dem Planungs-Abschnitt. Wenn dieser Text nach dem Rueckgaengig-Machen verschwunden ist, funktioniert die neue Methode auch in der Dateimitte.

---

### TEST-ABSATZ 6: Vor dem dritten Test-Block
Sechster Test-Absatz, eingefuegt direkt vor Test-Absatz 3. Damit wird geprueft, ob Aenderungen am unteren Ende der Datei zuverlaessig erkannt und zurueckgesetzt werden.

### TEST-ABSATZ 3: Dritter und letzter Test-Block
Der dritte Test-Absatz steht weiter unten in der Datei, kurz vor dem Abschnitt ueber den Planungs-Workflow. Damit kannst du testen, ob das Zurucksetzen auch bei Aenderungen funktioniert, die naeher am Ende der Datei liegen. Drei verschiedene Positionen geben einen guten Ueberblick, ob die Revert-Funktion zuverlaessig arbeitet.

### TEST-ABSATZ 3: Dritter und letzter Test-Block
Der dritte Test-Absatz steht weiter unten in der Datei, kurz vor dem Abschnitt ueber den Planungs-Workflow. Damit kannst du testen, ob das Zurucksetzen auch bei Aenderungen funktioniert, die naeher am Ende der Datei liegen. Drei verschiedene Positionen geben einen guten Ueberblick, ob die Revert-Funktion zuverlaessig arbeitet.

### TEST-ABSATZ C: Dritter neuer Testblock
Der dritte und letzte neue Test-Absatz. Er wurde direkt vor dem Planungs-Abschnitt eingefuegt, also im unteren Drittel der Datei. Damit hast du drei Testpunkte an gut verteilten Stellen, um das Zuruecksetzen gruendlich zu pruefen. Position: unteres Drittel der Datei.

### NEUER TEST-ABSATZ Z3: Vor dem Planungs-Workflow
Dritter neuer Test-Absatz (Runde 3). Er sitzt direkt vor dem Planungs-Workflow-Abschnitt, also am Uebergang zwischen Regeln und Workflow. Hier wird geprueft, ob Aenderungen an Abschnitts-Grenzen sauber rueckgaengig gemacht werden.

## DEEP PLANNING WORKFLOW

Für mittlere und große Aufgaben nutze den 2-Phasen-Workflow. **Plan und Ausführung sind IMMER getrennt.** Niemals während der Planung implementieren. Niemals während der Ausführung den Plan ändern (stattdessen stoppen und neu planen).

### Slash Commands als Trigger

| Befehl | Wann nutzen | Was passiert |
|--------|-------------|-------------|
| `/project:plan [Aufgabe]` | Neue komplexe Aufgabe | Erkundet, durchläuft den Q&A-Loop, erstellt `.plan.md` — **implementiert NICHTS** |
| `/project:execute-plan [Name]` | Nach Plan-Freigabe | Arbeitet Plan Punkt für Punkt ab mit strikter Verifikation |

### Phase 1: PLAN-MODUS (`/project:plan`)
1. **Stille Erkundung:** Das Projekt im Hintergrund verstehen (OHNE Kommentar an den User). Dabei IMMER schauen: Gibt es schon ähnliche Abläufe im Projekt? (REGEL 13)
2. **Iterativer Q&A-Loop (4-5 Durchläufe):** Gehe in den Dialog! Stelle Fragen **in Alltagssprache** (REGEL 10) — der User ist kein Programmierer! Reagiere auf die Antworten mit gezielten Folgefragen. **Schreibe den Plan erst, wenn nach 4-5 Iterationen 100%ige Klarheit herrscht.**
3. **Plan-Datei speichern — ZWEI Orte, ZWINGEND:**
   - **Projektordner** (für die Projekt-Historie): `<Projekt-Root>/.claude/plans/name.plan.md` (z.B. `f:\Firmenordner\Kalkulation\.claude\plans\name.plan.md`)
   - **ExitPlanMode-Pfad** (technisch erforderlich): Das `ExitPlanMode`-Tool erwartet die Plan-Datei an einem automatisch generierten Pfad (z.B. `C:\Users\kevin\.claude\plans\some-random-name.md`). Ablauf:
     1. Plan in den Projektordner schreiben.
     2. `ExitPlanMode` aufrufen.
     3. Falls der Fehler `No plan file found at X` kommt → Plan-Inhalt **sofort** an den Pfad `X` schreiben und `ExitPlanMode` **erneut** aufrufen. Dieser zweite Aufruf funktioniert dann.
   - Der Plan muss dem **2-Teile-Format** folgen (Teil 1 verständlich für den User, Teil 2 technisch für die KI).
4. **Iterativer Verfeinerungs-Zyklus (Speichern → Feedback → Bearbeiten → Speichern):**
   - Plan dem User präsentieren.
   - User gibt Feedback / Änderungswünsche.
   - Plan-Datei bearbeiten und **erneut abspeichern**.
   - Diesen Zyklus so oft wiederholen, bis der User explizit bestätigt (z.B. "passt", "ok", "freigegeben").
5. **STOPPEN:** Die Umsetzung darf **ERST** beginnen, wenn der User den Plan explizit freigibt. Ohne klare Freigabe wird NICHTS implementiert.

### Phase 2: AUSFÜHRUNGS-MODUS (`/project:execute-plan`)
**Voraussetzung:** Der Plan wurde als `.plan.md` im **Projektordner** unter `<Projekt-Root>/.claude/plans/` gespeichert UND vom User explizit freigegeben.
1. **Plan laden:** Die freigegebene `.plan.md` aus dem **Projektordner** `<Projekt-Root>/.claude/plans/` lesen (NICHT aus dem globalen User-Verzeichnis!).
2. **Abfragen:** Die "Konkret zu tun" Checkliste aus der Plan-Datei gilt als verbindliche Verifikations-Liste.
3. **Punkt für Punkt abarbeiten:** Jeden Punkt umsetzen + sofort verifizieren.
4. **Finale, kritische Gesamt-Verifikation:** Bevor du fertig meldest, hinterfrage deine eigene Arbeit. Ist wirklich jeder Aspekt umgesetzt? Funktioniert alles fehlerfrei zusammen? Erst bei 100%iger Gewissheit den Abschlussbericht (Regel 10) generieren.
5. **Plan-Abschluss-Validierung (REGEL 12):** Am Ende ZWINGEND durchführen:
   - Alle Dateien aus der Datei-Tabelle gegen tatsächliche Änderungen abgleichen.
   - Alle Checklisten-Punkte einzeln abhaken (nur verifizierte!).
   - Plan-Datei aktualisieren (Häkchen setzen, Status auf `completed`).
   - Prüfen ob zusätzliche Änderungen gemacht wurden, die nicht im Plan stehen → Plan ergänzen.

### Plan-Datei Format (`<Projekt-Root>/.claude/plans/name.plan.md`)

**WICHTIGE REGEL: Jeder Plan hat ZWEI Teile:**
1. **Übersicht** — Verständlich, ohne Fachbegriffe, erklärt WAS passiert und WARUM
2. **Checkliste** — Welche Dateien werden angefasst + Abhak-Liste damit nichts vergessen wird

Die Übersicht ist das Herzstück des Plans. Die Checkliste ist nur ein Sicherheitsnetz für die Umsetzung. Technische Architektur-Erklärungen gehören NICHT in den Plan — die KI hat vollen Zugriff auf das Projekt und kann sich alles selbst erschließen.

` ` `markdown
---
name: Plan-Titel
overview: Ein-Absatz-Beschreibung (so einfach wie möglich — als würde man es einem Freund erklären)
status: draft | in-progress | completed
created: DATUM
todos:
  - id: eindeutige-id
    content: 'Kurzbeschreibung in Alltagssprache'
    status: pending | done
---

# Plan-Titel

---
## TEIL 1: ÜBERSICHT (für dich — verständlich erklärt)
---

### Das Problem
[Was funktioniert gerade nicht gut? Was fehlt? Warum brauchen wir das?
→ In 2-3 Sätzen, mit Alltagsvergleichen wenn nötig]

### Die Lösung
[Was wird gebaut/geändert? Was wird danach anders/besser sein?
→ Beschreibe das ERGEBNIS, nicht den technischen Weg dahin.
→ Nutze Vergleiche: "Stell dir vor, bisher war alles in einem riesigen Notizbuch — jetzt bekommt jedes Thema ein eigenes Kapitel mit Inhaltsverzeichnis"]

### Was ändert sich für dich?
[Was wirst du nach der Umsetzung SEHEN oder ANDERS MACHEN?
→ z.B. "Es gibt einen neuen Schritt im Vorbereitungs-Ablauf"
→ z.B. "Der Ablauf bleibt gleich, aber die App wird im Hintergrund schneller"]

### Ablauf in einfachen Schritten
1. [Schritt 1 — in einem Satz, was passiert]
2. [Schritt 2 — ...]
3. [...]
(Wie eine Anleitung: "Zuerst passiert X, dann Y, am Ende Z")

### Risiken & Was schiefgehen könnte
[In Alltagssprache: "Könnte sein, dass..." / "Wir müssen aufpassen, dass..."]

### Offene Fragen an dich
[Falls Entscheidungen ausstehen — klar formuliert als Fragen]

---
## CHECKLISTE (Sicherheitsnetz — damit nichts vergessen wird)
---

### Betroffene Dateien
| Aktion | Datei | Was passiert dort? |
|--------|-------|-------------------|
| NEU | pfad/datei.ts | Kurzbeschreibung |
| ÄNDERN | pfad/datei.ts | Kurzbeschreibung |
| LÖSCHEN | pfad/datei.ts | Warum |

(Jede Datei die angefasst wird MUSS hier stehen. Am Ende wird gegengeprüft.)

### Konkret zu tun (Abhak-Liste)
- [ ] Punkt 1 (verständlich formuliert — was soll erreicht werden, nicht wie)
- [ ] Punkt 2
- [ ] ...
` ` `

---

## ARCHITEKTUR-KONTEXT

### REVERT-TEST R5-3: Vor dem Workflow-System (unteres Drittel)
Dritter und letzter Test-Absatz aus Runde 5. Sitzt am Anfang des Architektur-Abschnitts, also im unteren Bereich der Datei. Alle drei R5-Absaetze zusammen decken oben, mitte und unten ab.

### Workflow-System
- Workflows werden durch Generatoren erzeugt (`3_10_Hauptslave`, `3_11_Unterslave`).
- **NIEMALS** die generierten Rules direkt editieren — NUR die Generatoren/Validatoren ändern!
- User baut Workflow neu nach Generator-Änderung und testet.
- Desktop-KI (Gemini Flash) läuft teilweise stateless — muss aus Screenshot + Rule alles ableiten.

### Projekt-Struktur
- `app/src/main/` — Electron Main Process (Orchestrator, Provider, Handlers)
- `app/src/renderer/` — React Frontend (Components, Stores, Hooks)
- `driver/rules/` — KI-Regelwerk (Generatoren, Validatoren, Kataloge)
- `driver/rules/Erstellen/` — Builder-Pipeline (Phase A-E)

### Tech Stack
- Electron + React + TypeScript
- Zustand (State Management)
- Tailwind CSS + Shadcn/ui
- Icons: `lucide-react`
- KI-Provider: Gemini, Alibaba/Qwen

---

### NEUER TEST-ABSATZ Z4: Vor dem Styling-Abschnitt
Vierter und letzter neuer Test-Absatz (Runde 3). Er wurde ganz unten in der Datei eingefuegt, direkt vor dem Styling-Abschnitt. Damit sind die vier Absaetze gut ueber die gesamte Datei verteilt — vom oberen Qualitaets-Bereich bis zum unteren Styling-Bereich.

## STYLING & UI-KONVENTIONEN

### Goldene Regel: Shadcn-Defaults respektieren
**NIEMALS** Shadcn-Komponenten mit eigenen Tailwind-Abständen (padding, margin, gap) überschreiben.
- Shadcn-Komponenten bringen ihre eigenen Abstände mit — diese sind das Design-System.
- Erlaubt sind NUR strukturelle Klassen: `flex-1`, `overflow-y-auto`, `space-y-*`, `gap-*`, `grid`, `truncate` etc.
- Eigene `p-*`, `m-*`, `px-*`, `py-*` sind fast nie nötig — nur bei selbstgebauten Elementen (nicht bei Shadcn-Wrappern).

### Farb-System: Shadcn CSS-Variablen
Alle Farben MÜSSEN über Shadcn Design-Tokens referenziert werden — KEINE hardcodierten Hex/RGB-Werte für UI-Grundfarben.

**Hintergrund & Rahmen:**
- `bg-card` — Karten-Hintergrund
- `bg-muted` / `bg-muted/30` — Gedämpfter Hintergrund (Header, Hover)
- `bg-secondary` / `bg-secondary/50` — Sekundärer Hintergrund
- `bg-input` — Input-Felder
- `border-border` — Standard-Rahmenfarbe

**Text:**
- `text-foreground` — Primärtext
- `text-muted-foreground` — Sekundärtext, Labels, Beschreibungen
- `text-foreground font-medium` / `font-semibold` / `font-bold` — Hervorgehobener Text

**Semantische Akzentfarben** (für Status, Kategorien, Badges):
| Zweck | Farbe | Beispiel-Klassen |
|-------|-------|------------------|
| Erfolg / Positiv | `emerald-500` | `text-emerald-500`, `bg-emerald-500/10`, `border-emerald-500/30` |
| Fehler / Negativ | `red-500` | `text-red-500`, `bg-red-500/10`, `border-red-500/30` |
| Warnung / Aktiv | `amber-500` | `text-amber-500`, `bg-amber-500/10`, `border-amber-500/30` |
| Info / Standard | `blue-500` / `text-info` / `bg-info` | `text-blue-500`, `bg-blue-500/10` |
| Marke / Highlight | `violet` | `text-violet`, `bg-violet/10`, `ring-violet/30` |
| Sekundär-Kategorie | `orange-500` | `text-orange-500`, `bg-orange-500/10` |
| Durchgestrichen/Alt | `text-destructive` | `text-destructive line-through` |
| Neu/Hinzugefügt | `text-success` | `text-success` |

**Muster für Severity-Farben (3 Stufen):**
```
Hoch/Kritisch: bg-red-500/10, border-red-500/30, text-red-500
Mittel/Warnung: bg-amber-500/10, border-amber-500/30, text-amber-500
Niedrig/Info:   bg-blue-500/10, border-blue-500/30, text-blue-500
```

### Container & Karten
Standard-Container für jede eigenständige Komponente:
```
className="rounded-xl border border-border bg-card p-4"
```
- Einfachere/innere Container: `rounded-lg` statt `rounded-xl`
- Interne Unterkarten: `rounded-lg border border-border bg-muted/30 p-3`
- Leer-Zustand: `flex items-center justify-center rounded-lg border border-border bg-card p-8 text-muted-foreground`

### Text-Hierarchie
| Ebene | Klasse | Verwendung |
|-------|--------|------------|
| Seitentitel | `text-xl font-bold text-foreground` | Hauptüberschrift einer Ansicht |
| Abschnittstitel | `text-lg font-semibold text-foreground` | Section-Header im Dashboard-Grid |
| Kartentitel | `text-sm font-semibold text-foreground mb-3` | Titel innerhalb einer Karte |
| Body-Text | `text-xs text-foreground` | Standard-Inhalt |
| Labels/Meta | `text-xs text-muted-foreground` | Beschreibungen, Zeitstempel, Zähler |
| Mini-Labels | `text-[10px]` oder `text-[11px]` | Badges, Baum-Einträge, kompakte Listen |
| KPI-Werte | `text-2xl font-bold text-foreground` | Große Kennzahlen |

### Icons (lucide-react)
- Größen: `w-3 h-3` (kompakt), `w-3.5 h-3.5` (Standard), `w-4 h-4` (Karten-Header), `w-12 h-12` (Leer-Zustand)
- Farbe: Passend zum Kontext — `text-info`, `text-amber-500`, `text-muted-foreground` etc.
- In Titeln: `<Icon className="w-4 h-4 text-info" />` + `gap-2` zum Text
- In Listen: `<Icon className="w-3 h-3 text-amber-500 flex-shrink-0" />`

### Layout-Muster

**Dashboard-Grid (Hauptansicht):**
```tsx
<div className="flex flex-col gap-6">
  <h2 className="text-xl font-bold text-foreground">Titel</h2>
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
    {/* Kleine Karten: md:col-span-1 */}
    {/* Breite Karten: col-span-full */}
  </div>
</div>
```

**Karten-Abschnitt (Section):**
```tsx
<section className="flex flex-col gap-3">
  <h3 className="text-lg font-semibold text-foreground">{title}</h3>
  <KomponenteHier />
</section>
```

**Vertikale Listen:**
- `space-y-1` (kompakt), `space-y-2` (Standard), `space-y-4` (großzügig)

**Horizontale Elemente:**
- `flex items-center gap-2` (Standard), `gap-1` (kompakt), `gap-3` (großzügig)

**Responsive Grids:**
- Karten: `grid grid-cols-2 lg:grid-cols-4 gap-3`
- Insight-Cards: `grid grid-cols-1 md:grid-cols-2 gap-3`

### Interaktions-Muster

**Hover-Effekte:**
- Hintergrund: `hover:bg-muted/50 transition-colors`
- Opazität: `opacity-0 group-hover:opacity-100 transition-all` (für Edit/Delete-Buttons)
- Aktiver Zustand: `bg-violet/15 ring-1 ring-violet/30`

**Aufklapp-Elemente (Expand/Collapse):**
```tsx
<button className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left">
  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
  <span className="text-xs font-medium text-foreground flex-1">{label}</span>
</button>
```

**Badges/Tags:**
```tsx
<span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Label</span>
```

**Filter/Input:**
```tsx
<input className="text-xs px-2 py-1 rounded-lg border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-40" />
```

### Tabellen
```tsx
{/* Äußerer Container */}
<div className="overflow-x-auto rounded-lg border border-border">
  <table className="text-xs border-collapse w-full">
    <thead>
      <tr>
        <th className="px-3 py-2 text-left font-medium bg-muted border-b border-border text-foreground">
          Spalte
        </th>
      </tr>
    </thead>
    <tbody>
      <tr className="hover:bg-muted/20 transition-colors">
        <td className="px-3 py-1.5 border-b border-border text-muted-foreground">
          Wert
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### REVERT-TEST R4-3: Unten (vor Baum-Ansichten)
Dritter und letzter Test-Absatz aus Runde 4. Steht weit unten in der Datei, kurz vor den Baum-Ansichten. Damit sind alle drei Positionen abgedeckt: oben, mitte, unten. Wenn alle drei nach dem Rueckgaengig-Machen weg sind, funktioniert alles einwandfrei.

### Baum-Ansichten (Tree)
```tsx
{/* Eingerückter Content mit vertikaler Linie */}
<div className="ml-5 pl-2 border-l border-border space-y-0.5 mt-0.5 mb-1">
  {/* Einzelner Eintrag */}
  <div className="group flex items-start gap-1.5 px-2 py-0.5 rounded hover:bg-violet/5 transition-colors">
    <Icon className="w-3 h-3 text-violet flex-shrink-0 mt-0.5" />
    <span className="flex-1 text-[11px] text-foreground">{text}</span>
  </div>
</div>
```

### Komponenten-Architektur (Dashboard-System)
Das Projekt nutzt ein **Tag-basiertes Dashboard-System**. Markdown wird geparst und in React-Komponenten umgewandelt.

**Verfügbare Component-Types:**
`donut_chart`, `bar_chart`, `kpi_cards`, `progress_bar`, `timeline`, `problem_cards`, `chat_threads`, `data_table`, `insight_cards`, `gauge`, `heatmap`, `diff_view`, `repair_cards`

**Komponenten-Mapping:** Definiert in `DashboardView.tsx` → `COMPONENT_MAP`

**Standard-Props neuer Dashboard-Komponenten:**
```tsx
// Entweder section-basiert (ältere Komponenten):
interface XxxProps {
  section: DashboardSection;
}

// Oder data/columns-basiert (neuere Komponenten):
interface XxxProps {
  data: Record<string, unknown>[];
  columns: string[];
}
```

**Spalten-Erkennung** (intelligentes Matching):
```tsx
const labelKey = section.columns.find(c =>
  /kategorie|label|name|typ|type|gruppe/i.test(c),
) || section.columns[0];
```

### Checkliste für neue Views/Komponenten
Bevor du eine neue Ansicht oder Komponente erstellst, prüfe:
- [ ] Shadcn-Tokens statt hardcodierter Farben?
- [ ] Kein Überschreiben von Shadcn-Default-Spacing?
- [ ] Container: `rounded-xl border border-border bg-card p-4`?
- [ ] Text-Hierarchie eingehalten? (`text-sm` Titel, `text-xs` Body)
- [ ] Icons aus `lucide-react` mit korrekter Größe?
- [ ] Hover-States vorhanden? (`hover:bg-muted/50 transition-colors`)
- [ ] Responsive Grid verwendet? (`grid-cols-1 md:grid-cols-2`)
- [ ] Leer-Zustand implementiert?