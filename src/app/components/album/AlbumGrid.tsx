import type { ComponentProps } from 'react';

import type { Album } from '../../../api/types';
import type { GridCardProps } from '../common/CardGrid';
import { CardGrid } from '../common/CardGrid';
import {
  AlbumCard,
  albumCardFocusId,
  albumCardHeight,
  isAlbumCardFocusId,
} from './AlbumCard';

type AlbumGridProps = Omit<
  ComponentProps<typeof CardGrid<Album>>,
  'items' | 'Card' | 'cardHeight' | 'focusId' | 'ownsFocusId' | 'onItemPress'
> & {
  albums: Album[];
  onAlbumPress?: (album: Album) => void;
};

const focusId = (album: Album) => albumCardFocusId(album.id);

function Card({ item, ...card }: GridCardProps<Album>) {
  return <AlbumCard album={item} {...card} />;
}

export function AlbumGrid({ albums, onAlbumPress, ...grid }: AlbumGridProps) {
  return (
    <CardGrid
      {...grid}
      items={albums}
      Card={Card}
      onItemPress={onAlbumPress}
      cardHeight={albumCardHeight}
      focusId={focusId}
      ownsFocusId={isAlbumCardFocusId}
    />
  );
}
