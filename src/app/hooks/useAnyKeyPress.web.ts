import { useEffect, useRef } from 'react';

import { domWindow } from '../../platform/webDom';

export function useAnyKeyPress(onKeyPress: () => void) {
  const handlerRef = useRef(onKeyPress);
  useEffect(() => {
    handlerRef.current = onKeyPress;
  });

  useEffect(() => {
    const onKeyDown = () => handlerRef.current();
    domWindow.addEventListener('keydown', onKeyDown);
    return () => domWindow.removeEventListener('keydown', onKeyDown);
  }, []);
}
