import { TestHarness } from "./test-harness";
import { Demo } from "./demo/Demo";

const params = typeof window !== "undefined" ? window.location.search : "";
const isTestHarness = params.includes("test-harness");

export function App() {
  if (isTestHarness) return <TestHarness />;
  return <Demo />;
}
