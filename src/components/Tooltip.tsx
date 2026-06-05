import React, { useEffect, useRef, useState } from 'react';
import { View, Platform, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

// Lazy-load react-dom only on web so native bundles aren't affected.
let createPortal: ((node: React.ReactNode, container: Element) => React.ReactNode) | null = null;
if (Platform.OS === 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    createPortal = require('react-dom').createPortal;
  } catch {
    createPortal = null;
  }
}

type Placement = 'top' | 'bottom';

export interface TooltipProps {
  label: string;
  children: React.ReactNode;
  placement?: Placement;
  /** Delay in ms before the tooltip appears on hover. */
  delay?: number;
  /** Style applied to the wrapper View. The wrapper is non-interactive. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Hover tooltip for desktop / web targets. On native (iOS / Android) renders
 * just the children — tooltips aren't a hover-driven UX pattern on touch.
 *
 * The tooltip bubble is portaled to `document.body` so it never gets clipped
 * by ancestors that set `overflow: hidden` (rows, cards, scroll views). Keep
 * `accessibilityLabel` on the wrapped Pressable for screen readers.
 */
export function Tooltip({ label, children, placement = 'top', delay = 300, style }: TooltipProps) {
  if (Platform.OS !== 'web' || !label || !createPortal) {
    if (style) return <View style={style}>{children}</View>;
    return <>{children}</>;
  }
  return (
    <WebTooltip label={label} placement={placement} delay={delay} style={style}>
      {children}
    </WebTooltip>
  );
}

function WebTooltip({ label, children, placement, delay, style }: Required<Pick<TooltipProps, 'label' | 'placement' | 'delay'>> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  const wrapperRef = useRef<any>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number; placement: Placement } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const computePos = () => {
    const el = wrapperRef.current as HTMLElement | null;
    if (!el || typeof el.getBoundingClientRect !== 'function') return null;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: placement === 'top' ? rect.top : rect.bottom,
      placement,
    };
  };

  const show = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => {
      const p = computePos();
      if (!p) return;
      setPos(p);
      // Mount at opacity 0 first, then fade in on next frame so CSS transition triggers.
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => setVisible(true));
      } else {
        setVisible(true);
      }
    }, delay);
  };

  const hide = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    setVisible(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setPos(null), 140);
  };

  // RNW renders View → div on web; mouse events pass through to DOM. Cast keeps
  // TS happy since these aren't declared on RN's View type.
  const hoverProps: any = { onMouseEnter: show, onMouseLeave: hide };

  const bubbleStyle: any = pos
    ? {
        position: 'fixed',
        top: pos.placement === 'top' ? pos.y - 8 : pos.y + 8,
        left: pos.x,
        transform: pos.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        background: colors.text,
        color: colors.surface,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
        padding: '4px 8px',
        borderRadius: 6,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: 'opacity 120ms ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        userSelect: 'none',
      }
    : null;

  return (
    <>
      <View ref={wrapperRef} style={style} {...hoverProps}>
        {children}
      </View>
      {pos && createPortal && typeof document !== 'undefined'
        ? createPortal(React.createElement('div', { style: bubbleStyle }, label), document.body)
        : null}
    </>
  );
}
