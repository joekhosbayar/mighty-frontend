# Joker Friend Call Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "Call Joker" button to the friend call panel so declarers can easily call the Joker as their friend.

**Architecture:** A simple UI extension of the existing `FriendCallPanel` component that injects a new button alongside the existing standard call and "play alone" buttons, dispatching a hardcoded `{ suit: 'none', rank: 'Joker' }` payload.

**Tech Stack:** React, Vite, Vitest, Testing Library

## Global Constraints

- Must explicitly provide `{ suit: 'none', rank: 'Joker' }` payload.
- No other layout or logic changes to existing calls.

---

### Task 1: Add Call Joker Button

**Files:**
- Modify: `src/components/FriendCallPanel.tsx:38-45`
- Modify: `src/components/FriendCallPanel.test.tsx:32-35`

**Interfaces:**
- Consumes: Existing `FriendCallPanelProps` type and `onCallPartner` callback.
- Produces: Dispatches `{ suit: 'none', rank: 'Joker' }` to `onCallPartner`.

- [ ] **Step 1: Write the failing test**

```tsx
// In src/components/FriendCallPanel.test.tsx, add this test inside the describe block:

  it('calls the joker', async () => {
    const onCallPartner = vi.fn()
    render(<FriendCallPanel view={callingView()} onCallPartner={onCallPartner} onNoFriend={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Call Joker' }))
    expect(onCallPartner).toHaveBeenCalledWith({ suit: 'none', rank: 'Joker' })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/FriendCallPanel.test.tsx -t "calls the joker"`
Expected: FAIL with "Unable to find an accessible element with the role "button" and name "Call Joker""

- [ ] **Step 3: Write minimal implementation**

```tsx
// In src/components/FriendCallPanel.tsx, update the button row to include the new button:

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => onCallPartner({ suit, rank })} style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}>Call {rank} of {suit}</button>
        <span style={{ color: 'var(--color-text-secondary)' }}>or</span>
        <button onClick={() => onCallPartner({ suit: 'none', rank: 'Joker' })} style={{ background: 'var(--color-accent)', color: 'var(--color-ink)' }}>Call Joker</button>
        <span style={{ color: 'var(--color-text-secondary)' }}>or</span>
        <button onClick={onNoFriend} style={{ background: 'transparent' }}>Play alone (no friend, 2× score)</button>
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/FriendCallPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/FriendCallPanel.test.tsx src/components/FriendCallPanel.tsx
rtk git commit -m "feat: add Call Joker button to friend call panel"
```
