/**
 * Gemini model selection utility
 * Dynamically selects the best available model from the API
 */

/**
 * Get the best available Gemini model by calling the REST API directly
 * Prioritizes: gemini-2.0-flash-exp > gemini-2.0-flash > gemini-1.5-flash > gemini-1.5-pro
 */
export const getBestModel = async (apiKey: string): Promise<string> => {
  // Try both v1 and v1beta API versions
  const apiVersions = ['v1', 'v1beta'];
  
  for (const version of apiVersions) {
    try {
      // Call the REST API directly to list models
      const response = await fetch(
        `https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (__DEV__) {
          console.warn(`Failed to list models from ${version}: ${response.status} ${response.statusText}`);
        }
        continue; // Try next API version
      }

      const data = await response.json();
      
      // Extract model names from the response
      const models = data.models || [];
      
      // Filter models that support generateContent
      const supportedModels = models.filter((model: any) => {
        const supportedMethods = model.supportedGenerationMethods || [];
        return supportedMethods.includes('generateContent');
      });
      
      const modelNames = supportedModels.map((model: any) => {
        const name = model.name || '';
        // Extract just the model name (remove "models/" prefix if present)
        return name.includes('/') ? name.split('/').pop() : name;
      }).filter(Boolean);
      
      if (__DEV__) {
        console.log(`Available models from ${version}:`, modelNames);
      }
      
      if (modelNames.length === 0) {
        continue; // Try next API version
      }
      
      // Priority order (best to worst)
      const preferredModels = [
        'gemini-2.0-flash-exp',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-pro',
      ];
      
      // Find the first available model from our priority list
      for (const preferred of preferredModels) {
        const found = modelNames.find((name: string) => 
          name === preferred || name.includes(preferred)
        );
        
        if (found) {
          if (__DEV__) {
            console.log(`Selected model from ${version}:`, found);
          }
          return found;
        }
      }
      
      // Fallback: return the first available model
      const firstModel = modelNames[0];
      if (__DEV__) {
        console.log(`Using first available model from ${version}:`, firstModel);
      }
      return firstModel;
    } catch (error) {
      if (__DEV__) {
        console.warn(`Error listing models from ${version}:`, error);
      }
      continue; // Try next API version
    }
  }
  
  // Ultimate fallback - return a model that's most likely to work
  // Based on Google's current API, gemini-1.5-pro is more stable than gemini-1.5-flash
  if (__DEV__) {
    console.warn('Could not list models from API, using fallback: gemini-1.5-pro');
  }
  
  return 'gemini-1.5-pro'; // More stable than flash
};

/**
 * Cache for model name to avoid repeated API calls
 */
let cachedModelName: string | null = null;
let modelCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Clear the model cache (useful when a model fails)
 */
export const clearModelCache = () => {
  cachedModelName = null;
  modelCacheTime = 0;
};

/**
 * Get cached or fetch model name
 */
export const getCachedModel = async (apiKey: string): Promise<string> => {
  const now = Date.now();
  
  // Return cached model if still valid
  if (cachedModelName && (now - modelCacheTime) < CACHE_DURATION) {
    return cachedModelName;
  }
  
  // Fetch and cache new model
  cachedModelName = await getBestModel(apiKey);
  modelCacheTime = now;
  
  return cachedModelName;
};

