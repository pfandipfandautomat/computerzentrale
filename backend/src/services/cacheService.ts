import Redis from 'ioredis';

/**
 * CacheService - Singleton service for caching SSH command results
 * 
 * Uses Redis for distributed caching with TTL support.
 * Default TTL is 30 seconds for SSH results.
 */
class CacheService {
  private redis: Redis;
  private readonly DEFAULT_TTL = 30; // seconds
  private connected = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 3) {
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000); // Retry delay
      },
    });

    this.redis.on('connect', () => {
      console.log('[Cache] Connected to Redis');
      this.connected = true;
    });

    this.redis.on('error', (err: Error) => {
      console.error('[Cache] Redis error:', err.message);
      this.connected = false;
    });

    this.redis.on('close', () => {
      console.log('[Cache] Redis connection closed');
      this.connected = false;
    });

    // Connect immediately
    this.redis.connect().catch((err: Error) => {
      console.error('[Cache] Failed to connect to Redis:', err.message);
    });
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get a value from cache
   * @param key Cache key
   * @returns The cached value or undefined if not found
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.redis.get(key);
      if (value !== null) {
        console.log(`[Cache] HIT: ${key}`);
        return JSON.parse(value) as T;
      }
      console.log(`[Cache] MISS: ${key}`);
      return undefined;
    } catch (error) {
      console.error(`[Cache] Error getting key ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Set a value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds (optional, uses default if not provided)
   * @returns true if successful
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl ?? this.DEFAULT_TTL, serialized);
      console.log(`[Cache] SET: ${key} (TTL: ${ttl ?? this.DEFAULT_TTL}s)`);
      return true;
    } catch (error) {
      console.error(`[Cache] Error setting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a key from cache
   * @param key Cache key to delete
   * @returns Number of deleted entries (0 or 1)
   */
  async del(key: string): Promise<number> {
    try {
      const result = await this.redis.del(key);
      if (result > 0) {
        console.log(`[Cache] DEL: ${key}`);
      }
      return result;
    } catch (error) {
      console.error(`[Cache] Error deleting key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Delete multiple keys from cache
   * @param keys Array of cache keys to delete
   * @returns Number of deleted entries
   */
  async delMultiple(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    try {
      const result = await this.redis.del(...keys);
      console.log(`[Cache] DEL multiple: ${keys.length} keys, ${result} deleted`);
      return result;
    } catch (error) {
      console.error(`[Cache] Error deleting multiple keys:`, error);
      return 0;
    }
  }

  /**
   * Delete all keys matching a pattern
   * @param pattern Glob pattern to match (e.g., "docker:*")
   * @returns Number of deleted entries
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      const result = await this.redis.del(...keys);
      console.log(`[Cache] DEL pattern "${pattern}": ${result} keys deleted`);
      return result;
    } catch (error) {
      console.error(`[Cache] Error deleting pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  async flush(): Promise<void> {
    try {
      await this.redis.flushdb();
      console.log('[Cache] FLUSH: All keys cleared');
    } catch (error) {
      console.error('[Cache] Error flushing cache:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  async getStats(): Promise<{ hits: number; misses: number; keys: number; connected: boolean }> {
    try {
      const info = await this.redis.info('stats');
      const dbSize = await this.redis.dbsize();
      
      // Parse hits and misses from info
      const hitsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);
      
      return {
        hits: hitsMatch ? parseInt(hitsMatch[1], 10) : 0,
        misses: missesMatch ? parseInt(missesMatch[1], 10) : 0,
        keys: dbSize,
        connected: this.connected,
      };
    } catch (error) {
      console.error('[Cache] Error getting stats:', error);
      return { hits: 0, misses: 0, keys: 0, connected: this.connected };
    }
  }

  /**
   * Get all cache keys matching a pattern
   * @param pattern Glob pattern (default: "*")
   * @returns Array of matching cache keys
   */
  async keys(pattern = '*'): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      console.error('[Cache] Error getting keys:', error);
      return [];
    }
  }

  /**
   * Check if a key exists in cache
   * @param key Cache key
   * @returns true if key exists
   */
  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error(`[Cache] Error checking key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   * @param key Cache key
   * @returns TTL in seconds or -1 if key doesn't exist or has no TTL
   */
  async getTtl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      console.error(`[Cache] Error getting TTL for ${key}:`, error);
      return -1;
    }
  }

  /**
   * Gracefully close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Export singleton instance
export const cacheService = new CacheService();
