# Physik-Applets

Interaktive Applets zu Physik und Mathematik, laufen direkt im Browser.

Online: https://oisela.github.io/applets/

- `index.html`: Startseite, pro Vorlesung eine einklappbare Karte (liest `applets.json`)
- `applets.json`: Katalog, wird vom Export-Werkzeug gepflegt
- `applets/<fach>/<name>.html`: ein Applet pro Datei
- `assets/style.css`: gemeinsames Design


## Applet aus der Lernzentrale veröffentlichen

```
node tools/export.mjs <lernzentrale.html> <key> <fach> --fach-titel "Optik" --text "Ein Satz Beschreibung"
```

Nimmt genau ein Applet samt Engine aus der Lernzentrale und schreibt `applets/<fach>/<key>.html` und trägt es in `applets.json` ein.
Kommentare und der Info-Reiter (Quellen) werden entfernt. Ein Filter bricht ab, wenn Wörter mit
Prüfungsbezug oder Namen aus `tools/sperrliste.local.txt` (nicht im Repo) vorkommen.
