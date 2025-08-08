import React from "react";
import { Years } from "../../components/Years";
import { Month } from "../../components/Month";
import { GameCategory } from "../../components/GameCategory";
import { GameList } from "@/components/GameList";
import { Headline1 } from "@/components/Headline1";

export default function page() {
  return (
    <>
      <Headline1>試合一覧</Headline1>
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
