export class TokenBucket {
    tokens: number;
    lastRefill: number;
  
    constructor(tokens: number, lastRefill: number) {
      this.tokens = tokens;
      this.lastRefill = lastRefill;
    }
  
    static fromRedis(data: Record<string, string>): TokenBucket | null {
      if (!data || Object.keys(data).length === 0) return null;
      
      return new TokenBucket(
        parseFloat(data.tokens),
        parseInt(data.lastRefill, 10),
      );
    }
  }