# Frontend Auth + Amplify Hosting Implementation Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the frontend to AWS Amplify Hosting and replace the homegrown authentication UI with `aws-amplify` v6, supporting passkeys, TOTP, and robust session management.

**Architecture:** Terraform provisions an Amplify App with a custom rewrite rule for the SPA. The React frontend embeds `aws-amplify` v6 for auth, syncing session state into the existing Zustand store and passing Cognito access tokens to the backend via `fetchAuthSession()`.

**Tech Stack:** OpenTofu, `aws-amplify` v6.

## Global Constraints

- Region **us-east-1**; account 711387141487; domain `themighty.gg`; existing tofu workspace `deploy/terraform/`.
- Frontend hosting: Amplify Hosting (`app.themighty.gg`) with SPA URL-rewrite rule.
- Auth: `aws-amplify` v6 embedded in the app's own UI (no hosted-UI redirect).
- Must provide signUp/confirmSignUp, signIn (USER_AUTH), passkeys (`associateWebAuthnCredential`), TOTP setup, and reset flows.
- Every task must leave the repo compiling and tests green (`npm run test` or `npx vitest run`).

---

### Task 1: Terraform — Amplify App & Domain

**Files:**
- Create: `deploy/terraform/amplify.tf`
- Modify: `deploy/terraform/variables.tf` (add `github_token`)
- Modify: `deploy/terraform/terraform.tfvars.example` (add `github_token`)

**Interfaces:**
- Consumes: `var.domain`, `aws_ssm_parameter.cognito_pool_id`, `aws_ssm_parameter.cognito_client_id`, `var.github_token`.
- Produces: `aws_amplify_app.frontend`, `aws_amplify_branch.main`, `aws_amplify_domain_association.frontend`.

- [ ] **Step 1: Write `deploy/terraform/amplify.tf`**

```hcl
resource "aws_amplify_app" "frontend" {
  name       = "mighty-frontend"
  repository = "https://github.com/joekhosbayar/mighty"

  # The GitHub token is required for Amplify to set up webhooks and pull code
  access_token = var.github_token

  # Redirect all client-side routed paths to index.html to avoid 404s
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>"
    status = "200"
    target = "/index.html"
  }

  environment_variables = {
    AMPLIFY_MONOREPO_APP_ROOT = "mighty-frontend"
    VITE_COGNITO_REGION       = "us-east-1"
    VITE_COGNITO_POOL_ID      = aws_ssm_parameter.cognito_pool_id.value
    VITE_COGNITO_CLIENT_ID    = aws_ssm_parameter.cognito_client_id.value
    VITE_API_URL              = "https://api.${var.domain}"
  }
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = "main"
  framework   = "React"
}

resource "aws_amplify_domain_association" "frontend" {
  app_id      = aws_amplify_app.frontend.id
  domain_name = var.domain

  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = "app"
  }
}
```

- [ ] **Step 2: Add `github_token` to `variables.tf`**

```hcl
variable "github_token" {
  type        = string
  description = "GitHub Personal Access Token for Amplify Hosting"
  sensitive   = true
}
```

- [ ] **Step 3: Update `terraform.tfvars.example`**
Add `github_token = "ghp_..."` to the file.

- [ ] **Step 4: Commit**

```bash
git add deploy/terraform/amplify.tf deploy/terraform/variables.tf deploy/terraform/terraform.tfvars.example
git commit -m "infra: Amplify Hosting for frontend SPA with routing rewrite"
```

---

### Task 2: Frontend Auth Configuration & Store Integration

**Files:**
- Modify: `mighty-frontend/package.json`
- Create: `mighty-frontend/src/core/auth.ts`
- Modify: `mighty-frontend/src/main.tsx`
- Modify: `mighty-frontend/src/store/index.ts`
- Modify: `mighty-frontend/src/api/http.ts`

**Interfaces:**
- Consumes: Environment variables via `import.meta.env`.
- Produces: Amplify initialization and a refactored `AppState` that uses `aws-amplify/auth` to manage the session instead of raw JWT storage.

- [ ] **Step 1: Install aws-amplify**

Run `npm install aws-amplify` in `mighty-frontend/`.

- [ ] **Step 2: Write `mighty-frontend/src/core/auth.ts`**

```typescript
import { Amplify } from 'aws-amplify';

export function configureAuth() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_COGNITO_POOL_ID || '',
        userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
        identityPoolId: '',
        signUpVerificationMethod: 'code',
      }
    }
  });
}
```

- [ ] **Step 3: Initialize Auth in `mighty-frontend/src/main.tsx`**
Import `configureAuth` from `./core/auth` and call it before `createRoot`.

- [ ] **Step 4: Update `mighty-frontend/src/api/http.ts`**
Remove `signup` and `login` from the `Http` interface, and their implementations from `createHttp`. Remove the `decodeToken` function completely.
The signature for `createGame` and `joinGame` remains `(token: string, ...)` for now.

- [ ] **Step 5: Rewrite `mighty-frontend/src/store/index.ts` auth methods**
Replace the custom storage logic and update `AppState`. Add `aws-amplify/auth` imports.

```typescript
import { signIn, signUp, signOut, fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
```
Remove `TOKEN_KEY` and `defaultStorage`. Replace the session loading with a function that fetches the Amplify session:
```typescript
      // Replace signup and login implementations inside createAppStore:
      async signup(u, p, email) {
        try {
          await signUp({ username: u, password: p, options: { userAttributes: { email, preferred_username: u } } });
          return true; // We don't auto-login here because they need to confirm
        } catch (e) {
          set({ lastError: errorMessage(e) });
          return false;
        }
      },

      async login(u, p) {
        try {
          await signIn({ username: u, password: p, options: { authFlowType: 'USER_AUTH' } });
          const session = await fetchAuthSession();
          const attrs = await fetchUserAttributes();
          const token = session.tokens?.accessToken?.toString() ?? null;
          set({ token, userId: attrs.sub ?? null, username: attrs.preferred_username ?? u, lastError: null });
          return true;
        } catch (e) {
          set({ lastError: errorMessage(e) });
          return false;
        }
      },

      logout() {
        socket?.close();
        socket = null;
        lastMove = null;
        busyRetried = false;
        signOut().catch(console.error);
        set({ token: null, userId: null, username: null, game: null, connection: 'idle' });
      },
```
You will also need an `initSession` function in the store to load the session on app start, or a `useEffect` in `App.tsx`. For this step, simply implement the updated store methods and remove `decodeToken` usages.

- [ ] **Step 6: Run tests and verify failure**
Run `npm run test` (if applicable) and fix any typing issues caused by removing `http.signup/login`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/core/auth.ts src/main.tsx src/api/http.ts src/store/index.ts
git commit -m "feat: configure aws-amplify and integrate with Zustand store"
```

---

### Task 3: AuthScreen.tsx — Login & Sign Up (Confirm)

**Files:**
- Modify: `mighty-frontend/src/components/AuthScreen.tsx`

**Interfaces:**
- Consumes: Amplify's `confirmSignUp`, `resendSignUpCode`.

- [ ] **Step 1: Add a 'confirm' state to `AuthScreen.tsx`**

Update `AuthScreen.tsx` to handle the verification code step.
When `onSignup` returns true, transition to `confirm` mode rather than navigating away.

```typescript
import { confirmSignUp } from 'aws-amplify/auth';
// ...
const [mode, setMode] = useState<'login' | 'signup' | 'confirm'>('login')
const [code, setCode] = useState('')

// Add a handleConfirm function
const handleConfirm = async (e: FormEvent) => {
  e.preventDefault()
  try {
    await confirmSignUp({ username, confirmationCode: code })
    // If successful, log them in automatically
    onLogin(username, password)
  } catch (err) {
    // Surface error to UI...
  }
}
```

- [ ] **Step 2: Render the confirm UI**
Render an input for `code` when `mode === 'confirm'`.

- [ ] **Step 3: Commit**

```bash
git add src/components/AuthScreen.tsx
git commit -m "feat: add confirmSignUp UI to AuthScreen"
```

---

### Task 4: AuthScreen.tsx — Advanced Flows (WebAuthn, TOTP, Reset)

**Files:**
- Modify: `mighty-frontend/src/components/AuthScreen.tsx`

**Interfaces:**
- Consumes: Amplify's `associateWebAuthnCredential`, `setUpTOTP`, `resetPassword`, `confirmResetPassword`.

- [ ] **Step 1: Add WebAuthn and TOTP UI**

After a successful `signIn`, Cognito might issue a challenge (e.g., `CONTINUE_SIGN_IN_WITH_MFA` or `NEW_PASSWORD_REQUIRED`). Alternatively, provide buttons in a user settings area for passkeys, but the spec says "embedded in the app's own UI".
For this task, add a basic "Forgot Password" mode to `AuthScreen.tsx`:

```typescript
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';

// Add 'forgot' and 'reset' modes
const [mode, setMode] = useState<'login' | 'signup' | 'confirm' | 'forgot' | 'reset'>('login')
```

Implement the `resetPassword` flow (asks for username, sends code) and `confirmResetPassword` (asks for code and new password).

- [ ] **Step 2: Add Passkey Registration Button (Optional/Profile)**
Since the spec requires `associateWebAuthnCredential`, add a small component or button that allows a logged-in user to register a passkey. For now, this can be placed in `LobbyScreen.tsx` or a new `SettingsModal`.

- [ ] **Step 3: Commit**

```bash
git add src/components/AuthScreen.tsx
git commit -m "feat: add password reset flow to AuthScreen"
```

---

### Task 5: Interceptors & Token Refresh

**Files:**
- Modify: `mighty-frontend/src/store/index.ts`
- Modify: `mighty-frontend/src/api/http.ts`
- Modify: `mighty-frontend/src/api/ws.ts`

**Interfaces:**
- Consumes: `fetchAuthSession()` from `aws-amplify/auth`.
- Produces: API calls automatically attaching the fresh access token, removing the need to pass `token` explicitly to `http.createGame` and `http.joinGame`.

- [ ] **Step 1: Update API Signatures**

In `mighty-frontend/src/api/http.ts`, remove `token` from `createGame` and `joinGame` signatures.
Instead, use an interceptor approach or fetch the token dynamically inside `createHttp`'s `request` function:

```typescript
import { fetchAuthSession } from 'aws-amplify/auth';

async function getToken(): Promise<string | undefined> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString();
  } catch {
    return undefined;
  }
}
```
Inject this into the `Authorization` header in `request`.

- [ ] **Step 2: Update `ws.ts` to use fresh tokens**
In `ws.ts`, `GameSocket` should call `fetchAuthSession()` before establishing the connection to ensure the `AUTH` message uses an unexpired token.

- [ ] **Step 3: Clean up `store/index.ts`**
Remove manual token injection into `deps.http.createGame(get().token, config)`.
Ensure `initSession` logic exists to automatically load the user into `AppState` on page load.

- [ ] **Step 4: Commit**

```bash
git add src/store/index.ts src/api/http.ts src/api/ws.ts
git commit -m "feat: dynamic token injection for REST and WebSockets"
```

---
