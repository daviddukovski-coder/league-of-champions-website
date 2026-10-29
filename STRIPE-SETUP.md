# Stripe einrichten – Schritt für Schritt

Ziel: Spieler zahlen die Anmeldegebühr online. Später wird jede Zahlung
automatisch aufgeteilt (z. B. 25 € an den Organisator, 5 € an Bolao).

**Wichtig:** Geheime Schlüssel (`sk_…`) niemals in den Chat oder auf die
Website kopieren – nur direkt in die Script-Properties des Apps Scripts.

---

## Teil A – Stripe-Konto für Bolao

### 1. Konto anlegen
https://dashboard.stripe.com/register
- Mit der Bolao-E-Mail registrieren, Land **Österreich**.

### 2. Konto aktivieren (Firmendaten)
https://dashboard.stripe.com/account/onboarding
- Unternehmensform, Firmenname, Adresse, UID-Nummer
- Vertretungsberechtigte Person (Ausweis)
- **IBAN** des Bolao-Kontos (dorthin werden eure Anteile ausgezahlt)
- Branche: Sport / Veranstaltungen

### 3. Einstellungen (je 1–2 Minuten)
- **Öffentliche Angaben & Abrechnungstext** (steht auf dem Kontoauszug, z. B. `BOLAO LOC`):
  https://dashboard.stripe.com/settings/public
- **Branding** (Logo, Farben für die Bezahlseite):
  https://dashboard.stripe.com/settings/branding
- **Zahlungsmethoden** (Karte, Apple Pay, Google Pay; optional EPS, Klarna):
  https://dashboard.stripe.com/settings/payment_methods
- **Belege per E-Mail an Kunden** einschalten:
  https://dashboard.stripe.com/settings/emails
- **Auszahlungen** (z. B. wöchentlich):
  https://dashboard.stripe.com/settings/payouts

## Teil B – Erst im Testmodus verbinden

### 4. Test-Schlüssel ins Apps Script
1. Test-Schlüssel holen: https://dashboard.stripe.com/test/apikeys →
   „Geheimer Schlüssel“ (beginnt mit `sk_test_`) → **Anzeigen** → kopieren.
2. Apps Script „Anmeldungen“ öffnen (Tabelle → Erweiterungen → Apps Script) →
   **Projekteinstellungen → Script-Properties**:
   - `STRIPE_SECRET_KEY` = der `sk_test_…`-Schlüssel
   - `SITE_BASE_URL` = `https://daviddukovski-coder.github.io/league-of-champions-website/`
     (nach der Domain-Umstellung: `https://www.footvolleyleagueofchampions.com/`)
   → speichern. (Neu bereitstellen ist dafür nicht nötig.)

### 5. Testzahlung
- Auf der Website bei einem Turnier anmelden → „Bezahlen“.
- Testkarte: `4242 4242 4242 4242`, beliebiges Ablaufdatum in der Zukunft,
  beliebige Prüfziffer (z. B. 123).
- Danach muss die Anmeldung als „Confirmed“ erscheinen und in der Tabelle auf
  „paid“ stehen. Testzahlungen kosten nichts.

## Teil C – Aufteilen mit Stripe Connect

### 6. Connect aktivieren
https://dashboard.stripe.com/connect/overview
- „Loslegen“ → Plattform-Typ: **Plattform / Marktplatz, die Zahlungen für
  andere entgegennimmt** → Kontotyp **Express**.
- Connect-Branding (Name, Logo, Farbe) für die Einladungen der Organisatoren:
  https://dashboard.stripe.com/settings/connect

### 7. Organisator einladen (pro Organisator einmal)
https://dashboard.stripe.com/connect/accounts/overview
- **+ Erstellen** → Express → Land des Organisators → Link kopieren und dem
  Organisator schicken.
- Der Organisator gibt dort seine Daten und **seine IBAN** ein (ca. 10 Minuten).
- Danach in der Kontoliste die **Konto-ID** kopieren (beginnt mit `acct_`).
  Die Konto-ID ist nicht geheim und kann an Claude geschickt werden.

### 8. Pro Turnier an Claude schicken
- Anmeldegebühr (z. B. 30 €)
- Konto-ID des Organisators (`acct_…`)
- Bolao-Anteil (z. B. 5 €)
- Wann der Organisator sein Geld bekommt: sofort oder erst nach dem Turnier

## Teil D – Live schalten

### 9. Echte Zahlungen
1. Live-Schlüssel: https://dashboard.stripe.com/apikeys → `sk_live_…` kopieren.
2. In den Script-Properties `STRIPE_SECRET_KEY` durch den Live-Schlüssel ersetzen.
3. Mit einer echten Karte einmal eine kleine Anmeldung zahlen und danach im
   Dashboard erstatten: https://dashboard.stripe.com/payments
4. Im Live-Modus müssen die Organisatoren **erneut** über einen Live-Link
   eingeladen werden (Test- und Live-Konten sind getrennt).

---

**Vorher mit dem Steuerberater klären:** Wer verkauft die Anmeldung
(Bolao oder der Organisator) und wer stellt welche Rechnung? Davon hängt ab,
wie die Rechnungen und die Umsatzsteuer (auch bei Turnieren im Ausland)
eingestellt werden.
