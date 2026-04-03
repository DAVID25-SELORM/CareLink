# 🚀 CareLink HMS - Deployment Guide

Complete guide to deploy CareLink HMS to production using Vercel and Supabase.

---

## 📋 Prerequisites

Before deploying, ensure you have:

- ✅ GitHub account
- ✅ Vercel account (free tier works)
- ✅ Supabase project created and configured
- ✅ All code committed to Git
- ✅ Database tables created (see DATABASE_SETUP.md)
- ✅ Optional module scripts run for the roles you plan to use

---

## 🗂️ Step 1: Prepare Your Code

### 1.1 Initialize Git Repository

```bash
cd CareLink
git init
```

### 1.2 Create .gitignore

Ensure `.gitignore` includes:

```
# Dependencies
node_modules/

# Build output
dist/
build/

# Environment variables
.env
.env.local
.env.production

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
```

### 1.3 Commit Your Code

```bash
git add .
git commit -m "Initial commit - CareLink HMS"
```

---

## 🔗 Step 2: Push to GitHub

### 2.1 Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click **New Repository**
3. Name: `carelink-hms`
4. Description: "Hospital Management System - Connecting Care, Simplifying Healthcare"
5. Keep it **Private** (or Public if you want)
6. Click **Create Repository**

### 2.2 Push Code

```bash
git remote add origin https://github.com/YOUR_USERNAME/carelink-hms.git
git branch -M main
git push -u origin main
```

---

## ☁️ Step 3: Deploy to Vercel

### 3.1 Sign Up / Login to Vercel

1. Go to [Vercel](https://vercel.com)
2. Sign up using your GitHub account

### 3.2 Import Project

1. Click **Add New Project**
2. Select **Import Git Repository**
3. Choose your `carelink-hms` repository
4. Click **Import**

### 3.3 Configure Project

**Framework Preset**: Vite  
**Root Directory**: `./`  
**Build Command**: `npm run build`  
**Output Directory**: `dist`  

### 3.4 Add Environment Variables

Click **Environment Variables** and add:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these:**
- Go to your Supabase project
- Navigate to **Settings** → **API**
- Copy **Project URL** and **anon public** key

### 3.5 Deploy!

Click **Deploy**

Vercel will:
- Install dependencies
- Build your project
- Deploy to production
- Give you a URL like: `carelink-hms.vercel.app`

---

## 🔒 Step 4: Configure Supabase for Production

### 4.1 Add Vercel URL to Supabase

1. Go to your Supabase project
2. Navigate to **Authentication** → **URL Configuration**
3. Add your Vercel URL to **Site URL**:
   ```
   https://carelink-hms.vercel.app
   ```

### 4.2 Add Redirect URLs

Add these to **Redirect URLs**:

```
https://carelink-hms.vercel.app/
https://carelink-hms.vercel.app/dashboard
```

### 4.3 Enable Email Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure email templates (optional)

### 4.4 Run Module SQL Scripts

If your hospital will use the newer role-specific modules, run these in Supabase SQL Editor after the base schema:

- [`nurse-system-setup.sql`](c:/Users/RealTimeIT/Desktop/CareLink/nurse-system-setup.sql)
- [`records-system-setup.sql`](c:/Users/RealTimeIT/Desktop/CareLink/records-system-setup.sql)
- [`referrals-setup.sql`](c:/Users/RealTimeIT/Desktop/CareLink/referrals-setup.sql)

---

## 🎯 Step 5: Create First Admin User

### 5.1 Using Supabase Dashboard

1. Go to **Authentication** → **Users**
2. Click **Add User**
3. Enter:
   - Email: `admin@carelink.com` (or your email)
   - Password: (create a strong password)
4. Click **Create User**

### 5.2 Add User to `users` Table

Go to **SQL Editor** and run:

```sql
INSERT INTO users (email, role, full_name, phone)
VALUES 
  ('admin@carelink.com', 'admin', 'Admin User', '+233247654381');
```

---

## ✅ Step 6: Test Your Deployment

### 6.1 Visit Your Site

Open: `https://carelink-hms.vercel.app`

### 6.2 Test Login

Use the admin credentials you created.

### 6.3 Test Core Features

- ✅ Patient registration
- ✅ Drug management
- ✅ Prescription creation
- ✅ Billing
- ✅ Reports

---

## 🔄 Step 7: Continuous Deployment

### Auto-Deploy on Git Push

Vercel automatically deploys when you push to GitHub:

```bash
# Make changes to your code
git add .
git commit -m "Update feature"
git push
```

Vercel will automatically:
- Detect the push
- Build the new version
- Deploy to production

### Preview Deployments

- Each pull request gets a preview URL
- Test changes before merging to main

---

## 🌐 Step 8: Custom Domain (Optional)

### 8.1 Buy a Domain

Buy from:
- Namecheap
- GoDaddy
- Google Domains

Suggestion: `carelink.com.gh` or `carelinkghana.com`

### 8.2 Add to Vercel

1. Go to Vercel project settings
2. Click **Domains**
3. Add your custom domain
4. Follow DNS configuration instructions

### 8.3 Update Supabase URLs

Add your custom domain to Supabase URL Configuration.

---

## 📱 Step 9: Mobile App Deployment (Future)

### React Native Mobile App

After building the mobile app:

**Android**:
```bash
cd hms-mobile
npx expo build:android
```

Upload to **Google Play Store**

**iOS**:
```bash
npx expo build:ios
```

Upload to **Apple App Store**

---

## 🔐 Step 10: Security Checklist

Before going live, ensure:

- ✅ Environment variables are set correctly
- ✅ Database RLS policies are enabled
- ✅ `.env` file is in `.gitignore`
- ✅ HTTPS is enabled (automatic on Vercel)
- ✅ Strong passwords for admin accounts
- ✅ Regular database backups enabled

---

## 📊 Step 11: Monitoring & Analytics

### 11.1 Vercel Analytics

Enable in Vercel dashboard:
- Go to **Analytics**
- Enable **Web Analytics**

### 11.2 Supabase Monitoring

Monitor in Supabase:
- **Database** → Usage
- **API** → Request logs
- **Auth** → User activity

### 11.3 Error Tracking (Optional)

Consider adding:
- **Sentry** - for error tracking
- **LogRocket** - for session replay

---

## 🚀 Step 12: Production Optimization

### 12.1 Build Optimization

Already configured in Vite:
- Code splitting
- Minification
- Tree shaking

### 12.2 Image Optimization

Use WebP format for images:
```bash
npm install sharp
```

### 12.3 Caching Strategy

Configure in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

---

## 💰 Step 13: Go-To-Market Strategy

### 13.1 Soft Launch

1. Deploy to Vercel
2. Test with 2-3 beta users (e.g., Ark Medical Centre)
3. Gather feedback
4. Fix bugs
5. Improve UX

### 13.2 Official Launch

1. Create demo account
2. Record demo video
3. Create pitch deck
4. Contact hospitals
5. Offer free trial (1-3 months)

### 13.3 Pricing Model

**Suggestions** (Ghana market):

**Starter Plan**
- GH₵ 300/month
- Up to 100 patients/month
- 1 location
- Email support

**Professional Plan**
- GH₵ 800/month
- Unlimited patients
- Up to 3 locations
- Phone + email support
- Custom reports

**Enterprise Plan**
- GH₵ 2,000/month
- Unlimited everything
- Multiple locations
- Dedicated support
- On-site training
- Custom features

**One-Time Installation**
- GH₵ 5,000 - GH₵ 20,000
- Self-hosted option
- Full customization

---

## 📞 Step 14: Support Setup

### 14.1 Create Support Channels

- **Email**: support@carelink.com.gh
- **Phone**: +233 24 765 4381
- **WhatsApp Business**: Same number

### 14.2 Documentation

Keep your documentation updated:
- README.md
- User manual
- Video tutorials
- FAQ section

---

## 🎓 Step 15: For School Project

If submitting as school project:

### Required Documents

1. **README.md** ✅ (already created)
2. **Technical Documentation**
   - System architecture
   - Database schema
   - API endpoints
3. **User Manual**
   - How to use each module
   - Screenshots
4. **Project Report**
   - Problem statement
   - Solution approach
   - Technologies used
   - Challenges faced
   - Future enhancements

### Presentation Tips

1. **Demo First** - Show live system
2. **Highlight Ghana-Specific Features**
   - NHIS integration
   - Mobile Money payments
3. **Show Real Value**
   - Time saved
   - Paper reduced
   - Efficiency improved
4. **Mention Real Usage**
   - "Currently testing at Ark Medical Centre"
   - "Built by someone inside healthcare"

---

## 🔄 Maintenance

### Regular Tasks

**Daily**:
- Monitor error logs
- Check system performance

**Weekly**:
- Review user feedback
- Update documentation

**Monthly**:
- Database backup verification
- Security updates
- Feature improvements

---

## 🆘 Troubleshooting

### Build Fails on Vercel

```bash
# Locally test the build
npm run build
```

Fix errors, commit, push again.

### Environment Variables Not Working

- Ensure they start with `VITE_`
- Redeploy after adding new variables

### Database Connection Issues

- Verify Supabase URL and key
- Check if Supabase project is active
- Ensure RLS policies allow access

---

## 📧 Support

**Developer**: David Gabion Selorm  
**Email**: gabiondavidselorm@gmail.com  
**Phone**: +233247654381  
**Business**: zittechgh@gmail.com

---

## ✅ Deployment Checklist

Before going live:

- [ ] All features tested locally
- [ ] Database tables created
- [ ] Sample data inserted
- [ ] Code pushed to GitHub
- [ ] Project imported to Vercel
- [ ] Environment variables added
- [ ] Deployment successful
- [ ] Admin user created
- [ ] Login tested
- [ ] All modules tested
- [ ] Mobile responsiveness checked
- [ ] Error handling verified
- [ ] Documentation complete
- [ ] Support channels ready

---

**CareLink HMS** - Built with ❤️ in Ghana 🇬🇭

*Connecting Care, Simplifying Healthcare*
