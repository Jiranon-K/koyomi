import { FollowButton } from "./follow-button";
import type { FollowedShow } from "./service";

type ShowListProps = { id: string; title: string; shows: readonly FollowedShow[] };

export function ShowList({ id, title, shows }: ShowListProps) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="border-b border-foreground pb-2 font-display text-3xl leading-none">
        {title}
      </h2>
      <ul>
        {shows.map((show) => (
          <li
            key={show.route}
            className="flex items-center justify-between gap-4 border-b border-border py-3"
          >
            <span>{show.title}</span>
            <FollowButton showRoute={show.route} title={show.title} followed />
          </li>
        ))}
      </ul>
    </section>
  );
}
