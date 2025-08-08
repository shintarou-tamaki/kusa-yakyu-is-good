"use client";
import React from "react";
import { useState } from "react";

const gameYears = [
  {
    year: "2025",
  },
  {
    year: "2024",
  },
  {
    year: "2023",
  },
  {
    year: "2022",
  },
  {
    year: "2021",
  },
  {
    year: "2020",
  },
  {
    year: "2019",
  },
  {
    year: "2018",
  },
  {
    year: "2017",
  },
];

export const Years = () => {
  const [years, setYears] = useState("年");
  return (
    <select name="年" value={years} onChange={(e) => setYears(e.target.value)}>
      {gameYears.map((gy, index) => (
        <option key={index} value={gy.year}>
          {gy.year}
        </option>
      ))}
    </select>
  );
};
