# Supabase Authentication Setup

## ✅ Complete Implementation

Your dashboard now has **two-layer authentication**:
1. **Supabase Auth** - User sign-in with email/password
2. **Dashboard Passcode** - Additional security layer

## 🚀 Setup Steps

### 1. Configure Supabase Auth in Dashboard

Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/vciscdagwhdpstaviakz/auth/users):

#### Enable Email Auth
1. Go to **Authentication → Providers**
2. Enable **Email** provider
3. Configure settings:
   - ✅ Enable email confirmations (recommended)
   - ✅ Enable password requirements
   - Set minimum password length (8+ chars)

#### Optional: Enable OAuth Providers
- **Google**: Quick social sign-in
- **GitHub**: Developer-friendly
- **Microsoft**: Enterprise users

### 2. Create Environment File

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `frontend/.env.local`:
```bash
# Get these from: https://supabase.com/dashboard/project/vciscdagwhdpstaviakz/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://vciscdagwhdpstaviakz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here

# Set your custom dashboard passcode
DASHBOARD_PASSCODE=MySecurePasscode123!
```

### 3. Start Development Server

```bash
npm run dev
```

## 🔐 Authentication Flow

1. **User visits protected route** (e.g., `/dashboard`, `/videos`)
   → Redirected to `/login`

2. **User signs in** with email/password
   → Redirected to `/verify-passcode`

3. **User enters dashboard passcode**
   → Access granted to dashboard

4. **Session persists** for 7 days (or until sign out)

## 📁 Files Created

```
frontend/
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser client
│   │   ├── server.ts          # Server component client
│   │   └── middleware.ts      # Auth middleware logic
│   └── auth/
│       └── auth-provider.tsx  # React context for auth state
├── app/
│   ├── login/
│   │   └── page.tsx          # Sign in/sign up page
│   ├── verify-passcode/
│   │   └── page.tsx          # Passcode verification
│   └── api/
│       └── verify-passcode/
│           └── route.ts      # Passcode verification API
├── middleware.ts             # Route protection
└── .env.local.example        # Environment template
```

## 🎯 Protected Routes

All dashboard routes now require authentication:
- `/dashboard`
- `/campaigns`
- `/scripts`
- `/videos`
- `/distribution`
- `/analytics`

## 👥 User Management

### Create First User
1. Go to `http://localhost:3000/login`
2. Click "Sign Up"
3. Enter email and password
4. Check email for confirmation link (if enabled)

### Manage Users
- View all users: [Supabase Auth Dashboard](https://supabase.com/dashboard/project/vciscdagwhdpstaviakz/auth/users)
- Delete users, reset passwords, etc.

### Add Sign Out Button

Already included in sidebar! The `useAuth()` hook provides:
```tsx
import { useAuth } from '@/lib/auth/auth-provider';

function MyComponent() {
  const { user, signOut } = useAuth();
  
  return (
    <button onClick={signOut}>
      Sign Out {user?.email}
    </button>
  );
}
```

## 🔒 Security Features

✅ **httpOnly cookies** - Prevents XSS attacks  
✅ **Secure flag** - HTTPS only in production  
✅ **7-day expiration** - Auto-logout for security  
✅ **Rate limiting** - Built into Supabase Auth  
✅ **Session refresh** - Automatic token renewal  
✅ **Two-layer auth** - Email + passcode

## 📊 Next Steps

1. **Test the auth flow**
   ```bash
   npm run dev
   # Visit http://localhost:3000/dashboard
   ```

2. **Add OAuth providers** (optional)
   - Google, GitHub, Microsoft, etc.
   - Configure in Supabase Dashboard

3. **Customize email templates** (optional)
   - Password reset emails
   - Email confirmation
   - Magic link emails

4. **Add user profile page** (optional)
   - Update email/password
   - View account details

## 🛠️ Troubleshooting

**"Invalid login credentials"**
- Check email/password are correct
- Verify email is confirmed (if email confirmation enabled)

**"Invalid passcode"**
- Check `DASHBOARD_PASSCODE` in `.env.local`
- Restart dev server after changing env vars

**Redirects not working**
- Clear browser cookies
- Check middleware is running: `console.log` in middleware.ts

**Session not persisting**
- Check browser allows cookies
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct

## 📖 Documentation

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Next.js SSR with Supabase](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
