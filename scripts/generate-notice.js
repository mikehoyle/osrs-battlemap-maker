const fs = require("fs");
const { execSync } = require("child_process");

const license = fs.readFileSync("ORIGINAL_LICENSE");
const licenseWithNewline = Buffer.concat([license, Buffer.from("\n", "utf8")]);
fs.writeFileSync("NOTICE", licenseWithNewline);
execSync("npx legal-notice >> NOTICE", { stdio: "inherit" });

// Copy to public folder for runtime access
fs.copyFileSync("NOTICE", "public/NOTICE");
