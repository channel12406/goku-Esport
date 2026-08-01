// Rate limiter simple pour protéger contre les abus
// Stocke les tentatives en mémoire avec expiration automatique

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Nettoie les entrées expirées périodiquement
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Nettoyage chaque minute

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  constructor(private config: RateLimitConfig) {}

  check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = rateLimitStore.get(identifier);

    if (!entry || now > entry.resetTime) {
      // Nouvelle fenêtre ou fenêtre expirée
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + this.config.windowMs,
      };
      rateLimitStore.set(identifier, newEntry);
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: newEntry.resetTime,
      };
    }

    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  reset(identifier: string): void {
    rateLimitStore.delete(identifier);
  }
}

// Rate limiters préconfigurés pour différents cas d'usage
export const rateLimiters = {
  // Transferts PXP : 10 par minute
  pxpTransfer: new RateLimiter({ maxRequests: 10, windowMs: 60000 }),

  // Lucky wheel : 20 par heure
  luckyWheel: new RateLimiter({ maxRequests: 20, windowMs: 3600000 }),

  // Inscriptions tournoi : 5 par minute
  tournamentRegistration: new RateLimiter({ maxRequests: 5, windowMs: 60000 }),

  // Création de tournois : 5 par heure
  tournamentCreation: new RateLimiter({ maxRequests: 5, windowMs: 3600000 }),

  // Demandes de statut créateur : 2 par heure
  creatorRequest: new RateLimiter({ maxRequests: 2, windowMs: 3600000 }),

  // Admin actions : 30 par minute
  adminActions: new RateLimiter({ maxRequests: 30, windowMs: 60000 }),

  // Auth : 5 par minute
  auth: new RateLimiter({ maxRequests: 5, windowMs: 60000 }),
};

// Fonction utilitaire pour vérifier le rate limit avec erreur
export function checkRateLimit(
  limiter: RateLimiter,
  identifier: string,
  customMessage?: string,
): void {
  const result = limiter.check(identifier);

  if (!result.allowed) {
    const message = customMessage || "Trop de requêtes. Réessaie plus tard.";
    const resetInSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);
    throw new Error(`${message} Réessaie dans ${resetInSeconds} secondes.`);
  }
}
