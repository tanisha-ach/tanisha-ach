const PATHS = {
  brush: 'M18.4 2.6a2 2 0 0 1 2.9 2.9L12 14.8 9.2 12zM8 13.5l2.5 2.5c-.4 2.6-2.3 4.5-5.5 4.5H3c1.2-1 1.5-2.2 1.6-3.5C4.8 15 6.2 13.6 8 13.5z',
  bucket: 'M5 11 12 4l7 7-7 7zM12 4V2M19.5 15s1.5 2 1.5 3a1.5 1.5 0 0 1-3 0c0-1 1.5-3 1.5-3zM5 11h14',
  picker: 'm14 6 4 4M17.5 2.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4zM3 21l3-3',
  mirror: 'M12 3v18M8 7 4 12l4 5zM16 7l4 5-4 5z',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'm15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  left: 'M15 6l-6 6 6 6',
  right: 'm9 6 6 6-6 6',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  flip: 'M12 3v18M3 7l6 5-6 5zM21 7l-6 5 6 5z',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  image: 'M4 5h16v14H4zM4 15l4-4 5 5M14 13l2-2 4 4M15.5 8.5h.01',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  rotate: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  close: 'M6 6l12 12M18 6 6 18',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
};

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
