/**
 * Script to check Webflow Collection field names
 * Run with: node check-webflow-fields.js
 */

require('dotenv').config();
const WebflowAPI = require('./webflow-api');

async function checkFields() {
  try {
    // Validate environment variables
    if (!process.env.WEBFLOW_API_TOKEN || !process.env.WEBFLOW_COLLECTION_ID) {
      console.error('❌ Missing WEBFLOW_API_TOKEN or WEBFLOW_COLLECTION_ID in environment variables.');
      console.log('\nBitte erstelle eine .env Datei mit:');
      console.log('WEBFLOW_API_TOKEN=dein_token');
      console.log('WEBFLOW_COLLECTION_ID=deine_collection_id');
      console.log('WEBFLOW_SITE_ID=deine_site_id (falls Site API Token verwendet wird)');
      process.exit(1);
    }

    const webflow = new WebflowAPI(process.env.WEBFLOW_API_TOKEN, process.env.WEBFLOW_SITE_ID);

    console.log('🔍 Lade Collection Schema von Webflow...\n');

    const schema = await webflow.getCollectionSchema(process.env.WEBFLOW_COLLECTION_ID);

    console.log('✅ Collection gefunden:', schema.name);
    console.log('📋 Collection ID:', schema.id);
    console.log('\n📝 Verfügbare Felder:\n');

    if (schema.fields && schema.fields.length > 0) {
      schema.fields.forEach((field, index) => {
        console.log(`${index + 1}. Feld Name: "${field.name}"`);
        console.log(`   Feld Slug: "${field.slug}"`);
        console.log(`   Feld Typ: ${field.type || 'N/A'}`);
        console.log(`   Erforderlich: ${field.isRequired ? 'Ja' : 'Nein'}`);
        console.log('');
      });

      console.log('\n💡 Verwendbare Feld-Slugs für den Code:\n');
      const plainTextFields = schema.fields.filter(f => f.type === 'PlainText');
      const anyTextFields = schema.fields.filter(f => 
        f.type === 'PlainText' || 
        f.type === 'RichText' || 
        f.name.toLowerCase().includes('kategorie') ||
        f.name.toLowerCase().includes('tag')
      );

      if (anyTextFields.length > 0) {
        anyTextFields.forEach(field => {
          console.log(`   - "${field.slug}" (${field.type}) - Name: "${field.name}"`);
        });
      } else {
        console.log('   Keine PlainText-Felder gefunden.');
      }

      // Suche nach Kategorie und Tag Feldern
      console.log('\n🔎 Suche nach Kategorie- und Tag-Feldern:\n');
      const kategorieFields = schema.fields.filter(f => 
        f.name.toLowerCase().includes('kategorie') || 
        f.slug.toLowerCase().includes('kategorie')
      );
      const tagFields = schema.fields.filter(f => 
        f.name.toLowerCase().includes('tag') && 
        !f.name.toLowerCase().includes('kategorie')
      );

      if (kategorieFields.length > 0) {
        console.log('✅ Kategorie-Feld(er) gefunden:');
        kategorieFields.forEach(f => {
          console.log(`   → Verwende in Code: webflowData['${f.slug}'] = event.category;`);
        });
      } else {
        console.log('❌ Kein Kategorie-Feld gefunden. Erstelle ein Feld in Webflow mit Namen "Kategorie Plain Text"');
      }

      if (tagFields.length > 0) {
        console.log('\n✅ Tag-Feld(er) gefunden:');
        tagFields.forEach(f => {
          console.log(`   → Verwende in Code: webflowData['${f.slug}'] = event.dayOfWeek;`);
        });
      } else {
        console.log('\n❌ Kein Tag-Feld gefunden. Erstelle ein Feld in Webflow mit Namen "Tag Plain Text"');
      }

    } else {
      console.log('❌ Keine Felder in dieser Collection gefunden.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('💡 Tipp: Die Feld-Slugs (klein geschrieben, mit Bindestrichen)');
    console.log('   sind die Werte, die du im Code verwenden musst!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Fehler beim Abrufen der Collection:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  checkFields();
}

module.exports = { checkFields };
