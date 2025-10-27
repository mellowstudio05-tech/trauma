const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes events from hessen-szene.de
 * @param {string} url - URL to scrape
 * @returns {Promise<Array>} Array of event objects
 */
async function scrapeEvents(url) {
  try {
    console.log(`Scraping events from: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    const events = [];
    
    // Finde die Event-Tabelle
    const eventTable = $('table.table tbody tr');
    
    eventTable.each((i, row) => {
      try {
        const $row = $(row);
        
        // Datum extrahieren
        const dateText = $row.find('td').eq(0).text().trim();
        const dateMatch = dateText.match(/(\d{2}\.\d{2}\.\d{2})/);
        const date = dateMatch ? dateMatch[1] : '';
        const dayOfWeek = $row.find('td').eq(0).find('br').next().text().trim();
        
        // Beginn extrahieren
        const time = $row.find('td').eq(1).text().trim();
        
        // Veranstaltung extrahieren
        const $eventLink = $row.find('td').eq(2).find('a');
        const eventName = $eventLink.text().trim();
        const eventLink = $eventLink.attr('href');
        const eventId = eventLink ? eventLink.match(/eventDate%5D=(\d+)/)?.[1] : '';
        
        // Ort extrahieren
        const location = $row.find('td').eq(3).text().trim().replace(/\s+/g, ' ');
        
        // Kategorie extrahieren
        const category = $row.find('td').eq(4).text().trim();
        
        if (eventName && date) {
          events.push({
            date: date,
            dayOfWeek: dayOfWeek,
            time: time,
            eventName: eventName,
            eventLink: eventLink ? new URL(eventLink, 'https://www.hessen-szene.de').href : '',
            eventId: eventId,
            location: location,
            category: category,
            venue: 'trauma im g-werk',
            scrapedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error(`Error parsing row ${i}:`, err.message);
      }
    });
    
    console.log(`Found ${events.length} events`);
    return events;
    
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    throw error;
  }
}

/**
 * Legacy function for general scraping (kept for backwards compatibility)
 * @param {string} url - URL to scrape
 * @returns {Promise<Object>} Scraped data
 */
async function scrapeContent(url) {
  const events = await scrapeEvents(url);
  return {
    url: url,
    title: 'Events from hessen-szene.de',
    events: events,
    eventCount: events.length,
    scrapedAt: new Date().toISOString()
  };
}

module.exports = { scrapeContent, scrapeEvents };

