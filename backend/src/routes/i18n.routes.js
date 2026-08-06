import { Router } from "express";
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, "..", "locales");

const router = Router();

// GET /api/i18n/locales — list supported locales for the language
// selection screen.
router.get("/locales", (req, res) => {
  const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith(".json"));
  const locales = files.map((f) => f.replace(".json", ""));
  res.json(locales);
});

// GET /api/i18n/:locale — returns the translated string bundle. Falls
// back to English if the requested locale doesn't exist, so the app
// never renders raw keys instead of text.
router.get("/:locale", (req, res) => {
  const requested = req.params.locale.replace(/[^a-z-]/gi, ""); // basic sanitization
  const filePath = path.join(LOCALES_DIR, `${requested}.json`);

  try {
    const bundle = JSON.parse(readFileSync(filePath, "utf-8"));
    res.json(bundle);
  } catch {
    const fallback = JSON.parse(readFileSync(path.join(LOCALES_DIR, "en.json"), "utf-8"));
    res.json(fallback);
  }
});

export default router;
