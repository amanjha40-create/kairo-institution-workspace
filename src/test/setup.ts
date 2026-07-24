import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

function createStorage() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

if (!("localStorage" in window) || !window.localStorage) {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: createStorage(),
  });
}

if (!("sessionStorage" in window) || !window.sessionStorage) {
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: createStorage(),
  });
}

afterEach(() => {
  cleanup();
  window.localStorage?.clear();
  window.sessionStorage?.clear();
  vi.unstubAllEnvs();
  vi.resetModules();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

Object.assign(window, {
  scrollTo: vi.fn(),
});

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});
