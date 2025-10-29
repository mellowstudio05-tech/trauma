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
   * Get collection schema (field definitions)
   * @param {string} collectionId - Webflow collection ID
   * @returns {Promise<Object>} Collection schema with fields
   */
  async getCollectionSchema(collectionId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/collections/${collectionId}`,
        { headers: this.headers }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error getting collection schema:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get items from a collection
   * @param {string} collectionId - Webflow collection ID
   * @param {Object} options - Optional query parameters (limit, offset, etc.)
   * @returns {Promise<Object>} Response with items and pagination info
   */
  async getItems(collectionId, options = {}) {
    try {
      const params = {
        limit: options.limit || 100,
        offset: options.offset || 0
      };
      
      const response = await axios.get(
        `${this.baseURL}/collections/${collectionId}/items`,
        { 
          headers: this.headers,
          params: params
        }
      );
      
      return {
        items: response.data.items || [],
        pagination: {
          total: response.data.pagination?.total,
          limit: response.data.pagination?.limit,
          offset: response.data.pagination?.offset
        }
      };
    } catch (error) {
      console.error('Error getting items from Webflow:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get a single item by ID
   * @param {string} collectionId - Webflow collection ID
   * @param {string} itemId - Item ID
   * @returns {Promise<Object>} Item data
   */
  async getItem(collectionId, itemId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/collections/${collectionId}/items/${itemId}`,
        { headers: this.headers }
      );
      
      return response.data.items?.[0] || response.data;
    } catch (error) {
      console.error('Error getting item from Webflow:', error.response?.data || error.message);
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
      // Hole erst das bestehende Item, um alle Felder zu erhalten
      const existingItem = await this.getItem(collectionId, itemId);
      
      // Merge bestehende Felddaten mit neuen Daten
      const mergedData = {
        ...(existingItem?.fieldData || {}),
        ...data  // Neue Daten überschreiben bestehende
      };

      // Webflow v2 API Update Format - möglicherweise ohne items Array
      const response = await axios.patch(
        `${this.baseURL}/collections/${collectionId}/items/${itemId}`,
        {
          fieldData: mergedData
        },
        { headers: this.headers }
      );
      
      console.log('Item updated in Webflow CMS:', response.data);
      return response.data.items?.[0] || response.data;
    } catch (error) {
      console.error('Error updating item in Webflow:', error.response?.data || error.message);
      
      // Fallback: Versuche es mit dem items Array Format
      if (error.response?.status === 400) {
        try {
          console.log('Trying alternative update format with items array...');
          const existingItem = await this.getItem(collectionId, itemId);
          const mergedData = {
            ...(existingItem?.fieldData || {}),
            ...data
          };
          
          const fallbackResponse = await axios.patch(
            `${this.baseURL}/collections/${collectionId}/items/${itemId}`,
            {
              items: [{
                id: itemId,
                fieldData: mergedData
              }]
            },
            { headers: this.headers }
          );
          
          return fallbackResponse.data.items?.[0] || fallbackResponse.data;
        } catch (fallbackError) {
          console.error('Fallback update also failed:', fallbackError.response?.data || fallbackError.message);
          throw error; // Throw original error
        }
      }
      
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
      // Suche durch alle Items (mit Pagination)
      let offset = 0;
      const limit = 100;
      let foundItem = null;

      while (!foundItem) {
        const result = await this.getItems(collectionId, { limit, offset });
        const items = result.items;

        // Suche nach Item mit gleichem Namen (exakte Übereinstimmung)
        foundItem = items.find(item => 
          item.fieldData?.name === name || item.fieldData?.name?.trim() === name.trim()
        );

        // Wenn gefunden oder keine weiteren Items, stoppe die Suche
        if (foundItem || items.length === 0) {
          break;
        }

        // Prüfe ob es weitere Items gibt
        if (result.pagination && offset + limit >= result.pagination.total) {
          break;
        }

        offset += limit;
      }

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
      // Webflow v2 API verwendet einen anderen Endpoint für Publishing
      const response = await axios.post(
        `${this.baseURL}/collections/${collectionId}/items/${itemId}/publish`,
        {},
        { headers: this.headers }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error publishing item in Webflow:', error.response?.data || error.message);
      
      // Falls Publishing fehlschlägt, versuche es mit dem v1 API
      try {
        console.log('Trying v1 API for publishing...');
        const v1Response = await axios.post(
          `https://api.webflow.com/v1/collections/${collectionId}/items/${itemId}/publish`,
          {},
          { headers: this.headers }
        );
        
        return v1Response.data;
      } catch (v1Error) {
        console.error('v1 API also failed:', v1Error.response?.data || v1Error.message);
        throw error; // Throw original error
      }
    }
  }
}

module.exports = WebflowAPI;

