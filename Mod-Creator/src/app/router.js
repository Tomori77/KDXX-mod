import { getState, dispatch } from "./store.js";
import { setUi } from "./actions.js";

const listeners = new Set();

export function getRoute() {
  return getState().ui.activeDomain;
}

export function navigate(domain) {
  const next = domain === undefined ? null : domain;
  const previous = getRoute();
  if (previous === next) {
    return next;
  }
  dispatch(setUi({ activeDomain: next }));
  for (const fn of Array.from(listeners)) {
    fn(next);
  }
  return next;
}

export function onRoute(fn) {
  if (typeof fn !== "function") {
    throw new Error("onRoute: 需要函数");
  }
  listeners.add(fn);
  return function unsubscribe() {
    listeners.delete(fn);
  };
}
