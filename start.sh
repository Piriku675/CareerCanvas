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
