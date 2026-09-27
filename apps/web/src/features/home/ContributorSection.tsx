import { t } from "../../i18n";
import { useEffect, useState } from "react";
import { ArrowUpRight, Github } from "lucide-react";

const REPOSITORY_URL = "https://github.com/suryacse2019/janpratinidhi";
const CONTRIBUTORS_URL = `${REPOSITORY_URL}/graphs/contributors`;
const CONTRIBUTORS_API =
  "https://api.github.com/repos/suryacse2019/janpratinidhi/contributors?per_page=100";

type Contributor = {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
};

export function ContributorSection() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(CONTRIBUTORS_API, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load contributors");
        return response.json() as Promise<Contributor[]>;
      })
      .then((data) =>
        setContributors(
          data.filter((person) => person.login && person.html_url && person.avatar_url),
        ),
      )
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <section id="contribute" className="contributors-section" aria-labelledby="contributors-title">
      <div className="contributors-heading">
        <span className="contributors-icon">
          <Github size={19} />
        </span>
        <div>
          <div className="eyebrow small-eyebrow">
            {t("COMMUNITY") + " "}
            <span className="heading-rule" />
          </div>
          <h2 id="contributors-title">
            {t("Built by") + " "}
            <em>{t("Contributors")}</em>
          </h2>
          <p>
            {t(
              "Jan Pratinidhi is open source and community-driven. Meet the people making Indian democracy more transparent.",
            )}
          </p>
        </div>
      </div>
      {loading ? (
        <p className="contributors-state" role="status">
          {t("Loading contributors from GitHub…")}
        </p>
      ) : error ? (
        <p className="contributors-state">
          {t("Contributor profiles are temporarily unavailable.")}{" "}
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            {t("Visit the project on GitHub") + " "}
            <ArrowUpRight size={13} />
          </a>
        </p>
      ) : contributors.length ? (
        <div className="contributors-grid">
          {contributors.map((person) => (
            <a
              className="contributor-card"
              href={person.html_url}
              target="_blank"
              rel="noreferrer"
              key={person.login}
              aria-label={t("Open {name}'s GitHub profile", { name: person.login })}
            >
              <img src={person.avatar_url} alt="" loading="lazy" />
              <span className="contributor-details">
                <b>{person.login}</b>
                <small>
                  {person.contributions}{" "}
                  {person.contributions === 1 ? t("contribution") : t("contributions")}
                </small>
              </span>
              <ArrowUpRight className="contributor-link-icon" size={15} />
            </a>
          ))}
        </div>
      ) : (
        <p className="contributors-state">{t("Be the first to contribute to this project.")}</p>
      )}
      <a
        className="contributors-project-link"
        href={CONTRIBUTORS_URL}
        target="_blank"
        rel="noreferrer"
      >
        {t("View all contributors on GitHub") + " "}
        <ArrowUpRight size={14} />
      </a>
    </section>
  );
}
