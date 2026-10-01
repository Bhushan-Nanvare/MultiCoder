import { describe, expect, it } from 'vitest';
import {
  canEditRoom,
  canReadRoom,
  canUseAiReview,
  canUsePlagiarism,
  withAccess,
} from '@/rooms/access.js';
import type { Room } from '@/rooms/types.js';

const room = (overrides: Partial<Room> = {}): Room => ({
  id: 'r1',
  name: 'Room',
  language: 'javascript',
  visibility: 'link-edit',
  mode: 'collaborate',
  ownerId: 'owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const owner = { userId: 'owner', isEditor: true };
const invited = { userId: 'candidate', isEditor: true };
const signedIn = { userId: 'stranger', isEditor: false };
const anonymous = { userId: null, isEditor: false };

describe('room visibility', () => {
  it('keeps a private room to the owner and invited editors', () => {
    const priv = room({ visibility: 'private' });
    expect(canReadRoom(priv, owner)).toBe(true);
    expect(canReadRoom(priv, invited)).toBe(true);
    expect(canReadRoom(priv, signedIn)).toBe(false);
    expect(canReadRoom(priv, anonymous)).toBe(false);
  });

  it('lets anyone read a link-view room but only editors write to it', () => {
    const view = room({ visibility: 'link-view' });
    expect(canReadRoom(view, anonymous)).toBe(true);
    expect(canEditRoom(view, signedIn)).toBe(false);
    expect(canEditRoom(view, invited)).toBe(true);
  });

  it('lets any signed-in user edit a link-edit room, but never anonymous', () => {
    expect(canEditRoom(room(), signedIn)).toBe(true);
    expect(canEditRoom(room(), anonymous)).toBe(false);
  });
});

describe('room modes', () => {
  it('shares AI review with everyone signed in while collaborating', () => {
    expect(canUseAiReview(room(), owner)).toBe(true);
    expect(canUseAiReview(room(), invited)).toBe(true);
    expect(canUseAiReview(room(), signedIn)).toBe(true);
    expect(canUseAiReview(room(), anonymous)).toBe(false);
  });

  it('has no plagiarism check at all in a collaborate room', () => {
    // Teammates edit the same files, so comparing them would flag the team.
    expect(canUsePlagiarism(room(), owner)).toBe(false);
    expect(canUsePlagiarism(room(), invited)).toBe(false);
  });

  it('keeps AI review from the candidate in an assessment room', () => {
    const exam = room({ mode: 'assessment' });
    expect(canUseAiReview(exam, owner)).toBe(true);
    expect(canUseAiReview(exam, invited)).toBe(false);
    expect(canUseAiReview(exam, signedIn)).toBe(false);
  });

  it('offers the plagiarism check only to the owner of an assessment room', () => {
    const exam = room({ mode: 'assessment' });
    expect(canUsePlagiarism(exam, owner)).toBe(true);
    expect(canUsePlagiarism(exam, invited)).toBe(false);
    expect(canUsePlagiarism(exam, anonymous)).toBe(false);
  });

  it('reports the same decisions to the client through withAccess', () => {
    const exam = room({ mode: 'assessment' });
    expect(withAccess(exam, invited)).toMatchObject({
      canUseAiReview: false,
      canUsePlagiarism: false,
      isOwner: false,
    });
    expect(withAccess(exam, owner)).toMatchObject({
      canUseAiReview: true,
      canUsePlagiarism: true,
      isOwner: true,
      canDelete: true,
    });
  });
});
