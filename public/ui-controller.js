/* Blackjack UI Controller - DOM rendering, events, keyboard shortcuts */

document.addEventListener('DOMContentLoaded', () => {
  const game = new BlackjackGame();

  const $ = (id) => document.getElementById(id);
  const dealerCardsEl = $('dealer-cards');
  const playerCardsEl = $('player-cards');
  const dealerScoreEl = $('dealer-score');
  const playerScoreEl = $('player-score');
  const messageEl = $('message');
  const balanceEl = $('balance');
  const currentBetEl = $('current-bet');
  const betInput = $('bet-input');
  const dealBtn = $('deal-btn');
  const hitBtn = $('hit-btn');
  const standBtn = $('stand-btn');
  const doubleBtn = $('double-btn');
  const newRoundBtn = $('new-round-btn');
  const chipBtns = document.querySelectorAll('.chip-btn');

  function createCardEl(card, delay) {
    const el = document.createElement('div');
    el.className = `card ${card.faceUp ? card.color : ''} ${card.faceUp ? '' : 'face-down'}`;
    el.style.animationDelay = `${delay}ms`;
    if (card.faceUp) {
      el.innerHTML = `
        <span class="card-rank top">${card.rank}</span>
        <span class="card-suit">${card.suit}</span>
        <span class="card-rank bottom">${card.rank}</span>`;
    }
    return el;
  }

  function renderCards(hand, container) {
    container.innerHTML = '';
    hand.cards.forEach((card, i) => container.appendChild(createCardEl(card, i * 120)));
  }

  function updateUI() {
    renderCards(game.playerHand, playerCardsEl);
    renderCards(game.dealerHand, dealerCardsEl);

    // Score display - hide dealer hole card value during play
    playerScoreEl.textContent = game.playerHand.cards.length ? game.playerHand.score : '';
    if (game.gameState === 'playing' && !game.dealerHand.cards[1]?.faceUp) {
      dealerScoreEl.textContent = game.dealerHand.cards[0]?.value || '';
    } else {
      dealerScoreEl.textContent = game.dealerHand.cards.length ? game.dealerHand.score : '';
    }

    balanceEl.textContent = game.balance.toLocaleString();
    currentBetEl.textContent = game.currentBet.toLocaleString();
    messageEl.textContent = game.message;

    // Message color
    messageEl.className = 'message';
    if (/win|Blackjack/i.test(game.message)) messageEl.classList.add('win');
    else if (/lose|bust/i.test(game.message)) messageEl.classList.add('lose');
    else if (/push/i.test(game.message)) messageEl.classList.add('push');

    // Stats
    $('wins').textContent = game.stats.wins;
    $('losses').textContent = game.stats.losses;
    $('pushes').textContent = game.stats.pushes;

    // Toggle controls
    const isBetting = game.gameState === 'betting';
    const isPlaying = game.gameState === 'playing';
    const isOver = game.gameState === 'gameOver';
    $('betting-controls').style.display = isBetting ? 'flex' : 'none';
    $('game-controls').style.display = isPlaying ? 'flex' : 'none';
    newRoundBtn.style.display = isOver ? 'inline-block' : 'none';

    if (isPlaying) {
      doubleBtn.disabled = game.playerHand.cards.length !== 2 || game.currentBet > game.balance;
    }
  }

  // Chip buttons add to bet
  chipBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const cur = parseInt(betInput.value) || 0;
      betInput.value = Math.min(cur + parseInt(btn.dataset.value), game.balance);
    });
  });

  dealBtn.addEventListener('click', () => {
    const bet = parseInt(betInput.value);
    if (game.placeBet(bet)) {
      updateUI();
    } else {
      messageEl.textContent = 'Invalid bet!';
      messageEl.className = 'message lose';
    }
  });

  hitBtn.addEventListener('click', () => { game.hit(); updateUI(); });
  standBtn.addEventListener('click', () => { game.stand(); updateUI(); });
  doubleBtn.addEventListener('click', () => { game.doubleDown(); updateUI(); });

  newRoundBtn.addEventListener('click', () => {
    game.newRound();
    betInput.value = 100;
    updateUI();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target === betInput) return;
    const key = e.key.toLowerCase();
    if (game.gameState === 'playing') {
      if (key === 'h') { game.hit(); updateUI(); }
      if (key === 's') { game.stand(); updateUI(); }
      if (key === 'd') { game.doubleDown(); updateUI(); }
    }
    if (game.gameState === 'gameOver' && (key === 'enter' || key === ' ')) {
      game.newRound(); betInput.value = 100; updateUI();
    }
    if (game.gameState === 'betting' && key === 'enter') {
      dealBtn.click();
    }
  });

  // Initial state
  game.message = 'Place your bet to start!';
  betInput.value = 100;
  updateUI();
});
