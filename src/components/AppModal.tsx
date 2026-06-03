import React, { useEffect } from 'react';
import { Modal, Platform, View, StyleSheet } from 'react-native';

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
 * On native it delegates to the platform `Modal`. On web it renders an in-tree,
 * fixed-position overlay instead. react-native-web's `Modal` portals into
 * `document.body` and installs a global focus-trap, which intermittently
 * swallows taps in an installed PWA (standalone display mode) — so on web we
 * avoid it entirely and just render the content as a top-most fixed layer.
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
  return <View style={styles.fixedFill}>{children}</View>;
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
