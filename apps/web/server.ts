import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initWebSocketServer } from "./lib/websocket";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl).catch((err) => {
      console.error("[server] Erro ao processar request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    });
  });

  initWebSocketServer(server);

  server.listen(port, "0.0.0.0", () => {
    console.log(`[server] Pronto em http://0.0.0.0:${port}`);
  });
});
