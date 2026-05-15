import { EventEmitter } from 'events';
import type { SessionStreamEvent } from './types';

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

export function publishSessionEvent(event: SessionStreamEvent): void {
  emitter.emit(event.sessionId, event);
}

export function subscribeSessionEvents(sessionId: string, listener: (event: SessionStreamEvent) => void): () => void {
  emitter.on(sessionId, listener);
  return () => emitter.off(sessionId, listener);
}

export function createSessionEvent(event: Omit<SessionStreamEvent, 'timestamp'>): SessionStreamEvent {
  return { ...event, timestamp: new Date().toISOString() };
}
