// Icon keys shared by the API and the client. The API only ever stores a key
// (`iconKey`); the SVG path data lives in the frontend icon registry, which
// mirrors this list. Paths here are the same ones the design board uses, kept
// so seeds and AI responses can be validated against a closed set.

export const ICON_KEYS = [
  'tea',
  'cig',
  'rick',
  'lunch',
  'data',
  'coffee',
  'bag',
  'bill',
  'grocery',
  'medicine',
  'fuel',
  'phone',
  'gift',
  'home',
];

export const DEFAULT_ICON_KEY = 'bag';

export const isValidIconKey = (key) => ICON_KEYS.includes(key);

// The subset carried over verbatim from Tally.dc.html, so seeded tiles render
// identically to the design board.
export const ICON_PATHS = {
  tea: 'M6 9h10v6a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V9ZM16 10.5h1.4a2.3 2.3 0 0 1 0 4.6H16M9.2 6c0-1 1-1.2 1-2.3M12.8 6c0-1 1-1.2 1-2.3',
  cig: 'M3 14.5h13.5v4H3zM18.5 14.5H21v4h-2.5zM17.6 10.6c1.6-.8 2-1.7 2-3.6M14.2 10.6c1.6-.8 2-1.7 2-3.6',
  rick: 'M4 17a2.4 2.4 0 1 0 4.8 0A2.4 2.4 0 0 0 4 17M15.2 17a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 0 0-4.8 0M6.8 15V9.2A4.2 4.2 0 0 1 11 5h.6a5 5 0 0 1 5 5V15M6.8 10h9.8',
  lunch: 'M3.4 12h17.2a8.6 8.6 0 0 1-17.2 0ZM2 12h20M9.2 8c0-1 1-1.3 1-2.3M13 8c0-1 1-1.3 1-2.3',
  data: 'M4 19v-3M9.3 19v-7M14.6 19V8M20 19V4',
  coffee: 'M6 8.4h12l-1.2 10.8a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8ZM4.6 5h14.8v3.4H4.6zM9.8 2.4v1.4M14.2 2.4v1.4',
  bag: 'M6 8h12l-1 12.5H7ZM9 8V6.2A3 3 0 0 1 15 6.2V8',
  bill: 'M5 4h14v16l-2.3-1.6L14.4 20 12 18.4 9.6 20l-2.3-1.6L5 20ZM9 9h6M9 13h4',
};
