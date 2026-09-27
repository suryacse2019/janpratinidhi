/** Central URL matching for the public site and its feature pages. */
export type AppRoute =
  | { name: "admin" }
  | { name: "dashboard" }
  | { name: "directory" }
  | { name: "representative"; identifier: string }
  | { name: "home" };

export function resolveRoute(pathname: string): AppRoute {
  if (pathname.startsWith("/admin")) return { name: "admin" };
  if (pathname === "/dashboard") return { name: "dashboard" };
  if (pathname === "/politician" || pathname === "/politician/") return { name: "directory" };
  const representative = pathname.match(/^\/representatives\/([^/]+)\/?$/);
  if (representative)
    return { name: "representative", identifier: decodeURIComponent(representative[1]) };
  return { name: "home" };
}
