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
   * Update an existing item in Webflow CMS collection
   * @param {string} collectionId - Webflow collection ID
   * @param {string} itemId - Item ID to update
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated item
   */
  async updateItem(collectionId, itemId, data) {
    try {
      const response = await axios.patch(
        `${this.baseURL}/collections/${collectionId}/items/${itemId}`,
        {
          items: [{
            id: itemId,
            fieldData: data
          }]
        },
        { headers: this.headers }
      );
      
      console.log('Item updated in Webflow CMS:', response.data);
      return response.data.items[0];
    } catch (error) {
      console.error('Error updating item in Webflow:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Find existing item by name
   * @param {string} collectionId - Webflow collection ID
   * @param {string} name - Name to search for
   * @returns {Promise<Object|null>} Found item or null
   */
  async findItemByName(collectionId, name) {
    try {
      const response = await axios.get(
        `${this.baseURL}/collections/${collectionId}/items`,
        { 
          headers: this.headers,
          params: {
            limit: 100 // Erhöhe das Limit um alle Items zu finden
          }
        }
      );
      
      // Suche nach Item mit gleichem Namen
      const foundItem = response.data.items.find(item => 
        item.fieldData.name === name
      );
      
      return foundItem || null;
    } catch (error) {
      console.error('Error finding item in Webflow:', error.response?.data || error.message);
      return null;
    }
  }
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
      // Webflow API v2 - Item Publishing (neueste Methode)
      const response = await axios.post(
        `https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}/publish`,
        {},
        { headers: this.headers }
      );
      
      console.log('✅ Item published successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error publishing item:', error.response?.data || error.message);
      
      // Fallback: Versuche v1 API
      try {
        console.log('🔄 Trying v1 API as fallback...');
        const v1Response = await axios.post(
          `https://api.webflow.com/v1/collections/${collectionId}/items/${itemId}/publish`,
          {},
          { headers: this.headers }
        );
        
        console.log('✅ Item published with v1 API:', v1Response.data);
        return v1Response.data;
      } catch (v1Error) {
        console.error('❌ v1 API also failed:', v1Error.response?.data || v1Error.message);
        throw error; // Throw original error
      }
    }
  }
}

module.exports = WebflowAPI;

