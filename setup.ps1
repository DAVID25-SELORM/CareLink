# 🚀 CareLink HMS - Setup Script

# PowerShell script to help you set up CareLink HMS quickly

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "    CareLink HMS - Installation Script         " -ForegroundColor Cyan
Write-Host "    Connecting Care, Simplifying Healthcare    " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Step 1: Check Node.js
Write-Host "[1/8] Checking Node.js installation..." -ForegroundColor Yellow
if (Test-Command node) {
    $nodeVersion = node --version
    Write-Host "✅ Node.js is installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js is NOT installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org" -ForegroundColor Yellow
    exit
}

# Step 2: Check npm
Write-Host "[2/8] Checking npm installation..." -ForegroundColor Yellow
if (Test-Command npm) {
    $npmVersion = npm --version
    Write-Host "✅ npm is installed: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "❌ npm is NOT installed!" -ForegroundColor Red
    exit
}

# Step 3: Install dependencies
Write-Host "[3/8] Installing project dependencies..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies!" -ForegroundColor Red
    exit
}

# Step 4: Check for .env file
Write-Host "[4/8] Checking environment variables..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✅ .env file found!" -ForegroundColor Green
    Write-Host "Please ensure you've added your Supabase credentials." -ForegroundColor Yellow
} else {
    Write-Host "⚠️  .env file not found!" -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Write-Host "Creating .env file from .env.example..." -ForegroundColor Gray
        Copy-Item ".env.example" ".env"
        Write-Host "✅ .env file created!" -ForegroundColor Green
        Write-Host "" -ForegroundColor Yellow
        Write-Host "⚠️  IMPORTANT: Edit .env and add your Supabase credentials!" -ForegroundColor Red
        Write-Host "   - VITE_SUPABASE_URL=your_supabase_url_here" -ForegroundColor Yellow
        Write-Host "   - VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here" -ForegroundColor Yellow
    }
}

# Step 5: Display Supabase setup reminder
Write-Host "" 
Write-Host "[5/8] Supabase Database Setup" -ForegroundColor Yellow
Write-Host "Have you created your Supabase database?" -ForegroundColor Cyan
Write-Host "If not, follow these steps:" -ForegroundColor Gray
Write-Host "  1. Go to https://supabase.com" -ForegroundColor Gray
Write-Host "  2. Create a new project" -ForegroundColor Gray
Write-Host "  3. Run the SQL commands from DATABASE_SETUP.md" -ForegroundColor Gray
Write-Host "  4. Copy your URL and anon key to .env" -ForegroundColor Gray

# Step 6: Check Git
Write-Host "" 
Write-Host "[6/8] Checking Git installation..." -ForegroundColor Yellow
if (Test-Command git) {
    Write-Host "✅ Git is installed!" -ForegroundColor Green
    
    # Check if git repo is initialized
    if (Test-Path ".git") {
        Write-Host "✅ Git repository initialized!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Git repository not initialized" -ForegroundColor Yellow
        $response = Read-Host "Initialize Git repository? (y/n)"
        if ($response -eq 'y') {
            git init
            Write-Host "✅ Git initialized!" -ForegroundColor Green
        }
    }
} else {
    Write-Host "⚠️  Git is not installed (optional)" -ForegroundColor Yellow
}

# Step 7: Build test
Write-Host "" 
Write-Host "[7/8] Testing build configuration..." -ForegroundColor Yellow
$response = Read-Host "Run test build? This will take a minute (y/n)"
if ($response -eq 'y') {
    npm run build
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Build test successful!" -ForegroundColor Green
    } else {
        Write-Host "❌ Build failed! Check errors above." -ForegroundColor Red
    }
}

# Step 8: Summary
Write-Host "" 
Write-Host "[8/8] Setup Summary" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "" 

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "" 
Write-Host "1. Configure Supabase" -ForegroundColor White
Write-Host "   - Create project at https://supabase.com" -ForegroundColor Gray
Write-Host "   - Run SQL from DATABASE_SETUP.md" -ForegroundColor Gray
Write-Host "   - Update .env with your credentials" -ForegroundColor Gray
Write-Host "" 

Write-Host "2. Start Development Server" -ForegroundColor White
Write-Host "   Run: npm run dev" -ForegroundColor Yellow
Write-Host "   Open: http://localhost:5173" -ForegroundColor Gray
Write-Host "" 

Write-Host "3. Deploy to Production" -ForegroundColor White
Write-Host "   - Push to GitHub" -ForegroundColor Gray
Write-Host "   - Deploy to Vercel" -ForegroundColor Gray
Write-Host "   - See DEPLOYMENT.md for details" -ForegroundColor Gray
Write-Host "" 

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Need help? Contact David Gabion Selorm" -ForegroundColor White
Write-Host "Email: gabiondavidselorm@gmail.com" -ForegroundColor Gray
Write-Host "Phone: +233 24 765 4381" -ForegroundColor Gray
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "" 

Write-Host "Ready to start CareLink HMS!" -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Yellow
