# Physik-Applets

Interaktive Applets zu Physik und Mathematik, laufen direkt im Browser.

Online: https://oisela.github.io/applets/

- `index.html`: Startseite, nach Fach geordnet
- `applets/<fach>/<name>.html`: ein Applet pro Datei
- `assets/style.css`: gemeinsames Design

Neues Applet: Datei in `applets/<fach>/` legen, Kachel in `index.html` im Abschnitt des Fachs ergänzen.

## Applet aus der Lernzentrale veröffentlichen

```
node tools/export.mjs <lernzentrale.html> <key> <fach>
```

Nimmt genau ein Applet samt Engine aus der Lernzentrale und schreibt `applets/<fach>/<key>.html`.
Kommentare und der Info-Reiter (Quellen) werden entfernt. Ein Filter bricht ab, wenn Wörter mit
Prüfungsbezug oder Namen aus `tools/sperrliste.local.txt` (nicht im Repo) vorkommen.
