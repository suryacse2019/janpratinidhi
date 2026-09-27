import { Languages } from "lucide-react";
import { setLanguage, useLanguage, t } from "../i18n";
import "../i18n/language.css";
export function LanguageSwitcher() {
  const language = useLanguage();
  return (
    <label className="language-switcher">
      <Languages size={16} aria-hidden="true" />
      <select
        aria-label={t("Language")}
        value={language}
        onChange={(event) => setLanguage(event.target.value === "hi" ? "hi" : "en")}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="hi" lang="hi">
          हिन्दी
        </option>
      </select>
    </label>
  );
}
