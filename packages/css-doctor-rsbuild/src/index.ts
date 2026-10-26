import type { RsbuildPlugin } from "@rsbuild/core";

import { CssDoctorRspackPlugin } from "./rspack-plugin";
import type { CssDoctorRsbuildOptions } from "./types";

/**
 * Adds the css-doctor Rspack plugin to production Rsbuild builds.
 */
export const pluginCssDoctor = (
  options: CssDoctorRsbuildOptions = {},
): RsbuildPlugin => ({
  name: "css-doctor:rsbuild",
  apply: "build",
  setup(api) {
    if (api.context.bundlerType !== "rspack") {
      return;
    }

    api.modifyRspackConfig((config, { isProd }) => {
      if (!isProd || process.env.NODE_ENV !== "production") {
        return;
      }

      config.plugins ??= [];
      config.plugins.push(new CssDoctorRspackPlugin(options));
    });
  },
});

export type * from "./types";
