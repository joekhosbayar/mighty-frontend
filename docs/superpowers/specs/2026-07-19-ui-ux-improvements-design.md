# UI/UX Improvements Design Spec

## Overview
This document outlines a series of UI, UX, and logic improvements to the Mighty web application. The goal is to make the interface more reactive, improve the first-time user experience, and add "game feel" through animations and polish.

## 1. Landing Page Redesign
Instead of dropping users immediately into an authentication screen, we will present a welcoming landing page using a Split Screen layout.

### Left Pane (Educational/Visual)
- **Visuals:** A large, welcoming header with game assets.
- **Content:** Scrollable sections containing the game's Rulebook and Scoring methods.

### Right Pane (Action/Sticky)
- **Layout:** A fixed sidebar that stays visible while scrolling the left pane.
- **Content:** 
  - A prominent "Log In" button.
  - A condensed list of currently active games, showing players how active the community is and giving them a quick entry point once logged in.

## 2. Teammate Selection (Vertical Wheels)
The native `<select>` dropdowns in `FriendCallPanel.tsx` will be replaced with custom vertical scroll wheels (Slot Machine style).

### Functionality
- **Suit Wheel (Left):** Spades, Hearts, Diamonds, Clubs, Joker.
- **Rank Wheel (Right):** A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2.
- **Joker Rule:** If "Joker" is centered on the Suit wheel, the Rank wheel will visually dim (opacity reduction) and lock, becoming un-selectable.

## 3. Reactive UI & Animations
Adding "game feel" through CSS transitions and React animations.

### Hover States
- Buttons and playable cards will receive a slight scale up (`transform: scale(1.05)`) and a drop shadow on hover to indicate interactivity.

### Move Animations
- **Card Plays:** When a player plays a card, a visual clone of the card will animate (slide/fly) from their seat's `div` to the center trick area.
- **Bidding:** 
  - Submitting a bid (e.g., "♠ 5") will spawn a speech bubble from the player's nameplate. The bubble will linger for 1.5 seconds, then fade out.
  - Passing will spawn an animated waving white flag 🏳️ from the player's nameplate, which also fades out after 1.5 seconds.

## 4. Game Logic & Bug Fixes

### Bidding Auto-Increment
- **Current Behavior:** The bid selector defaults to the absolute minimum bid (e.g., 3 or 4) regardless of previous bids.
- **New Behavior:** In `BidPanel.tsx`, the `points` state will initialize and update to the next legal minimum bid based on `view.currentBid`. The maximum selectable value will be capped at 10.

### Trick Order Bug Fix
- **Current Behavior:** Cards in the center trick area are not reliably ordered by when they were played.
- **New Behavior:** In `PlayArea.tsx`, the rendering logic will map over `view.currentTrick` (which provides the historical order of `PlayedCard` items) and display them in the exact order they were played, ensuring players can follow the lead suit and trick progression clearly.

## Architecture & Implementation Notes
- **Styling:** Use standard CSS in `styles.css` for hover effects and basic animations.
- **Animations:** The card/bid flying animations can be achieved by adding temporary absolute-positioned DOM nodes or using CSS transitions with dynamic `style={{ transform: ... }}` based on bounding client rects.
- **Carousels:** Will require a custom React component for the vertical snap-scrolling behavior. No heavy external libraries unless necessary; standard CSS `scroll-snap-type: y mandatory` can achieve the slot machine effect natively.
