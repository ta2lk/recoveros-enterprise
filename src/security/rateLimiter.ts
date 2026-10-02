/**
 * RecoverOS - Security Headers & Sliding-Window Rate Limiter
 * 
 * Rules:
 * 1. Security Headers: Strict CSP, HSTS, X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN.
 * 2. Rate Limiting per IP: Prevents brute force and denial of service.
 * 3. Rate Limiting per Tenant: Prevents resource hogging and ensures multi-tenant fairness.
 */

import { Request, Response, NextFunction } from 'express';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export class SlidingWindowRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(config: RateLimitConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
  }

  /**
   * Check if a key (IP or Tenant) is rate limited. Returns { allowed: boolean, remaining: number, retryAfterSec?: number }
   */
  check(key: string, now: number = Date.now()): { allowed: boolean; remaining: number; retryAfterSec?: number } {
    let timestamps = this.requests.get(key) || [];
    const windowStart = now - this.windowMs;

    // Filter out timestamps outside the active sliding window
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= this.maxRequests) {
      const oldestInWindow = timestamps[0];
      const retryAfterSec = Math.ceil((oldestInWindow + this.windowMs - now) / 1000);
      this.requests.set(key, timestamps);
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    timestamps.push(now);
    this.requests.set(key, timestamps);
    return {
      allowed: true,
      remaining: this.maxRequests - timestamps.length,
    };
  }

  clear() {
    this.requests.clear();
  }
}

// Global Limiter Instances
export const ipLimiter = new SlidingWindowRateLimiter({ windowMs: 60 * 1000, maxRequests: 100 });
export const tenantLimiter = new SlidingWindowRateLimiter({ windowMs: 60 * 1000, maxRequests: 500 });
export const authIpLimiter = new SlidingWindowRateLimiter({ windowMs: 60 * 1000, maxRequests: 10 }); // strict for login
export const portalIpLimiter = new SlidingWindowRateLimiter({ windowMs: 60 * 1000, maxRequests: 30 });

/**
 * Middleware: Apply Enterprise Security Headers (Helmet Equivalent)
 */
export function applySecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  // Strict Content Security Policy (CSP)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"
  );
  next();
}

/**
 * Middleware: Rate Limit by IP
 */
export function rateLimitByIp(limiter: SlidingWindowRateLimiter = ipLimiter) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const status = limiter.check(ip);

    res.setHeader('X-RateLimit-Limit', 100);
    res.setHeader('X-RateLimit-Remaining', status.remaining);

    if (!status.allowed) {
      res.setHeader('Retry-After', status.retryAfterSec || 60);
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED: Too many requests from this IP. Please wait before retrying.',
        retryAfterSeconds: status.retryAfterSec,
      });
    }

    next();
  };
}
