/**
 * Startup file for Hostinger (and any host that boots a Node app from a file
 * rather than an npm script).
 *
 * Why this exists
 * ---------------
 * When a Server Action calls redirect(), Next does not simply send a 303. It
 * fetches the redirect target from ITSELF, so it can stream the new page back
 * in the same response instead of making the browser do a second round trip.
 * It does the same when it has to forward an action to another worker.
 *
 * To make that internal request it needs to know its own address. `next start`
 * sets __NEXT_PRIVATE_ORIGIN to whatever it bound to. Booted any other way,
 * that variable is unset and Next guesses — and the guess is http://127.0.0.1:3000,
 * regardless of the port it is actually listening on and regardless of the Host
 * header. On a host that assigns the port (Hostinger does), nothing is on 3000,
 * so the internal fetch is refused and the log fills with:
 *
 *   failed to get redirect response   TypeError: fetch failed
 *   failed to forward action response TypeError: fetch failed
 *
 * Those are logged by Next, not thrown, so the user still gets redirected —
 * which is why the site mostly worked while the log looked alarming. It fires
 * on sign in, sign out, and every form that redirects on success.
 *
 * Setting the origin to the port we are really listening on fixes both, and
 * lets Next stream the redirect target as intended.
 */
const { createServer } = require("node:http");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";

// Must be set before the first request is handled. Respect an existing value
// in case the host already got this right.
if (!process.env.__NEXT_PRIVATE_ORIGIN) {
  process.env.__NEXT_PRIVATE_ORIGIN = `http://127.0.0.1:${port}`;
}

// Telling Next the real port also keeps request.url honest, which matters for
// anything that builds a redirect from it.
const app = next({ dev: false, dir: __dirname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      handle(req, res).catch((err) => {
        console.error("request failed", req.url, err);
        if (!res.headersSent) res.statusCode = 500;
        res.end("Internal Server Error");
      });
    }).listen(port, hostname, () => {
      console.log(`Brighttemp Booking Hub ready on http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error("failed to start", err);
    process.exit(1);
  });
