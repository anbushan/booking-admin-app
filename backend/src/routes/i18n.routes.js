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

// GET /api/i18n/:locale — returns the translated string bundle for a
// locale this server actually has a file for. Used to silently 200 with
// English content when the requested locale was missing — but the
// mobile client merges this response *over* its own correctly bundled
// copy of that locale (see I18nContext.tsx applyLocale), so a silent
// English substitution here would overwrite an otherwise-fine bundled
// Tamil/Kannada/etc. translation with English text instead of just
// leaving it alone. 404 lets the client tell the difference and skip
// the merge, so a backend that's simply behind on locale files (hasn't
// been redeployed with a newly added language yet) degrades to "use the
// bundled copy as-is" rather than "silently corrupt the bundled copy".
router.get("/:locale", (req, res) => {
  const requested = req.params.locale.replace(/[^a-z-]/gi, ""); // basic sanitization
  const filePath = path.join(LOCALES_DIR, `${requested}.json`);

  try {
    const bundle = JSON.parse(readFileSync(filePath, "utf-8"));
    res.json(bundle);
  } catch {
    res.status(404).json({ error: "Locale not found on this server." });
  }
});

export default router;
