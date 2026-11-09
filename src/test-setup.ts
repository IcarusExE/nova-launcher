import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 5000 });

Object.defineProperty(globalThis, 'localStorage', {
  value: window.localStorage,
  configurable: true,
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.accent;
});
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }),
});
HTMLElement.prototype.scrollTo = () => {};
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};

HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open');
};
