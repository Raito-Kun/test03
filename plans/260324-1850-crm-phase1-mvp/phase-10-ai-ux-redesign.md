---
phase: 10
title: "AI-Powered UI/UX Redesign"
status: completed
priority: P1
effort: 7d
depends_on: [09]
completed: 2026-03-25
---

# Phase 10 — AI-Powered UI/UX Redesign

## Context Links
- [Plan Overview](./plan.md)
- [Phase 08 UI](./phase-08-frontend-ui.md)

## Overview
Complete visual redesign of all frontend pages with modern dark sidebar, card-based layouts, smooth animations, and glassmorphism accents. Add AI agentic features powered by Anthropic Claude API for real-time assistance, smart search, call coaching, auto-summarization, lead scoring, and anomaly detection.

**Approach:** Frontend-only changes + new AI service backend module. Existing REST API unchanged.

## Key Insights
- 7 AI agentic patterns: Assistant (orchestrator), Smart Search (tool use), Call Coaching (reflection), Auto-Summary (RAG), Lead Scoring (tool use), Disposition Suggestion (prompt chaining), Anomaly Alerts (monitoring)
- AI service calls Anthropic API server-side to protect API key
- Streaming responses via SSE for real-time feel
- Dark sidebar + light content area (hybrid theme)
- Framer Motion for page transitions and micro-interactions

## Requirements
**UI Redesign:**
- Dark sidebar with gradient accent, icon tooltips when collapsed
- Card-based dashboard with charts (recharts)
- Smooth page transitions (framer-motion)
- Glassmorphism cards for key metrics
- Improved data tables with inline actions
- Better form layouts with step indicators
- Toast notifications with progress

**AI Features:**
- AI Assistant panel: slide-out right panel, context-aware, streaming responses
- Smart Search: natural language query bar in header, searches across all entities
- Call Coaching: real-time suggestion cards during active calls
- Auto-Summary: customer 360 summary card on contact/lead detail pages
- Lead Scoring: AI-computed score with explanation on lead cards
- Disposition Suggestion: post-call AI recommendation
- Anomaly Alerts: dashboard widget showing unusual patterns

## Architecture

```
Frontend (new/modified):
  src/
  ├── components/
  │   ├── ai/
  │   │   ├── ai-assistant-panel.tsx      # Slide-out AI chat panel
  │   │   ├── ai-search-bar.tsx           # Natural language search
  │   │   ├── call-coaching-card.tsx       # Real-time call suggestions
  │   │   ├── customer-summary-card.tsx    # Auto-generated 360 summary
  │   │   ├── lead-score-badge.tsx         # AI score with explanation
  │   │   ├── disposition-suggestion.tsx   # Post-call AI recommendation
  │   │   └── anomaly-alert-widget.tsx     # Dashboard anomaly detection
  │   ├── layout/
  │   │   ├── sidebar.tsx                  # Redesigned dark sidebar
  │   │   ├── header.tsx                   # Updated with AI search
  │   │   └── app-layout.tsx              # Updated layout
  │   └── charts/
  │       ├── call-stats-chart.tsx         # Recharts call statistics
  │       └── lead-funnel-chart.tsx        # Recharts lead funnel
  ├── services/
  │   └── ai-service.ts                   # Frontend AI API client
  └── stores/
      └── ai-store.ts                     # Zustand AI state

Backend (new module only):
  src/
  ├── routes/ai-routes.ts                 # AI API endpoints
  ├── services/ai-service.ts              # Anthropic API integration
  └── lib/ai-prompts.ts                   # Prompt templates
```

## Related Code Files
**Modify:** All pages in src/pages/, sidebar, header, app-layout, dashboard, app.css
**Create:** AI components (7), AI service (FE+BE), AI store, chart components, AI routes
**Keep unchanged:** All existing REST API endpoints, stores, hooks

## Implementation Steps

### Sub-phase 10a: UI Redesign Foundation (Day 1-2)
1. Install framer-motion, recharts
2. Redesign sidebar: dark gradient background, colored active indicators, smooth collapse animation, logo with app name
3. Redesign header: updated search bar (prep for AI search), cleaner profile menu
4. Update app.css: CSS variables for dark sidebar, glassmorphism utilities
5. Add page transition wrapper with framer-motion (fade + slide)
6. Redesign dashboard: recharts for call stats, glassmorphism stat cards, better agent grid
7. Update data table: hover effects, inline action buttons, better pagination

### Sub-phase 10b: Page Redesigns (Day 2-3)
1. Contact detail: tabbed card layout, 360-degree view prep
2. Lead list: kanban-style pipeline view option
3. Debt case: colored tier indicators, progress bars for payment
4. Call log detail: timeline-style layout, better audio player styling
5. Ticket detail: conversation-style layout
6. Reports: chart-based reports instead of plain tables
7. Settings: organized sections with icons

### Sub-phase 10c: AI Backend Service (Day 3-4)
1. Install @anthropic-ai/sdk in backend
2. Create AI prompts library (vi-text for Vietnamese context)
3. Create AI service: streaming chat, search, summarize, score, suggest
4. Create AI routes: POST /ai/chat, POST /ai/search, POST /ai/summarize, POST /ai/score-lead, POST /ai/suggest-disposition, GET /ai/anomalies
5. SSE streaming endpoint for real-time responses
6. Rate limit AI endpoints (5 req/min per user)

### Sub-phase 10d: AI Frontend Components (Day 4-6)
1. AI Assistant panel: slide-out from right, chat interface with streaming, context injection (current page, selected contact/lead)
2. AI Search bar: natural language input in header, federated results across entities
3. Customer Summary card: auto-generate 360 summary on contact/lead detail pages
4. Lead Score badge: AI-computed score with hover explanation tooltip
5. Call Coaching card: suggestions during active call (call-bar integration)
6. Disposition Suggestion: post-call recommendation in call-bar wrap-up
7. Anomaly Alert widget: dashboard card showing unusual patterns

### Sub-phase 10e: Polish & Integration (Day 6-7)
1. Animation fine-tuning (timing, easing curves)
2. Loading states for AI features (skeleton + streaming indicators)
3. Error handling for AI failures (graceful fallback)
4. Mobile responsive adjustments
5. Performance optimization (lazy load AI components)

## Todo List
- [x] Install framer-motion + recharts
- [x] Redesign sidebar (dark theme, animations)
- [x] Redesign header (AI search prep)
- [x] Dashboard with charts + glassmorphism
- [x] Page transitions (framer-motion)
- [x] Redesign all detail/list pages
- [x] AI backend service (Anthropic SDK + streaming)
- [x] AI routes + rate limiting
- [x] AI Assistant panel
- [x] AI Smart Search
- [x] Customer 360 Summary
- [x] Lead Score badge
- [x] Call Coaching cards
- [x] Disposition Suggestion
- [x] Anomaly Alerts widget
- [x] Animation polish + error handling

## Success Criteria
- All pages visually redesigned with consistent dark sidebar + card layout
- Page transitions smooth (< 200ms)
- AI Assistant responds with streaming in < 2s first token
- Smart Search returns results across entities
- Customer summary generates on page load
- Lead scores computed and displayed
- No regression in existing functionality

## Risk Assessment
- Anthropic API costs: rate limit AI endpoints, cache common queries
- API latency: streaming SSE mitigates perceived latency
- AI hallucination: ground responses in real CRM data (RAG pattern)

## Security Considerations
- Anthropic API key stored server-side only (never exposed to frontend)
- AI endpoints require authentication
- Rate limiting on AI endpoints (prevent abuse)
- No PII sent to AI without user consent (anonymize if needed)
