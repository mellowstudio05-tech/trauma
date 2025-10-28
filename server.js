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
        // Transform event data to Webflow format - genau wie du es brauchst
        const webflowData = {
          'blog-header': event.title || event.eventName,           // Event-Titel aus Detailseite
          'slug': (event.title || event.eventName).toLowerCase().replace(/\s+/g, '-'), // URL-friendly slug
          'uhrzeit': event.time,                                   // Zeit (z.B. "18:30h")
          'event-datum': event.fullDateTime || `${event.dayOfWeek}, ${event.date}, ${event.time} Uhr`, // Vollständiges Datum
          'preis': event.price || 'Eintritt frei',                 // Preis aus Detailseite
          'eintritt-frei': (event.price || '').toLowerCase().includes('frei'), // Switch basierend auf Preis
          'blog-rich-text': event.description || `${event.eventName}\n\nDatum: ${event.date}\nZeit: ${event.time}\nOrt: ${event.location}\nKategorie: ${event.category}`, // Vollständige Beschreibung
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

