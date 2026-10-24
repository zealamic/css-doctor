import type { ReactNode } from "react";

type CardProps = {
  title: string;
  children: ReactNode;
};

export default function Card({ title, children }: CardProps) {
  return (
    <article className="rounded-lg bg-white p-4 shadow-md">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-slate-600">{children}</p>
    </article>
  );
}
