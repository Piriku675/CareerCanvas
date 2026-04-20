#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
#   CareerCanvas — GitHub Push Helper
#   Always uses ~/career-canvas as root
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

PROJECT_DIR="$HOME/career-canvas"

# ── Banner ───────────────────────────────────────────────────
clear
printf "\n"
printf "${CYAN}${BOLD}  ╔════════════════════════════════════════════════╗${RESET}\n"
printf "${CYAN}${BOLD}  ║   🎨  CareerCanvas  •  GitHub Push Helper      ║${RESET}\n"
printf "${CYAN}${BOLD}  ╚════════════════════════════════════════════════╝${RESET}\n"
printf "\n"
separator

# ── Environment ──────────────────────────────────────────────
log_step "Environment"

[ ! -d "$PROJECT_DIR" ] && die "Project not found: $PROJECT_DIR"
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

# ── Git init ─────────────────────────────────────────────────
log_step "Git repository"

if [ ! -d ".git" ]; then
  git init -b main 2>/dev/null || { git init; git branch -m main 2>/dev/null; }
  log_ok "Initialised"
else
  log_ok "Repo exists (.git found)"
fi

separator

# ── Remote URL ───────────────────────────────────────────────
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

separator

# ── Stage & commit ───────────────────────────────────────────
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

# ── Push ─────────────────────────────────────────────────────
log_step "Pushing to GitHub"
printf "\n"

git push -u origin main
PUSH_EXIT=$?
printf "\n"

if [ $PUSH_EXIT -eq 0 ]; then
  printf "${GREEN}${BOLD}  ╔════════════════════════════════════════════════╗${RESET}\n"
  printf "${GREEN}${BOLD}  ║   🎉  CareerCanvas pushed to GitHub!           ║${RESET}\n"
  printf "${GREEN}${BOLD}  ╚════════════════════════════════════════════════╝${RESET}\n\n"
  exit 0
fi

# ── Auth retry ───────────────────────────────────────────────
separator
log_warn "Push failed — possible causes: not authenticated, wrong URL, no access"
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

  # Remove PAT from remote URL after push for security
  git remote set-url origin "$REPO_URL"

  if [ $RETRY_EXIT -eq 0 ]; then
    printf "${GREEN}${BOLD}  ╔════════════════════════════════════════════════╗${RESET}\n"
    printf "${GREEN}${BOLD}  ║   🎉  CareerCanvas pushed to GitHub!           ║${RESET}\n"
    printf "${GREEN}${BOLD}  ╚════════════════════════════════════════════════╝${RESET}\n\n"
    exit 0
  else
    die "Push failed — check PAT permissions and repo access"
  fi
else
  printf "\n"
  log_info "Skipped — run the script again when ready"
  exit 1
fi
