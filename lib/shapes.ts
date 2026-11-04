/** Tracés des symboles de points, dans un carré 0..1 (réutilisés par l'export SVG). */
export function shapePath(shape: string): [number, number][] | null {
  switch (shape) {
    case 'square':
      return [[0.15, 0.15], [0.85, 0.15], [0.85, 0.85], [0.15, 0.85]];
    case 'triangle':
      return [[0.5, 0.1], [0.92, 0.85], [0.08, 0.85]];
    case 'diamond':
      return [[0.5, 0.05], [0.95, 0.5], [0.5, 0.95], [0.05, 0.5]];
    case 'star': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.2 : 0.47;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push([0.5 + r * Math.cos(a), 0.53 + r * Math.sin(a)]);
      }
      return pts;
    }
    case 'cross':
      return [
        [0.38, 0.08], [0.62, 0.08], [0.62, 0.38], [0.92, 0.38], [0.92, 0.62], [0.62, 0.62],
        [0.62, 0.92], [0.38, 0.92], [0.38, 0.62], [0.08, 0.62], [0.08, 0.38], [0.38, 0.38],
      ];
    case 'arrowhead':
      return [[0.5, 0.0], [0.92, 0.9], [0.5, 0.68], [0.08, 0.9]];
    case 'tick':
      return [[0.44, 0.0], [0.56, 0.0], [0.56, 1], [0.44, 1]].map(([x, y]) => [y, x]) as [number, number][];
    default:
      return null;
  }
}

