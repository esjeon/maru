type StringKeys<T> = Extract<keyof T, string>;

interface CustomEventListener<T> {
  (evt: CustomEvent<T>): void;
}

interface CustomEventListenerObject<T> {
  handleEvent(object: CustomEvent<T>): void;
}

type CustomEventListenerClass<T> =
  | CustomEventListener<T>
  | CustomEventListenerObject<T>;

export class CustomEventTarget<EventMap> {
  private eventTarget: EventTarget;

  constructor() {
    this.eventTarget = new EventTarget();
  }

  public addEventListener<K extends StringKeys<EventMap>>(
    type: K,
    listener: CustomEventListenerClass<EventMap[K]>,
  ): void {
    // NOTE: intentional unsafe casting
    this.eventTarget.addEventListener(type, listener as any);
  }

  public removeEventListener<K extends StringKeys<EventMap>>(
    type: K,
    listener: CustomEventListenerClass<EventMap[K]>,
  ): void {
    // NOTE: intentional unsafe casting
    this.eventTarget.removeEventListener(type, listener as any);
  }

  public dispatchEvent<K extends StringKeys<EventMap>>(
    event: CustomEvent<EventMap[K]>,
  ): boolean {
    return this.eventTarget.dispatchEvent(event);
  }
}
