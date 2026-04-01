import App from "./App";
import NetworkSwitcher from "./components/NetworkSwitcher";

export default function AppWithNetworkSwitcher() {
  return (
    <>
      <div style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: "999",
      }}>
        <NetworkSwitcher />
      </div>
      <App />
    </>
  );
}
