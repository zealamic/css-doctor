declare module "*.css";

declare module "*.module.css" {
  const classes: Record<string, string>;

  export default classes;
}

declare module "*.svg?react" {
  import type { FunctionComponent, SVGProps } from "react";

  const ReactComponent: FunctionComponent<SVGProps<SVGSVGElement>>;

  export default ReactComponent;
}
