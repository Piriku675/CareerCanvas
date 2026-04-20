#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
#   CareerCanvas — One-Click Termux Script
#   Setup + GitHub Push, all in one
#   Source of truth: ~/career-canvas
#
#   Stack: Firebase Firestore + Node.js Telegram bot
#          Frontend on GitHub Pages, Bot on Render
# ============================================================

RED='\033[1;31m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
WHITE='\033[1;37m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

log_step()  { printf "\n${CYAN}${BOLD}▶  %s${RESET}\n" "$1"; }
log_ok()    { printf "${GREEN}  ✔  %s${RESET}\n" "$1"; }
log_warn()  { printf "${YELLOW}  ⚠  %s${RESET}\n" "$1"; }
log_info()  { printf "${WHITE}  ℹ  %s${RESET}\n" "$1"; }
log_fail()  { printf "${RED}${BOLD}  ✘  %s${RESET}\n" "$1"; }
separator() { printf "${DIM}  ──────────────────────────────────────────${RESET}\n"; }

die() {
  printf "\n"
  log_fail "$1"
  printf "\n"
  exit 1
}

ask_yn() {
  printf "  ${WHITE}%s (y/n): ${RESET}" "$1"
  read -r _yn
  [[ "$_yn" =~ ^[Yy]$ ]]
}

pkg_installed() {
  dpkg -s "$1" >/dev/null 2>&1
}

# ── GitHub auth: check if remote is reachable, offer PAT login if not ──
ensure_github_auth() {
  local REPO_URL="$1"
  log_info "Checking GitHub access..."
  git ls-remote "$REPO_URL" >/dev/null 2>&1
  if [ $? -eq 0 ]; then
    log_ok "GitHub access confirmed"
    GH_AUTH_PREFIX=""
    return 0
  fi

  log_warn "Cannot reach GitHub — authentication required"
  printf "
"
  printf "  ${WHITE}GitHub username: ${RESET}"; read -r GH_USER
  printf "  ${WHITE}PAT (hidden):    ${RESET}"; read -rs GH_PAT; printf "
"

  [ -z "$GH_USER" ] && die "No username provided"
  [ -z "$GH_PAT" ]  && die "No PAT provided"

  CLEAN=$(printf "%s" "$REPO_URL" | sed 's|https://||;s|http://||')
  GH_AUTH_PREFIX="https://${GH_USER}:${GH_PAT}@"
  AUTHED_URL="${GH_AUTH_PREFIX}${CLEAN}"

  git ls-remote "$AUTHED_URL" >/dev/null 2>&1
  if [ $? -ne 0 ]; then
    die "Still cannot reach GitHub — check username, PAT, and repo URL"
  fi

  log_ok "GitHub access confirmed with PAT"
  # Set authenticated URL on remote; will be stripped after push
  git remote set-url origin "$AUTHED_URL"
}

# Strip PAT from remote URL after push for security
cleanup_github_auth() {
  local REPO_URL="$1"
  git remote set-url origin "$REPO_URL" 2>/dev/null
}

# ── Firebase auth: check if logged in, run firebase login if not ──
ensure_firebase_auth() {
  if ! command -v firebase >/dev/null 2>&1; then
    log_warn "Firebase CLI not installed"
    log_info "Install with: npm install -g firebase-tools"
    return 1
  fi

  log_info "Checking Firebase login status..."
  firebase login:list 2>&1 | grep -q "@"
  if [ $? -eq 0 ]; then
    log_ok "Firebase already logged in"
    return 0
  fi

  log_warn "Not logged into Firebase — starting login..."
  printf "
"
  firebase login
  if [ $? -ne 0 ]; then
    log_warn "Firebase login failed or was cancelled"
    log_info "Run manually: firebase login"
    return 1
  fi

  firebase login:list 2>&1 | grep -q "@"
  if [ $? -eq 0 ]; then
    log_ok "Firebase login successful"
    return 0
  else
    log_warn "Firebase login did not complete — skipping Firebase steps"
    return 1
  fi
}

PROJECT_DIR="$HOME/career-canvas"
BOT_DIR="$PROJECT_DIR/bot"
FIREBASE_DIR="$PROJECT_DIR/firebase"
FRONTEND_DIR="$PROJECT_DIR/frontend"
MIRROR_DIR="/storage/emulated/0/CareerCanvas"

# ════════════════════════════════════════════════════════════
#  GITHUB PUSH — defined as a function so setup can call it
# ════════════════════════════════════════════════════════════
run_github_push() {
  log_step "Environment"

  [ ! -d "$PROJECT_DIR" ] && die "Project not found: $PROJECT_DIR — run Setup first"
  cd "$PROJECT_DIR" || die "Cannot cd into $PROJECT_DIR"
  log_ok "Working directory: $(pwd)"

  if ! command -v git >/dev/null 2>&1; then
    log_warn "Git not found — installing..."
    pkg install git -y || die "Git installation failed"
  fi
  log_ok "Git: $(git --version)"

  git config --global --add safe.directory "$PROJECT_DIR" 2>/dev/null
  log_ok "safe.directory registered"

  separator

  # ── Git init ───────────────────────────────────────────────
  log_step "Git repository"

  if [ ! -d ".git" ]; then
    git init -b main 2>/dev/null || { git init; git branch -m main 2>/dev/null; }
    log_ok "Initialised"
  else
    log_ok "Repo exists (.git found)"
  fi

  separator

  # ── Remote URL ─────────────────────────────────────────────
  log_step "Remote setup"

  CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null)
  if [ -n "$CURRENT_REMOTE" ]; then
    log_info "Current origin: $CURRENT_REMOTE"
    printf "  ${WHITE}Change URL? Leave blank to keep it: ${RESET}"
    read -r NEW_URL
    [ -n "$NEW_URL" ] && REPO_URL="$NEW_URL" || REPO_URL="$CURRENT_REMOTE"
  else
    printf "  ${WHITE}GitHub repository URL: ${RESET}"
    read -r REPO_URL
    [ -z "$REPO_URL" ] && die "No URL provided"
  fi

  git remote remove origin 2>/dev/null
  git remote add origin "$REPO_URL"
  git branch -M main
  log_ok "Origin: $REPO_URL"

  # Check GitHub auth before committing / pushing
  ensure_github_auth "$REPO_URL"

  separator

  # ── Stage & commit ─────────────────────────────────────────
  log_step "Staging & commit"

  git add .
  STAGED=$(git diff --cached --name-only | wc -l | tr -d ' ')
  log_ok "Staged $STAGED file(s)"

  if git diff --cached --quiet; then
    log_warn "Nothing to commit — pushing existing commits"
  else
    printf "  ${WHITE}Commit message (blank = 'Update CareerCanvas'): ${RESET}"
    read -r MSG
    [ -z "$MSG" ] && MSG="Update CareerCanvas"
    git commit -m "$MSG" && log_ok "Committed: \"$MSG\""
  fi

  separator

  # ── Push ───────────────────────────────────────────────────
  log_step "Pushing to GitHub"
  printf "\n"

  PUSH_OUTPUT=$(git push -u origin main 2>&1)
  PUSH_EXIT=$?
  printf "%s\n" "$PUSH_OUTPUT"
  printf "\n"

  if [ $PUSH_EXIT -eq 0 ]; then
    cleanup_github_auth "$REPO_URL"
    printf "${GREEN}${BOLD}  ╔════════════════════════════════════════════════╗${RESET}\n"
    printf "${GREEN}${BOLD}  ║   🎉  CareerCanvas pushed to GitHub!           ║${RESET}\n"
    printf "${GREEN}${BOLD}  ╚════════════════════════════════════════════════╝${RESET}\n\n"
    return 0
  fi

  # ── Detect failure reason ──────────────────────────────────
  separator

  if printf "%s" "$PUSH_OUTPUT" | grep -q "fetch first\|non-fast-forward"; then
    printf "\n"
    log_warn "GitHub has changes that aren't on your device yet"
    printf "\n"
    printf "  ${WHITE}What do you want to do?${RESET}\n"
    printf "  ${DIM}  1) Pull remote changes and merge (safe)${RESET}\n"
    printf "  ${DIM}  2) Force push — overwrite GitHub with your local version${RESET}\n"
    printf "  ${DIM}  3) Cancel${RESET}\n"
    printf "\n"
    printf "  ${WHITE}Choice (1/2/3): ${RESET}"
    read -r CONFLICT_CHOICE

    case "$CONFLICT_CHOICE" in
      1)
        log_info "Pulling remote changes..."
        git pull origin main --rebase
        if [ $? -eq 0 ]; then
          log_ok "Pull successful — retrying push..."
          git push -u origin main
          if [ $? -eq 0 ]; then
            printf "\n"
            printf "${GREEN}${BOLD}  ╔════════════════════════════════════════════════╗${RESET}\n"
            printf "${GREEN}${BOLD}  ║   🎉  CareerCanvas pushed to GitHub!           ║${RESET}\n"
            printf "${GREEN}${BOLD}  ╚════════════════════════════════════════════════╝${RESET}\n\n"
            return 0
          else
            die "Push still failed after pull — resolve conflicts manually"
          fi
        else
          log_warn "Pull had conflicts — resolve them manually then run the script again"
          log_info "  git status          — see conflicting files"
          log_info "  git rebase --abort  — undo the rebase if stuck"
          return 1
        fi
        ;;
      2)
        printf "\n"
        log_warn "Force pushing — this will overwrite GitHub with your local version"
        printf "  ${WHITE}Are you sure? (y/n): ${RESET}"
        read -r FORCE_CONFIRM
        if [[ "$FORCE_CONFIRM" =~ ^[Yy]$ ]]; then
          git push -u origin main --force
          if [ $? -eq 0 ]; then
            printf "\n"
            printf "${GREEN}${BOLD}  ╔════════════════════════════════════════════════╗${RESET}\n"
            printf "${GREEN}${BOLD}  ║   🎉  CareerCanvas force pushed to GitHub!     ║${RESET}\n"
            printf "${GREEN}${BOLD}  ╚════════════════════════════════════════════════╝${RESET}\n\n"
            return 0
          else
            die "Force push failed — check your PAT permissions"
          fi
        else
          log_info "Force push cancelled"
          return 1
        fi
        ;;
      *)
        log_info "Cancelled — run the script again when ready"
        return 1
        ;;
    esac

  elif printf "%s" "$PUSH_OUTPUT" | grep -q "Authentication failed\|could not read Username\|403\|unauthorized"; then
    printf "\n"
    log_warn "Authentication failed"
    printf "\n"
    printf "  ${WHITE}Retry with Personal Access Token? (y/n): ${RESET}"
    read -r RETRY

    if [[ "$RETRY" =~ ^[Yy]$ ]]; then
      printf "\n"
      printf "  ${WHITE}GitHub username: ${RESET}"; read -r GH_USER
      printf "  ${WHITE}PAT (hidden):    ${RESET}"; read -rs GH_PAT; printf "\n\n"

      [ -z "$GH_USER" ] && die "No username provided"
      [ -z "$GH_PAT" ]  && die "No PAT provided"

      CLEAN=$(printf "%s" "$REPO_URL" | sed 's|https://||;s|http://||')
      git remote set-url origin "https://${GH_USER}:${GH_PAT}@${CLEAN}"

      git push -u origin main
      RETRY_EXIT=$?
      git remote set-url origin "$REPO_URL"

      if [ $RETRY_EXIT -eq 0 ]; then
        printf "\n"
        printf "${GREEN}${BOLD}  ╔════════════════════════════════════════════════╗${RESET}\n"
        printf "${GREEN}${BOLD}  ║   🎉  CareerCanvas pushed to GitHub!           ║${RESET}\n"
        printf "${GREEN}${BOLD}  ╚════════════════════════════════════════════════╝${RESET}\n\n"
        return 0
      else
        die "Push failed — check PAT permissions and repo access"
      fi
    else
      printf "\n"
      log_info "Skipped — run the script again when ready"
      return 1
    fi

  else
    printf "\n"
    log_warn "Push failed for an unknown reason — see output above"
    log_info "Common fixes:"
    log_info "  1) Check your repo URL is correct"
    log_info "  2) Make sure you have a Personal Access Token with repo permissions"
    log_info "  3) Run: git push -u origin main   to see the raw error"
    return 1
  fi
}

# ════════════════════════════════════════════════════════════
#  SETUP — full Termux environment install
# ════════════════════════════════════════════════════════════
run_setup() {

  # ── MODULE 1 — Environment check ───────────────────────────
  log_step "MODULE 1 · Environment check"

  if [ -z "$HOME" ] || [ ! -d "$HOME" ]; then
    die "Termux HOME directory not found."
  fi
  log_ok "HOME: $HOME"

  STORAGE_DIR="/storage/emulated/0"
  if [ -d "$STORAGE_DIR" ]; then
    log_ok "Android storage accessible"
    STORAGE_AVAILABLE=true
  else
    log_warn "Storage not accessible — requesting permission..."
    termux-setup-storage
    sleep 3
    if [ -d "$STORAGE_DIR" ]; then
      log_ok "Storage permission granted"
      STORAGE_AVAILABLE=true
    else
      log_warn "Storage unavailable — mirror step will be skipped"
      STORAGE_AVAILABLE=false
    fi
  fi

  separator

  # ── MODULE 2 — Project directory ───────────────────────────
  log_step "MODULE 2 · Project directory setup"

  if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p "$PROJECT_DIR" || die "Failed to create $PROJECT_DIR"
    log_ok "Created: $PROJECT_DIR"
  else
    log_ok "Project folder exists: $PROJECT_DIR"
  fi

  mkdir -p "$BOT_DIR/commands"
  mkdir -p "$BOT_DIR/utils"
  mkdir -p "$FIREBASE_DIR"
  mkdir -p "$FRONTEND_DIR/css"
  mkdir -p "$FRONTEND_DIR/js"
  mkdir -p "$PROJECT_DIR/logs"
  log_ok "Directory structure ready"

  git config --global --add safe.directory "$PROJECT_DIR" 2>/dev/null
  log_ok "Git safe.directory registered"

  GITIGNORE="$PROJECT_DIR/.gitignore"
  if [ ! -f "$GITIGNORE" ]; then
    cat > "$GITIGNORE" <<'GITIGNOREFILE'
# Secrets — never commit
bot/serviceAccountKey.json
bot/.env
.env

# Dependencies
node_modules/
bot/node_modules/

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db
GITIGNOREFILE
    log_ok ".gitignore created"
  else
    grep -q "serviceAccountKey.json" "$GITIGNORE" || \
      printf "\nbot/serviceAccountKey.json\n" >> "$GITIGNORE"
    log_ok ".gitignore exists — verified secrets are excluded"
  fi

  separator

  # ── MODULE 3 — Copy project files ──────────────────────────
  log_step "MODULE 3 · Copy project files"

  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

  if [ "$SCRIPT_DIR" = "$PROJECT_DIR" ]; then
    log_ok "Already running from project root — no copy needed"
  else
    log_info "Script location: $SCRIPT_DIR"
    if ask_yn "Copy all files from $SCRIPT_DIR into $PROJECT_DIR?"; then
      cp -r "$SCRIPT_DIR"/. "$PROJECT_DIR/"
      if [ $? -eq 0 ]; then
        log_ok "Files copied into $PROJECT_DIR"
      else
        log_warn "Copy had issues — continuing anyway"
      fi
    else
      log_warn "Skipping copy — make sure your files are already in $PROJECT_DIR"
    fi
  fi

  separator

  # ── MODULE 4 — Termux repositories ─────────────────────────
  log_step "MODULE 4 · Termux repository setup"

  log_info "Updating package lists..."
  pkg update -y 2>&1 | tail -3

  if [ $? -ne 0 ]; then
    log_warn "pkg update had warnings — attempting mirror fix..."
    termux-change-repo 2>/dev/null || true
    pkg update -y 2>&1 | tail -3
  fi

  log_ok "Repositories updated"
  separator

  # ── MODULE 5 — System dependencies ─────────────────────────
  log_step "MODULE 5 · Install dependencies"

  install_if_missing() {
    local PKG="$1"
    local LABEL="${2:-$1}"
    if pkg_installed "$PKG"; then
      VER=$(dpkg -s "$PKG" 2>/dev/null | grep '^Version' | awk '{print $2}')
      log_ok "$LABEL already installed  ($VER)"
    else
      log_info "Installing $LABEL..."
      pkg install "$PKG" -y
      if pkg_installed "$PKG"; then
        log_ok "$LABEL installed"
      else
        die "$LABEL installation failed. Run: pkg install $PKG"
      fi
    fi
  }

  install_if_missing git    "Git"
  install_if_missing nodejs "Node.js"
  install_if_missing npm    "npm"

  separator

  # ── MODULE 6 — Node modules ────────────────────────────────
  log_step "MODULE 6 · Node.js bot dependencies"

  mkdir -p "$BOT_DIR"

  if [ -f "$BOT_DIR/package.json" ]; then
    log_ok "Found bot/package.json"
    cd "$BOT_DIR" || die "Cannot cd into $BOT_DIR"
    npm install
    if [ $? -eq 0 ]; then
      log_ok "Node modules installed in bot/"
    else
      log_warn "npm install had errors — check bot/package.json"
    fi

  elif [ -f "$PROJECT_DIR/package.json" ]; then
    log_warn "Found package.json in project root — this is for Render (backend deploy only)"
    log_info "Skipping npm install — bot dependencies must live in bot/package.json"
    log_info "Create bot/package.json and re-run, or add it manually"

  else
    log_warn "No package.json found — creating one in bot/"
    cat > "$BOT_DIR/package.json" <<'PKGJSON'
{
  "name": "career-canvas-bot",
  "version": "1.0.0",
  "description": "CareerCanvas Telegram bot",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "node-telegram-bot-api": "^0.64.0",
    "dotenv": "^16.0.0"
  }
}
PKGJSON
    log_ok "bot/package.json created"
    cd "$BOT_DIR" || die "Cannot cd into $BOT_DIR"
    npm install
    if [ $? -eq 0 ]; then
      log_ok "Node modules installed in bot/"
    else
      log_warn "npm install had errors — check your internet connection"
    fi
  fi

  cd "$PROJECT_DIR" || die "Cannot cd back to $PROJECT_DIR"
  log_info "Back at project root: $(pwd)"

  separator

  # ── MODULE 7 — Firebase config ─────────────────────────────
  log_step "MODULE 7 · Firebase configuration"

  SA_KEY_FILE="$BOT_DIR/serviceAccountKey.json"

  if [ -f "$SA_KEY_FILE" ]; then
    log_ok "serviceAccountKey.json already exists in bot/ — skipping"
  else
    printf "\n"
    printf "  ${CYAN}${BOLD}Paste your serviceAccountKey.json below.${RESET}\n"
    printf "  ${DIM}Firebase Console → Project Settings → Service Accounts${RESET}\n"
    printf "  ${DIM}→ Generate new private key → copy the full JSON${RESET}\n"
    printf "\n"
    printf "  ${YELLOW}Paste JSON then type END on a new line and press Enter:${RESET}\n"
    printf "  ${WHITE}> ${RESET}\n"

    SA_INPUT=""
    while IFS= read -r line; do
      [ "$line" = "END" ] && break
      SA_INPUT="${SA_INPUT}${line}"$'\n'
    done

    if printf "%s" "$SA_INPUT" | grep -q '"type"' && \
       printf "%s" "$SA_INPUT" | grep -q '"project_id"' && \
       printf "%s" "$SA_INPUT" | grep -q '"private_key"'; then
      printf "%s" "$SA_INPUT" > "$SA_KEY_FILE"
      log_ok "serviceAccountKey.json saved to bot/"
      log_warn "This file is in .gitignore — it will NOT be committed"
    else
      log_warn "Input does not look like a valid service account key"
      log_warn "Add it manually later: $SA_KEY_FILE"
    fi
  fi

  printf "\n"
  log_info "Note: Telegram bot token, Admin Chat ID, and Firebase project ID"
  log_info "are set as environment variables in your Render dashboard — not here."
  log_info "See README → Deploy Bot to Render for the full variable list."

  separator

  # ── MODULE 8 — Firebase seed & rules ───────────────────────
  log_step "MODULE 8 · Firebase seed & rules"

  if [ -f "$FIREBASE_DIR/seed.js" ]; then
    if ask_yn "Run firebase/seed.js to populate Firestore now?"; then
      if [ ! -f "$BOT_DIR/serviceAccountKey.json" ]; then
        log_warn "serviceAccountKey.json missing from bot/ — skipping seed"
        log_info "Add the key file then run manually:"
        log_info "  NODE_PATH=~/career-canvas/bot/node_modules node ~/career-canvas/firebase/seed.js"
      else
        log_info "Running seed (modules resolved from bot/node_modules)..."
        NODE_PATH="$BOT_DIR/node_modules" node "$FIREBASE_DIR/seed.js"
        if [ $? -eq 0 ]; then
          log_ok "Firebase seed complete"
        else
          log_warn "Seed script had errors — check firebase/seed.js"
        fi
      fi
    else
      log_info "Skipped — run manually when ready:"
      log_info "  NODE_PATH=~/career-canvas/bot/node_modules node ~/career-canvas/firebase/seed.js"
    fi
  else
    log_warn "firebase/seed.js not found — skipping"
  fi

  if command -v firebase >/dev/null 2>&1; then
    if [ -f "$FIREBASE_DIR/firestore.rules" ]; then
      if ask_yn "Deploy Firestore rules now?"; then
        cd "$PROJECT_DIR" || die "Cannot cd into $PROJECT_DIR"
        # Ensure logged into Firebase before doing anything
        ensure_firebase_auth || { log_warn "Skipping rules deploy — not logged in"; return; }

        if [ ! -f "$PROJECT_DIR/firebase.json" ]; then
          log_warn "firebase.json not found — Firebase CLI needs it to deploy rules"
          log_info "Running: firebase login && firebase init firestore"
          printf "\n"
          firebase login
          firebase init firestore
          if [ -f "$PROJECT_DIR/firebase.json" ]; then
            node -e "
              const fs = require('fs');
              const f = '$PROJECT_DIR/firebase.json';
              const j = JSON.parse(fs.readFileSync(f, 'utf8'));
              if (j.firestore) j.firestore.rules = 'firebase/firestore.rules';
              fs.writeFileSync(f, JSON.stringify(j, null, 2));
            " && log_ok "firebase.json rules path set to firebase/firestore.rules" \
              || log_warn "Could not patch firebase.json — check it manually"
          else
            log_warn "firebase init did not produce firebase.json"
            log_warn "Set rules manually: Firestore → Rules tab → Publish"
            log_info "Or run: cd ~/career-canvas && firebase init firestore && firebase deploy --only firestore:rules"
          fi
        fi

        if [ -f "$PROJECT_DIR/firebase.json" ]; then
          node -e "
            const fs = require('fs');
            const f = '$PROJECT_DIR/firebase.json';
            const j = JSON.parse(fs.readFileSync(f, 'utf8'));
            if (j.firestore) j.firestore.rules = 'firebase/firestore.rules';
            fs.writeFileSync(f, JSON.stringify(j, null, 2));
          " && log_ok "firebase.json verified — rules path: firebase/firestore.rules" \
            || log_warn "Could not patch firebase.json — check it manually"
          log_info "Deploying Firestore rules..."
          firebase deploy --only firestore:rules
          if [ $? -eq 0 ]; then
            log_ok "Firestore rules deployed"
          else
            log_warn "Deploy failed — try: firebase login, then re-run"
          fi
        fi
      else
        log_info "Skipped — run manually: firebase deploy --only firestore:rules"
        log_info "Note: requires firebase.json — run 'firebase init firestore' first if missing"
      fi
    else
      log_warn "firebase/firestore.rules not found — skipping rules deploy"
    fi
  else
    log_warn "Firebase CLI not installed — skipping rules deploy"
    log_info "Install later: npm install -g firebase-tools"
    log_info "Then: firebase login && firebase init firestore && firebase deploy --only firestore:rules"
  fi

  separator

  # ── MODULE 9 — Android storage mirror ──────────────────────
  log_step "MODULE 9 · Android storage mirror (optional)"

  if [ "$STORAGE_AVAILABLE" = true ]; then
    if ask_yn "Copy project to $MIRROR_DIR for viewing/sharing?"; then
      mkdir -p "$MIRROR_DIR"
      if command -v rsync >/dev/null 2>&1; then
        rsync -a --exclude='.git' --exclude='node_modules' \
          "$PROJECT_DIR/" "$MIRROR_DIR/"
      else
        cp -r "$PROJECT_DIR/." "$MIRROR_DIR/"
      fi
      if [ $? -eq 0 ]; then
        log_ok "Mirror created: $MIRROR_DIR"
        log_warn "Mirror is for viewing/sharing only — always work from ~/career-canvas"
      else
        log_warn "Mirror copy had issues"
      fi
    else
      log_info "Mirror skipped"
    fi
  else
    log_warn "Android storage not available — mirror skipped"
  fi

  separator

  # ── MODULE 10 — Helper scripts ─────────────────────────────
  log_step "MODULE 10 · Generating helper scripts"

  cat > "$PROJECT_DIR/start.sh" <<'STARTSH'
#!/data/data/com.termux/files/usr/bin/bash
# CareerCanvas — Bot Start Script

RED='\033[1;31m'; GREEN='\033[1;32m'; YELLOW='\033[1;33m'
CYAN='\033[1;36m'; WHITE='\033[1;37m'; DIM='\033[2m'
BOLD='\033[1m'; RESET='\033[0m'

PROJECT_DIR="$HOME/career-canvas"
BOT_DIR="$PROJECT_DIR/bot"

clear
printf "\n${CYAN}${BOLD}  ╔══════════════════════════════════════════╗${RESET}\n"
printf "${CYAN}${BOLD}  ║   🎨  CareerCanvas  •  Bot Launcher      ║${RESET}\n"
printf "${CYAN}${BOLD}  ╚══════════════════════════════════════════╝${RESET}\n\n"

[ ! -d "$BOT_DIR" ] && \
  printf "${RED}  ✘  bot/ not found: $BOT_DIR${RESET}\n\n" && exit 1

cd "$BOT_DIR" || { printf "${RED}  ✘  Cannot cd into $BOT_DIR${RESET}\n"; exit 1; }
printf "${GREEN}  ✔  Working directory: $(pwd)${RESET}\n\n"

if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs) 2>/dev/null
  printf "${GREEN}  ✔  .env loaded${RESET}\n"
fi

if [ ! -d "node_modules" ]; then
  printf "${YELLOW}  ⚠  node_modules missing — running npm install in bot/...${RESET}\n\n"
  npm install
fi

printf "\n${CYAN}${BOLD}  ▶  Starting CareerCanvas bot...${RESET}\n\n"
printf "${DIM}  ──────────────────────────────────────────${RESET}\n\n"

node index.js
STARTSH

  chmod +x "$PROJECT_DIR/start.sh"
  log_ok "start.sh created"

  separator

  # ── MODULE 11 — Shell aliases ───────────────────────────────
  log_step "MODULE 11 · Shell shortcuts"

  BASHRC="$HOME/.bashrc"
  [ ! -f "$BASHRC" ] && touch "$BASHRC"

  add_alias() {
    local NAME="$1"
    local CMD="$2"
    if grep -q "alias $NAME=" "$BASHRC" 2>/dev/null; then
      log_warn "Alias '$NAME' already in .bashrc — skipping"
    else
      printf "\nalias %s='%s'\n" "$NAME" "$CMD" >> "$BASHRC"
      log_ok "Alias added: $NAME"
    fi
  }

  if ask_yn "Add shortcut 'cc' (go to ~/career-canvas)?"; then
    add_alias "cc" "cd $PROJECT_DIR"
  fi

  if ask_yn "Add shortcut 'ccstart' (launch bot)?"; then
    add_alias "ccstart" "bash $PROJECT_DIR/start.sh"
  fi

  if ask_yn "Add shortcut 'ccrun' (run this script)?"; then
    add_alias "ccrun" "bash $PROJECT_DIR/careercanvas.sh"
  fi

  log_info "Run 'source ~/.bashrc' to activate shortcuts now"
  separator

  # ── MODULE 12 — Summary ─────────────────────────────────────
  printf "\n"
  printf "${GREEN}${BOLD}  ╔════════════════════════════════════════════════╗${RESET}\n"
  printf "${GREEN}${BOLD}  ║   🎉  CareerCanvas Setup Complete!             ║${RESET}\n"
  printf "${GREEN}${BOLD}  ╚════════════════════════════════════════════════╝${RESET}\n"
  printf "\n"
  printf "${GREEN}  ✔  Project root:        $PROJECT_DIR${RESET}\n"
  printf "${GREEN}  ✔  Git configured${RESET}\n"
  printf "${GREEN}  ✔  Dependencies installed${RESET}\n"
  printf "${GREEN}  ✔  bot/node_modules ready${RESET}\n"
  printf "${GREEN}  ✔  serviceAccountKey.json in bot/ (local only)${RESET}\n"
  printf "${GREEN}  ✔  Helper scripts generated${RESET}\n"
  [ "$STORAGE_AVAILABLE" = true ] && \
    printf "${GREEN}  ✔  Android mirror:      $MIRROR_DIR${RESET}\n"
  printf "\n"
  printf "${DIM}  ──────────────────────────────────────────${RESET}\n"
  printf "\n"
  printf "${CYAN}${BOLD}  What to do next:${RESET}\n\n"
  printf "  ${WHITE}bash ~/career-canvas/start.sh${RESET}      — run the bot locally\n"
  printf "  ${WHITE}bash ~/career-canvas/careercanvas.sh${RESET} — push to GitHub\n"
  printf "  ${WHITE}source ~/.bashrc${RESET}                   — activate shortcuts\n"
  printf "\n"
  printf "  ${DIM}Render env vars to set in dashboard:${RESET}\n"
  printf "  ${DIM}  TELEGRAM_BOT_TOKEN, ADMIN_CHAT_ID, FIREBASE_STORAGE_BUCKET${RESET}\n"
  printf "  ${DIM}  + upload serviceAccountKey.json as a Secret File${RESET}\n"
  printf "\n"

  separator

  # ── Offer GitHub push after setup ───────────────────────────
  printf "\n"
  if ask_yn "Push CareerCanvas to GitHub now?"; then
    printf "\n"
    separator
    run_github_push
  else
    log_info "Skipped — select 'GitHub Push' next time you run this script"
  fi
}

# ════════════════════════════════════════════════════════════
#  MAIN MENU
# ════════════════════════════════════════════════════════════
clear
printf "\n"
printf "${CYAN}${BOLD}  ╔════════════════════════════════════════════════╗${RESET}\n"
printf "${CYAN}${BOLD}  ║   🎨  CareerCanvas  •  Termux Manager          ║${RESET}\n"
printf "${CYAN}${BOLD}  ║   Portfolio Site + Telegram Admin Bot          ║${RESET}\n"
printf "${CYAN}${BOLD}  ╚════════════════════════════════════════════════╝${RESET}\n"
printf "${DIM}  Source of truth: ~/career-canvas${RESET}\n"
printf "\n"
separator
printf "\n"
printf "  ${WHITE}What would you like to do?${RESET}\n"
printf "\n"
printf "  ${CYAN}${BOLD}  1)${RESET}  ${WHITE}Setup${RESET}         — install environment, Firebase, dependencies\n"
printf "  ${CYAN}${BOLD}  2)${RESET}  ${WHITE}GitHub Push${RESET}   — commit and push to GitHub\n"
printf "  ${CYAN}${BOLD}  3)${RESET}  ${WHITE}Exit${RESET}\n"
printf "\n"
printf "  ${WHITE}Choice (1/2/3): ${RESET}"
read -r MAIN_CHOICE
printf "\n"
separator

case "$MAIN_CHOICE" in
  1)
    run_setup
    ;;
  2)
    run_github_push
    ;;
  3)
    printf "\n"
    log_info "Goodbye!"
    printf "\n"
    exit 0
    ;;
  *)
    die "Invalid choice — run the script again and enter 1, 2, or 3"
    ;;
esac
