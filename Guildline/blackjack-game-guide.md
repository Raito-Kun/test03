# Blackjack Game - Development & Deployment Guide

## Overview

A browser-based Blackjack card game built with vanilla HTML/CSS/JavaScript. Served via Nginx (Docker) and exposed through Cloudflare Tunnel.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | HTML5, CSS3, JavaScript (ES6+) |
| Server | Nginx Alpine (Docker) |
| Tunnel | Cloudflare Tunnel (cloudflared) |
| Deploy | Docker Compose |

## Project Structure

```
03_TEST/
├── docker-compose.yml      # Nginx + Cloudflare Tunnel services
├── .env                     # CLOUDFLARE_TUNNEL_TOKEN (not committed)
├── .env.example             # Env template
├── Guildline/               # This documentation
│   └── blackjack-game-guide.md
└── public/                  # Static files served by Nginx
    ├── index.html           # Game HTML structure
    ├── style.css            # UI styling (dark theme, green felt table)
    ├── game-engine.js       # Core game logic (Deck, Hand, BlackjackGame)
    └── ui-controller.js     # DOM rendering, events, keyboard shortcuts
```

## Game Features

- **Standard Blackjack rules**: Hit, Stand, Double Down
- **Card rendering**: CSS-based cards with suits (no images required)
- **Chip betting**: $10, $25, $50, $100 chip buttons
- **Score tracking**: Wins / Losses / Ties counter
- **Keyboard shortcuts**: H=Hit, S=Stand, D=Double, Enter=Deal/New Round
- **Responsive design**: Works on desktop and mobile
- **Auto-reset**: Balance resets to $1,000 when chips run out

## Game Rules Implemented

1. Dealer hits on 16 or less, stands on 17+
2. Blackjack (21 with 2 cards) pays 3:2
3. Ace counts as 11 or 1 (auto-adjusted)
4. Double Down available on first 2 cards only
5. Deck auto-reshuffles when fewer than 10 cards remain

## Code Architecture

### game-engine.js
- `Card` — Suit, rank, color, value
- `Deck` — Fisher-Yates shuffle, draw, auto-reset
- `Hand` — Score calculation with soft ace handling
- `BlackjackGame` — Full game state machine (betting → playing → dealerTurn → gameOver)

### ui-controller.js
- DOM element binding and rendering
- Card element creation with deal animations
- Chip/button event listeners
- Keyboard shortcut handler
- State-based UI toggling (show/hide controls per game phase)

### style.css
- Dark theme with green felt table
- CSS playing cards (no image assets)
- Casino chip buttons with hover effects
- Deal card animation (slide-in)
- Responsive breakpoints for mobile

## Deployment

### Prerequisites
- Docker & Docker Compose installed
- Cloudflare Tunnel token (from Zero Trust dashboard)

### Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Raito-Kun/test03.git
   cd test03
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and set CLOUDFLARE_TUNNEL_TOKEN
   ```

3. **Start services:**
   ```bash
   docker-compose up -d
   ```

4. **Verify:**
   - Local: http://localhost:80
   - Public: via your Cloudflare Tunnel domain

### Server Path
On the Linux server, the project deploys to:
```
/opt/03-Test/
├── docker-compose.yml
├── .env
├── Guildline/
└── public/
```

### Updating
```bash
cd /opt/03-Test
git pull origin main
docker-compose restart web
```

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Blank page | Check Nginx logs: `docker logs web` |
| Tunnel not connecting | Verify `CLOUDFLARE_TUNNEL_TOKEN` in `.env` |
| CSS/JS not loading | Ensure `./public` volume mount is correct |
| Cards not rendering | Check browser console for JS errors |

## Testing

Open in browser and verify:
1. Chips add to bet amount correctly
2. Deal creates 4 cards (2 player face-up, 1 dealer face-up, 1 face-down)
3. Hit draws a card, busts if over 21
4. Stand triggers dealer play (hits until 17+)
5. Double Down doubles bet, draws 1 card, then dealer plays
6. Blackjack pays 1.5x bet
7. Balance resets when reaching $0
8. Keyboard shortcuts work (H, S, D, Enter)
9. Mobile layout is usable
