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
});
HTMLElement.prototype.scrollTo = () => {};
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};
