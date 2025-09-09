// src/app/core/services/cache.service.ts
import { Injectable } from '@angular/core';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private cache = new Map<string, CacheItem<any>>();
  
  /**
   * Set a cached value with expiration
   * @param key Cache key
   * @param data Data to cache
   * @param expiresInMinutes Time until expiration in minutes
   */
  set<T>(key: string, data: T, expiresInMinutes: number = 10): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn: expiresInMinutes * 60 * 1000
    });
  }
  
  /**
   * Get a cached value if available and not expired
   * @param key Cache key
   * @returns The cached value or null if not found/expired
   */
  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > cached.expiresIn) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }
  
  /**
   * Clear the entire cache
   */
  clearAll(): void {
    this.cache.clear();
  }
  
  /**
   * Clear cache entries that match a pattern
   * @param keyPattern String pattern to match against keys
   */
  clear(keyPattern: string): void {
    for (const key of Array.from(this.cache.keys())) {
      if (key.includes(keyPattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Check if a key exists in the cache and is not expired
   * @param key Cache key
   * @returns Whether the key exists and is valid
   */
  has(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    const now = Date.now();
    if (now - cached.timestamp > cached.expiresIn) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get all cached keys
   * @returns Array of all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}