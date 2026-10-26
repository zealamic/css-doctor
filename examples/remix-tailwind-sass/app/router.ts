import { render } from "remix/middleware/render";
import { staticFiles } from "remix/middleware/static";
import { createRouter } from "remix/router";

import controller from "./actions/controller.tsx";
import { assets } from "./assets.ts";
import { routes } from "./routes.ts";

export const router = createRouter({
  middleware: [staticFiles("./public", { index: false }), render({ assets })],
});

router.map(routes, controller);
