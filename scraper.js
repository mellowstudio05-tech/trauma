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
    
    // Validate URL
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL provided');
    }
    
    // Check if URL is valid
    try {
      new URL(url);
    } catch (e) {
      throw new Error(`Invalid URL format: ${url}`);
    }
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000 // 30 second timeout
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
        
        // Detailseite URL erstellen
        const detailUrl = eventLink ? new URL(eventLink, 'https://www.hessen-szene.de').href : '';
        
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
            eventLink: detailUrl,
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
    
    // Detailseiten für zusätzliche Informationen laden
    console.log('Loading event details...');
    for (let i = 0; i < events.length; i++) {
      if (events[i].eventLink) {
        try {
          const details = await scrapeEventDetails(events[i].eventLink);
          events[i] = { ...events[i], ...details };
          console.log(`Loaded details for: ${events[i].eventName}`);
          
          // Delay zwischen Requests um Rate Limits zu vermeiden
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Failed to load details for ${events[i].eventName}:`, error.message);
        }
      }
    }
    
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

/**
 * Scrapes additional details from event detail page
 * @param {string} detailUrl - URL of the event detail page
 * @returns {Promise<Object>} Additional event details
 */
async function scrapeEventDetails(detailUrl) {
  try {
    console.log(`Scraping details from: ${detailUrl}`);
    
    const response = await axios.get(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Extrahiere Details aus der Detailseite
    const details = {
      // Event-Titel (für Blog Header)
      title: $('h1.pb-2').text().trim(),
      
      // Vollständiges Datum und Zeit (für Event Datum)
      fullDateTime: $('.event-single-view-datetime strong').text().trim(),
      
      // Veranstaltungsbeginn
      startTime: $('.event-single-view-time p').text().trim(),
      
      // Kategorie
      category: $('.event-single-view-category').text().replace('Kategorie:', '').trim(),
      
      // Ort mit vollständiger Adresse
      fullLocation: $('.event-single-view-contact .col:last-child p').html(),
      
      // Event-Bild
      imageUrl: $('.single-event-image img').attr('src'),
      imageAlt: $('.single-event-image img').attr('alt'),
      
      // Beschreibung (für Blog Rich Text)
      description: $('.event-single-view-desc').text().trim(),
      
      // Eintrittspreis
      price: $('.event-single-view-fee p').text().trim(),
      
      // Hotline (falls vorhanden)
      hotline: $('.event-single-view-contact p').text().match(/Hotline: (\d+)/)?.[1] || '',
    };
    
    return details;
    
  } catch (error) {
    console.error(`Error scraping details from ${detailUrl}:`, error.message);
    return {};
  }
}

/**
 * Main function to scrape content from hessen-szene.de
 * @returns {Promise<Object>} Scraped data with events
 */
async function scrapeContent() {
  try {
    // Die URL von hessen-szene.de (einfache Version)
    const url = 'https://www.hessen-szene.de/';
    
    console.log('Starting scrape process...');
    console.log('URL:', url);
    
    // Validate URL before using it
    if (!url || url === 'undefined') {
      throw new Error('URL is undefined or invalid');
    }
    
    const events = await scrapeEvents(url);
    console.log(`Scraped ${events.length} events from main page`);
    
        // Scrape details for each event
        const eventsWithDetails = [];
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          console.log(`Scraping details for event ${i + 1}/${events.length}: ${event.eventName}`);
          
          try {
            // Prüfe ob detailUrl existiert
            if (!event.detailUrl) {
              console.log(`⚠️ No detailUrl for ${event.eventName}, skipping details`);
              eventsWithDetails.push(event);
              continue;
            }
            
            const details = await scrapeEventDetails(event.detailUrl);
            eventsWithDetails.push({
              ...event,
              ...details
            });
            
            // Delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Failed to scrape details for ${event.eventName}:`, error.message);
            eventsWithDetails.push(event); // Add event without details
          }
        }
    
    return {
      events: eventsWithDetails,
      scrapedAt: new Date().toISOString(),
      totalEvents: eventsWithDetails.length
    };
    
  } catch (error) {
    console.error('Error in scrapeContent:', error.message);
    throw error;
  }
}

module.exports = { scrapeContent, scrapeEvents, scrapeEventDetails };

