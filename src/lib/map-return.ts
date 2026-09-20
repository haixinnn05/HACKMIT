const FROM_MAP = "map";

/** Marks a link as opened from the home path, so Back can return there. */
export function withMapReturn(href: string): string {
  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const path = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}from=${FROM_MAP}${hash}`;
}

export function backFromMap(from: string | undefined, fallback: string): string {
  return from === FROM_MAP ? "/" : fallback;
}

export function openedFromMap(from: string | undefined): boolean {
  return from === FROM_MAP;
}
