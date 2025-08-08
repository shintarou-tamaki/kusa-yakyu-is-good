import React from "react";
import { Button } from "./ui/button";

export const Header = () => {
  return (
    <header className="flex justify-between items-center p-10">
      <div className="font-bold text-2xl">草野球 is Good</div>
      <div className="flex gap-5">
        <Button>ログイン</Button>
        <Button>新規登録</Button>
      </div>
    </header>
  );
};
