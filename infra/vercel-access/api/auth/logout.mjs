import {
  relayAuth,
  rewriteWorkerLocation,
} from "../_proxy.mjs";

export default async function handler(req, res) {
  return relayAuth(
    req,
    res,
    "/api/auth/logout",
    (location) => rewriteWorkerLocation(req, location),
  );
}
