/* Blackjack Game Engine - core logic, deck, scoring */

const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_COLORS = { '\u2660': 'black', '\u2663': 'black', '\u2665': 'red', '\u2666': 'red' };

class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.color = SUIT_COLORS[suit];
    this.faceUp = true;
  }

  get value() {
    if (['J', 'Q', 'K'].includes(this.rank)) return 10;
    if (this.rank === 'A') return 11;
    return parseInt(this.rank);
  }
}

class Deck {
  constructor(numDecks = 1) {
    this.cards = [];
    this.reset(numDecks);
  }

  reset(numDecks = 1) {
    this.cards = [];
    for (let d = 0; d < numDecks; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          this.cards.push(new Card(suit, rank));
        }
      }
    }
    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    if (this.cards.length < 10) this.reset();
    return this.cards.pop();
  }
}

class Hand {
  constructor() {
    this.cards = [];
  }

  addCard(card) {
    this.cards.push(card);
  }

  get score() {
    let total = 0;
    let aces = 0;
    for (const card of this.cards) {
      total += card.value;
      if (card.rank === 'A') aces++;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  }

  get isBusted() { return this.score > 21; }
  get isBlackjack() { return this.cards.length === 2 && this.score === 21; }
  clear() { this.cards = []; }
}

class BlackjackGame {
  constructor() {
    this.deck = new Deck();
    this.playerHand = new Hand();
    this.dealerHand = new Hand();
    this.balance = 1000;
    this.currentBet = 0;
    this.gameState = 'betting';
    this.message = '';
    this.stats = { wins: 0, losses: 0, pushes: 0, blackjacks: 0 };
  }

  placeBet(amount) {
    if (this.gameState !== 'betting') return false;
    if (amount > this.balance || amount <= 0) return false;
    this.currentBet = amount;
    this.balance -= amount;
    this.deal();
    return true;
  }

  deal() {
    this.playerHand.clear();
    this.dealerHand.clear();
    this.playerHand.addCard(this.deck.draw());
    this.dealerHand.addCard(this.deck.draw());
    this.playerHand.addCard(this.deck.draw());
    const holeCard = this.deck.draw();
    holeCard.faceUp = false;
    this.dealerHand.addCard(holeCard);

    if (this.playerHand.isBlackjack) {
      this.dealerHand.cards[1].faceUp = true;
      this.endGame(this.dealerHand.isBlackjack ? 'push' : 'blackjack');
    } else {
      this.gameState = 'playing';
      this.message = 'Hit or Stand?';
    }
  }

  hit() {
    if (this.gameState !== 'playing') return;
    this.playerHand.addCard(this.deck.draw());
    if (this.playerHand.isBusted) this.endGame('bust');
  }

  stand() {
    if (this.gameState !== 'playing') return;
    this.dealerPlay();
  }

  doubleDown() {
    if (this.gameState !== 'playing') return false;
    if (this.playerHand.cards.length !== 2) return false;
    if (this.currentBet > this.balance) return false;
    this.balance -= this.currentBet;
    this.currentBet *= 2;
    this.playerHand.addCard(this.deck.draw());
    if (this.playerHand.isBusted) {
      this.endGame('bust');
    } else {
      this.dealerPlay();
    }
    return true;
  }

  dealerPlay() {
    this.gameState = 'dealerTurn';
    this.dealerHand.cards[1].faceUp = true;
    while (this.dealerHand.score < 17) {
      this.dealerHand.addCard(this.deck.draw());
    }
    const ds = this.dealerHand.score;
    const ps = this.playerHand.score;
    if (this.dealerHand.isBusted) this.endGame('dealerBust');
    else if (ds > ps) this.endGame('lose');
    else if (ds < ps) this.endGame('win');
    else this.endGame('push');
  }

  endGame(result) {
    this.gameState = 'gameOver';
    const payouts = {
      blackjack: () => { this.balance += Math.floor(this.currentBet * 2.5); this.stats.blackjacks++; this.stats.wins++; },
      win: () => { this.balance += this.currentBet * 2; this.stats.wins++; },
      dealerBust: () => { this.balance += this.currentBet * 2; this.stats.wins++; },
      lose: () => { this.stats.losses++; },
      bust: () => { this.stats.losses++; },
      push: () => { this.balance += this.currentBet; this.stats.pushes++; },
    };
    payouts[result]();
    const messages = {
      blackjack: 'Blackjack! You win!',
      win: 'You win!',
      dealerBust: 'Dealer busts! You win!',
      lose: 'Dealer wins!',
      bust: 'Busted! You lose!',
      push: 'Push! Bet returned.',
    };
    this.message = messages[result];
  }

  newRound() {
    if (this.balance <= 0) {
      this.balance = 1000;
      this.message = 'Out of chips! Balance reset to $1,000.';
    }
    this.currentBet = 0;
    this.gameState = 'betting';
  }
}
