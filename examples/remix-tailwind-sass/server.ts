import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

import { router } from "./app/router.ts";

const port = Number(process.env.PORT ?? 44100);
const server = http.createServer(createRequestListener(router.fetch));

server.listen(port, () => {
  console.log(
    `Remix 3 css-doctor example listening on http://localhost:${port}`,
  );
});
