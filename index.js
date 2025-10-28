require('dotenv').config();
const { scrapeContent } = require('./scraper');
const WebflowAPI = require('./webflow-api');

/**
 * Main function to scrape content and upload to Webflow
 */
async function main() {
  try {
    // Validate environment variables
    if (!process.env.WEBFLOW_API_TOKEN || !process.env.WEBFLOW_COLLECTION_ID || !process.env.SOURCE_URL) {
      throw new Error('Missing required environment variables. Please check your .env file.');
    }

    // Initialize Webflow API
    const webflow = new WebflowAPI(process.env.WEBFLOW_API_TOKEN, process.env.WEBFLOW_SITE_ID);

    // Scrape events from source URL
    console.log('Starting scraping process...');
    const scrapedData = await scrapeContent(process.env.SOURCE_URL);

    console.log(`Found ${scrapedData.events.length} events`);

    // Upload each event to Webflow
    const uploadedEvents = [];
    
    for (const event of scrapedData.events) {
      try {
        // Transform event data to Webflow format - Blog Header ist das name Field
        const webflowData = {
          name: event.title || event.eventName,                    // Blog Header = name Field
          slug: (event.title || event.eventName).toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')                         // Entferne Sonderzeichen
            .replace(/\s+/g, '-')                                 // Ersetze Leerzeichen mit -
            .replace(/-+/g, '-')                                  // Entferne mehrfache -
            .replace(/^-|-$/g, ''),                               // Entferne führende/trailing -
          'uhrzeit': event.time,                                  // Zeit
          'event-datum': event.fullDateTime || `${event.dayOfWeek}, ${event.date}, ${event.time} Uhr`, // Datum
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

        // Optional: Publish the item
        if (process.env.AUTO_PUBLISH === 'true') {
          await webflow.publishItem(process.env.WEBFLOW_COLLECTION_ID, result.id);
        }

        console.log(`✅ Uploaded: ${event.eventName}`);
        
        // Delay zwischen Uploads um Rate Limits zu vermeiden
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error uploading event ${event.eventName}:`, error.message);
      }
    }

    console.log(`\n✅ Successfully uploaded ${uploadedEvents.length} events to Webflow!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };

