require('dotenv').config();
const express = require('express');
const { scrapeContent } = require('./scraper');
const WebflowAPI = require('./webflow-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Initialize Webflow API
const webflow = new WebflowAPI(process.env.WEBFLOW_API_TOKEN, process.env.WEBFLOW_SITE_ID);

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Trauma Scraper API', 
    version: '1.0.0',
    endpoints: {
      scrape: '/api/scrape',
      health: '/api/health'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/scrape', async (req, res) => {
  try {
    console.log('Starting scrape process...');
    console.log('Environment check:', {
      hasApiToken: !!process.env.WEBFLOW_API_TOKEN,
      hasSiteId: !!process.env.WEBFLOW_SITE_ID,
      hasCollectionId: !!process.env.WEBFLOW_COLLECTION_ID,
      apiTokenStart: process.env.WEBFLOW_API_TOKEN?.substring(0, 5) + '...'
    });
    
    // Konvertiere relative Bild-URL zu vollständiger URL (globale Funktion)
    const formatImageUrl = (imageUrl) => {
      if (!imageUrl) return '';
      
      // Wenn es bereits eine vollständige URL ist
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
      }
      
      // Wenn es ein relativer Pfad ist, füge die Domain hinzu
      if (imageUrl.startsWith('/')) {
        return `https://www.hessen-szene.de${imageUrl}`;
      }
      
      // Falls es ein anderer Pfad ist
      return `https://www.hessen-szene.de/${imageUrl}`;
    };
    
    // Scrape content from the URL
    const scrapedData = await scrapeContent();
    console.log(`Found ${scrapedData.events.length} events`);

    // Upload each event to Webflow
    const uploadedEvents = [];
    
    for (const event of scrapedData.events) {
      try {
        const eventName = event.title || event.eventName;
        
        console.log(`Creating event: ${eventName}...`);
        
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
            name: eventName,                                        // Blog Header = name Field
            slug: eventName.toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')                       // Entferne Sonderzeichen
              .replace(/\s+/g, '-')                               // Ersetze Leerzeichen mit -
              .replace(/-+/g, '-')                                // Entferne mehrfache -
              .replace(/^-|-$/g, ''),                             // Entferne führende/trailing -
            'uhrzeit': event.time,                                // Zeit
            'event-datum': formatDateForWebflow(event),           // Korrekt formatiertes Datum
            'preis': event.price || 'Eintritt frei',              // Preis
            'eintritt-frei': (event.price || '').toLowerCase().includes('frei'), // Switch
            'blog-rich-text': event.description || `${eventName}\n\nDatum: ${event.date}\nZeit: ${event.time}\nOrt: ${event.location}\nKategorie: ${event.category}`, // Beschreibung
            'imageurl': formatImageUrl(event.imageUrl),           // Vollständige Event-Bild URL
            'kategorie': event.category || '',                   // Kategorie aus Detailseite
            'tag': event.dayOfWeek || '',                        // Wochentag (Montag, Dienstag, etc.)
          };

          console.log(`Creating: ${eventName}...`);
          const result = await webflow.createItem(
            process.env.WEBFLOW_COLLECTION_ID,
            webflowData
          );

          uploadedEvents.push({
            eventName: eventName,
            webflowId: result.id,
            action: 'created'
          });

          // Publish the item (mit besserem Error Handling)
          try {
            console.log(`Publishing: ${eventName}...`);
            await webflow.publishItem(process.env.WEBFLOW_COLLECTION_ID, result.id);
            console.log(`✅ Published: ${eventName}`);
          } catch (publishError) {
            console.error(`❌ Failed to publish ${eventName}:`, publishError.message);
            console.log(`⚠️ Event ${eventName} uploaded but not published. You may need to publish manually.`);
          }

          console.log(`✅ Created: ${eventName}`);
        
        // Delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error processing event ${eventName || 'unknown'}:`, error.message);
        continue;
      }
    }

    res.json({
      success: true,
      message: `Successfully processed ${uploadedEvents.length} events`,
      events: uploadedEvents,
      summary: {
        total: scrapedData.events.length,
        uploaded: uploadedEvents.length,
        created: uploadedEvents.length
      }
    });

  } catch (error) {
    console.error('Scrape process failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/scrape', async (req, res) => {
  try {
    console.log('Manual scrape triggered...');
    
    // Scrape content from the URL
    const scrapedData = await scrapeContent();
    console.log(`Found ${scrapedData.events.length} events`);

    // Upload each event to Webflow
    const uploadedEvents = [];
    
    for (const event of scrapedData.events) {
      try {
        const eventName = event.title || event.eventName;
        
        console.log(`Creating event: ${eventName}...`);
        
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
            name: eventName,                                        // Blog Header = name Field
            slug: eventName.toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')                       // Entferne Sonderzeichen
              .replace(/\s+/g, '-')                               // Ersetze Leerzeichen mit -
              .replace(/-+/g, '-')                                // Entferne mehrfache -
              .replace(/^-|-$/g, ''),                             // Entferne führende/trailing -
            'uhrzeit': event.time,                                // Zeit
            'event-datum': formatDateForWebflow(event),           // Korrekt formatiertes Datum
            'preis': event.price || 'Eintritt frei',              // Preis
            'eintritt-frei': (event.price || '').toLowerCase().includes('frei'), // Switch
            'blog-rich-text': event.description || `${eventName}\n\nDatum: ${event.date}\nZeit: ${event.time}\nOrt: ${event.location}\nKategorie: ${event.category}`, // Beschreibung
            'imageurl': formatImageUrl(event.imageUrl),           // Vollständige Event-Bild URL
            'kategorie': event.category || '',                   // Kategorie aus Detailseite
            'tag': event.dayOfWeek || '',                        // Wochentag (Montag, Dienstag, etc.)
          };

          console.log(`Creating: ${eventName}...`);
          const result = await webflow.createItem(
            process.env.WEBFLOW_COLLECTION_ID,
            webflowData
          );

          uploadedEvents.push({
            eventName: eventName,
            webflowId: result.id,
            action: 'created'
          });

          // Publish the item (mit besserem Error Handling)
          try {
            console.log(`Publishing: ${eventName}...`);
            await webflow.publishItem(process.env.WEBFLOW_COLLECTION_ID, result.id);
            console.log(`✅ Published: ${eventName}`);
          } catch (publishError) {
            console.error(`❌ Failed to publish ${eventName}:`, publishError.message);
            console.log(`⚠️ Event ${eventName} uploaded but not published. You may need to publish manually.`);
          }

          console.log(`✅ Created: ${eventName}`);
        
        // Delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error processing event ${eventName || 'unknown'}:`, error.message);
        continue;
      }
    }

    res.json({
      success: true,
      message: `Successfully processed ${uploadedEvents.length} events`,
      events: uploadedEvents,
      summary: {
        total: scrapedData.events.length,
        uploaded: uploadedEvents.length,
        created: uploadedEvents.length
      }
    });

  } catch (error) {
    console.error('Manual scrape process failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
