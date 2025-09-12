// src/app/shared/utils/tag-formatter.ts
export class TagFormatter {
    static parseTags(tags: any): Record<string, string> {
      if (!tags) return {};
      
      try {
        if (typeof tags === 'string' && tags.includes('"Key"') && tags.includes('"Value"')) {
          const awsRegex = /\{\s*"Key"\s*:\s*"([^"]+)"\s*,\s*"Value"\s*:\s*"([^"]*)"\s*\}/g;
          let match;
          const result: Record<string, string> = {};

          while ((match = awsRegex.exec(tags)) !== null) {
            const key = match[1];
            const value = match[2];
            if (key) {
              result[key] = value;
            }
          }
          if (Object.keys(result).length > 0) {
            return result;
          }
        }
        if (typeof tags === 'string') {
          // Handle empty string cases
          if (tags.trim() === '' || tags === '[]' || tags === '{}') {
            return {};
          }
          
          try {
            const parsed = JSON.parse(tags);
            if (Array.isArray(parsed)) {
              const result: Record<string, string> = {};
              
              for (const item of parsed) {
                if (item && typeof item === 'object') {
                  if ('Key' in item && 'Value' in item) {
                    result[item.Key] = String(item.Value);
                  } else if (Object.keys(item).length === 1) {
                    const key = Object.keys(item)[0];
                    result[key] = String(item[key]);
                  }
                }
              }
              return result;
            }

            if (typeof parsed === 'object' && parsed !== null) {
              const result: Record<string, string> = {};
              Object.keys(parsed).forEach(key => {
                result[key] = String(parsed[key]);
              });
              return result;
            }
            return { "value": String(parsed) };
          } catch (e) {
            console.error('Error parsing tags JSON:', e, tags);
            return { "value": String(tags) };
          }
        }
        if (typeof tags === 'object' && !Array.isArray(tags)) {
          const result: Record<string, string> = {};
          Object.keys(tags).forEach(key => {
            result[key] = String(tags[key]);
          });
          return result;
        }
        if (Array.isArray(tags)) {
          const result: Record<string, string> = {};
          
          for (const tag of tags) {
            if (tag && typeof tag === 'object') {
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
        return { "value": String(tags) };
      } catch (e) {
        console.error('Unexpected error parsing tags:', e, tags);
        return { "error": "Could not parse tags" };
      }
    }

    static isEmptyObject(obj: any): boolean {
      if (!obj) return true;
      if (typeof obj !== 'object') return false;
      return Object.keys(obj).length === 0;
    }

    static parseIpList(value: any): string[] {

      if (!value === null || value === undefined) return [];
      console.log('parseIpList input:', value, typeof value);
      
      try {
        if (typeof value === 'string') {
          if (value === '[]' || value === '"[]"' || value === '\"[]\"') {
            return [];
          }
          const ipRegex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g;
          const matches = value.match(ipRegex);
          
          if (matches && matches.length > 0) {
            console.log('Found IPs via regex:', matches);
            return matches;
          }
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              console.log('Parsed array directly:', parsed);
              return parsed.map(ip => String(ip));
            }
            if (typeof parsed === 'string') {
              try {
                const innerParsed = JSON.parse(parsed);
                if (Array.isArray(innerParsed)) {
                  console.log('Parsed doubly encoded array:', innerParsed);
                  return innerParsed.map(ip => String(ip));
                }
              } catch (e) {
                console.log('Inner parse failed, using outer result:', parsed);
                return [parsed];
              }
            }
          } catch (e) {
            console.log('Direct parse failed:', (e as Error).message);
          }
          let cleanedValue = value;
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
        if (Array.isArray(value)) {
          return value.map(ip => String(ip));
        }
        if (typeof value === 'object' && value !== null) {
          if (value.privateIp) return [String(value.privateIp)];
          if (value.publicIp) return [String(value.publicIp)];
        }
        const stringValue = String(value);
        const ipRegex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g;
        const matches = stringValue.match(ipRegex);
        
        if (matches && matches.length > 0) {
          return matches;
        }
        console.log('All parsing methods failed for:', value);
        return [];
        
      } catch (e) {
        console.error('Unexpected error in parseIpList:', e);
        return [];
      }
    }
  }