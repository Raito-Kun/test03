/* UI Controller - manages 4 parallel game tables with focus-based keyboard routing */

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('tables-grid');
  const tables = [];
  let focusedIndex = 0;

  function setFocus(index) {
    tables.forEach((t, i) => t.el.classList.toggle('focused', i === index));
    focusedIndex = index;
  }

  // Create 4 independent game tables (each runs its own BlackjackGame instance)
  for (let i = 0; i < 4; i++) {
    const renderer = new TableRenderer(i, grid);
    renderer.onFocus = setFocus;
    tables.push(renderer);
  }

  // Focus first table by default
  setFocus(0);

  // Global keyboard shortcuts routed to the focused table
  document.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('bet-input')) return;
    const key = e.key.toLowerCase();

    // Tab cycles through tables
    if (key === 'tab') {
      e.preventDefault();
      setFocus((focusedIndex + (e.shiftKey ? 3 : 1)) % 4);
      return;
    }

    // Number keys 1-4 jump to specific table
    if (['1', '2', '3', '4'].includes(key) && !e.ctrlKey && !e.altKey) {
      setFocus(parseInt(key) - 1);
      return;
    }

    // Route game keys to focused table
    tables[focusedIndex].handleKey(key);
  });
});
