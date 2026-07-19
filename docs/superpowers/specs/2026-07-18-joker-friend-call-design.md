# Joker Friend Call Design

## Purpose
Fix a missing UI option in the `mighty-frontend` application that prevents a declarer from calling the Joker as their friend.

## Architecture & Components
- **Component**: `FriendCallPanel` (`src/components/FriendCallPanel.tsx`)
- **Change**: Add a dedicated "Call Joker" button alongside the existing standard card call button and the "Play alone" button.

## Data Flow
- When the new "Call Joker" button is clicked, it will trigger the existing `onCallPartner` callback passed via props.
- The payload sent will be explicitly defined as the Joker card: `{ suit: 'none', rank: 'Joker' }`.

## Error Handling & Edge Cases
- The Joker button ensures that invalid configurations (like assigning a standard suit to the Joker) are impossible because the payload is hardcoded to `{ suit: 'none', rank: 'Joker' }`.

## Testing
- Ensure the `FriendCallPanel.test.tsx` test suite handles the new button layout and validates that clicking "Call Joker" dispatches the correct payload to `onCallPartner`.
