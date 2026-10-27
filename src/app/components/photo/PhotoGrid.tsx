import type { ComponentProps } from 'react';

import type { Photo } from '../../../api/types';
import type { GridCardProps } from '../common/CardGrid';
import { CardGrid } from '../common/CardGrid';
import {
  isPhotoCardFocusId,
  PhotoCard,
  photoCardFocusId,
  photoCardHeight,
} from './PhotoCard';

type PhotoGridProps = Omit<
  ComponentProps<typeof CardGrid<Photo>>,
  'items' | 'Card' | 'cardHeight' | 'focusId' | 'ownsFocusId' | 'onItemPress'
> & {
  photos: Photo[];
  onPhotoPress?: (photo: Photo) => void;
};

const focusId = (photo: Photo) => photoCardFocusId(photo.id);

function Card({ item, ...card }: GridCardProps<Photo>) {
  return <PhotoCard photo={item} {...card} />;
}

export function PhotoGrid({ photos, onPhotoPress, ...grid }: PhotoGridProps) {
  return (
    <CardGrid
      {...grid}
      items={photos}
      Card={Card}
      onItemPress={onPhotoPress}
      cardHeight={photoCardHeight}
      focusId={focusId}
      ownsFocusId={isPhotoCardFocusId}
    />
  );
}
