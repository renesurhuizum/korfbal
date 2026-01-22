export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

4. **"Commit changes"**

---

### **Bestand 5/12: `.gitignore`**

1. **"Add file"** → **"Create new file"**
2. Filename: `.gitignore`
3. Plak:
```
# Dependencies
node_modules/

# Production
dist/
build/

# Environment variables
.env
.env.local
.env.production

# Logs
*.log

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
