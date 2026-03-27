# Blackjack Online - 4-Player Parallel Game Guide

## Overview

A browser-based Blackjack card game with **4 independent parallel tables**. Each player runs their own game instance simultaneously without conflicts. Built with vanilla HTML/CSS/JavaScript, served via Nginx (Docker) and exposed through Cloudflare Tunnel.

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
├── docker-compose.yml          # Nginx + Cloudflare Tunnel services
├── .env                        # CLOUDFLARE_TUNNEL_TOKEN (not committed)
├── .env.example                # Env template
├── Guildline/                  # This documentation
│   └── blackjack-game-guide.md
└── public/                     # Static files served by Nginx
    ├── index.html              # 4-player grid layout
    ├── style.css               # Dark theme, 2x2 responsive grid
    ├── game-engine.js          # Core logic (Card, Deck, Hand, BlackjackGame)
    ├── table-renderer.js       # Single table DOM + events + rendering
    └── ui-controller.js        # Manages 4 tables, focus, keyboard routing
```

## Game Features

- **4 Parallel Tables**: Each player has their own independent game table
- **Standard Blackjack rules**: Hit, Stand, Double Down
- **CSS-based cards**: No image assets needed, suit/rank rendered in DOM
- **Chip betting**: $10, $25, $50, $100 chip buttons per table
- **Score tracking**: Wins / Losses / Ties counter per player
- **Focus system**: Click table or press 1-4 to select, Tab to cycle
- **Keyboard shortcuts**: H=Hit, S=Stand, D=Double, Enter=Deal/New Round
- **Color-coded players**: Blue, Red, Green, Purple table borders
- **Responsive design**: 2x2 grid on desktop, stacked on mobile
- **Auto-reset**: Balance resets to $1,000 when chips run out

## Parallel Architecture

Each of the 4 tables runs a completely independent `BlackjackGame` instance:

```
┌─────────────────────────────────────────┐
│          UI Controller (main)           │
│  - Focus management (click/Tab/1-4)     │
│  - Keyboard routing to focused table    │
├──────────┬──────────┬──────────┬────────┤
│ Table 1  │ Table 2  │ Table 3  │ Table 4│
│ Renderer │ Renderer │ Renderer │Renderer│
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │┌──────┐│
│ │Game  │ │ │Game  │ │ │Game  │ ││Game  ││
│ │Engine│ │ │Engine│ │ │Engine│ ││Engine││
│ │ #1   │ │ │ #2   │ │ │ #3   │ ││ #4   ││
│ └──────┘ │ └──────┘ │ └──────┘ │└──────┘│
└──────────┴──────────┴──────────┴────────┘
```

- **No shared state** between tables = no conflicts
- Each table has its own: deck, dealer hand, player hand, balance, bet, stats
- Players can play at their own pace independently

## Game Rules Implemented

1. Dealer hits on 16 or less, stands on 17+
2. Blackjack (21 with 2 cards) pays 3:2
3. Ace counts as 11 or 1 (auto-adjusted)
4. Double Down available on first 2 cards only (if balance allows)
5. Deck auto-reshuffles when fewer than 10 cards remain

## Code Architecture

### game-engine.js (~190 lines)
- `Card` — Suit, rank, color, face-up/down, value
- `Deck` — Fisher-Yates shuffle, draw, auto-reset
- `Hand` — Score calculation with soft ace handling, blackjack detection
- `BlackjackGame` — State machine: betting → playing → dealerTurn → gameOver

### table-renderer.js (~140 lines)
- `TableRenderer` — Creates and manages one game table's DOM
- Builds HTML structure with `data-el` refs for fast element access
- Binds chip, deal, hit, stand, double, new-round events
- `handleKey(key)` — Processes keyboard input for this table
- `render()` — Updates all DOM elements from game state

### ui-controller.js (~40 lines)
- Creates 4 `TableRenderer` instances in a grid container
- Manages focus: click, Tab (cycle), 1-4 keys (direct select)
- Routes keyboard shortcuts to the currently focused table

### style.css (~200 lines)
- Dark theme (#0d1117) with green felt tables
- 2x2 CSS Grid layout for 4 tables
- CSS playing cards with suit colors (no images)
- Casino chip buttons with hover glow effects
- Card deal animation (slide-in from top)
- `--accent` CSS variable for player color coding
- Responsive: stacks to 1 column below 768px, smaller cards below 480px

## Keyboard Controls

| Key | Action |
|-----|--------|
| 1-4 | Focus table 1/2/3/4 |
| Tab | Cycle to next table (Shift+Tab for previous) |
| H | Hit (during play) |
| S | Stand (during play) |
| D | Double Down (during play) |
| Enter | Deal (betting) / New Round (game over) |

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
| Tables not appearing | Verify `game-engine.js` loads before `table-renderer.js` |
| Keyboard not working | Click a table first to set focus |

## Testing Checklist

1. All 4 tables render in 2x2 grid
2. Click/Tab/1-4 switches focus (highlighted border)
3. Each table deals independently
4. Chips add to bet amount correctly
5. Deal creates 4 cards (2 player face-up, 1 dealer face-up, 1 face-down)
6. Hit draws a card, busts if over 21
7. Stand triggers dealer play (hits until 17+)
8. Double Down doubles bet, draws 1 card, then dealer plays
9. Blackjack pays 1.5x bet
10. Balance resets when reaching $0
11. Keyboard shortcuts route to focused table only
12. Mobile layout stacks tables vertically
