"use client";
import React from "react";
import { useState } from "react";

const gameMonth = [
  {
    month: "月",
  },
  {
    month: "1",
  },
  {
    month: "2",
  },
  {
    month: "3",
  },
  {
    month: "4",
  },
  {
    month: "5",
  },
  {
    month: "6",
  },
  {
    month: "7",
  },
  {
    month: "8",
  },
  {
    month: "9",
  },
  {
    month: "10",
  },
  {
    month: "11",
  },
  {
    month: "12",
  },
];

export const Month = () => {
  const [months, setMonths] = useState("年");
  return (
    <select
      name="月"
      value={months}
      onChange={(e) => setMonths(e.target.value)}
    >
      {gameMonth.map((gm, index) => (
        <option key={index} value={gm.month}>
          {gm.month}
        </option>
      ))}
    </select>
  );
};
