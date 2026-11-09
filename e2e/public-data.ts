import type { Page } from '@playwright/test';
import { catalog, profile } from '../src/test/fixtures';

/** Explicit Playwright-only module replacement; no fixture switch ships in Nova. */
export async function mockPublicData(page: Page) {
  await page.route('**/src/lib/roblox.ts', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `export * from '/src/lib/roblox.ts?actual';
      const catalog = ${JSON.stringify(catalog)};
      const profile = ${JSON.stringify(profile)};
      export async function robloxRequest(request, kind) {
        const control = window.publicDataTest || {};
        if (control.fail) throw {code: 'offline', message: 'Test connection is offline.'};
        if (request.action === 'lookupUsername') {
          await new Promise(r => setTimeout(r, request.username === 'Older' ? 600 : 30));
          (window.publicDataCompletions ||= []).push(request.username);
          return {...profile, username: request.username, displayName: request.username};
        }
        if (request.action === 'lookupUser') {
          if (control.slowUser) await new Promise(r => setTimeout(r,600));
          (window.publicDataCompletions ||= []).push('user');
          return profile;
        }
        if (request.action === 'searchUsers') {
          if(control.rateLimited) throw {code:'rateLimited',message:'Original rate-limit diagnostic',retryAfterSeconds:20};
          if(control.slowPage && request.cursor) await new Promise(r => setTimeout(r,600));
          (window.publicDataCompletions ||= []).push(request.cursor ? 'page':'search');
          return {users: [{id:request.cursor ? '2':'1', username:request.cursor ? 'Builder':'Roblox', displayName:request.cursor ? 'Builder':'Roblox', verified:false}], nextCursor: request.cursor ? null:'next-page', retryAfterSeconds:0};
        }
        if (kind === 'experience') {
          await new Promise(r => setTimeout(r,request.universeId === '1' ? 600 : 30));
          (window.universeCompletions ||= []).push(request.universeId);
          return {experience: catalog.experiences[request.universeId === '2' ? 1 : 0], warnings:[]};
        }
        return catalog;
      }`,
    }),
  );
}
