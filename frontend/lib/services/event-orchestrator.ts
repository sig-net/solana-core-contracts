import { ChainSignaturesContract } from '@/lib/contracts/chain-signatures-contract';
import type { EventPromises } from '@/lib/types/chain-signatures.types';
import { SERVICE_CONFIG } from '@/lib/constants/service.config';

export interface EventSubscription {
  requestId: string;
  promises: EventPromises;
  subscribers: number;
  createdAt: number;
}

export interface EventSubscriptionOptions {
  timeout?: number; // Timeout in milliseconds
}

/**
 * EventOrchestrator centralizes event management for chain signatures,
 * providing deduplication, error handling, and cleanup management.
 */
export class EventOrchestrator {
  private subscriptions = new Map<string, EventSubscription>();
  private readonly CLEANUP_INTERVAL = SERVICE_CONFIG.TIMEOUTS.CLEANUP_INTERVAL;

  constructor(private chainSignaturesContract: ChainSignaturesContract) {
    // Start periodic cleanup of expired subscriptions
    this.startPeriodicCleanup();
  }

  /**
   * Subscribe to events for a request ID. If a subscription already exists,
   * increment the subscriber count and return the existing promises.
   */
  async subscribe(
    requestId: string,
    options: EventSubscriptionOptions = {},
  ): Promise<EventPromises> {
    const existingSubscription = this.subscriptions.get(requestId);

    if (existingSubscription) {
      // Increment subscriber count for existing subscription
      existingSubscription.subscribers++;
      console.log(
        `Reusing subscription for ${requestId}, subscribers: ${existingSubscription.subscribers}`,
      );
      return existingSubscription.promises;
    }

    // Create new subscription
    const promises = this.createEventSubscription(requestId, options);
    const subscription: EventSubscription = {
      requestId,
      promises,
      subscribers: 1,
      createdAt: Date.now(),
    };

    this.subscriptions.set(requestId, subscription);
    console.log(`Created new subscription for ${requestId}`);

    return promises;
  }

  /**
   * Unsubscribe from events for a request ID. Decrements subscriber count
   * and cleans up if no more subscribers remain.
   */
  unsubscribe(requestId: string): void {
    const subscription = this.subscriptions.get(requestId);

    if (!subscription) {
      console.warn(`No subscription found for request ID: ${requestId}`);
      return;
    }

    subscription.subscribers--;
    console.log(
      `Unsubscribed from ${requestId}, remaining subscribers: ${subscription.subscribers}`,
    );

    if (subscription.subscribers <= 0) {
      this.cleanupSubscription(requestId);
    }
  }

  /**
   * Force cleanup of a specific subscription regardless of subscriber count
   */
  forceCleanup(requestId: string): void {
    this.cleanupSubscription(requestId);
  }

  /**
   * Get active subscription count for monitoring
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get subscription details for a request ID
   */
  getSubscription(requestId: string): EventSubscription | undefined {
    return this.subscriptions.get(requestId);
  }

  /**
   * Create event subscription without timeout handling
   */
  private createEventSubscription(
    requestId: string,
    options: EventSubscriptionOptions,
  ): EventPromises {
    // Setup event listeners without any timeouts
    const eventPromises =
      this.chainSignaturesContract.setupEventListeners(requestId);

    const enhancedCleanup = () => {
      try {
        eventPromises.cleanup();
      } catch (error) {
        console.error(`Error during event cleanup for ${requestId}:`, error);
      }
    };

    return {
      signature: eventPromises.signature,
      readRespond: eventPromises.readRespond,
      cleanup: enhancedCleanup,
    };
  }

  /**
   * Clean up a specific subscription
   */
  private cleanupSubscription(requestId: string): void {
    const subscription = this.subscriptions.get(requestId);

    if (subscription) {
      try {
        subscription.promises.cleanup();
        console.log(`Cleaned up subscription for ${requestId}`);
      } catch (error) {
        console.error(
          `Error cleaning up subscription for ${requestId}:`,
          error,
        );
      }

      this.subscriptions.delete(requestId);
    }
  }

  /**
   * Start periodic cleanup of expired subscriptions
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expiredRequestIds: string[] = [];

      for (const [requestId, subscription] of this.subscriptions) {
        // Clean up subscriptions older than 2 hours
        if (
          now - subscription.createdAt >
          SERVICE_CONFIG.TIMEOUTS.MAX_SUBSCRIPTION_AGE
        ) {
          expiredRequestIds.push(requestId);
        }
      }

      for (const requestId of expiredRequestIds) {
        console.log(`Auto-cleaning expired subscription: ${requestId}`);
        this.cleanupSubscription(requestId);
      }

      if (expiredRequestIds.length > 0) {
        console.log(
          `Cleaned up ${expiredRequestIds.length} expired subscriptions`,
        );
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Manual cleanup of all subscriptions (useful for shutdown)
   */
  cleanup(): void {
    console.log(`Cleaning up all ${this.subscriptions.size} subscriptions`);

    for (const [requestId] of this.subscriptions) {
      this.cleanupSubscription(requestId);
    }
  }
}
