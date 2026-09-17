const { execFileSync } = require("child_process");
const path = require("path");

// electron-builder's own identity resolution treats "-" as a literal
// keychain identity name to look up rather than the ad-hoc signing
// sentinel, so it silently skips signing (see build logs: "0 identities
// found"). Sign the app bundle ourselves after packaging instead - this is
// what Apple Silicon requires to launch at all; it's not a real certificate,
// just enough for macOS to accept the binary. Users still see one Gatekeeper
// "unidentified developer" prompt on first launch, which is expected and
// documented in the README.
module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);

  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit",
  });
};
