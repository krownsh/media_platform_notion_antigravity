# Initialize Project Script (PowerShell)

# 1. Create Vite Project (React + JavaScript)
Write-Host "Creating Vite project..."
npm create vite@latest . -- --template react

# 2. Install Dependencies
Write-Host "Installing dependencies..."
# Core & UI
npm install @reduxjs/toolkit react-redux redux-saga react-router-dom
npm install @supabase/supabase-js
npm install tailwindcss postcss autoprefixer
npm install lucide-react clsx tailwind-merge
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities framer-motion
npm install uuid

# Dev Dependencies
npm install -D tailwindcss postcss autoprefixer

# 3. Initialize TailwindCSS
Write-Host "Initializing TailwindCSS..."
npx tailwindcss init -p

# 4. Create Directory Structure
Write-Host "Creating directory structure..."
New-Item -ItemType Directory -Force -Path "src/api"
New-Item -ItemType Directory -Force -Path "src/assets"
New-Item -ItemType Directory -Force -Path "src/components"
New-Item -ItemType Directory -Force -Path "src/features"
New-Item -ItemType Directory -Force -Path "src/hooks"
New-Item -ItemType Directory -Force -Path "src/pages"
New-Item -ItemType Directory -Force -Path "src/services"
New-Item -ItemType Directory -Force -Path "src/services/crawlerService"
New-Item -ItemType Directory -Force -Path "src/services/crawlerService/parsers"
New-Item -ItemType Directory -Force -Path "src/store"
New-Item -ItemType Directory -Force -Path "src/utils"

# 5. Create Placeholder Files
Write-Host "Creating placeholder files..."

# API Client
Set-Content -Path "src/api/supabaseClient.js" -Value "import { createClient } from '@supabase/supabase-js';`n`nconst supabaseUrl = import.meta.env.VITE_SUPABASE_URL;`nconst supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;`n`nexport const supabase = createClient(supabaseUrl, supabaseKey);"

# Store
Set-Content -Path "src/store/index.js" -Value "import { configureStore } from '@reduxjs/toolkit';`nimport createSagaMiddleware from 'redux-saga';`nimport rootReducer from './rootReducer';`nimport rootSaga from './rootSaga';`n`nconst sagaMiddleware = createSagaMiddleware();`n`nexport const store = configureStore({`n  reducer: rootReducer,`n  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),`n});`n`nsagaMiddleware.run(rootSaga);"
Set-Content -Path "src/store/rootReducer.js" -Value "import { combineReducers } from '@reduxjs/toolkit';`n`nconst rootReducer = combineReducers({`n  // slices will go here`n});`n`nexport default rootReducer;"
Set-Content -Path "src/store/rootSaga.js" -Value "import { all } from 'redux-saga/effects';`n`nexport default function* rootSaga() {`n  yield all([`n    // sagas will go here`n  ]);`n}"

# Env Template
Set-Content -Path ".env.example" -Value "VITE_SUPABASE_URL=your_supabase_url`nVITE_SUPABASE_ANON_KEY=your_supabase_anon_key"

Write-Host "Initialization Complete! Please run 'npm install' and then 'npm run dev' to start."
