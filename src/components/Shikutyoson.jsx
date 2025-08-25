"use client";
import React from "react";
import { useState } from "react";

export const Shikutyoson = () => {
  const [city, setCity] = useState("市区町村");
  return (
    <select
      name="市区町村"
      value={city}
      onChange={(e) => setCity(e.target.value)}
    >
      <option value="全て">全て</option>
      <option value="堺市">堺市</option>
    </select>
  );
};
