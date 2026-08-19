import { Router } from "express";
import { getAppConfig } from "../lib/appConfig.js";

const router = Router();

// GET /api/app-status — public, no auth. Checked once at app launch
// (see SplashOnboardingScreens.tsx) so a maintenance-mode toggle in
// admin (Settings > App configuration) takes effect for new app opens
// without needing an app-store update. Deliberately minimal — nothing
// here should ever require a signed-in user just to ask "can I use the
// app right now".
router.get("/", async (req, res) => {
  const config = await getAppConfig();
  res.json({
    maintenanceMode: config.maintenanceMode,
    maintenanceMessage: config.maintenanceMessage || null,
    // Client compares its own app.json version against this (see
    // SplashOnboardingScreens.tsx) and blocks with an "update required"
    // screen if it's below. Comparison happens client-side, same as
    // maintenanceMode — this route just hands back the threshold.
    minSupportedVersion: config.minSupportedVersion,
  });
});

export default router;
