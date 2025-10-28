# Trauma Scraper 🕷️

Ein Web-Scraper der Inhalte von Webseiten extrahiert und automatisch in dein Webflow CMS hochlädt.

## Features

- ✅ Web-Scraping mit Cheerio
- ✅ Integration mit Webflow CMS API
- ✅ Vercel Deployment ready
- ✅ Express API Server
- ✅ Automatisches Upload zu Webflow

## Setup

### 1. Installiere Dependencies

```bash
npm install
```

### 2. Konfiguriere Environment Variables

Kopiere `.env.example` und erstelle eine `.env` Datei:

```bash
cp .env.example .env
```

Dann editiere die `.env` Datei und trage deine Webflow API-Daten ein:

```env
WEBFLOW_API_TOKEN=wf_dein_api_token
WEBFLOW_COLLECTION_ID=deine_collection_id
SOURCE_URL=https://example.com
```

### 3. Webflow API Token holen

1. Gehe zu [Webflow Developer Settings](https://webflow.com/dashboard/account/developer)
2. Erstelle einen neuen API Token
3. Kopiere den Token in deine `.env` Datei

### 4. Collection ID finden

1. Gehe zu deinem Webflow Projekt
2. Öffne deine CMS Collection
3. In der URL findest du die Collection ID: `https://webflow.com/design/your-site/collections?id=COLLECTION_ID`
4. Kopiere die ID in deine `.env` Datei

### 5. Collection Fields konfigurieren

In deiner Webflow CMS Collection musst du folgende Fields erstellen:
- `name` (Text oder Name Field) - Name des Events
- `date` (Text oder Date) - Das Datum im Format DD.MM.YY
- `day-of-week` (Text) - Wochentag (z.B. "Dienstag")
- `time` (Text) - Beginn-Zeit
- `location` (Text) - Der Ort mit Adresse
- `category` (Text) - Die Kategorie (z.B. "Party / Disco / Tanz")
- `event-link` (URL) - Link zur Detail-Seite
- `venue` (Text) - Name des Venues (z.B. "trauma im g-werk")
- `scraped-at` (Date oder Text) - Zeitpunkt des Scrapings

**Wichtig:** Diese Field-Namen findest du in `index.js` und `server.js` im `webflowData` Objekt!

## Nutzung

### Lokal testen

```bash
npm run dev
```

Das scrapt die URL aus deiner `.env` Datei und lädt sie in Webflow hoch.

### Mit API Server

```bash
npm start
```

Der Server läuft auf `http://localhost:3000`

#### API Endpoints

**Scrape und Upload:**
```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

**Auto-Publish:**
```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "autoPublish": true}'
```

**Get Webflow Items:**
```bash
curl http://localhost:3000/api/webflow/items
```

## Git & Vercel Deployment + Automatische Updates

### ⚡ WICHTIG: Automatische Aktualisierung

Nach dem Deployment läuft der Scraper **automatisch täglich um 9 Uhr** und aktualisiert deine Webflow-Events!

📖 **Mehr Details:** Siehe `AUTOMATIC_UPDATES.md`

### 1. Initialisiere Git Repository

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

### 2. Erstelle GitHub Repository

1. Gehe zu GitHub und erstelle ein neues Repository
2. Verbinde dein lokales Repository:

```bash
git remote add origin https://github.com/dein-username/trauma-scraper.git
git push -u origin main
```

### 3. Deploy auf Vercel

1. Gehe zu [Vercel](https://vercel.com)
2. Erstelle einen neuen Account oder logge dich ein
3. Klicke auf "New Project"
4. Verbinde dein GitHub Repository
5. **Wichtig:** Füge Environment Variables hinzu:
   - `WEBFLOW_API_TOKEN`: Dein Webflow API Token
   - `WEBFLOW_COLLECTION_ID`: Deine Collection ID

6. Deploy!

### 4. Nach dem Deploy

Vercel gibt dir eine URL wie: `https://dein-projekt.vercel.app`

Dann kannst du den Scraper so aufrufen:

```bash
curl -X POST https://dein-projekt.vercel.app/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## Customization

### Scraper anpassen

Die Scraper-Logik findest du in `scraper.js`. Du kannst die Selectoren anpassen um spezifische Inhalte zu extrahieren:

```javascript
const scrapedData = {
  title: $('h1').text(),
  content: $('.article-content').text(),
  // etc.
};
```

### Webflow Fields anpassen

In `index.js` und `server.js` findest du das Mapping zu Webflow:

```javascript
const webflowData = {
  name: scrapedData.title,
  'source-url': scrapedData.url,
  // Hier deine Custom Fields
};
```

## Troubleshooting

### "Missing environment variables" Error

Stelle sicher dass deine `.env` Datei alle benötigten Variablen enthält.

### Webflow API Errors

- Überprüfe deinen API Token
- Stelle sicher dass die Collection ID korrekt ist
- Überprüfe ob deine Webflow Fields existieren

### CORS Issues

Falls du den Scraper von einem Browser aus nutzt, könntest du CORS Issues haben. Füge dann in `server.js` hinzu:

```javascript
const cors = require('cors');
app.use(cors());
```

## Nützliche Links

- [Webflow API Documentation](https://developers.webflow.com/)
- [Vercel Documentation](https://vercel.com/docs)
- [Cheerio Documentation](https://cheerio.js.org/)

## Lizenz

MIT

