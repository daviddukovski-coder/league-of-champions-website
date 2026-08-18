# League of Champions – Turnier-Anmeldeplattform

Stand: 2026-08-18. Diese Datei ist der Einstiegspunkt für jede neue Chat-Session an diesem Projekt – sie fasst zusammen, was existiert, was fertig ist und was als Nächstes ansteht.

## Was das ist

Website für die Footvolley-Turnierserie "League of Champions" (footvolleyleagueofchampions.com): Landingpage, Turnierübersicht/-details, Spieler-Accounts, Team-Registrierung mit Stripe-Zahlung, sowie ein rudimentäres On-Page-CMS für Admins.

## Architektur

- **`index.html`** – die komplette Site: eine einzige Datei (~1700 Zeilen, statisches HTML + eingebettetes CSS + Vanilla-JS, keine Build-Pipeline, kein Framework). Bilder/Logos sind teils als Base64 inline eingebettet, damit sie auch ohne Server (z. B. in einer Artifact-Vorschau) rendern.
- **`apps-script/Code.gs`** – Backend als Google Apps Script Web App. Nutzt Google Sheets als Datenbank ("Registrations"-Tab: ID, Timestamp, TournamentId, Competition, Name, Email, Phone, Partner, Club, Status, StripeSessionId). Endpunkte: Registrierungen auflisten/anlegen/updaten, Stripe Checkout erstellen (`createCheckout_`) und bestätigen (`confirmPayment_`, verifiziert serverseitig gegen die Stripe API).
- **`assets/`** – Club-Logos (74 Vereine) + League-Badge.
- Kein `package.json`, kein Node-Toolchain – reines Static-HTML-Deployment.

## Konfiguration (`CONFIG`-Block in `index.html`, ~Zeile 433)

Aktuell läuft die Site **im Demo-Modus**, weil zwei Werte noch Platzhalter sind:
- `API_URL` = `'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE'` → solange das so ist, werden Registrierungen nur lokal im Browser gespeichert, nicht wirklich verarbeitet.
- `FIREBASE.apiKey` = `'PASTE_FIREBASE_API_KEY'` → solange das so ist, laufen Accounts nur lokal im Browser (kein echter Auth-Service).
- `ADMIN_EMAILS: ['daviddukovski@gmail.com']` ist bereits echt gesetzt.

**Offener Schritt vor Live-Gang:** Apps-Script-Deployment durchführen und die Web-App-URL eintragen, Firebase-Projekt (Email/Password Auth) anlegen und Keys eintragen, Stripe Secret Key als Apps-Script-Property (`STRIPE_SECRET_KEY`) hinterlegen.

## Feature-Stand (aus Git-Historie, neueste zuerst)

- Drag-to-Reorder für Blöcke auf der Turnier-Detailseite (Bild, Header, Info-Grid, Anmelde-Button, Teamliste) – Touch- und Maus-kompatibel, responsive. **Zuletzt committet, aber es gibt noch unstaged Änderungen an `index.html`** (39 Insertions/19 Deletions laut `git diff --stat`) – vermutlich Polishing/Bugfixing dieses Features.
- On-Page-Admin-Editor: Klick-zum-Tauschen für Fotos, Inline-Textbearbeitung für Turnierbild/-name/-daten/-gebühr/-frist und den Landing-Hero. Zugriff nur für `CONFIG.ADMIN_EMAILS` (via Firestore+Storage oder Demo-Fallback).
- Sämtliche UI-Texte editierbar im Edit Mode (Nav, Footer, Landing, Home, Turnier-Detail-Labels, Registrierungs-/Login-/Account-Formulare, Bestätigungen).
- Spieler-Accounts: Landingpage, Register/Login (Firebase Auth oder Demo-Fallback), Turnier-Registrierung ist Login-gated, Name/Email werden aus dem Account vorausgefüllt.
- Ranking-Feature wurde wieder entfernt (Nav-Link, View, Backend, Sheet-Tab, Docs).
- Echte Club-Liste + 74 Logos eingebunden (abgeglichen aus bereitgestelltem Foto-Ordner + "Liste der Teams.xlsx").
- Markenauftritt: Navy/Cyan-Palette, Bebas Neue + Poppins, echtes Impressum, echte Instagram-Handles, Seite auf Englisch übersetzt (Datenfelder: firstName/lastName/club/phone, Divisionen Men/Women).

## Zuletzt in Bearbeitung (laufende Session)

Die Chat-Session war zuletzt dabei, den Eyebrow-Fix zu verifizieren und anschließend Login-Zustand + Drag-Reorder auf der Landingpage im Browser zu testen (Formular-Interaktionen liefen gerade). Falls diese Session noch offen ist, dort weitermachen; sonst: unstaged `index.html`-Änderungen sichten (`git diff`), Drag-Reorder und Login-Flow durchtesten, dann committen.

## Nächste sinnvolle Schritte

1. Unstaged Änderungen in `index.html` prüfen und committen (oder verwerfen, falls experimentell).
2. Echte Apps-Script-Deployment-URL + Firebase-Keys eintragen, um aus dem Demo-Modus rauszukommen.
3. Stripe-Testkäufe end-to-end durchspielen (Checkout → `confirmPayment_` → Sheet-Status).
4. Mobile-Test von Drag-Reorder (Touch-Events) und Admin-Editor.
