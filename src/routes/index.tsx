import { createFileRoute } from "@tanstack/react-router";
import { GameShell } from "@/components/game/GameShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Gilded Depths — Pixel Art Survival Action Game" },
      {
        name: "description",
        content:
          "Fight through 15 pixel-art dungeon rooms, level up, and slay bosses in this top-down keyboard-and-mouse survival action game.",
      },
      { property: "og:title", content: "The Gilded Depths — Pixel Art Survival Action Game" },
      {
        property: "og:description",
        content:
          "Top-down pixel-art roguelite: WASD to move, mouse to aim, level up to grow stronger as the depths grow deadlier.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main>
      <h1 className="sr-only">The Gilded Depths — top-down pixel art survival action game</h1>
      <GameShell />
    </main>
  );
}
