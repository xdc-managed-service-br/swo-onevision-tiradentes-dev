// src/app/shared/utils/tag-formatter.ts
/**
 * Utility for handling AWS resource tags in different formats
 * and converting them to a consistent display format
 */
export class TagFormatter {
    /**
     * Parse tags from various formats into a uniform key-value object
     * @param tags - Input tags which could be in various formats
     * @returns A simple key-value object with tag keys and values
     */
    static parseTags(tags: any): Record<string, string> {
      // Handle empty, null or undefined
      if (!tags) return {};
      
      try {
        // Special case: if the tags look like an AWS JSON string but aren't parsed yet
        if (typeof tags === 'string' && tags.includes('"Key"') && tags.includes('"Value"')) {
          // Try to directly parse AWS format
          const awsRegex = /\{\s*"Key"\s*:\s*"([^"]+)"\s*,\s*"Value"\s*:\s*"([^"]*)"\s*\}/g;
          let match;
          const result: Record<string, string> = {};
          
          // Extract all Key-Value pairs using regex
          while ((match = awsRegex.exec(tags)) !== null) {
            const key = match[1];
            const value = match[2];
            if (key) {
              result[key] = value;
            }
          }
          
          // If we found any matches, return them
          if (Object.keys(result).length > 0) {
            return result;
          }
        }
        
        // If it's a string, try to parse as JSON
        if (typeof tags === 'string') {
          // Handle empty string cases
          if (tags.trim() === '' || tags === '[]' || tags === '{}') {
            return {};
          }
          
          try {
            const parsed = JSON.parse(tags);
            
            // Handle array of {Key: "k1", Value: "v1"} objects (AWS format)
            if (Array.isArray(parsed)) {
              const result: Record<string, string> = {};
              
              for (const item of parsed) {
                if (item && typeof item === 'object') {
                  // Handle AWS format: [{Key: "k1", Value: "v1"}, ...]
                  if ('Key' in item && 'Value' in item) {
                    result[item.Key] = String(item.Value);
                  } else if (Object.keys(item).length === 1) {
                    // Handle simple key-value objects in array
                    const key = Object.keys(item)[0];
                    result[key] = String(item[key]);
                  }
                }
              }
              
              return result;
            }
            
            // If parsed is an object but not an array
            if (typeof parsed === 'object' && parsed !== null) {
              const result: Record<string, string> = {};
              // Convert all values to strings
              Object.keys(parsed).forEach(key => {
                result[key] = String(parsed[key]);
              });
              return result;
            }
            
            // If none of the above, return as a simple value
            return { "value": String(parsed) };
          } catch (e) {
            console.error('Error parsing tags JSON:', e, tags);
            // If it's a string but not valid JSON, return it as-is
            return { "value": String(tags) };
          }
        }
        
        // If it's already an object but not an array (might be a Record<string, string>)
        if (typeof tags === 'object' && !Array.isArray(tags)) {
          const result: Record<string, string> = {};
          // Convert all values to strings
          Object.keys(tags).forEach(key => {
            result[key] = String(tags[key]);
          });
          return result;
        }
        
        // If it's an array, process it directly
        if (Array.isArray(tags)) {
          const result: Record<string, string> = {};
          
          for (const tag of tags) {
            if (tag && typeof tag === 'object') {
              // Handle AWS format
              if ('Key' in tag && 'Value' in tag) {
                result[tag.Key] = String(tag.Value);
              } else if (Object.keys(tag).length === 1) {
                const key = Object.keys(tag)[0];
                result[key] = String(tag[key]);
              }
            }
          }
          
          return result;
        }
        
        // Fallback for any other type
        return { "value": String(tags) };
      } catch (e) {
        console.error('Unexpected error parsing tags:', e, tags);
        return { "error": "Could not parse tags" };
      }
    }
    
    /**
     * Check if an object is empty
     */
    static isEmptyObject(obj: any): boolean {
      if (!obj) return true;
      if (typeof obj !== 'object') return false;
      return Object.keys(obj).length === 0;
    }

    /**
     * Parse IP lists from various formats into a uniform string array
     * @param value - Input which could be a JSON string, array, or other format
     * @returns A string array of IP addresses
     */
    static parseIpList(value: any): string[] {
      // Handle empty, null or undefined
      if (!value === null || value === undefined) return [];
      
      // Log the exact value we're working with for debugging
      console.log('parseIpList input:', value, typeof value);
      
      try {
        // For the exact pattern you're seeing
        if (typeof value === 'string') {
          // Handle empty arrays
          if (value === '[]' || value === '"[]"' || value === '\"[]\"') {
            return [];
          }
          
          // Try to find IP addresses using regex
          const ipRegex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g;
          const matches = value.match(ipRegex);
          
          if (matches && matches.length > 0) {
            console.log('Found IPs via regex:', matches);
            return matches;
          }
          
          // If no IPs found with regex, try different parsing strategies
          
          // Strategy 1: Direct JSON parse
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              console.log('Parsed array directly:', parsed);
              return parsed.map(ip => String(ip));
            }
            if (typeof parsed === 'string') {
              // Try to parse the string again (double encoding)
              try {
                const innerParsed = JSON.parse(parsed);
                if (Array.isArray(innerParsed)) {
                  console.log('Parsed doubly encoded array:', innerParsed);
                  return innerParsed.map(ip => String(ip));
                }
              } catch (e) {
                // Not a JSON string, might be a single IP
                console.log('Inner parse failed, using outer result:', parsed);
                return [parsed];
              }
            }
          } catch (e) {
            console.log('Direct parse failed:', (e as Error).message);
          }
          
          // Strategy 2: Handle escaped quotes manually
          // This is the extreme case you're seeing
          let cleanedValue = value;
          // Replace escaped backslashes and quotes
          cleanedValue = cleanedValue.replace(/\\\\"/g, '"');
          cleanedValue = cleanedValue.replace(/\\"/g, '"');
          cleanedValue = cleanedValue.replace(/^"/, '').replace(/"$/, '');
          
          try {
            console.log('Cleaned value:', cleanedValue);
            const parsed = JSON.parse(cleanedValue);
            if (Array.isArray(parsed)) {
              console.log('Parsed cleaned array:', parsed);
              return parsed.map(ip => String(ip));
            }
          } catch (e) {
            console.log('Cleaned parse failed:', (e as Error).message);
          }
        }
        
        // If we've got here and haven't returned, handle other cases
        
        // Already an array
        if (Array.isArray(value)) {
          return value.map(ip => String(ip));
        }
        
        // Object with IP fields
        if (typeof value === 'object' && value !== null) {
          if (value.privateIp) return [String(value.privateIp)];
          if (value.publicIp) return [String(value.publicIp)];
        }
        
        // Last resort - try to find IPs with regex in stringified value
        const stringValue = String(value);
        const ipRegex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g;
        const matches = stringValue.match(ipRegex);
        
        if (matches && matches.length > 0) {
          return matches;
        }
        
        // If all else fails
        console.log('All parsing methods failed for:', value);
        return [];
        
      } catch (e) {
        console.error('Unexpected error in parseIpList:', e);
        return [];
      }
    }
  }