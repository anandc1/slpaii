/**
 * Token Service for handling assessment upload tokens
 */
class TokenService {
  constructor(firebase) {
    this.db = firebase.firestore();
    this.auth = firebase.auth();
  }

  /**
   * Generate a new token for assessment upload
   * @param {string} assessmentType - The type of assessment
   * @param {string} userId - The user ID (required)
   * @returns {Promise<string>} - The token ID
   */
  async generateToken(assessmentType, userId) {
    try {
      if (!userId) {
        throw new Error("User ID is required to generate a token");
      }
      
      // Generate a random token ID
      const tokenId = this.generateRandomId(20);
      
      // Create token document in Firestore
      const tokenRef = this.db.collection("tokens").doc(tokenId);
      await tokenRef.set({
        userId: userId,
        assessmentType: assessmentType,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        used: false,
        requiresAuth: false // Authentication is now handled at the extension level
      });

      return tokenId;
    } catch (error) {
      console.error("Error generating token:", error);
      throw error;
    }
  }

  /**
   * Generate a random ID for the token
   * @param {number} length - The length of the ID
   * @returns {string} - The random ID
   */
  generateRandomId(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// Export the service
export default TokenService;
