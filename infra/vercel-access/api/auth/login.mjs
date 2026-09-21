import { relayAuth, publicOrigin } from "../_proxy.mjs";

export default async function handler(req, res) {
  return relayAuth(req, res, "/api/auth/login", (location) => {
    const url = new URL(location);
    if (
      url.hostname === "oauth.yandex.ru" ||
      url.hostname === "oauth.yandex.com"
    ) {
      url.searchParams.set(
        "redirect_uri",
        `${publicOrigin(req)}/api/auth/callback`,
      );
    }
    return url.toString();
  });
}
