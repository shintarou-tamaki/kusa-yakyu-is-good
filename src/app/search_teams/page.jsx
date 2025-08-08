import React from "react";
import { Todofuken } from "../../components/Todofuken";
import { Shikutyoson } from "../../components/Shikutyoson";
import { PlayStyle } from "../../components/PlayStyle";
import { Headline1 } from "../../components/Headline1";

const teamInfo = [
  {
    teamNme: "EXODUS",
    teamLocation: "練馬区",
  },
  {
    teamNme: "ダークス",
    teamLocation: "練馬区",
  },
  {
    teamNme: "レイダース",
    teamLocation: "練馬区",
  },
  {
    teamNme: "T-Jokers",
    teamLocation: "練馬区",
  },
  {
    teamNme: "風船会FARAWAYS",
    teamLocation: "練馬区",
  },
  {
    teamNme: "滝野川ブルーウイングス",
    teamLocation: "練馬区",
  },
  {
    teamNme: "GENERAL",
    teamLocation: "練馬区",
  },
  {
    teamNme: "ベアハンターズ",
    teamLocation: "練馬区",
  },
  {
    teamNme: "BEAT",
    teamLocation: "練馬区",
  },
  {
    teamNme: "Wild Card",
    teamLocation: "練馬区",
  },
  {
    teamNme: "平成@ゆとりーと",
    teamLocation: "練馬区",
  },
];

export default function page() {
  return (
    <>
      <Headline1>チーム一覧</Headline1>
      <section>
        <div>
          <input type="text" defaultValue="チーム名" />
        </div>
        <Todofuken />
        <Shikutyoson />
        <PlayStyle />
        <div>
          <input type="checkbox" id="menbo" name="menbo" />
          <label htmlFor="menbo">メンバー募集中</label>
        </div>
      </section>
      <section>
        <div className="grid grid-cols-3 gap-4">
          {teamInfo.map((ti, index) => (
            <div key={index} className="p-3">
              <h3 className="font-bold text-2xl">{ti.teamNme}</h3>
              <p>{ti.teamLocation}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
