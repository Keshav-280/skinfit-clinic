#!/usr/bin/env node
/**
 * After `npx expo prebuild --platform ios`, confirms Info.plist allows http:// API.
 * Usage: npm run verify:ios-ats
 */
const fs = require("fs");
const path = require("path");

const plistPaths = [
  path.join(__dirname, "../ios/SkinFit/Info.plist"),
  path.join(__dirname, "../ios/mobile/Info.plist"),
];

const plist = plistPaths.find((p) => fs.existsSync(p));
if (!plist) {
  console.error("No ios Info.plist found. Run: npx expo prebuild --platform ios --clean");
  process.exit(1);
}

const text = fs.readFileSync(plist, "utf8");
const ok =
  text.includes("NSAllowsArbitraryLoads") &&
  (text.includes("<true/>") || text.includes("<true></true>"));

if (ok) {
  console.log("OK:", plist, "allows HTTP (NSAllowsArbitraryLoads).");
  process.exit(0);
}

console.error("MISSING ATS:", plist, "does not contain NSAllowsArbitraryLoads.");
console.error("Fix: set EXPO_PUBLIC_API_URL=http://... in mobile/.env then:");
console.error("  npx expo prebuild --platform ios --clean");
console.error("  npm run verify:ios-ats");
process.exit(1);
