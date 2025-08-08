import { GameCategory } from "@/components/GameCategory";
import React from "react";
const gameDitailInfo = [
  {
    date: "2025年7月26日",
    gameRool: "公式戦",
    gameCategory: "GBNリーグ",
    reagStage: "4回戦",
    battingFirstTeam: "EXODUS",
    fieldingFirstTeam: "ダークス",
    battingFirstTeamScore1: "0",
    battingFirstTeamScore2: "0",
    battingFirstTeamScore3: "0",
    battingFirstTeamScore4: "0",
    battingFirstTeamScore5: "2",
    battingFirstTeamScore6: "0",
    battingFirstTeamScore7: "3",
    battingFirstTeamScore: "5",
    fieldingFirstTeamScore1: "0",
    fieldingFirstTeamScore2: "7",
    fieldingFirstTeamScore3: "7",
    fieldingFirstTeamScore4: "7",
    fieldingFirstTeamScore5: "7",
    fieldingFirstTeamScore6: "7",
    fieldingFirstTeamScore7: "7",
    fieldingFirstTeamScore: "7",
  },
];
export default function page() {
  return (
    <>
      <h1>試合詳細</h1>
      <table>
        <thead>
          <tr>
            <th>チーム名</th>
            <th>1</th>
            <th>2</th>
            <th>3</th>
            <th>4</th>
            <th>5</th>
            <th>6</th>
            <th>7</th>
            <th>R</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>チームA</th>
            <td>1</td>
            <td>0</td>
            <td>2</td>
            <td>0</td>
            <td>1</td>
            <td>0</td>
            <td>0</td>
            <td>6</td>
          </tr>
          <tr>
            <th>チームB</th>
            <td>0</td>
            <td>3</td>
            <td>0</td>
            <td>1</td>
            <td>0</td>
            <td>1</td>
            <td>0</td>
            <td>6</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
