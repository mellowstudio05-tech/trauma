const axios = require('axios');

/**
 * Webflow API Client
 */
class WebflowAPI {
  constructor(apiToken, siteId = null) {
    this.apiToken = apiToken;
    this.siteId = siteId;
    this.baseURL = 'https://api.webflow.com/v2';
    this.headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    };
    
    // Für Site API Token brauchen wir die Site ID
    if (siteId) {
      this.headers['X-Webflow-Site'] = siteId;
    }
  }

  /**
   * Upload an item to Webflow CMS collection
   * @param {string} collectionId - Webflow collection ID
   * @param {Object} data - Data to upload
   * @returns {Promise<Object>} Created item
   */
  async createItem(collectionId, data) {
    try {
      const response = await axios.post(
        `${this.baseURL}/collections/${collectionId}/items`,
        {
          items: [{
            fieldData: data
          }]
        },
        { headers: this.headers }
      );
      
      console.log('Item created in Webflow CMS:', response.data);
      return response.data.items[0];
    } catch (error) {
      console.error('Error creating item in Webflow:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get items from a collection
   * @param {string} collectionId - Webflow collection ID
   * @returns {Promise<Array>} Collection items
   */
  async getItems(collectionId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/collections/${collectionId}/items`,
        { headers: this.headers }
      );
      
      return response.data.items;
    } catch (error) {
      console.error('Error getting items from Webflow:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Upload an image to Webflow and return the asset ID
   * @param {string} imageUrl - URL of the image to upload
   * @param {string} filename - Filename for the uploaded image
   * @returns {Promise<string>} Asset ID
   */
  async uploadImage(imageUrl, filename) {
    try {
      // Lade das Bild herunter
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      // Konvertiere zu Base64
      const base64 = Buffer.from(response.data).toString('base64');
      const mimeType = response.headers['content-type'] || 'image/jpeg';
      
      // Upload zu Webflow
      const uploadResponse = await axios.post(
        `${this.baseURL}/assets`,
        {
          fileName: filename,
          fileData: base64,
          mimeType: mimeType
        },
        { headers: this.headers }
      );
      
      console.log('Image uploaded to Webflow:', uploadResponse.data);
      return uploadResponse.data.id;
      
    } catch (error) {
      console.error('Error uploading image to Webflow:', error.response?.data || error.message);
      throw error;
    }
  }
  async publishItem(collectionId, itemId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/collections/${collectionId}/items/${itemId}/publish`,
        {},
        { headers: this.headers }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error publishing item in Webflow:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = WebflowAPI;

