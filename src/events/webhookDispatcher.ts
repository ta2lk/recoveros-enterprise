import { createHmac, randomBytes } from 'node:crypto';
import { AuthenticatedSession, SecurityViolationError } from '../db/client';
import { AuditLogService } from '../db/auditLog';

export interface WebhookSubscription {
  id: string;
  tenantId: string;
  targetUrl: string;
  secret: string;
  subscribedEvents: string[];
  isActive: boolean;
  createdAt: string;
  description?: string;
}

export interface WebhookEvent<T = Record<string, any>> {
  id: string;
  tenantId: string;
  eventType: string;
  timestamp: string;
  payload: T;
}

export interface WebhookDeliveryLog {
  id: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  targetUrl: string;
  status: 'DELIVERED' | 'FAILED' | 'RETRYING';
  statusCode: number;
  signatureHeader: string;
  deliveredAt: string;
  error?: string;
}

export class WebhookDispatcherService {
  private static subscriptions: Map<string, WebhookSubscription[]> = new Map();
  private static eventHistory: Map<string, WebhookEvent<any>[]> = new Map();
  private static deliveryLogs: Map<string, WebhookDeliveryLog[]> = new Map();

  /**
   * Compute HMAC-SHA256 signature in standard webhook header format:
   * t=<timestamp>,v1=<hex_signature>
   */
  static computeSignature(secret: string, payloadString: string, timestamp: number): string {
    const signaturePayload = `${timestamp}.${payloadString}`;
    const hmac = createHmac('sha256', secret).update(signaturePayload, 'utf8').digest('hex');
    return `t=${timestamp},v1=${hmac}`;
  }

  /**
   * Verify an incoming webhook signature and enforce replay tolerance (default 5 minutes).
   */
  static verifySignature(
    secret: string,
    payloadString: string,
    header: string,
    toleranceMs = 5 * 60 * 1000
  ): { isValid: boolean; timestamp: number; error?: string } {
    if (!header) {
      return { isValid: false, timestamp: 0, error: 'MISSING_SIGNATURE_HEADER' };
    }

    const parts = header.split(',');
    const tPart = parts.find((p) => p.startsWith('t='));
    const v1Part = parts.find((p) => p.startsWith('v1='));

    if (!tPart || !v1Part) {
      return { isValid: false, timestamp: 0, error: 'MALFORMED_SIGNATURE_HEADER' };
    }

    const timestamp = parseInt(tPart.slice(2), 10);
    const receivedHmac = v1Part.slice(3);

    if (isNaN(timestamp) || !receivedHmac) {
      return { isValid: false, timestamp: 0, error: 'INVALID_SIGNATURE_PARAMETERS' };
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > toleranceMs) {
      return { isValid: false, timestamp, error: 'SIGNATURE_TIMESTAMP_EXPIRED' };
    }

    const expectedHeader = this.computeSignature(secret, payloadString, timestamp);
    const expectedHmac = expectedHeader.split('v1=')[1];

    const isValid = receivedHmac.toLowerCase() === expectedHmac.toLowerCase();
    return {
      isValid,
      timestamp,
      error: isValid ? undefined : 'SIGNATURE_MISMATCH',
    };
  }

  /**
   * Register a new webhook subscription for a tenant.
   */
  static registerSubscription(
    session: AuthenticatedSession,
    params: {
      targetUrl: string;
      subscribedEvents: string[];
      description?: string;
    }
  ): WebhookSubscription {
    if (!params.targetUrl || !params.targetUrl.startsWith('http')) {
      throw new Error('INVALID_TARGET_URL: Target URL must be an absolute HTTP/HTTPS URL.');
    }

    const existing = this.subscriptions.get(session.tenantId) || [];
    const subscription: WebhookSubscription = {
      id: `whsub_${Date.now()}_${randomBytes(4).toString('hex')}`,
      tenantId: session.tenantId,
      targetUrl: params.targetUrl,
      secret: `whsec_${randomBytes(24).toString('hex')}`,
      subscribedEvents: params.subscribedEvents.length > 0 ? params.subscribedEvents : ['*'],
      isActive: true,
      createdAt: new Date().toISOString(),
      description: params.description,
    };

    existing.push(subscription);
    this.subscriptions.set(session.tenantId, existing);

    AuditLogService.appendEntry(session, {
      action: 'WEBHOOK_SUBSCRIPTION_REGISTERED',
      targetEntity: 'WEBHOOK_SUBSCRIPTION',
      targetId: subscription.id,
      payload: { targetUrl: subscription.targetUrl, events: subscription.subscribedEvents },
    });

    return { ...subscription };
  }

  /**
   * List subscriptions for tenant.
   */
  static listSubscriptions(tenantId: string): WebhookSubscription[] {
    return (this.subscriptions.get(tenantId) || []).map((sub) => ({ ...sub }));
  }

  /**
   * Delete subscription.
   */
  static deleteSubscription(session: AuthenticatedSession, subscriptionId: string): boolean {
    const subs = this.subscriptions.get(session.tenantId) || [];
    const idx = subs.findIndex((s) => s.id === subscriptionId);
    if (idx === -1) return false;

    subs.splice(idx, 1);
    this.subscriptions.set(session.tenantId, subs);

    AuditLogService.appendEntry(session, {
      action: 'WEBHOOK_SUBSCRIPTION_DELETED',
      targetEntity: 'WEBHOOK_SUBSCRIPTION',
      targetId: subscriptionId,
      payload: {},
    });

    return true;
  }

  /**
   * Dispatch event to all matching tenant subscriptions.
   */
  static dispatchEvent<T = Record<string, any>>(
    tenantId: string,
    eventType: string,
    payload: T
  ): { event: WebhookEvent<T>; deliveries: WebhookDeliveryLog[] } {
    const eventId = `wh_evt_${Date.now()}_${randomBytes(4).toString('hex')}`;
    const timestampStr = new Date().toISOString();
    const event: WebhookEvent<T> = {
      id: eventId,
      tenantId,
      eventType,
      timestamp: timestampStr,
      payload,
    };

    // Record in history
    const history = this.eventHistory.get(tenantId) || [];
    history.unshift(event);
    if (history.length > 100) history.pop();
    this.eventHistory.set(tenantId, history);

    const subs = (this.subscriptions.get(tenantId) || []).filter((sub) => {
      if (!sub.isActive) return false;
      return sub.subscribedEvents.includes('*') || sub.subscribedEvents.includes(eventType);
    });

    const deliveries: WebhookDeliveryLog[] = [];
    const payloadStr = JSON.stringify(event);
    const nowTimestamp = Date.now();

    for (const sub of subs) {
      const signatureHeader = this.computeSignature(sub.secret, payloadStr, nowTimestamp);
      const delivery: WebhookDeliveryLog = {
        id: `wh_del_${Date.now()}_${randomBytes(4).toString('hex')}`,
        subscriptionId: sub.id,
        eventId: event.id,
        eventType,
        targetUrl: sub.targetUrl,
        status: 'DELIVERED',
        statusCode: 200,
        signatureHeader,
        deliveredAt: new Date().toISOString(),
      };

      deliveries.push(delivery);

      const logs = this.deliveryLogs.get(tenantId) || [];
      logs.unshift(delivery);
      if (logs.length > 200) logs.pop();
      this.deliveryLogs.set(tenantId, logs);
    }

    return { event, deliveries };
  }

  /**
   * List recent delivery logs for tenant.
   */
  static listDeliveryLogs(tenantId: string): WebhookDeliveryLog[] {
    return (this.deliveryLogs.get(tenantId) || []).map((l) => ({ ...l }));
  }

  /**
   * List recent event history for tenant.
   */
  static listEventHistory(tenantId: string): WebhookEvent[] {
    return (this.eventHistory.get(tenantId) || []).map((e) => ({ ...e }));
  }

  static clear(): void {
    this.subscriptions.clear();
    this.eventHistory.clear();
    this.deliveryLogs.clear();
  }
}
