"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CarolWorld } from "./carol-3d-world";
import { GrimoEmotionMark } from "./grimo-emotion-mark";
import { MacaronIcon } from "./macaron-icon";

export function Carol3DScreen() {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<CarolWorld | null>(null);
  const [status, setStatus] = useState("キャロルを呼んでいます…");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [reaction, setReaction] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [showReference, setShowReference] = useState(false);
  const [paused, setPaused] = useState(false);
  const [outlineColor, setOutlineColor] = useState("#f2fbff");
  const [feeding, setFeeding] = useState(false);
  const [heartSequence, setHeartSequence] = useState<number | null>(null);
  const [tailStartleSequence, setTailStartleSequence] = useState<number | null>(null);
  const [foodMessage, setFoodMessage] = useState("");

  useEffect(() => {
    const target = host.current;
    if (!target) return;
    let cancelled = false;
    void import("./carol-3d-world").then(({ createCarolWorld }) => {
      if (cancelled) return;
      world.current = createCarolWorld(target, {
        onReady: () => { setReady(true); setStatus(""); },
        onError: message => { setError(true); setReady(false); setStatus(message); },
        onReaction: setReaction,
        onFeedState: setFeeding,
        onFeedHearts: setHeartSequence,
        onTailStartle: setTailStartleSequence,
      });
    }).catch(() => {
      if (!cancelled) { setError(true); setStatus("3D表示を開始できませんでした。対応ブラウザで再読み込みしてください。"); }
    });
    return () => { cancelled = true; world.current?.dispose(); world.current = null; };
  }, [attempt]);

  function handleFeed() {
    // This route is a visual check surface. It deliberately does not read,
    // spend, or mint the user's persisted macarons.
    if (feeding) return;
    world.current?.act("feed");
    setFoodMessage("キャロルはマカロンを見つめ、口元で受け取った。");
  }

  return <main className="carol3d-page">
    <header className="carol3d-header">
      <div><p className="carol3d-eyebrow">GRIMOIRE / 小さな雲の上</p><h1>キャロル</h1>
        <p className="carol3d-edition">{showReference ? "原画 · 比較用" : "3D試作品 · 原画からの再制作"}</p></div>
      <Link href="/" className="carol3d-back">ホームへ</Link>
    </header>
    <div ref={host} className="carol3d-stage" tabIndex={0} role="region"
      aria-label="キャロルとの触れ合い。直接なでるか、下のボタンで操作できます。"
      aria-describedby="carol3d-help" />
    {heartSequence !== null && <div className="carol3d-hearts" key={heartSequence} aria-hidden="true">
      {[0, 1, 2, 3, 4].map(index => <GrimoEmotionMark key={index} kind="heart" className={`carol3d-heart carol3d-heart-${index + 1}`} />)}
    </div>}
    {tailStartleSequence !== null && <div className="carol3d-tail-startle" key={tailStartleSequence} aria-hidden="true">
      <GrimoEmotionMark kind="exclamation" className="carol3d-exclamation" />
    </div>}
    <div className="carol3d-feed-actions" aria-label="キャロルに食べ物をあげる">
      <Button type="button" className="carol3d-feed-button" disabled={!ready || showReference || paused || feeding} onClick={handleFeed}>
        <MacaronIcon className="carol3d-food-icon" />
        {feeding ? "キャロルが食べています…" : "マカロンをあげる（チェック用）"}
      </Button>
    </div>
    {status && <div className="carol3d-loading" role={error ? "alert" : "status"}>
      <p>{status}</p>
      {error && <Button variant="outline" onClick={() => {
        setError(false); setReady(false); setShowReference(false); setPaused(false);
        setStatus("キャロルを呼んでいます…"); setAttempt(a => a+1);
      }}>再読み込み</Button>}
    </div>}
    <footer className="carol3d-footer">
      <p id="carol3d-help">そっと触れて、ゆっくりなでて。</p>
      <div className="carol3d-touch-actions" aria-label="触れ合いの操作">
        <Button disabled={!ready || showReference || paused || feeding} onClick={() => world.current?.act("pet")}>なでる</Button>
        <Button variant="ghost" disabled={!ready || showReference || paused || feeding} onClick={() => world.current?.act("poke")}>つつく</Button>
        <Button variant="ghost" disabled={!ready || showReference || paused || feeding} onClick={() => world.current?.act("hold")}>そっと押す</Button>
      </div>
      <div className="carol3d-camera-actions" aria-label="視点の操作">
        <Button variant="ghost" disabled={!ready} aria-label="左から見る" onClick={() => world.current?.act("left")}>←</Button>
        <Button variant="ghost" disabled={!ready} onClick={() => world.current?.act("front")}>正面へ</Button>
        <Button variant="ghost" disabled={!ready} aria-label="右から見る" onClick={() => world.current?.act("right")}>→</Button>
        <Button variant="ghost" disabled={!ready} aria-label="遠ざかる" onClick={() => world.current?.act("zoomOut")}>−</Button>
        <Button variant="ghost" disabled={!ready} aria-label="近づく" onClick={() => world.current?.act("zoomIn")}>＋</Button>
      </div>
      <p className="carol3d-hint">背景をわずかにドラッグ · 2本指で拡大</p>
      <div className="carol3d-compare-actions">
        <Button variant="ghost" size="sm" disabled={!ready || feeding} aria-pressed={showReference} onClick={() => {
          world.current?.setReference(!showReference); setShowReference(!showReference);
        }}>{showReference ? "3Dに戻る" : "原画と見比べる"}</Button>
        <Button variant="ghost" size="sm" disabled={!ready || showReference || feeding} aria-pressed={paused} onClick={() => {
          world.current?.setPaused(!paused); setPaused(!paused);
        }}>{paused ? "動きを再開" : "動きを止める"}</Button>
        <label className="carol3d-outline-control">
          <span>輪郭線</span>
          <input type="color" value={outlineColor} aria-label="輪郭線の色" onChange={event => {
            setOutlineColor(event.target.value); world.current?.setOutlineColor(event.target.value);
          }} />
          <output aria-live="polite">{outlineColor.toUpperCase()}</output>
        </label>
      </div>
      <p className="sr-only" aria-live="polite">{reaction}</p>
      <p className="sr-only" aria-live="polite">{foodMessage}</p>
    </footer>
  </main>;
}
