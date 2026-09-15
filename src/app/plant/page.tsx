import { Carol3DScreen } from "@/components/grimo/carol-3d-screen";

export default function PlantPage() {
  // The library's main destination is Carol's finished, interactive scene.
  // Keep the review URL as an explicit deep link, rather than sending people
  // to the older calibration scene with a different set of interactions.
  return <Carol3DScreen />;
}
