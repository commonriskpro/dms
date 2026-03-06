type Handler<T = unknown> = (payload: T) => void | Promise<void>;

const registry = new Map<string, Handler<unknown>[]>();

export function emit<T>(eventName: string, payload: T): void {
  const handlers = registry.get(eventName);
  if (!handlers?.length) return;
  for (const h of handlers) {
    try {
      const result = h(payload as unknown);
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch((err) => console.error(`[events] ${eventName} handler error:`, err));
      }
    } catch (err) {
      console.error(`[events] ${eventName} handler error:`, err);
    }
  }
}

export function register<T>(eventName: string, handler: Handler<T>): void {
  const list = registry.get(eventName) ?? [];
  list.push(handler as Handler<unknown>);
  registry.set(eventName, list);
}
