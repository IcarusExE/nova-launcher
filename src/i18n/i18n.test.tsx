import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import {
  resources,
  translate,
  detectLocale,
  resolveLocale,
  formatDate,
  relativeTime,
} from './core';
import { I18nProvider, useI18n } from './index';
import { LocalizedError } from '../components/LocalizedError';
import type { MessageKey } from './types';

it('has complete English/Turkish resources with identical placeholders and plural forms', () => {
  expect(Object.keys(resources.tr).sort()).toEqual(
    Object.keys(resources.en).sort(),
  );
  const placeholders = (value: string) =>
    [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(resources.en) as MessageKey[]) {
    const en = resources.en[key],
      tr = resources.tr[key];
    expect(typeof tr).toBe(typeof en);
    for (const form of ['one', 'other'] as const) {
      const english = typeof en === 'string' ? en : en[form];
      const turkish = typeof tr === 'string' ? tr : tr[form];
      expect(turkish.trim(), key).not.toBe('');
      expect(placeholders(turkish), key).toEqual(placeholders(english));
      const params = Object.fromEntries(
        placeholders(english).map((name) => [
          name,
          name === 'count' ? 2 : 'Test',
        ]),
      );
      expect(translate('tr', key, params)).not.toMatch(/\{\w+\}/);
    }
  }
  expect(translate('en', 'games.count', { count: 1 })).toBe('1 game');
  expect(translate('en', 'games.count', { count: 2 })).toBe('2 games');
  expect(translate('tr', 'games.count', { count: 2 })).toBe('2 oyun');
});

it('guards owned JSX text and accessible labels against untranslated additions', () => {
  const files = [
    'src/App.tsx',
    ...['src/pages', 'src/components'].flatMap((dir) =>
      readdirSync(dir).map((name) => `${dir}/${name}`),
    ),
  ];
  const proper = new Set([
    'Nova Launcher',
    'Nova',
    'nova',
    'LAUNCHER',
    'Roblox',
    'v0.1.0',
    '0.1.0',
    'Ctrl K',
    'Türkçe',
    'English',
  ]);
  const missed: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    expect(source, `${file}: locale must not change React keys`).not.toMatch(
      /key=\{[^}]*\bt\(/,
    );
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const walk = (node: ts.Node) => {
      if (ts.isJsxText(node)) {
        const text = node.text.replace(/\s+/g, ' ').trim();
        if (/[A-Za-z]/.test(text) && !proper.has(text))
          missed.push(`${file}: ${text}`);
      }
      if (
        ts.isJsxAttribute(node) &&
        ['aria-label', 'title', 'placeholder', 'description', 'label'].includes(
          node.name.getText(ast),
        ) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        !proper.has(node.initializer.text)
      )
        missed.push(`${file}: ${node.initializer.text}`);
      ts.forEachChild(node, walk);
    };
    walk(ast);
  }
  expect(missed).toEqual([]);
});

it('detects primary OS/browser locales and honors explicit overrides', () => {
  for (const value of ['tr', 'tr-TR', 'TR_tr.UTF-8', 'tr_TR.UTF-8'])
    expect(detectLocale([value])).toBe('tr');
  for (const values of [['en-US', 'tr'], ['de-DE'], ['C.UTF-8'], []])
    expect(detectLocale(values)).toBe('en');
  expect(resolveLocale('en', 'tr')).toBe('en');
  expect(resolveLocale('tr', 'en')).toBe('tr');
  expect(resolveLocale('system', 'tr')).toBe('tr');
  expect(formatDate('tr', Date.UTC(2026, 10, 9))).toBe(
    new Intl.DateTimeFormat('tr', { dateStyle: 'medium' }).format(
      Date.UTC(2026, 10, 9),
    ),
  );
  expect(relativeTime('tr', 1000, 61000)).toBe(
    new Intl.RelativeTimeFormat('tr', { numeric: 'auto' }).format(-1, 'minute'),
  );
});

function Probe() {
  const { t } = useI18n();
  return <h1>{t('Settings')}</h1>;
}
it('updates system language without remounting and keeps manual override authoritative', () => {
  const langs = vi
    .spyOn(navigator, 'languages', 'get')
    .mockReturnValue(['tr-TR']);
  const view = render(
    <I18nProvider preference="system" loaded>
      <Probe />
    </I18nProvider>,
  );
  const heading = screen.getByRole('heading', { name: 'Ayarlar' });
  expect(document.documentElement.lang).toBe('tr');
  langs.mockReturnValue(['en-US']);
  act(() => window.dispatchEvent(new Event('languagechange')));
  expect(screen.getByRole('heading', { name: 'Settings' })).toBe(heading);
  view.rerender(
    <I18nProvider preference="tr" loaded>
      <Probe />
    </I18nProvider>,
  );
  act(() => window.dispatchEvent(new Event('languagechange')));
  expect(screen.getByRole('heading', { name: 'Ayarlar' })).toBe(heading);
  langs.mockRestore();
});

describe('localized errors retain diagnostics rather than translating remote text', () => {
  it('localizes a parameterized rate limit and leaves the original diagnostic untouched', () => {
    render(
      <I18nProvider preference="tr" loaded>
        <LocalizedError
          error={{
            code: 'rateLimited',
            message: 'Original upstream diagnostic',
            retryAfterSeconds: 23,
          }}
        />
      </I18nProvider>,
    );
    expect(screen.getByText(/23 saniye sonra/)).toBeVisible();
    expect(screen.getByText('Original upstream diagnostic')).not.toBeVisible();
    expect(screen.getByText('Teknik ayrıntılar')).toBeVisible();
    expect(screen.getByText('rateLimited')).not.toBeVisible();
  });
  it('uses a localized fallback for unknown errors, preserving their text only in diagnostics', () => {
    render(
      <I18nProvider preference="tr" loaded>
        <LocalizedError
          error={{
            code: 'new-server-code',
            message: 'Not an application translation',
          }}
        />
      </I18nProvider>,
    );
    expect(
      screen.getByText(
        'Roblox veri hizmeti kullanılamıyor. Daha sonra tekrar dene.',
      ),
    ).toBeVisible();
    expect(
      screen.getByText('Not an application translation'),
    ).not.toBeVisible();
  });
});
