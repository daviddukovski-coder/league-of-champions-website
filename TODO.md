# To-do-Liste – League of Champions

Offene Aufgaben rund um die League of Champions. Erledigte Punkte abhaken (`[x]`) statt löschen.

## Offen

- [ ] **Survey-Template für die Evaluation der League of Champions 2027 erstellen**

## Live-Gang der Website (übernommen aus `CLAUDE.md` → "Nächste sinnvolle Schritte")

- [ ] Apps-Script-Web-App-URL und Firebase-Keys im `CONFIG`-Block von `index.html` eintragen (Demo-Modus verlassen)
- [ ] Google Sheet, Tab "Registrations": Spalten `UserId` und `PartnerId` nach `StripeSessionId` von Hand ergänzen
- [ ] Firestore-Security-Rules für `content/{doc}`, `brackets/{tournamentId}` und `players/{uid}` setzen
- [ ] Stripe-Secret-Key als Apps-Script-Property `STRIPE_SECRET_KEY` hinterlegen und Testkäufe end-to-end durchspielen
- [ ] Mobile-Test auf echtem Gerät (Drag-Reorder, Ergebniseingabe, Spielplan)
- [ ] Live-Bracket + Spielplan mit einem echten Turnier durchspielen und Feedback einholen
- [ ] GitHub-Pages-Deployment abschließen
- [ ] Optional: echtes Ranking-Feature (Punkte pro Turnier-Platzierung)
