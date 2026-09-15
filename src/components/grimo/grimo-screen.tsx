"use client";

import { BottomNav } from "@/components/navigation/bottom-nav";
import { useEffect, useState } from "react";
import { claimLoginMacaron, feedMacaron, getMacaronCount } from "@/lib/macaronDb";
import { CarolScene } from "./carol-scene";
import { CarolReviewControls } from "./carol-review-controls";
import { DEFAULT_CAROL_SETTINGS, type CarolSettingKey } from "./carol-settings";
import { MacaronIcon } from "./macaron-icon";

export function GrimoScreen() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_CAROL_SETTINGS);
  const [macarons, setMacarons] = useState(0);
  const [feeding, setFeeding] = useState(false);
  const [foodNonce, setFoodNonce] = useState(0);
  const [foodMessage, setFoodMessage] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = () => {
      // The root gate claims this too, but claiming before the read closes the
      // harmless first-render race when this route mounts before that effect.
      claimLoginMacaron().then(() => getMacaronCount()).then((count) => {
        if (active) setMacarons(count);
      }).catch((error) => console.error("[macaron] balance load failed:", error));
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, []);

  useEffect(() => {
    if (window.location.search !== "?review=1") return;
    const timer = window.setTimeout(() => setReviewOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!reviewOpen || window.location.search !== "?review=1") return;
    document.getElementById("carol-review-title")?.scrollIntoView({ block: "start" });
  }, [reviewOpen]);

  async function handleFeed() {
    if (feeding) return;
    setFeeding(true);
    try {
      const result = await feedMacaron();
      if (!result) {
        setFoodMessage("マカロンがありません。タスクを登録・達成すると受け取れます。");
        return;
      }
      setMacarons(result.balance);
      setFoodNonce((value) => value + 1);
      setFoodMessage("キャロルはマカロンを頬ばって、うれしそうに星を揺らした。");
    } catch (error) {
      console.error("[macaron] feed failed:", error);
      setFoodMessage("マカロンをあげられませんでした。もう一度試してください。");
    } finally {
      setFeeding(false);
    }
  }

  return (
    <main className={`grimo-page${reviewOpen ? " grimo-page-reviewing" : ""}`}>
      <CarolScene settings={settings} onOpenReview={() => setReviewOpen((open) => !open)} reviewOpen={reviewOpen} foodNonce={foodNonce} />
      <p className="grimo-food-note">タスクを登録・達成、または今日最初の訪問でマカロンを受け取れます。</p>
      <p className="sr-only" aria-live="polite">{foodMessage}</p>
      <div className="grimo-feed-actions" aria-label="キャロルに食べ物をあげる">
        <button type="button" className="grimo-feed-button" disabled={feeding || macarons === 0} onClick={handleFeed}>
          <MacaronIcon className="grimo-food-icon" />
          {feeding ? "あげています…" : "マカロンをあげる"}
          <span className="grimo-macaron-count" aria-label={`マカロン ${macarons}個`}>×{macarons}</span>
        </button>
      </div>
      {reviewOpen && <CarolReviewControls
        settings={settings}
        onChange={(key: CarolSettingKey, value) => setSettings((current) => ({ ...current, [key]: value }))}
        onReset={() => setSettings(DEFAULT_CAROL_SETTINGS)}
      />}
      <BottomNav />
    </main>
  );
}
