/* Table Renderer - creates and manages DOM for one independent Blackjack table */

const PLAYER_COLORS = ['#3498db', '#e74c3c', '#2ecc71', '#9b59b6'];
const PLAYER_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

class TableRenderer {
  constructor(index, container) {
    this.index = index;
    this.game = new BlackjackGame();
    this.onFocus = null;
    this.el = document.createElement('div');
    this.el.className = 'table-panel';
    this.el.dataset.index = index;
    this.el.style.setProperty('--accent', PLAYER_COLORS[index]);
    this.buildDOM();
    container.appendChild(this.el);
    this.refs = {};
    this.el.querySelectorAll('[data-el]').forEach(n => { this.refs[n.dataset.el] = n; });
    this.bindEvents();
    this.game.message = 'Place your bet!';
    this.render();
  }

  buildDOM() {
    this.el.innerHTML = `
      <div class="panel-head">
        <span class="p-name">${PLAYER_NAMES[this.index]}</span>
        <span class="p-stats">
          W:<span data-stat="wins">0</span>
          L:<span data-stat="losses">0</span>
          T:<span data-stat="pushes">0</span>
        </span>
      </div>
      <div class="felt">
        <div class="hand-area">
          <div class="hand-label">Dealer <span data-el="d-score" class="score-badge"></span></div>
          <div data-el="d-cards" class="card-row"></div>
        </div>
        <div data-el="msg" class="msg"></div>
        <div class="hand-area">
          <div data-el="p-cards" class="card-row"></div>
          <div class="hand-label">You <span data-el="p-score" class="score-badge"></span></div>
        </div>
      </div>
      <div class="ctrl">
        <div class="bal-row">
          <span>$<span data-el="balance">1,000</span></span>
          <span>Bet: $<span data-el="bet">0</span></span>
        </div>
        <div data-el="bet-phase" class="ctrl-row">
          <div class="chip-group">
            <button class="chip" data-val="10">10</button>
            <button class="chip" data-val="25">25</button>
            <button class="chip" data-val="50">50</button>
            <button class="chip" data-val="100">100</button>
          </div>
          <input type="number" data-el="bet-input" class="bet-input" value="100" min="1">
          <button data-el="deal-btn" class="btn btn-gold">Deal</button>
        </div>
        <div data-el="play-phase" class="ctrl-row" style="display:none">
          <button data-el="hit-btn" class="btn btn-blue">Hit</button>
          <button data-el="stand-btn" class="btn btn-red">Stand</button>
          <button data-el="dbl-btn" class="btn btn-purple">Dbl</button>
        </div>
        <button data-el="next-btn" class="btn btn-gold btn-full" style="display:none">New Round</button>
      </div>`;
  }

  bindEvents() {
    this.el.addEventListener('click', () => { if (this.onFocus) this.onFocus(this.index); });

    this.el.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cur = parseInt(this.refs['bet-input'].value) || 0;
        this.refs['bet-input'].value = Math.min(cur + parseInt(btn.dataset.val), this.game.balance);
      });
    });

    this.refs['deal-btn'].addEventListener('click', (e) => {
      e.stopPropagation();
      const bet = parseInt(this.refs['bet-input'].value);
      if (this.game.placeBet(bet)) { this.render(); }
      else { this.refs.msg.textContent = 'Invalid bet!'; this.refs.msg.className = 'msg lose'; }
    });

    this.refs['hit-btn'].addEventListener('click', (e) => { e.stopPropagation(); this.game.hit(); this.render(); });
    this.refs['stand-btn'].addEventListener('click', (e) => { e.stopPropagation(); this.game.stand(); this.render(); });
    this.refs['dbl-btn'].addEventListener('click', (e) => { e.stopPropagation(); this.game.doubleDown(); this.render(); });

    this.refs['next-btn'].addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.newRound();
      this.refs['bet-input'].value = 100;
      this.render();
    });
  }

  handleKey(key) {
    const g = this.game;
    if (g.gameState === 'playing') {
      if (key === 'h') { g.hit(); this.render(); }
      if (key === 's') { g.stand(); this.render(); }
      if (key === 'd') { g.doubleDown(); this.render(); }
    }
    if (g.gameState === 'gameOver' && (key === 'enter' || key === ' ')) {
      g.newRound(); this.refs['bet-input'].value = 100; this.render();
    }
    if (g.gameState === 'betting' && key === 'enter') { this.refs['deal-btn'].click(); }
  }

  renderCard(card, delay) {
    const el = document.createElement('div');
    el.className = `card ${card.faceUp ? card.color : ''} ${card.faceUp ? '' : 'face-down'}`;
    el.style.animationDelay = `${delay}ms`;
    if (card.faceUp) {
      el.innerHTML = `<span class="rank t">${card.rank}</span><span class="suit">${card.suit}</span><span class="rank b">${card.rank}</span>`;
    }
    return el;
  }

  render() {
    const g = this.game;

    // Cards
    this.refs['d-cards'].innerHTML = '';
    g.dealerHand.cards.forEach((c, i) => this.refs['d-cards'].appendChild(this.renderCard(c, i * 100)));
    this.refs['p-cards'].innerHTML = '';
    g.playerHand.cards.forEach((c, i) => this.refs['p-cards'].appendChild(this.renderCard(c, i * 100)));

    // Scores
    this.refs['p-score'].textContent = g.playerHand.cards.length ? g.playerHand.score : '';
    if (g.gameState === 'playing' && !g.dealerHand.cards[1]?.faceUp) {
      this.refs['d-score'].textContent = g.dealerHand.cards[0]?.value || '';
    } else {
      this.refs['d-score'].textContent = g.dealerHand.cards.length ? g.dealerHand.score : '';
    }

    // Balance & bet
    this.refs.balance.textContent = g.balance.toLocaleString();
    this.refs.bet.textContent = g.currentBet.toLocaleString();

    // Message
    this.refs.msg.textContent = g.message;
    this.refs.msg.className = 'msg';
    if (/win|Blackjack/i.test(g.message)) this.refs.msg.classList.add('win');
    else if (/lose|bust/i.test(g.message)) this.refs.msg.classList.add('lose');
    else if (/push/i.test(g.message)) this.refs.msg.classList.add('push');

    // Stats
    this.el.querySelector('[data-stat="wins"]').textContent = g.stats.wins;
    this.el.querySelector('[data-stat="losses"]').textContent = g.stats.losses;
    this.el.querySelector('[data-stat="pushes"]').textContent = g.stats.pushes;

    // Phase visibility
    this.refs['bet-phase'].style.display = g.gameState === 'betting' ? 'flex' : 'none';
    this.refs['play-phase'].style.display = g.gameState === 'playing' ? 'flex' : 'none';
    this.refs['next-btn'].style.display = g.gameState === 'gameOver' ? 'block' : 'none';

    if (g.gameState === 'playing') {
      this.refs['dbl-btn'].disabled = g.playerHand.cards.length !== 2 || g.currentBet > g.balance;
    }
  }
}
