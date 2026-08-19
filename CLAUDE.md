# League of Champions – Turnier-Anmeldeplattform

Stand: 2026-08-19. Diese Datei ist der Einstiegspunkt für jede neue Chat-Session an diesem Projekt – sie fasst zusammen, was existiert, was fertig ist und was als Nächstes ansteht.

## Was das ist

Website für die Footvolley-Turnierserie "League of Champions" (footvolleyleagueofchampions.com): Landingpage, Turnierübersicht/-details, Spieler-Accounts, Team-Registrierung mit Stripe-Zahlung, ein On-Page-CMS für Admins, und ein Live-Ticker/Turnierbaum pro Turnier (Gruppen, Swiss-Stage, Crossover/K.-o.-Bracket).

## Architektur

- **`index.html`** – die komplette Site: eine einzige Datei (statisches HTML + eingebettetes CSS + Vanilla-JS, keine Build-Pipeline, kein Framework). Bilder/Logos sind teils als Base64 inline eingebettet, damit sie auch ohne Server (z. B. in einer Artifact-Vorschau) rendern.
- **`apps-script/Code.gs`** – Backend als Google Apps Script Web App. Nutzt Google Sheets als Datenbank ("Registrations"-Tab: ID, Timestamp, TournamentId, Competition, FirstName, LastName, Email, Phone, Partner, Club, Status, StripeSessionId). Endpunkte: Registrierungen auflisten (inkl. `id` für den Live-Bracket-Import)/anlegen/updaten, Stripe Checkout erstellen (`createCheckout_`) und bestätigen (`confirmPayment_`, verifiziert serverseitig gegen die Stripe API).
- **`assets/`** – Club-Logos (74 Vereine) + League-Badge.
- Kein `package.json`, kein Node-Toolchain – reines Static-HTML-Deployment.

## Konfiguration (`CONFIG`-Block in `index.html`)

Aktuell läuft die Site **im Demo-Modus**, weil zwei Werte noch Platzhalter sind:
- `API_URL` = `'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE'` → solange das so ist, werden Registrierungen nur lokal im Browser gespeichert, nicht wirklich verarbeitet.
- `FIREBASE.apiKey` = `'PASTE_FIREBASE_API_KEY'` → solange das so ist, laufen Accounts, der Content-Editor UND der Live-Bracket nur lokal im Browser (kein echter Service, kein Echtzeit-Update für Zuschauer).
- `ADMIN_EMAILS: ['daviddukovski@gmail.com']` ist bereits echt gesetzt.

**Offener Schritt vor Live-Gang:** Apps-Script-Deployment durchführen und die Web-App-URL eintragen, Firebase-Projekt (Email/Password Auth + Firestore + Storage) anlegen und Keys eintragen, Firestore-Security-Rules für `content/{doc}` UND `brackets/{tournamentId}` setzen (siehe Setup-Guide), Stripe Secret Key als Apps-Script-Property (`STRIPE_SECRET_KEY`) hinterlegen.

## Feature-Stand (aus Git-Historie, neueste zuerst)

- **Auto-Spielplan pro Turnier** (`event/:id/schedule`, lebt im selben Bracket-Doc wie der Live-Bracket, eigenes `schedule`-Feld: Plätze-Anzahl + Liste von Tagen mit Startzeit): Admin trägt Plätze + Tage ein, klickt pro Stage "Add to schedule" – ein Greedy-Scheduler verteilt alle noch nicht eingeplanten Spiele dieser Stage auf die Plätze (niemand doppelt gebucht, Bracket-Spiele warten automatisch, bis ihre Zubringer-Spiele eingeplant sind). Dauer pro Spiel = Summe der Satzpunkte in Minuten (≈1 Min./Punkt), nie gespeichert sondern live berechnet. Es wird nie eine Uhrzeit gespeichert, nur die Reihenfolge pro Platz – jede Zeit ergibt sich aus der Summe der Dauern davor, weshalb Drag&Drop (auch zwischen Plätzen) und manuelle Blöcke ("Fan's Challenge" etc.) automatisch alles danach neu berechnen. Re-Klick auf "Add to schedule" ist sicher (nur neue Spiele werden ergänzt).
- **Live-Bracket/Ticker pro Turnier** (`event/:id/live`, eigene Firestore-Collection `brackets/{tournamentId}` bzw. `localStorage['loc_bracket_...']` im Demo-Modus, Echtzeit via `onSnapshot`): Team-Roster (aus bezahlten Anmeldungen oder manuell), konfigurierbares Match-Format (Best-of/Satzpunkte, pro Spiel überschreibbar), **Gruppen**-Stage mit automatisch berechneter Tabelle, **Bracket**-Stage (vereint Crossover + K.-o. – jeder Slot in jeder Runde hat eine Quelle: Gruppen-/Swiss-Platzierung per Dropdown, manuelle Zuweisung, Freilos, oder automatisch Sieger der Vorrunde; Auflösung erfolgt dynamisch bei jedem Render, nicht gecacht), **Swiss**-Stage (Paarung nach Rekord-Buckets, entweder `seeded` per festem Seeding – Wiederholungsgegner möglich – oder `random` per explizitem "Auslosen"-Klick; Vorschau vor dem Speichern editierbar). Alles hinter `isAdmin`/`admin-edit-mode` abgesichert (Handler-Ebene, nicht nur CSS).
- Doppel-Anmeldung für dasselbe Turnier verhindert (`localStorage['loc_registered_' + tournamentId]`), "Paid"-Status heißt jetzt "Confirmed", Vereinslogo bei jedem registrierten Team sichtbar.
- Security-Fix: Admin-Edit-Aktionen (Text/Bild ändern) prüfen jetzt `isAdmin` direkt im Handler und in den Speicherfunktionen selbst, nicht mehr nur per CSS-Sichtbarkeit der Stift-Icons.
- Drag-to-Reorder für Blöcke auf Turnier-Detailseite UND Landingpage – Touch- und Maus-kompatibel, responsive.
- On-Page-Admin-Editor: Klick-zum-Tauschen für Fotos, Inline-Textbearbeitung für praktisch jeden Text der Seite (Nav, Footer, Landing, Home, Turnier-Detail-Labels, Registrierungs-/Login-/Account-Formulare, Bestätigungen). Zugriff nur für `CONFIG.ADMIN_EMAILS` (via Firestore+Storage oder Demo-Fallback).
- Spieler-Accounts: Landingpage, Register/Login (Firebase Auth oder Demo-Fallback), Turnier-Registrierung ist Login-gated, Name/Email werden aus dem Account vorausgefüllt.
- Ranking-Feature wurde wieder entfernt (Nav-Link, View, Backend, Sheet-Tab, Docs).
- Echte Club-Liste + 74 Logos eingebunden (abgeglichen aus bereitgestelltem Foto-Ordner + "Liste der Teams.xlsx").
- Markenauftritt: Navy/Cyan-Palette, Bebas Neue + Poppins, echtes Impressum, echte Instagram-Handles, Seite auf Englisch übersetzt.

## Zuletzt in Bearbeitung (laufende Session)

Auto-Spielplan-Feature (siehe oben) fertig gebaut und in 4 Schritten committet + im Browser verifiziert (Demo-Modus). Kein offener/unstaged Zustand – alles committet.

**Wiederkehrender Bug-Typ, den es zu vermeiden gilt:** Mehrfach in dieser und der vorherigen Session ist derselbe CSS-Fehler aufgetreten – eine Komponentenklasse deklariert selbst `display:...`, was (bei gleicher Spezifität, aber späterer Position im Stylesheet) die `admin-only`/`admin-only-flex`/`admin-only-inline`-Sichtbarkeitsklasse überstimmt und Admin-Bedienelemente für alle Besucher sichtbar/nutzbar macht. Regel: neue Komponentenklassen, die mit einer `admin-only*`-Markerklasse kombiniert werden, dürfen niemals selbst `display` setzen – das muss immer die Markerklasse übernehmen. Vor jedem Feature-Abschluss den `getComputedStyle(...).display` für alle neuen Admin-Elemente als nicht-eingeloggter Besucher explizit prüfen, nicht nur visuell.

## Nächste sinnvolle Schritte

1. Echte Apps-Script-Deployment-URL + Firebase-Keys eintragen, um aus dem Demo-Modus rauszukommen (Registrierungen, Accounts, Content-Editor, Live-Bracket UND Spielplan betroffen).
2. Firestore-Security-Rules für `content/{doc}` UND `brackets/{tournamentId}` setzen (Setup-Guide Punkt 5) – deckt auch den Spielplan ab, da er im selben Doc lebt.
3. Stripe-Testkäufe end-to-end durchspielen (Checkout → `confirmPayment_` → Sheet-Status).
4. Mobile-Test auf echtem Gerät (Touch-Events für Drag-Reorder, Live-Bracket-Ergebniseingabe UND Spielplan-Verschieben courtside).
5. Live-Bracket + Spielplan mit einem echten Turnier durchspielen (Setzliste → Gruppen → Bracket/Swiss → Finale, Spielplan generieren) und Feedback zur Bedienung courtside einholen.
