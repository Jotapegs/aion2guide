import type { Guide } from '../../src/core/guide'

/** Guia válido mínimo. Duas fases, três parts, níveis 1–45. */
export function makeGuide(): Guide {
  return {
    version: '1.0.0',
    source: 'fixture',
    legend: [
      { id: 'msq', label: 'Main Story Quest (MSQ)', marker: 'Yellow Arrows', color: '#d4a000', uiColor: '#f0c040' },
      { id: 'side', label: 'Side Quests', marker: 'Green Arrows', color: '#2e7d32', uiColor: '#5cc46a' },
      { id: 'seal', label: 'Seal Dungeons', marker: 'Orange Arrows', color: '#e65100', uiColor: '#ff8a3d' },
      { id: 'kisk', label: 'Kisks', marker: 'Black Arrows', color: '#000000', uiColor: '#c8d0e0' },
    ],
    downtime: ['Weapons (+5 max).', 'Accessories (+5 max).'],
    phases: [
      {
        id: 'phase-1',
        title: 'Phase 1',
        levelFrom: 1,
        levelTo: 9,
        parts: [
          {
            id: 'p1-1',
            title: 'Levels 1–9',
            note: null,
            map: null,
            actions: [{ id: 'p1-1-a1', text: 'Follow core MSQ', tag: 'msq', sub: [] }],
          },
        ],
      },
      {
        id: 'phase-2',
        title: 'Phase 2',
        levelFrom: 10,
        levelTo: 45,
        parts: [
          {
            id: 'p2-1',
            title: 'Part 1',
            note: 'You get your first lvl8 skills here!',
            map: { src: 'maps/image3.webp', width: 1258, height: 882 },
            actions: [
              { id: 'p2-1-a1', text: 'MSQ Push', tag: 'msq', sub: [] },
              {
                id: 'p2-1-a2',
                text: 'Seal DG Detour',
                tag: 'seal',
                sub: [{ id: 'p2-1-a2-s1', text: 'Do the 4 Seal dgs on the way', tag: null, sub: [] }],
              },
            ],
          },
          {
            id: 'p2-2',
            title: 'Part 2',
            note: null,
            map: null,
            actions: [{ id: 'p2-2-a1', text: 'Take the Kisks', tag: 'kisk', sub: [] }],
          },
        ],
      },
    ],
  }
}
