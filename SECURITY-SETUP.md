# Sicherheit vor dem Launch – Schritt für Schritt

**Reihenfolge einhalten:** erst Website, dann Apps Scripts, dann Regeln.
Wird das neue Apps Script vor der neuen Website live geschaltet, schlagen
Turnier-Anmeldungen fehl.

Deine Werte (brauchst du unten):
- Firebase-Web-Key: `AIzaSyDKJ4a2LPDL6PmKrUFr9B8i_6sdIIDl65M`
- Deine Admin-ID: `YZL9Fl2AF9WUKflyKpF8VhRCGW03`

---

## Schritt 1 – Website veröffentlichen
Das macht Claude für dich (Commit, in `main` übernehmen, zu GitHub hochladen).
Danach prüfen, dass die Seite live ist:
- GitHub Pages: https://github.com/daviddukovski-coder/league-of-champions-website/settings/pages
  (oben steht „Your site is live at …“ – Link öffnen, Seite neu laden)

## Schritt 2 – Apps Script „Anmeldungen“ (Code.gs)
1. Öffne die Google-Tabelle mit den Anmeldungen (Tab „Registrations“) –
   oder alle Scripts hier: https://script.google.com/home
2. In der Tabelle: **Erweiterungen → Apps Script**.
3. Links die Datei **Code.gs** anklicken, **alles markieren (Cmd+A) und löschen**.
4. Den kompletten Inhalt von `apps-script/Code.gs` aus dem Projekt einfügen →
   **Speichern** (Diskettensymbol oder Cmd+S).
5. Links das **Zahnrad „Projekteinstellungen“** → ganz unten **„Script-Properties“ →
   „Script-Property hinzufügen“**:
   - Property `FIREBASE_API_KEY` – Wert `AIzaSyDKJ4a2LPDL6PmKrUFr9B8i_6sdIIDl65M`
   - Property `ADMIN_UIDS` – Wert `YZL9Fl2AF9WUKflyKpF8VhRCGW03`
   → **„Script-Properties speichern“**.
6. Oben rechts **Bereitstellen → Bereitstellungen verwalten**.
7. Die bestehende Web-App auswählen → **Stift-Symbol (Bearbeiten)** →
   bei „Version“ **„Neue Version“** → **Bereitstellen**.
   Die URL bleibt gleich – auf der Website muss nichts geändert werden.
8. Falls Google nach Berechtigungen fragt (neu: Firestore lesen für
   Push-Mitteilungen): **Zugriff erlauben** → dein Konto → „Erweitert“ →
   „Weiter zu … (unsicher)“ → **Zulassen**. (Das ist dein eigenes Script.)

## Schritt 3 – Apps Script „Ranking“ (RankingSync.gs)
1. Öffne die Ranking-Tabelle → **Erweiterungen → Apps Script**
   (oder über https://script.google.com/home).
2. Datei **RankingSync.gs** (bzw. Code.gs in diesem Projekt) komplett durch den
   Inhalt von `apps-script/RankingSync.gs` ersetzen → **Speichern**.
3. **Projekteinstellungen → Script-Properties**: dieselben zwei Properties wie in
   Schritt 2 (`FIREBASE_API_KEY`, `ADMIN_UIDS`) → speichern.
4. **Bereitstellen → Bereitstellungen verwalten → Bearbeiten → Neue Version →
   Bereitstellen.**

## Schritt 4 – Firestore-Regeln
1. Öffne: https://console.firebase.google.com/project/league-of-champions-website/firestore/rules
2. **Sicherung:** den aktuellen Text komplett markieren und in eine Notiz kopieren.
3. Alles löschen, den Inhalt von `firestore.rules` einfügen → **Veröffentlichen (Publish)**.
4. Testen: auf derselben Seite **„Rules Playground“** öffnen (rechts bzw. unten):

| Typ | Pfad | Authentifiziert | Provider-UID | Erwartet |
|---|---|---|---|---|
| get | `content/site` | aus | – | ✅ erlaubt |
| update | `content/site` | an | `test123` | ❌ verweigert |
| update | `content/site` | an | `YZL9Fl2AF9WUKflyKpF8VhRCGW03` | ✅ erlaubt |
| update | `brackets/faro-finals` | an | `test123` | ❌ verweigert |
| update | `players/test123` (Daten: `{"uid":"test123","name":"Test"}`) | an | `test123` | ✅ erlaubt |
| update | `players/test123` | an | `anders456` | ❌ verweigert |
| get | `players/test123/private/contact` | an | `anders456` | ❌ verweigert |

Falls etwas nicht stimmt: die Sicherung aus Punkt 2 wieder einfügen und Claude Bescheid geben.

## Schritt 5 – Storage-Regeln
1. Öffne: https://console.firebase.google.com/project/league-of-champions-website/storage
2. Oben den Reiter **„Regeln“ (Rules)**.
3. Aktuellen Text sichern, durch den Inhalt von `storage.rules` ersetzen → **Veröffentlichen**.

## Schritt 6 – Login-Einstellungen (Firebase Authentication)
1. Öffne: https://console.firebase.google.com/project/league-of-champions-website/authentication/settings
2. **„Autorisierte Domains“ (Authorized domains):** nur eure echte Domain,
   `localhost` und `league-of-champions-website.firebaseapp.com` behalten –
   alles andere entfernen.
3. **„Nutzeraktionen“ (User actions):** **„E-Mail-Enumerationsschutz“
   (Email enumeration protection)** aktivieren → speichern.

## Schritt 7 – Web-Key auf eure Domain beschränken
1. Öffne: https://console.cloud.google.com/apis/credentials?project=league-of-champions-website
2. Unter „API-Schlüssel“ den **Browser key** (beginnt mit `AIzaSyDKJ4…`) anklicken.
3. **Anwendungseinschränkungen → Websites** → hinzufügen:
   - `https://footvolleyleagueofchampions.com/*` (bzw. eure echte Domain)
   - `https://daviddukovski-coder.github.io/*`
   - `https://league-of-champions-website.firebaseapp.com/*`
   - `http://localhost:8765/*` (zum Testen)
4. **Speichern.** (Die Apps Scripts verwenden den Key serverseitig – falls die
   Anmeldung danach „login required“ meldet, bei „API-Einschränkungen“ prüfen,
   dass „Identity Toolkit API“ erlaubt ist.)

## Schritt 8 – App Check (empfohlen, kann auch nach dem Launch)
1. Öffne: https://console.firebase.google.com/project/league-of-champions-website/appcheck
2. Die Web-App mit **reCAPTCHA Enterprise** registrieren (Claude baut danach
   die eine Zeile Code auf der Website ein).
3. Zuerst nur beobachten, nach ein paar Tagen bei Firestore und Storage
   **„Erzwingen“ (Enforce)**.

## Schritt 9 – Testen
- **Ausgeloggt:** Startseite, Turniere, Ranking, Profile sichtbar.
- **Als normaler Spieler** (zweiter Account): Profil bearbeiten, für ein
  Turnier anmelden, Spielerbörse, jemandem schreiben – der Empfänger sollte
  eine Push-Mitteilung bekommen.
- **Als Admin:** Text im Edit-Modus ändern, Ergebnis eintragen, Anmeldung
  „als bezahlt markieren“, Ranking-Sync.
