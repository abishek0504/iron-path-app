/**
 * Robust JSON extraction utility for AI responses
 * Handles various response formats including markdown code blocks,
 * wrapped text, and plain JSON
 */

export class JSONParseError extends Error {
  constructor(message: string, public originalText?: string) {
    super(message);
    this.name = 'JSONParseError';
  }
}

/**
 * Extract and parse JSON from AI response text
 * Tries multiple strategies to find valid JSON
 * 
 * @param text - Raw text response from AI
 * @returns Parsed JSON object or array
 * @throws JSONParseError if JSON cannot be extracted
 */
export const extractJSON = (text: string): any => {
  if (!text || typeof text !== 'string') {
    throw new JSONParseError('Invalid input: text must be a non-empty string');
  }

  let cleanedText = text.trim();

  // Strategy 1: Remove markdown code blocks
  if (cleanedText.startsWith('```')) {
    // Remove opening ```json or ```
    cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/i, '');
    // Remove closing ```
    cleanedText = cleanedText.replace(/\n?```\s*$/g, '');
    cleanedText = cleanedText.trim();
  }

  // Strategy 2: Try parsing directly
  try {
    return JSON.parse(cleanedText);
  } catch (e) {
    // Continue to next strategy
  }

  // Strategy 3: Find JSON object/array in text
  // Look for first { or [ and find matching closing } or ]
  const objectStart = cleanedText.indexOf('{');
  const arrayStart = cleanedText.indexOf('[');
  
  let startIndex = -1;
  let isArray = false;
  
  if (objectStart !== -1 && (arrayStart === -1 || objectStart < arrayStart)) {
    startIndex = objectStart;
    isArray = false;
  } else if (arrayStart !== -1) {
    startIndex = arrayStart;
    isArray = true;
  }

  if (startIndex !== -1) {
    // Find matching closing bracket
    const openChar = isArray ? '[' : '{';
    const closeChar = isArray ? ']' : '}';
    let depth = 0;
    let endIndex = -1;

    for (let i = startIndex; i < cleanedText.length; i++) {
      if (cleanedText[i] === openChar) {
        depth++;
      } else if (cleanedText[i] === closeChar) {
        depth--;
        if (depth === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    if (endIndex !== -1) {
      const jsonSubstring = cleanedText.substring(startIndex, endIndex);
      try {
        return JSON.parse(jsonSubstring);
      } catch (e) {
        // Continue to next strategy
      }
    }
  }

  // Strategy 4: Try regex to find JSON-like structures
  const jsonRegex = /(?:^|\s)(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\])/s;
  const match = cleanedText.match(jsonRegex);
  
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      // Continue to error
    }
  }

  // All strategies failed
  throw new JSONParseError(
    'Could not extract valid JSON from response. The AI may have returned an unexpected format.',
    text
  );
};

