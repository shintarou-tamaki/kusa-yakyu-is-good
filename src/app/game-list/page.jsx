import React from "react";
import { Years } from "../../components/Years";
import { Month } from "../../components/Month";
import { GameCategory } from "../../components/GameCategory";
import { GameList } from "@/components/GameList";

export default function page() {
  return (
    <>
      <h1>試合一覧</h1>
      <section>
        <Years />
        <Month />
        <GameCategory />
      </section>
      <section>
        <GameList />
      </section>
    </>
  );
}
