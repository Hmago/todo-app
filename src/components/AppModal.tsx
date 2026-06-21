import React, { useEffect } from 'react';
import { Modal, Platform, View, StyleSheet } from 'react-native';

// Lazy-load react-dom's createPortal only on web so native bundles aren't
// affected (mirrors Tooltip).
let createPortal: ((node: React.ReactNode, container: Element) => React.ReactNode) | null = null;
if (Platform.OS === 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    createPortal = require('react-dom').createPortal;
  } catch {
    createPortal = null;
  }
}

interface AppModalProps {
  visible: boolean;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  onRequestClose?: () => void;
  children: React.ReactNode;
}

/**
 * Drop-in replacement for React Native's `Modal`.
 *
 * On native it delegates to the platform `Modal`. On web it renders a
 * fixed-position overlay **portaled to `document.body`**.
 *
 * Why the portal (and not RN's Modal, nor a plain in-tree overlay)?
 *  - react-native-web's `Modal` installs a global focus-trap that intermittently
 *    swallows taps in an installed PWA (standalone display mode).
 *  - But rendering the overlay in-tree doesn't work either: the app shell sets
 *    `#root` and `#app-root` to `position: fixed`, so an in-tree `position:
 *    fixed` overlay becomes a fixed layer nested inside two more fixed
 *    ancestors — and iOS WebKit then breaks touch hit-testing on it (the modal
 *    renders but its buttons are dead). Portaling the overlay out to
 *    `document.body` escapes those fixed ancestors so taps land correctly,
 *    while keeping React context (theme, store) intact.
 */
export function AppModal({
  visible,
  transparent,
  animationType,
  onRequestClose,
  children,
}: AppModalProps) {
  const isWeb = Platform.OS === 'web';

  // Preserve the Escape-to-close behaviour the native Modal provides.
  useEffect(() => {
    if (!isWeb || !visible || !onRequestClose) return;
    const g: any = globalThis;
    const doc = g.document;
    if (!doc) return;
    const onKey = (e: any) => {
      if (e.key === 'Escape') onRequestClose();
    };
    doc.addEventListener('keyup', onKey, false);
    return () => doc.removeEventListener('keyup', onKey, false);
  }, [isWeb, visible, onRequestClose]);

  if (!isWeb) {
    return (
      <Modal
        visible={visible}
        transparent={transparent}
        animationType={animationType}
        onRequestClose={onRequestClose}
      >
        {children}
      </Modal>
    );
  }

  if (!visible) return null;
  const overlay = <View style={styles.fixedFill}>{children}</View>;
  // Portal out of the (fixed-positioned) app shell so iOS WebKit hit-tests the
  // overlay's buttons correctly. Fall back to in-tree if the portal isn't
  // available (e.g. document.body missing during SSR/first paint).
  if (createPortal && typeof document !== 'undefined' && document.body) {
    return createPortal(overlay, document.body) as any;
  }
  return overlay;
}

const styles = StyleSheet.create({
  fixedFill: {
    // `fixed` is a react-native-web value (not in RN's type union); cast to keep
    // the overlay anchored to the viewport above all app content.
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
});
