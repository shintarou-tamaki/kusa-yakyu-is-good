"use client";
import React from "react";
import { useState } from "react";

export const PlayStyle = () => {
  const [plaustyle, setPlaustyle] = useState("プレイスタイル");
  return (
    <select
      name="プレイスタイル"
      value={plaustyle}
      onChange={(e) => setPlaustyle(e.target.value)}
    >
      <option value="全て">全て</option>
      <option value="軟式">軟式</option>
      <option value="ソフトボール">ソフトボール</option>
      <option value="ジュニア">ジュニア</option>
    </select>
  );
};
