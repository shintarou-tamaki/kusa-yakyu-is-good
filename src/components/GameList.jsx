import React from "react";
const gameRisultLight = [
  {
    date: "2025年7月26日",
    battingFirstTeam: "EXODUS",
    fieldingFirstTeam: "ダークス",
    battingFirstTeamScore: "5",
    fieldingFirstTeamScore: "7",
  },
  {
    date: "2025年7月25日",
    battingFirstTeam: "EXODUS",
    fieldingFirstTeam: "レイダース",
    battingFirstTeamScore: "9",
    fieldingFirstTeamScore: "2",
  },
  {
    date: "2025年7月24日",
    battingFirstTeam: "T-Jokers",
    fieldingFirstTeam: "EXODUS",
    battingFirstTeamScore: "4",
    fieldingFirstTeamScore: "18",
  },
  {
    date: "2025年7月23日",
    battingFirstTeam: "EXODUS",
    fieldingFirstTeam: "風船会FARAWAYS",
    battingFirstTeamScore: "4",
    fieldingFirstTeamScore: "8",
  },
  {
    date: "2025年7月22日",
    battingFirstTeam: "EXODUS",
    fieldingFirstTeam: "滝野川ブルーウイングス",
    battingFirstTeamScore: "5",
    fieldingFirstTeamScore: "6",
  },
];

export const GameList = () => {
  return (
    <>
      {gameRisultLight.map((grl, index) => (
        <div key={index}>
          <p>{grl.date}</p>
          <div>{grl.battingFirstTeam}</div>
          <div>
            <span>{grl.battingFirstTeamScore}</span>
            <span>-</span>
            <span>{grl.fieldingFirstTeamScore}</span>
          </div>
          <div>{grl.fieldingFirstTeam}</div>
        </div>
      ))}
    </>
  );
};
