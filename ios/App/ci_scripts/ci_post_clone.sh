#!/bin/sh
# Xcode Cloud: runs after the repo is cloned, before dependencies resolve.
# The Capacitor Swift packages live in node_modules, and the web bundle
# (App/App/public) is gitignored, so both have to be created here.
set -e

cd "$CI_PRIMARY_REPOSITORY_PATH"

# Xcode Cloud images don't ship Node.
export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1
brew install node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"

node -v
npm ci
npm run build
npx cap sync ios
