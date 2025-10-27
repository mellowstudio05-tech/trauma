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
    const webflow = new WebflowAPI(process.env.WEBFLOW_API_TOKEN);

    // Scrape events from source URL
    console.log('Starting scraping process...');
    const scrapedData = await scrapeContent(process.env.SOURCE_URL);

    console.log(`Found ${scrapedData.events.length} events`);

    // Upload each event to Webflow
    const uploadedEvents = [];
    
    for (const event of scrapedData.events) {
      try {
        // Transform event data to Webflow format
        // ANPASSEN: Passe diese Mapping an deine Webflow Collection Fields an
        const webflowData = {
          name: event.eventName,
          date: event.date,
          'day-of-week': event.dayOfWeek,
          time: event.time,
          location: event.location,
          category: event.category,
          'event-link': event.eventLink,
          venue: event.venue,
          'scraped-at': event.scrapedAt,
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

