export default {
  "*.{ts,tsx}": ["eslint --fix --no-warn-ignored", "prettier --write"],
  "*.{js,mjs,cjs,json,md,css,html,yml,yaml}": ["prettier --write"],
}
