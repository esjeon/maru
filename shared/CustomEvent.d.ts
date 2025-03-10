// XXX: This is necessary to provide missing CustomEvent declaration in the context of Node.js.
//      Node.js does provide CustomEvent, but `@type/node` doesn't provide the signature.
//
//      Note that this will likely conflict with the DOM signature.

declare class CustomEvent<T = any> extends Event {
  detail: T;
  constructor(typeArg: string, eventInitDict?: CustomEventInit<T>);
}

interface CustomEventInit<T = any> extends EventInit {
  detail?: T;
}
