# Affen-Abenteuer mit Speichern im Google Sheet

Damit jedes Kind auf jedem iPad dort weiterspielt, wo es aufgehört hat, läuft die App über Google Apps Script.
Der Fortschritt landet in einem Google Sheet in deinem Google-Konto. Die Kinder brauchen kein Konto und kein Passwort: Sie tippen nur auf ihren Namen.

Einmalige Einrichtung, etwa 10 Minuten:

1. **Google Sheet anlegen.** Auf drive.google.com → Neu → Google Tabellen, zum Beispiel „Affen-Abenteuer 1A“ nennen.
2. **Apps Script öffnen.** Im Sheet: Erweiterungen → Apps Script.
3. **Code einfügen.** Den Inhalt von `Code.gs` (diese Datei liegt neben der Anleitung) komplett in die Datei `Code.gs` im Editor kopieren und das, was dort stand, ersetzen.
4. **App-Datei anlegen.** Links bei „Dateien“ auf **+** → **HTML** → Name genau `Index` (ohne .html). Den gesamten Inhalt von `schulapp/index.html` hineinkopieren und alles Vorhandene ersetzen. Speichern (Diskettensymbol).
5. **Veröffentlichen.** Oben rechts: Bereitstellen → Neue Bereitstellung → Zahnrad → **Web-App**.
   - Ausführen als: **Ich**
   - Zugriff: **Jeder** (damit die Kinder ohne Anmeldung spielen können)
   - Bereitstellen → Google fragt einmal nach Berechtigungen → erlauben (bei „Diese App wurde nicht überprüft“: Erweitert → Weiter zu …).
6. **Link kopieren.** Die angezeigte Web-App-URL (endet auf `/exec`) ist der neue Link für die Kinder. Daraus machen wir den QR-Code.
7. **Kinder eintragen.** Entweder im Sheet im Blatt **Kinder** in Spalte A (ab Zeile 2) die Namen schreiben, oder in der App unten auf „Lehrkraft: Kinder verwalten“ (7 · 8 = 56).

## Gut zu wissen

- **Namen:** Nimm nur Vornamen, bei Doppelungen mit Anfangsbuchstaben („Lena K.“). Wer den Link hat, kann die Namensliste sehen. Bitte kläre mit der Schule, ob Vornamen in einem Google Sheet erlaubt sind (Datenschutz). Alternativ gehen auch Fantasienamen („Tiger 3“).
- **Im Sheet** siehst du im Blatt **Fortschritt** pro Kind die Bananen, die geschafften Level und wann es zuletzt gespielt hat.
- **Ohne Internet** spielt die App weiter und speichert auf dem iPad. Beim nächsten Spielen mit Verbindung wird alles zusammengeführt. Es zählt immer der bessere Stand.
- **Updates der App:** neuen Inhalt von `index.html` in die Datei `Index` kopieren, dann Bereitstellen → Bereitstellungen verwalten → Stift → Version „Neue Version“ → Bereitstellen. Der Link bleibt gleich.
