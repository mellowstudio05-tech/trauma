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
   * Publish an item (make it live)
   * @param {string} collectionId - Collection ID
   * @param {string} itemId - Item ID
   * @returns {Promise<Object>} Publication result
   */
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

