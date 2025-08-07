import Image from "next/image";
import styles from "./page.module.css";
import { Todofuken } from "../components/Todofuken";
import { Shikutyoson } from "../components/Shikutyoson";

export default function Home() {
  return (
    <>
      <main>
        <section>
          <div>
            <h1>草野球 is Good</h1>
            <p>
              草野球・ソフトボールが好きな人たちの記録を綴る
              <br />
              全ての機能が無料のスコア登録サービス
            </p>
          </div>
          <div>
            <label>チームを探す</label>
            <Todofuken />
            <Shikutyoson />
            <input type="text" />
            <button>検索</button>
          </div>
        </section>
        <section>
          <h2>使い方、特徴</h2>
          <p>草野球 is Goodは以下の3点が特徴のサービスです</p>
          <div>
            <h3>全ての機能が無料で使えます</h3>
            <p>
              草野球 is
              Goodは、全ての機能が無料で利用でき、過去の試合の記録も無制限で登録できます。
            </p>
          </div>
          <div>
            <h3>チーム運営タスクの記録もできます</h3>
            <p>
              安打数や奪三振数だけでなく、グランド確保係や道具保管・持ってくる係なども記録でき、称賛する事ができます。
            </p>
          </div>
          <div>
            <h3>個人でも試合の記録ができます</h3>
            <p>
              チームが試合の記録をしていなくても、助っ人だけで野球を楽しんでいる人でも、個人として試合の記録をする事ができます。
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
