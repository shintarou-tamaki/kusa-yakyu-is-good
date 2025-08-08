"use client";
import React from "react";
import { useState } from "react";

const gameCategory = [
  {
    cate: "全て",
  },
  {
    cate: "GBNリーグ",
  },
  {
    cate: "ねリーグ",
  },
  {
    cate: "練習試合",
  },
];

export const GameCategory = () => {
  const [gcategory, setGcategory] = useState("全て");
  return (
    <select
      name="ゲームカテゴリー"
      value={gcategory}
      onChange={(e) => setGcategory(e.target.value)}
    >
      {gameCategory.map((gc, index) => (
        <option key={index} value={gc.cate}>
          {gc.cate}
        </option>
      ))}
    </select>
  );
};
