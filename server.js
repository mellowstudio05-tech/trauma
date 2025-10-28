require('dotenv').config();
const express = require('express');
const { scrapeContent } = require('./scraper');
const WebflowAPI = require('./webflow-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Support for cron jobs (no request body needed)
app.use('/api/scrape', express.json({ type: () => true }));

/**
 * Health check endpoint
 */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Trauma Scraper API is running',
    endpoints: {
      scrape: 'POST /api/scrape',
      health: 'GET /'
    }
  });
});

/**
 * API endpoint to trigger scraping and upload to Webflow
 * Supports both POST (with custom URL) and GET (with default URL from env)
 */
async function scrapeHandler(req, res) {
  try {
    // Validate environment variables
    if (!process.env.WEBFLOW_API_TOKEN || !process.env.WEBFLOW_COLLECTION_ID) {
      return res.status(500).json({
        error: 'Server configuration error. Missing Webflow credentials.'
      });
    }

    // Get URL from request body or use environment variable
    const { url } = req.body || {};
    const targetUrl = url || process.env.SOURCE_URL;

    if (!targetUrl) {
      return res.status(400).json({
        error: 'Missing URL parameter or SOURCE_URL in environment variables'
      });
    }

    // Initialize Webflow API
    const webflow = new WebflowAPI(process.env.WEBFLOW_API_TOKEN, process.env.WEBFLOW_SITE_ID);

    // Scrape events
    console.log(`Starting scraping process for: ${targetUrl}`);
    const scrapedData = await scrapeContent(targetUrl);

    console.log(`Found ${scrapedData.events.length} events`);

    // Upload each event to Webflow
    const uploadedEvents = [];
    
    for (const event of scrapedData.events) {
      try {
        // Datum für Webflow Date Field formatieren
        const formatDateForWebflow = (event) => {
          // Versuche das Datum aus der Detailseite zu parsen
          if (event.fullDateTime) {
            // Entferne Zeilenumbrüche und extrahiere Datum
            const cleanDate = event.fullDateTime.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            // Beispiel: "Dienstag, 28. Oktober 2025, 18:30 Uhr"
            
            // Konvertiere zu ISO Format für Webflow
            try {
              // Parse das deutsche Datum
              const dateStr = cleanDate.match(/(\d{1,2})\.\s*(\w+)\s*(\d{4})/);
              const timeStr = cleanDate.match(/(\d{1,2}):(\d{2})/);
              
              if (dateStr && timeStr) {
                const day = dateStr[1];
                const month = dateStr[2];
                const year = dateStr[3];
                const hour = timeStr[1];
                const minute = timeStr[2];
                
                // Monatsnamen zu Zahlen
                const monthMap = {
                  'Januar': '01', 'Februar': '02', 'März': '03', 'April': '04',
                  'Mai': '05', 'Juni': '06', 'Juli': '07', 'August': '08',
                  'September': '09', 'Oktober': '10', 'November': '11', 'Dezember': '12'
                };
                
                const monthNum = monthMap[month];
                if (monthNum) {
                  return `${year}-${monthNum}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:00.000Z`;
                }
              }
            } catch (e) {
              console.log('Could not parse date:', cleanDate);
            }
          }
          
          // Fallback: Verwende das einfache Datum aus der Tabelle
          if (event.date) {
            // Format: DD.MM.YY -> YYYY-MM-DD
            const parts = event.date.split('.');
            if (parts.length === 3) {
              const day = parts[0];
              const month = parts[1];
              const year = '20' + parts[2]; // 25 -> 2025
              return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`;
            }
          }
          
          return null;
        };

        // Transform event data to Webflow format - Blog Header ist das name Field
        const webflowData = {
          name: event.title || event.eventName,                    // Blog Header = name Field
          slug: (event.title || event.eventName).toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')                         // Entferne Sonderzeichen
            .replace(/\s+/g, '-')                                 // Ersetze Leerzeichen mit -
            .replace(/-+/g, '-')                                  // Entferne mehrfache -
            .replace(/^-|-$/g, ''),                               // Entferne führende/trailing -
          'uhrzeit': event.time,                                  // Zeit
          'event-datum': formatDateForWebflow(event),             // Korrekt formatiertes Datum
          'preis': event.price || 'Eintritt frei',                // Preis
          'eintritt-frei': (event.price || '').toLowerCase().includes('frei'), // Switch
          'blog-rich-text': event.description || `${event.eventName}\n\nDatum: ${event.date}\nZeit: ${event.time}\nOrt: ${event.location}\nKategorie: ${event.category}`, // Beschreibung
        };

        console.log(`Uploading: ${event.eventName}...`);
        const result = await webflow.createItem(
          process.env.WEBFLOW_COLLECTION_ID,
          webflowData
        );

        uploadedEvents.push({
          eventName: event.eventName,
          webflowId: result.id
        });

        // Optional: Publish
        if (req.body.autoPublish) {
          await webflow.publishItem(process.env.WEBFLOW_COLLECTION_ID, result.id);
        }
        
        // Delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error uploading event ${event.eventName}:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `Successfully scraped and uploaded ${uploadedEvents.length} events to Webflow`,
      data: {
        uploadedCount: uploadedEvents.length,
        uploadedEvents: uploadedEvents,
        totalEventsFound: scrapedData.events.length
      }
    });

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Support both GET (for cron) and POST requests
app.get('/api/scrape', scrapeHandler);
app.post('/api/scrape', scrapeHandler);

/**
 * API endpoint to get Webflow items
 */
app.get('/api/webflow/items', async (req, res) => {
  try {
    const webflow = new WebflowAPI(process.env.WEBFLOW_API_TOKEN);
    const items = await webflow.getItems(process.env.WEBFLOW_COLLECTION_ID);
    
    res.json({
      success: true,
      count: items.length,
      items: items
    });
  } catch (error) {
    console.error('Error fetching Webflow items:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}`);
  console.log(`🔧 API endpoint: http://localhost:${PORT}/api/scrape`);
});

