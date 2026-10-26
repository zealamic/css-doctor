import type { Handle, RemixNode } from "remix/component";

export type DocumentProps = {
  title?: string;
  children: RemixNode;
  stylesheets?: string[];
};

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    const { children, stylesheets = [], title = "Remix 3 Test" } = handle.props;

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <title>{title}</title>

          {/* Global styles */}
          <link rel="stylesheet" href="/assets/app/styles/app.css" />
          <link rel="stylesheet" href="/assets/app/styles/styles-global.css" />
          <link rel="stylesheet" href="/assets/app/styles/styles-custom.scss" />

          {/* Page-specific styles */}
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
        </head>
        <body>{children}</body>
      </html>
    );
  };
}
