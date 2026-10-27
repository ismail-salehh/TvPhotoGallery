import React from 'react';

import type { Photo } from '../../src/api/types';
import { useI18n } from '../../src/app/hooks/useI18n';
import { renderInApp } from '../helpers/renderApp';

const photo = (title: string, createdAt = '2024-03-12T00:00:00Z'): Photo => ({
  id: 'p',
  albumId: '',
  title,
  imageUrl: '',
  thumbnailUrl: '',
  photographer: 'Ann Lee',
  width: 1,
  height: 1,
  createdAt,
});

async function i18n(language: 'en' | 'ar') {
  let value!: ReturnType<typeof useI18n>;
  function Probe() {
    value = useI18n();
    return null;
  }
  await renderInApp(<Probe />, language);
  return value;
}

describe('useI18n', () => {
  it('fills in a missing photo title in the UI language, at display time', async () => {
    expect((await i18n('en')).photoTitle(photo(''))).toBe('Photo by Ann Lee');
    expect((await i18n('ar')).photoTitle(photo(''))).toBe(
      'صورة من تصوير Ann Lee',
    );
  });

  it('shows Unsplash’s own title as it is, in either language', async () => {
    expect((await i18n('ar')).photoTitle(photo('A lake'))).toBe('A lake');
  });

  it('formats dates in the UI language', async () => {
    expect((await i18n('en')).formatDate('2024-03-12T00:00:00Z')).toBe(
      'March 12, 2024',
    );
    expect((await i18n('ar')).formatDate('2024-03-12T00:00:00Z')).toBe(
      '١٢ مارس ٢٠٢٤',
    );
  });
});
